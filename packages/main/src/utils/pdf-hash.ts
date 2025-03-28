import { promises as fs } from 'fs';
import crypto from 'crypto';
import path from 'path';
import { createReadStream } from 'fs';

/**
 * Reads a PDF file and generates a stable SHA-256 hash
 * 
 * @param filePath Path to the PDF file
 * @returns SHA-256 hash as a hex string
 * @throws Error if file doesn't exist or can't be read
 */
export async function calculatePdfHash(filePath: string): Promise<string> {
    try {
        // Verify file exists
        await fs.access(filePath);

        // Read the file
        const fileBuffer = await fs.readFile(filePath);

        // Calculate SHA-256 hash
        const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        return hash;
    } catch (error) {
        throw new Error(`Failed to calculate hash for ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Calculate SHA-256 hash of a PDF file using streaming approach (for large files)
 * This uses less memory by processing the file in chunks
 * 
 * @param filePath Path to the PDF file
 * @returns SHA-256 hash as a hex string
 * @throws Error if file doesn't exist or can't be read
 */
export async function calculatePdfHashStreaming(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        try {
            const hash = crypto.createHash('sha256');
            const stream = createReadStream(filePath);

            stream.on('data', (data) => {
                hash.update(data);
            });

            stream.on('end', () => {
                resolve(hash.digest('hex'));
            });

            stream.on('error', (error) => {
                reject(new Error(`Failed to read file ${filePath}: ${error.message}`));
            });
        } catch (error) {
            reject(new Error(`Failed to create stream for ${filePath}: ${error instanceof Error ? error.message : String(error)}`));
        }
    });
}

/**
 * Intelligently selects the best hashing method based on file size
 * Uses streaming for large files to reduce memory usage
 * 
 * @param filePath Path to the PDF file
 * @param sizeThreshold Size in bytes above which to use streaming (default: 50MB)
 * @returns SHA-256 hash as a hex string
 */
export async function calculatePdfHashOptimized(
    filePath: string,
    sizeThreshold: number = 50 * 1024 * 1024
): Promise<string> {
    try {
        // Get file stats to check size
        const stats = await fs.stat(filePath);

        // Use streaming method for large files
        if (stats.size > sizeThreshold) {
            return calculatePdfHashStreaming(filePath);
        }

        // Use standard method for smaller files
        return calculatePdfHash(filePath);
    } catch (error) {
        throw new Error(`Failed to hash file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Checks if a file's current hash differs from a stored hash
 * 
 * @param filePath Path to the PDF file
 * @param storedHash Previously stored hash to compare against
 * @returns True if the file has changed (hashes don't match)
 */
export async function hasPdfChanged(filePath: string, storedHash: string): Promise<boolean> {
    try {
        const currentHash = await calculatePdfHashOptimized(filePath);
        return currentHash !== storedHash;
    } catch (error) {
        // If there's an error reading the file or calculating the hash,
        // assume the file has changed
        console.error(`Error checking if PDF changed: ${error}`);
        return true;
    }
}

/**
 * Calculates hashes for all PDF files in a directory
 * 
 * @param directoryPath Path to directory containing PDF files
 * @returns Map of file paths to their SHA-256 hashes
 */
export async function calculateDirectoryHashes(directoryPath: string): Promise<Map<string, string>> {
    const hashMap = new Map<string, string>();

    try {
        // Read directory contents
        const files = await fs.readdir(directoryPath);

        // Filter for PDF files
        const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === '.pdf');

        // Calculate hash for each PDF file
        for (const pdfFile of pdfFiles) {
            const filePath = path.join(directoryPath, pdfFile);
            try {
                const hash = await calculatePdfHashOptimized(filePath);
                hashMap.set(filePath, hash);
            } catch (error) {
                console.error(`Error hashing ${filePath}: ${error}`);
                // Skip this file and continue with others
            }
        }

        return hashMap;
    } catch (error) {
        console.error(`Error calculating directory hashes: ${error}`);
        return hashMap; // Return what we have, even if incomplete
    }
}

/**
 * Compares two files to see if they have the same content (hash)
 * 
 * @param file1 Path to first file
 * @param file2 Path to second file
 * @returns True if files have identical content
 */
export async function areFilesIdentical(file1: string, file2: string): Promise<boolean> {
    try {
        const hash1 = await calculatePdfHashOptimized(file1);
        const hash2 = await calculatePdfHashOptimized(file2);
        return hash1 === hash2;
    } catch (error) {
        console.error(`Error comparing files: ${error}`);
        return false; // Assume files are different if there's an error
    }
} 