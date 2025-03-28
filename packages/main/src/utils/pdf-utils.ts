import { promises as fs } from 'fs';
import path from 'path';
import {
    calculatePdfHashOptimized,
    calculateDirectoryHashes
} from './pdf-hash';
import { getPdfMetadata, updatePdfMetadata, listPdfMetadata } from './pdf-metadata';

/**
 * Gets PDF information including metadata and hash
 * 
 * @param filePath Path to the PDF file
 * @returns Object containing file information, metadata, and hash
 */
export async function getPdfInfo(filePath: string): Promise<{
    fileName: string;
    filePath: string;
    fileSize: number;
    hash: string;
    metadata: any | null;
}> {
    // Get file stats
    const stats = await fs.stat(filePath);

    // Calculate hash
    const hash = await calculatePdfHashOptimized(filePath);

    // Get existing metadata if available
    const metadata = await getPdfMetadata(filePath);

    return {
        fileName: path.basename(filePath),
        filePath,
        fileSize: stats.size,
        hash,
        metadata
    };
}

/**
 * Identifies duplicate PDF files in a directory based on content hash
 * 
 * @param directoryPath Directory to scan for duplicates
 * @returns Map of hash values to arrays of files with that hash
 */
export async function findDuplicatePdfs(directoryPath: string): Promise<Map<string, string[]>> {
    // Get hashes for all PDFs in directory
    const hashMap = await calculateDirectoryHashes(directoryPath);

    // Create reverse map from hash to array of file paths
    const reverseMap = new Map<string, string[]>();

    // Populate reverse map
    hashMap.forEach((hash, filePath) => {
        if (!reverseMap.has(hash)) {
            reverseMap.set(hash, []);
        }
        reverseMap.get(hash)?.push(filePath);
    });

    // Filter for hashes that have multiple files (duplicates)
    const duplicatesMap = new Map<string, string[]>();
    reverseMap.forEach((filePaths, hash) => {
        if (filePaths.length > 1) {
            duplicatesMap.set(hash, filePaths);
        }
    });

    return duplicatesMap;
}

/**
 * Updates hash values for all PDF metadata
 * Useful when migrating from an old hashing system to the new one
 * 
 * @param updateMetadata If true, update metadata with new hash values
 * @returns Object containing stats about the update process
 */
export async function updateAllPdfHashes(updateMetadata: boolean = false): Promise<{
    total: number;
    updated: number;
    failed: number;
    unchanged: number;
}> {
    const stats = {
        total: 0,
        updated: 0,
        failed: 0,
        unchanged: 0
    };

    try {
        // Get all PDF metadata using listPdfMetadata instead of getPdfMetadata
        const metadataList = await listPdfMetadata();
        stats.total = metadataList.length;

        for (const metadata of metadataList) {
            try {
                // Skip files without local path
                if (!metadata.localPath) {
                    stats.unchanged++;
                    continue;
                }

                // Calculate new hash
                const newHash = await calculatePdfHashOptimized(metadata.localPath);

                // Check if hash has changed
                if (newHash !== metadata.versionHash) {
                    if (updateMetadata) {
                        // Update metadata with new hash
                        await updatePdfMetadata(
                            metadata.partNumber,
                            metadata.manufacturer,
                            metadata.localPath,
                            metadata.remoteUrl
                        );
                    }
                    stats.updated++;
                } else {
                    stats.unchanged++;
                }
            } catch (error) {
                console.error(`Error updating hash for ${metadata.localPath}:`, error);
                stats.failed++;
            }
        }

        return stats;
    } catch (error) {
        console.error('Error updating PDF hashes:', error);
        return stats;
    }
}

/**
 * Example of using the PDF hash functions to verify file integrity
 * 
 * @param sourceFile Original file to use as reference
 * @param targetFile File to verify against the source
 * @returns Object with verification results
 */
export async function verifyPdfIntegrity(
    sourceFile: string,
    targetFile: string
): Promise<{
    sourceHash: string;
    targetHash: string;
    isIdentical: boolean;
    sourceSize: number;
    targetSize: number;
}> {
    // Get source file hash and size
    const sourceStats = await fs.stat(sourceFile);
    const sourceHash = await calculatePdfHashOptimized(sourceFile);

    // Get target file hash and size
    const targetStats = await fs.stat(targetFile);
    const targetHash = await calculatePdfHashOptimized(targetFile);

    // Compare hashes
    const isIdentical = sourceHash === targetHash;

    return {
        sourceHash,
        targetHash,
        isIdentical,
        sourceSize: sourceStats.size,
        targetSize: targetStats.size
    };
} 