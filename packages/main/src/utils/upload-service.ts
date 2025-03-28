import { promises as fs } from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { FormData, File, Blob } from 'node-fetch';
import {
    getPdfMetadata,
    updatePdfMetadata,
    hasFileChanged,
    PdfMetadata,
    listPdfMetadata
} from './pdf-metadata';

// UploadThing API response types
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

// Configuration for the UploadThing API
// This should be set by environment variables in a real app
const UPLOADTHING_API_KEY = process.env.UPLOADTHING_API_KEY || 'your-api-key-here';
const UPLOADTHING_APP_ID = process.env.UPLOADTHING_APP_ID || 'your-app-id-here';
const UPLOADTHING_URL = 'https://uploadthing.com/api/uploadFiles';

/**
 * Uploads a single file to UploadThing
 */
async function uploadSingleFile(
    filePath: string,
    manufacturer?: string,
    partNumber?: string
): Promise<{
    success: boolean;
    url?: string;
    error?: string;
    metadata?: PdfMetadata;
}> {
    try {
        // Get file details
        const fileName = path.basename(filePath);

        // Check if file exists in metadata and if it's unchanged
        const existingMetadata = await getPdfMetadata(filePath);

        // If we have metadata with a remote URL and the file hasn't changed, skip upload
        if (existingMetadata?.remoteUrl && !await hasFileChanged(filePath)) {
            return {
                success: true,
                url: existingMetadata.remoteUrl,
                metadata: existingMetadata
            };
        }

        // Create form data for the upload
        const formData = new FormData();

        // Read the file content
        const fileBuffer = await fs.readFile(filePath);

        // Create a blob from the file buffer
        const fileBlob = new Blob([fileBuffer], { type: 'application/pdf' });

        // Create a file object
        const file = new File([fileBlob], fileName, { type: 'application/pdf' });

        // Add the file to the form data
        formData.append('file', file);

        // Make the upload request to UploadThing
        const response = await fetch(UPLOADTHING_URL, {
            method: 'POST',
            headers: {
                'X-API-Key': UPLOADTHING_API_KEY,
                'X-App-Id': UPLOADTHING_APP_ID,
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
            // Success! Update metadata and return the remote URL

            // If we have manufacturer and part number, update the metadata
            if (manufacturer && partNumber) {
                const metadata = await updatePdfMetadata(
                    partNumber,
                    manufacturer,
                    filePath,
                    result.data.url
                );

                return {
                    success: true,
                    url: result.data.url,
                    metadata
                };
            }

            // Otherwise just return the URL without updating metadata
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
        console.error(`Error uploading file ${filePath}:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Uploads multiple PDF files from a directory
 */
export async function uploadDirectoryPdfs(
    directory: string,
    extractMetadata: boolean = false
): Promise<{
    success: boolean;
    results?: Array<{
        filePath: string;
        fileName: string;
        isUploaded: boolean;
        remoteUrl?: string;
        error?: string;
        wasSkipped?: boolean;
        manufacturer?: string;
        partNumber?: string;
    }>;
    summary?: {
        total: number;
        uploaded: number;
        failed: number;
        skipped: number;
    };
    error?: string;
}> {
    try {
        // Check if directory exists
        await fs.access(directory);

        // Get all files in the directory
        const files = await fs.readdir(directory);

        // Filter for PDF files only
        const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === '.pdf');

        if (pdfFiles.length === 0) {
            return {
                success: true,
                results: [],
                summary: {
                    total: 0,
                    uploaded: 0,
                    failed: 0,
                    skipped: 0
                }
            };
        }

        // Process each PDF file
        const results = await Promise.all(
            pdfFiles.map(async (fileName) => {
                const filePath = path.join(directory, fileName);

                try {
                    // Try to extract manufacturer and part number from filename if requested
                    let manufacturer: string | undefined;
                    let partNumber: string | undefined;

                    if (extractMetadata) {
                        // Basic extraction logic - this would need to be customized for your naming convention
                        const parts = fileName.replace('.pdf', '').split(/[_\s-]+/);
                        if (parts.length >= 2) {
                            // This is just a basic example - you'd need custom logic
                            // for your specific naming patterns
                            manufacturer = parts[0];
                            partNumber = parts[1];
                        }
                    }

                    // First check if the file is in the metadata cache
                    const metadata = await getPdfMetadata(filePath);

                    // If file is in metadata with remoteUrl and hasn't changed, skip upload
                    if (metadata?.remoteUrl && !await hasFileChanged(filePath)) {
                        return {
                            filePath,
                            fileName,
                            isUploaded: true,
                            remoteUrl: metadata.remoteUrl,
                            wasSkipped: true,
                            manufacturer: metadata.manufacturer,
                            partNumber: metadata.partNumber
                        };
                    }

                    // Upload the file
                    const uploadResult = await uploadSingleFile(
                        filePath,
                        manufacturer ?? metadata?.manufacturer,
                        partNumber ?? metadata?.partNumber
                    );

                    if (uploadResult.success && uploadResult.url) {
                        return {
                            filePath,
                            fileName,
                            isUploaded: true,
                            remoteUrl: uploadResult.url,
                            wasSkipped: false,
                            manufacturer: uploadResult.metadata?.manufacturer ?? manufacturer,
                            partNumber: uploadResult.metadata?.partNumber ?? partNumber
                        };
                    } else {
                        return {
                            filePath,
                            fileName,
                            isUploaded: false,
                            error: uploadResult.error,
                            wasSkipped: false,
                            manufacturer,
                            partNumber
                        };
                    }
                } catch (error) {
                    return {
                        filePath,
                        fileName,
                        isUploaded: false,
                        error: error instanceof Error ? error.message : String(error),
                        wasSkipped: false
                    };
                }
            })
        );

        // Calculate summary
        const summary = {
            total: results.length,
            uploaded: results.filter(r => r.isUploaded && !r.wasSkipped).length,
            skipped: results.filter(r => r.wasSkipped).length,
            failed: results.filter(r => !r.isUploaded).length
        };

        return {
            success: true,
            results,
            summary
        };
    } catch (error) {
        console.error('Error uploading directory PDFs:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Get a list of all uploaded files with their metadata
 */
export async function getUploadedFiles(): Promise<PdfMetadata[]> {
    try {
        const allMetadata = await listPdfMetadata();
        // Filter to just files that have a remoteUrl
        return allMetadata.filter(metadata => !!metadata.remoteUrl);
    } catch (error) {
        console.error('Error getting uploaded files:', error);
        return [];
    }
}

/**
 * Deletes a file from remote storage (and removes its URL from the metadata)
 * Note: This is a simplified version that only updates local cache
 * UploadThing might not support actual remote deletion via API
 */
export async function deleteRemoteFile(filePath: string): Promise<boolean> {
    try {
        const metadata = await getPdfMetadata(filePath);

        if (!metadata) {
            console.error(`File not found in metadata: ${filePath}`);
            return false;
        }

        if (!metadata.remoteUrl) {
            console.error(`File doesn't have a remote URL: ${filePath}`);
            return false;
        }

        // In a real implementation, you would call the UploadThing API to delete the file
        // For now, we'll just update our local metadata to remove the remote URL

        // Update the metadata to remove the remote URL but keep other metadata
        await updatePdfMetadata(
            metadata.partNumber,
            metadata.manufacturer,
            metadata.localPath
        );

        return true;
    } catch (error) {
        console.error(`Error deleting remote file: ${filePath}`, error);
        return false;
    }
} 