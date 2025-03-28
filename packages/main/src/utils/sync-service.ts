import { promises as fs } from 'fs';
import path from 'path';
import { app } from 'electron';
import isDev from 'electron-is-dev';
import {
    listPdfMetadata,
    hasFileChanged,
} from './pdf-metadata';
import { downloadPdfFromUploadThing } from './pdf-downloader';
import { uploadSingleFile, getUploadedFiles } from './upload-service';

// Types for remote manifest
interface RemoteManifest {
    projectId: string;
    name: string;
    lastUpdated: string;
    files: RemoteFileEntry[];
}

interface RemoteFileEntry {
    manufacturer: string;
    partNumber: string;
    remoteUrl: string;
    versionHash: string;
    fileName: string;
    fileSize: number;
    lastUpdated: string;
}

// Types for sync results
interface SyncResult {
    success: boolean;
    syncedFiles: {
        downloaded: SyncedFileResult[];
        uploaded: SyncedFileResult[];
        upToDate: SyncedFileResult[];
        failed: SyncedFileResult[];
    };
    summary: {
        total: number;
        downloaded: number;
        uploaded: number;
        upToDate: number;
        failed: number;
    };
    error?: string;
}

interface SyncedFileResult {
    manufacturer: string;
    partNumber: string;
    fileName: string;
    localPath?: string;
    remoteUrl?: string;
    action: 'downloaded' | 'uploaded' | 'up-to-date' | 'failed';
    error?: string;
}

/**
 * Gets the path to the manifest JSON file on disk
 */
async function getManifestPath(projectId: string): Promise<string> {
    const userDataPath = isDev
        ? path.join(__dirname, '../../../..', 'data')
        : path.join(app.getPath('userData'), 'data');

    // Create manifest directory if it doesn't exist
    const manifestDir = path.join(userDataPath, 'manifests');
    await fs.mkdir(manifestDir, { recursive: true });

    return path.join(manifestDir, `manifest-${projectId}.json`);
}

/**
 * Loads a remote manifest from disk or creates a new one if it doesn't exist
 */
async function getManifest(projectId: string): Promise<RemoteManifest> {
    const manifestPath = await getManifestPath(projectId);

    try {
        const data = await fs.readFile(manifestPath, 'utf-8');
        return JSON.parse(data) as RemoteManifest;
    } catch (error) {
        // Create a new manifest if it doesn't exist
        const newManifest: RemoteManifest = {
            projectId,
            name: `Project ${projectId}`,
            lastUpdated: new Date().toISOString(),
            files: []
        };

        await saveManifest(newManifest);
        return newManifest;
    }
}

/**
 * Saves a manifest to disk
 */
async function saveManifest(manifest: RemoteManifest): Promise<void> {
    const manifestPath = await getManifestPath(manifest.projectId);
    manifest.lastUpdated = new Date().toISOString();
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}

/**
 * Updates a manifest with the latest metadata from uploaded files
 */
async function updateManifestFromUploads(projectId: string): Promise<RemoteManifest> {
    // Get the current manifest
    const manifest = await getManifest(projectId);

    // Get all uploaded files
    const uploads = await getUploadedFiles();

    // Update the manifest with the latest uploaded files
    manifest.files = uploads.map(metadata => ({
        manufacturer: metadata.manufacturer,
        partNumber: metadata.partNumber,
        remoteUrl: metadata.remoteUrl || '',
        versionHash: metadata.versionHash,
        fileName: metadata.fileName,
        fileSize: metadata.fileSize,
        lastUpdated: metadata.lastUpdated
    }));

    // Save the updated manifest
    await saveManifest(manifest);

    return manifest;
}

/**
 * Sync PDFs between local storage and UploadThing
 * 
 * This function:
 * 1. Updates the local manifest with the latest metadata from uploaded files
 * 2. Downloads any files that are in the manifest but not locally available
 * 3. Uploads any local files that are not in the manifest or have changed
 * 
 * @param projectId Unique identifier for the project/folder
 * @param forceRefresh If true, skip hash checks and force re-download/upload
 * @returns Results of the sync operation
 */
