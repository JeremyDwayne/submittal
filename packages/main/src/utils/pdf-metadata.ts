import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import isDev from 'electron-is-dev';
import crypto from 'crypto';
import { calculatePdfHashOptimized, hasPdfChanged } from './pdf-hash';

/**
 * Metadata for a single PDF file
 */
export interface PdfMetadata {
    partNumber: string;
    manufacturer: string;
    localPath: string;
    remoteUrl?: string;
    versionHash: string;  // SHA-256 hash of file contents
    fileSize: number;
    lastUpdated: string;
    fileName: string;
}

/**
 * Structure of the metadata cache file
 */
interface PdfCache {
    files: Record<string, PdfMetadata>;
    lastUpdated: string;
}

/**
 * Path to the metadata cache file
 */
function getCachePath(): string {
    const userDataPath = isDev
        ? path.join(__dirname, '../../../..', 'data')
        : path.join(app.getPath('userData'), 'data');

    return path.join(userDataPath, 'pdf-cache.json');
}

/**
 * Ensures the data directory exists
 */
async function ensureDataDirectory(): Promise<string> {
    const userDataPath = isDev
        ? path.join(__dirname, '../../../..', 'data')
        : path.join(app.getPath('userData'), 'data');

    await fs.mkdir(userDataPath, { recursive: true });
    return userDataPath;
}

/**
 * Gets the metadata cache, creating it if it doesn't exist
 */
export async function getMetadataCache(): Promise<PdfCache> {
    try {
        const cachePath = getCachePath();
        await ensureDataDirectory();

        try {
            // Try to read the existing cache
            const data = await fs.readFile(cachePath, 'utf-8');
            return JSON.parse(data) as PdfCache;
        } catch (error) {
            // If the file doesn't exist or has invalid JSON, create a new cache
            const newCache: PdfCache = {
                files: {},
                lastUpdated: new Date().toISOString()
            };

            await fs.writeFile(cachePath, JSON.stringify(newCache, null, 2));
            return newCache;
        }
    } catch (error) {
        console.error('Error getting metadata cache:', error);
        // Return an empty cache if there's an error
        return {
            files: {},
            lastUpdated: new Date().toISOString()
        };
    }
}

/**
 * Updates the metadata cache with the provided data
 */
export async function updateMetadataCache(cache: PdfCache): Promise<void> {
    try {
        const cachePath = getCachePath();
        await ensureDataDirectory();

        // Update the lastUpdated timestamp
        cache.lastUpdated = new Date().toISOString();

        // Write the updated cache to disk
        await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
    } catch (error) {
        console.error('Error updating metadata cache:', error);
        throw error;
    }
}

/**
 * Calculates SHA-256 hash of a file's contents
 * @deprecated Use calculatePdfHash from pdf-hash.ts instead
 */
export async function calculateFileHash(filePath: string): Promise<string> {
    try {
        const data = await fs.readFile(filePath);
        return crypto.createHash('sha256').update(data).digest('hex');
    } catch (error) {
        console.error(`Error calculating hash for ${filePath}:`, error);
        throw error;
    }
}

/**
 * Adds or updates a PDF file in the metadata cache
 */
export async function updatePdfMetadata(
    partNumber: string,
    manufacturer: string,
    localPath: string,
    remoteUrl?: string
): Promise<PdfMetadata> {
    try {
        // Get file stats
        const stats = await fs.stat(localPath);

        // Calculate hash using the optimized function
        const versionHash = await calculatePdfHashOptimized(localPath);

        // Create metadata object
        const metadata: PdfMetadata = {
            partNumber,
            manufacturer,
            localPath,
            remoteUrl,
            versionHash,
            fileSize: stats.size,
            lastUpdated: new Date().toISOString(),
            fileName: path.basename(localPath)
        };

        // Update the cache
        const cache = await getMetadataCache();
        cache.files[localPath] = metadata;
        await updateMetadataCache(cache);

        return metadata;
    } catch (error) {
        console.error(`Error updating metadata for ${localPath}:`, error);
        throw error;
    }
}

/**
 * Gets metadata for a PDF file if it exists in the cache
 */
export async function getPdfMetadata(localPath: string): Promise<PdfMetadata | null> {
    try {
        const cache = await getMetadataCache();
        return cache.files[localPath] || null;
    } catch (error) {
        console.error(`Error getting metadata for ${localPath}:`, error);
        return null;
    }
}

/**
 * Removes a PDF file from the metadata cache
 */
export async function removePdfMetadata(localPath: string): Promise<boolean> {
    try {
        const cache = await getMetadataCache();

        if (cache.files[localPath]) {
            delete cache.files[localPath];
            await updateMetadataCache(cache);
            return true;
        }

        return false;
    } catch (error) {
        console.error(`Error removing metadata for ${localPath}:`, error);
        return false;
    }
}

/**
 * Lists all PDFs in the metadata cache
 */
export async function listPdfMetadata(): Promise<PdfMetadata[]> {
    try {
        const cache = await getMetadataCache();
        return Object.values(cache.files);
    } catch (error) {
        console.error('Error listing PDF metadata:', error);
        return [];
    }
}

/**
 * Checks if a PDF file has changed by comparing its current hash with the stored hash
 */
export async function hasFileChanged(localPath: string): Promise<boolean> {
    try {
        const metadata = await getPdfMetadata(localPath);

        // If file isn't in cache, it's considered changed
        if (!metadata) return true;

        // Use the hasPdfChanged function from pdf-hash.ts
        return await hasPdfChanged(localPath, metadata.versionHash);
    } catch (error) {
        console.error(`Error checking if file changed: ${localPath}`, error);
        // If there's an error reading or hashing the file, consider it changed
        return true;
    }
}

/**
 * Finds a PDF in the cache by manufacturer and part number
 */
export async function findPdfByPart(
    manufacturer: string,
    partNumber: string
): Promise<PdfMetadata | null> {
    try {
        const cache = await getMetadataCache();

        // Normalize search terms
        const normalizedManufacturer = manufacturer.toLowerCase().replace(/[_\s-]/g, '');
        const normalizedPartNumber = partNumber.toLowerCase().replace(/[_\s-]/g, '');

        // Search through the cache
        for (const metadata of Object.values(cache.files)) {
            const metaNormalizedManufacturer =
                metadata.manufacturer.toLowerCase().replace(/[_\s-]/g, '');
            const metaNormalizedPartNumber =
                metadata.partNumber.toLowerCase().replace(/[_\s-]/g, '');

            if (
                metaNormalizedManufacturer.includes(normalizedManufacturer) ||
                normalizedManufacturer.includes(metaNormalizedManufacturer)
            ) {
                if (
                    metaNormalizedPartNumber.includes(normalizedPartNumber) ||
                    normalizedPartNumber.includes(metaNormalizedPartNumber)
                ) {
                    return metadata;
                }
            }
        }

        return null;
    } catch (error) {
        console.error(`Error finding PDF for ${manufacturer} ${partNumber}:`, error);
        return null;
    }
} 