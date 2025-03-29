import { promises as fs } from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { listPdfMetadata } from './pdf-metadata';
require('dotenv').config();

// Interface for manifest entries
interface ManifestEntry {
    remote_url: string;
    version_hash: string;
    file_size: number;
    manufacturer: string;
    last_updated: string;
}

// Interface for the complete manifest
interface PdfManifest {
    metadata: {
        generated_at: string;
        version: string;
    };
    files: Record<string, ManifestEntry>;
}

// Define UploadThing API response types
interface UploadThingSuccessResponse {
    data: {
        url: string;
        key: string;
    };
}

interface UploadThingErrorResponse {
    error: string;
}

type UploadThingResponse = UploadThingSuccessResponse | UploadThingErrorResponse;

/**
 * Generates a manifest file from the current PDF metadata
 * 
 * @param manifestName Name of the manifest (used as filename)
 * @returns Path to the generated manifest file
 */
export async function generateManifest(manifestName = 'manifest'): Promise<{
    success: boolean;
    manifestPath?: string;
    manifestData?: PdfManifest;
    error?: string;
}> {
    try {
        // Get all PDF metadata
        const metadataList = await listPdfMetadata();

        // Filter out entries without remote URLs
        const entriesWithRemoteUrls = metadataList.filter(meta => meta.remoteUrl);

        if (entriesWithRemoteUrls.length === 0) {
            return {
                success: false,
                error: 'No PDFs with remote URLs found in metadata'
            };
        }

        // Create manifest structure
        const manifest: PdfManifest = {
            metadata: {
                generated_at: new Date().toISOString(),
                version: '1.0'
            },
            files: {}
        };

        // Add each PDF to the manifest
        for (const meta of entriesWithRemoteUrls) {
            // Create a unique key from manufacturer and part number
            const key = `${meta.manufacturer.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${meta.partNumber.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

            manifest.files[key] = {
                remote_url: meta.remoteUrl!,
                version_hash: meta.versionHash,
                file_size: meta.fileSize,
                manufacturer: meta.manufacturer,
                last_updated: meta.lastUpdated
            };
        }

        // Create a temp directory for the manifest
        const tempDir = path.join(process.cwd(), 'temp');
        await fs.mkdir(tempDir, { recursive: true });

        // Write the manifest to a file
        const manifestPath = path.join(tempDir, `${manifestName}.json`);
        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

        return {
            success: true,
            manifestPath,
            manifestData: manifest
        };
    } catch (error) {
        console.error('Error generating manifest:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Uploads a manifest file to UploadThing
 * 
 * @param manifestPath Path to the manifest file
 * @returns URL of the uploaded manifest
 */
export async function uploadManifest(manifestPath: string): Promise<{
    success: boolean;
    url?: string;
    error?: string;
}> {
    try {
        // Configuration for the UploadThing API
        let apiKey = 'your-api-key-here';
        let appId = process.env.UPLOADTHING_APP_ID || 'your-app-id-here';

        // Decode and extract API key from token
        try {
            const token = process.env.UPLOADTHING_TOKEN || '';
            if (token) {
                const decodedToken = Buffer.from(token, 'base64').toString('utf-8');
                const tokenData = JSON.parse(decodedToken);
                if (tokenData.apiKey) {
                    apiKey = tokenData.apiKey;
                }
                if (tokenData.appId) {
                    appId = tokenData.appId;
                }
            }
        } catch (error) {
            console.error('Error decoding UPLOADTHING_TOKEN:', error);
        }

        const UPLOADTHING_URL = 'https://uploadthing.com/api/uploadFiles';

        // Get the filename
        const fileName = path.basename(manifestPath);

        // Create form data for the upload
        const formData = new FormData();

        // Read the file content
        const fileBuffer = await fs.readFile(manifestPath);

        // Add the file buffer directly to the form data with the file name
        formData.append('file', fileBuffer, {
            filename: fileName,
            contentType: 'application/json'
        });

        // Make the upload request to UploadThing
        const response = await fetch(UPLOADTHING_URL, {
            method: 'POST',
            headers: {
                'X-API-Key': apiKey,
                'X-App-Id': appId,
            },
            body: formData
        });

        // Parse the response
        const result = await response.json() as UploadThingResponse;

        if (!response.ok) {
            return {
                success: false,
                error: 'error' in result ? result.error : 'Upload failed'
            };
        }

        // Type guard to check if result is a success response
        if ('data' in result && result.data && result.data.url) {
            return {
                success: true,
                url: result.data.url
            };
        }

        return {
            success: false,
            error: 'Invalid response from server'
        };
    } catch (error) {
        console.error('Error uploading manifest:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Downloads a manifest file from a URL
 * 
 * @param url URL of the manifest file
 * @returns Parsed manifest data
 */
export async function downloadManifest(url: string): Promise<{
    success: boolean;
    manifest?: PdfManifest;
    error?: string;
}> {
    try {
        // Fetch the manifest
        const response = await fetch(url);

        if (!response.ok) {
            return {
                success: false,
                error: `Failed to download manifest: ${response.statusText}`
            };
        }

        // Parse the JSON
        const manifest = await response.json() as PdfManifest;

        return {
            success: true,
            manifest
        };
    } catch (error) {
        console.error('Error downloading manifest:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Creates and uploads a manifest file in one operation
 * 
 * @param manifestName Optional name for the manifest file
 * @returns URL of the uploaded manifest
 */
export async function createAndUploadManifest(manifestName = 'manifest'): Promise<{
    success: boolean;
    url?: string;
    manifestData?: PdfManifest;
    error?: string;
}> {
    try {
        // Generate the manifest
        const generateResult = await generateManifest(manifestName);

        if (!generateResult.success || !generateResult.manifestPath) {
            return {
                success: false,
                error: generateResult.error || 'Failed to generate manifest'
            };
        }

        // Upload the manifest
        const uploadResult = await uploadManifest(generateResult.manifestPath);

        if (!uploadResult.success || !uploadResult.url) {
            return {
                success: false,
                error: uploadResult.error || 'Failed to upload manifest'
            };
        }

        // Return the URL and manifest data
        return {
            success: true,
            url: uploadResult.url,
            manifestData: generateResult.manifestData
        };
    } catch (error) {
        console.error('Error creating and uploading manifest:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
} 