export async function syncPdfs(
    projectId: string,
    forceRefresh: boolean = false
): Promise<SyncResult> {
    try {
        // Results collection
        const result: SyncResult = {
            success: true,
            syncedFiles: {
                downloaded: [],
                uploaded: [],
                upToDate: [],
                failed: []
            },
            summary: {
                total: 0,
                downloaded: 0,
                uploaded: 0,
                upToDate: 0,
                failed: 0
            }
        };

        // Step 1: Update manifest with the latest uploaded files
        const manifest = await updateManifestFromUploads(projectId);

        // Step 2: List all local PDF metadata
        const localFiles = await listPdfMetadata();

        // Step 3: Download missing/outdated files based on manifest
        for (const remoteFile of manifest.files) {
            // Skip files with no remote URL
            if (!remoteFile.remoteUrl) continue;

            try {
                // Find matching local file
                const localMatch = localFiles.find(
                    local =>
                        local.manufacturer.toLowerCase() === remoteFile.manufacturer.toLowerCase() &&
                        local.partNumber.toLowerCase() === remoteFile.partNumber.toLowerCase()
                );

                let needsDownload = false;

                // Check if we need to download the file
                if (!localMatch) {
                    // No local match, need to download
                    needsDownload = true;
                } else if (forceRefresh) {
                    // Force refresh enabled, download regardless
                    needsDownload = true;
                } else if (localMatch.versionHash !== remoteFile.versionHash) {
                    // Hash mismatch, need to download
                    needsDownload = true;
                } else {
                    // File exists and hashes match, mark as up to date
                    result.syncedFiles.upToDate.push({
                        manufacturer: remoteFile.manufacturer,
                        partNumber: remoteFile.partNumber,
                        fileName: remoteFile.fileName,
                        localPath: localMatch.localPath,
                        remoteUrl: remoteFile.remoteUrl,
                        action: 'up-to-date'
                    });
                    result.summary.upToDate++;
                    continue;
                }

                if (needsDownload) {
                    // Download the file
                    const downloadResult = await downloadPdfFromUploadThing(
                        remoteFile.manufacturer,
                        remoteFile.partNumber,
                        remoteFile.remoteUrl,
                        forceRefresh
                    );

                    if (downloadResult.success) {
                        result.syncedFiles.downloaded.push({
                            manufacturer: remoteFile.manufacturer,
                            partNumber: remoteFile.partNumber,
                            fileName: remoteFile.fileName,
                            localPath: downloadResult.localPath,
                            remoteUrl: remoteFile.remoteUrl,
                            action: 'downloaded'
                        });
                        result.summary.downloaded++;
                    } else {
                        result.syncedFiles.failed.push({
                            manufacturer: remoteFile.manufacturer,
                            partNumber: remoteFile.partNumber,
                            fileName: remoteFile.fileName,
                            remoteUrl: remoteFile.remoteUrl,
                            action: 'failed',
                            error: downloadResult.error
                        });
                        result.summary.failed++;
                    }
                }
            } catch (error) {
                result.syncedFiles.failed.push({
                    manufacturer: remoteFile.manufacturer,
                    partNumber: remoteFile.partNumber,
                    fileName: remoteFile.fileName,
                    remoteUrl: remoteFile.remoteUrl,
                    action: 'failed',
                    error: error instanceof Error ? error.message : String(error)
                });
                result.summary.failed++;
            }
        }

        // Step 4: Upload new/changed local files that aren't in the manifest
        for (const localFile of localFiles) {
            try {
                // Skip files with no local path (shouldn't happen)
                if (!localFile.localPath) continue;

                // Find matching remote file
                const remoteMatch = manifest.files.find(
                    remote =>
                        remote.manufacturer.toLowerCase() === localFile.manufacturer.toLowerCase() &&
                        remote.partNumber.toLowerCase() === localFile.partNumber.toLowerCase()
                );

                let needsUpload = false;

                // Check if we need to upload the file
                if (!remoteMatch) {
                    // No remote match, need to upload
                    needsUpload = true;
                } else if (forceRefresh) {
                    // Force refresh enabled, upload regardless
                    needsUpload = true;
                } else if (localFile.versionHash !== remoteMatch.versionHash) {
                    // Hash mismatch, check if local file has actually changed
                    const hasChanged = await hasFileChanged(localFile.localPath);
                    needsUpload = hasChanged;
                }

                if (needsUpload) {
                    // Upload the file
                    const uploadResult = await uploadSingleFile(
                        localFile.localPath,
                        localFile.manufacturer,
                        localFile.partNumber
                    );

                    if (uploadResult.success && uploadResult.url) {
                        result.syncedFiles.uploaded.push({
                            manufacturer: localFile.manufacturer,
                            partNumber: localFile.partNumber,
                            fileName: localFile.fileName,
                            localPath: localFile.localPath,
                            remoteUrl: uploadResult.url,
                            action: 'uploaded'
                        });
                        result.summary.uploaded++;
                    } else {
                        result.syncedFiles.failed.push({
                            manufacturer: localFile.manufacturer,
                            partNumber: localFile.partNumber,
                            fileName: localFile.fileName,
                            localPath: localFile.localPath,
                            action: 'failed',
                            error: uploadResult.error
                        });
                        result.summary.failed++;
                    }
                } else if (!remoteMatch) {
                    // This is a local-only file that wasn't uploaded due to some reason
                    result.syncedFiles.failed.push({
                        manufacturer: localFile.manufacturer,
                        partNumber: localFile.partNumber,
                        fileName: localFile.fileName,
                        localPath: localFile.localPath,
                        action: 'failed',
                        error: 'File was not uploaded and no remote match found'
                    });
                    result.summary.failed++;
                }
            } catch (error) {
                result.syncedFiles.failed.push({
                    manufacturer: localFile.manufacturer,
                    partNumber: localFile.partNumber,
                    fileName: localFile.fileName,
                    localPath: localFile.localPath,
                    action: 'failed',
                    error: error instanceof Error ? error.message : String(error)
                });
                result.summary.failed++;
            }
        }

        // Update the total count
        result.summary.total = result.summary.downloaded + result.summary.uploaded + result.summary.upToDate + result.summary.failed;

        // Update manifest after uploads
        await updateManifestFromUploads(projectId);

        return result;
    } catch (error) {
        console.error('Error syncing PDFs:', error);
        return {
            success: false,
            syncedFiles: {
                downloaded: [],
                uploaded: [],
                upToDate: [],
                failed: []
            },
            summary: {
                total: 0,
                downloaded: 0,
                uploaded: 0,
                upToDate: 0,
                failed: 0
            },
            error: error instanceof Error ? error.message : String(error)
        };
    }
} 