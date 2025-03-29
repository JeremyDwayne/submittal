import { promises as fs } from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import FormData from 'form-data';
import {
    getPdfMetadata,
    updatePdfMetadata,
    hasFileChanged,
    PdfMetadata,
    listPdfMetadata
} from './pdf-metadata';
require('dotenv').config();

// Configuration for the UploadThing API
// The UPLOADTHING_TOKEN is a base64 encoded JSON string with apiKey and appId
const UPLOADTHING_TOKEN = process.env.UPLOADTHING_TOKEN || '';

// Decode and extract the actual API key and app ID
let UPLOADTHING_API_KEY = 'your-api-key-here';
let UPLOADTHING_APP_ID = process.env.UPLOADTHING_APP_ID || 'your-app-id-here';

try {
    if (UPLOADTHING_TOKEN) {
        const decodedToken = Buffer.from(UPLOADTHING_TOKEN, 'base64').toString('utf-8');
        const tokenData = JSON.parse(decodedToken);
        if (tokenData.apiKey) {
            UPLOADTHING_API_KEY = tokenData.apiKey;
        }
        if (tokenData.appId) {
            UPLOADTHING_APP_ID = tokenData.appId;
        }
    }
} catch (error) {
    console.error('Error decoding UPLOADTHING_TOKEN:', error);
}

// Response type for UploadThing API
interface UploadThingResponse {
    data?: {
        url: string;
        key: string;
    };
    error?: string;
}

/**
 * Uploads a single file to UploadThing using the official SDK
 */
export async function uploadSingleFile(
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

        // Read the file content
        const fileBuffer = await fs.readFile(filePath);

        try {
            // Perform the upload using form-data and node-fetch
            const formData = new FormData();
            formData.append('file', fileBuffer, {
                filename: fileName,
                contentType: 'application/pdf'
            });

            const response = await fetch('https://uploadthing.com/api/uploadFiles', {
                method: 'POST',
                headers: {
                    'X-API-Key': UPLOADTHING_API_KEY,
                    'X-App-Id': UPLOADTHING_APP_ID
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Upload failed with status: ${response.status}`);
            }

            const result = await response.json() as UploadThingResponse;

            if (!result.data || !result.data.url) {
                throw new Error(result.error || 'Invalid response format from uploadthing');
            }

            const fileUrl = result.data.url;

            // If we have manufacturer and part number, update the metadata
            if (manufacturer && partNumber) {
                const metadata = await updatePdfMetadata(
                    partNumber,
                    manufacturer,
                    filePath,
                    fileUrl
                );

                return {
                    success: true,
                    url: fileUrl,
                    metadata
                };
            }

            // Otherwise just return the URL without updating metadata
            return {
                success: true,
                url: fileUrl
            };
        } catch (uploadError) {
            console.error(`Error during upload of ${filePath}:`, uploadError);
            return {
                success: false,
                error: uploadError instanceof Error ? uploadError.message : String(uploadError)
            };
        }
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

                    // Upload the file using our single file upload function
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
                            manufacturer: uploadResult.metadata?.manufacturer,
                            partNumber: uploadResult.metadata?.partNumber
                        };
                    } else {
                        return {
                            filePath,
                            fileName,
                            isUploaded: false,
                            error: uploadResult.error
                        };
                    }
                } catch (fileError) {
                    return {
                        filePath,
                        fileName,
                        isUploaded: false,
                        error: fileError instanceof Error ? fileError.message : String(fileError)
                    };
                }
            })
        );

        // Calculate summary stats
        const summary = {
            total: results.length,
            uploaded: results.filter(r => r.isUploaded && !r.wasSkipped).length,
            failed: results.filter(r => !r.isUploaded).length,
            skipped: results.filter(r => r.wasSkipped).length
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
 * Delete a file from remote storage by its local path
 */
export async function deleteRemoteFile(filePath: string): Promise<boolean> {
    try {
        // Get the metadata for the file to find its remote URL
        const metadata = await getPdfMetadata(filePath);

        if (!metadata || !metadata.remoteUrl) {
            console.error('No metadata or remote URL found for file:', filePath);
            return false;
        }

        // Extract the file key from the URL - the last part of the path
        const urlParts = new URL(metadata.remoteUrl);
        const pathSegments = urlParts.pathname.split('/');
        const fileKey = pathSegments[pathSegments.length - 1];

        if (!fileKey) {
            console.error('Could not extract file key from URL:', metadata.remoteUrl);
            return false;
        }

        try {
            // Make a DELETE request to the UploadThing API
            const response = await fetch(`https://uploadthing.com/api/deleteFile?fileKey=${fileKey}`, {
                method: 'DELETE',
                headers: {
                    'X-API-Key': UPLOADTHING_API_KEY,
                    'X-App-Id': UPLOADTHING_APP_ID
                }
            });

            if (!response.ok) {
                throw new Error(`Delete failed with status: ${response.status}`);
            }

            const result = await response.json() as UploadThingResponse;

            if (result.error) {
                throw new Error(result.error);
            }

            // If successful, remove the remote URL from the metadata
            await updatePdfMetadata(
                metadata.partNumber,
                metadata.manufacturer,
                metadata.localPath
                // No remote URL - this removes it
            );

            return true;
        } catch (deleteError) {
            console.error('Error deleting remote file:', deleteError);
            return false;
        }
    } catch (error) {
        console.error('Error in deleteRemoteFile:', error);
        return false;
    }
} 