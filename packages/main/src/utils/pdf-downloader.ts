import axios from 'axios';
import path from 'path';
import fs from 'fs/promises';
import { app } from 'electron';
import Store from 'electron-store';
import isDev from 'electron-is-dev';

// Define the cache schema
interface CacheSchema {
    cutSheets: Record<string, CutSheetMetadata>;
}

// Define metadata for each downloaded cut sheet
interface CutSheetMetadata {
    brand: string;
    partNumber: string;
    filePath: string;
    url: string;
    downloadDate: string;
    fileSize: number;
}

// Initialize the store for caching
const store = new Store<CacheSchema>({
    name: 'pdf-cache',
    defaults: {
        cutSheets: {}
    }
});

/**
 * Creates the necessary directory structure for storing cut sheets
 * @param brand The manufacturer brand
 * @returns The path to the directory
 */
export async function ensureCutSheetDirectory(brand: string): Promise<string> {
    // Get the userData directory from the app
    const userDataPath = isDev
        ? path.join(__dirname, '../../../..', 'data')
        : path.join(app.getPath('userData'), 'data');

    // Create the full path to where we'll store the cut sheet
    const cutSheetsDir = path.join(userDataPath, 'cut_sheets');
    const brandDir = path.join(cutSheetsDir, brand.toLowerCase());

    // Create directories if they don't exist
    try {
        await fs.mkdir(cutSheetsDir, { recursive: true });
        await fs.mkdir(brandDir, { recursive: true });
        return brandDir;
    } catch (error) {
        console.error(`Error creating directories: ${error}`);
        throw error;
    }
}

/**
 * Gets a sanitized filename from a part number
 * @param partNumber The part number to use as the base of the filename
 * @returns A sanitized filename
 */
function getSanitizedFilename(partNumber: string): string {
    // Remove invalid characters, replace spaces with underscores
    const sanitized = partNumber
        .replace(/[/\\?%*:|"<>]/g, '')
        .replace(/\s+/g, '_');

    // Make sure it has a PDF extension
    return sanitized.endsWith('.pdf') ? sanitized : `${sanitized}.pdf`;
}

/**
 * Create a unique cache ID for lookup
 * @param brand The manufacturer brand
 * @param partNumber The part number 
 * @returns A unique cache ID
 */
export function getCacheId(brand: string, partNumber: string): string {
    return `${brand.toLowerCase()}_${partNumber.replace(/\s+/g, '')}`;
}

/**
 * Downloads a PDF from a URL and saves it to the cut sheets directory
 * @param url The URL of the PDF to download
 * @param brand The manufacturer brand (for directory structure)
 * @param partNumber The part number (for filename)
 * @param forceRefresh If true, bypasses the cache and downloads again
 * @returns Metadata about the downloaded file
 */
export async function downloadPdf(
    url: string,
    brand: string,
    partNumber: string,
    forceRefresh: boolean = false
): Promise<{ success: boolean; filePath?: string; cacheHit?: boolean; error?: string }> {
    try {
        if (!url || !brand || !partNumber) {
            return { success: false, error: 'Invalid parameters: URL, brand, and part number are required' };
        }

        const cacheId = getCacheId(brand, partNumber);

        // Check if it's already in the cache
        const cutSheets = store.get('cutSheets') || {};
        const existingEntry = cutSheets[cacheId] as CutSheetMetadata | undefined;

        if (existingEntry && !forceRefresh) {
            try {
                // Verify file exists
                await fs.access(existingEntry.filePath);
                return {
                    success: true,
                    filePath: existingEntry.filePath,
                    cacheHit: true
                };
            } catch (error) {
                // File doesn't exist despite cache entry, so we'll re-download
                console.log(`Cache entry exists but file not found: ${existingEntry.filePath}`);
            }
        }

        // Ensure the brand directory exists
        const brandDir = await ensureCutSheetDirectory(brand);

        // Get sanitized filename
        const fileName = getSanitizedFilename(partNumber);
        const filePath = path.join(brandDir, fileName);

        // Download the PDF
        console.log(`Downloading PDF from ${url}`);

        // Check if this is a Schneider Electric URL
        const isSchneiderUrl = url.includes('se.com') || url.includes('schneider-electric.com');

        try {
            // Enhanced browser-like headers for Schneider Electric
            const headers: Record<string, string> = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Cache-Control': 'max-age=0',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Dest': 'document',
                'Pragma': 'no-cache',
                'Sec-Ch-Ua': '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"macOS"'
            };

            // Add referer for Schneider URLs
            if (isSchneiderUrl) {
                headers['Referer'] = 'https://www.se.com/us/en/product/search';
                headers['Origin'] = 'https://www.se.com';
            }

            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                headers,
                timeout: 30000,
                maxRedirects: 5
            });

            // Verify we got a PDF
            const contentType = response.headers['content-type'];
            if (contentType && !contentType.includes('pdf') && !contentType.includes('octet-stream')) {
                // If we got an HTML response from Schneider instead of a PDF
                if (isSchneiderUrl && contentType.includes('html')) {
                    return {
                        success: false,
                        error: 'Authentication required: Schneider Electric requires you to be logged in to download PDFs. Try downloading manually from their website.'
                    };
                }

                console.warn(`Warning: Expected PDF, but got ${contentType}`);
            }

            // Save the PDF file
            await fs.writeFile(filePath, Buffer.from(response.data));

            // Get file size
            const stats = await fs.stat(filePath);

            // Store metadata in cache
            const metadata: CutSheetMetadata = {
                brand,
                partNumber,
                filePath,
                url,
                downloadDate: new Date().toISOString(),
                fileSize: stats.size
            };

            store.set(`cutSheets.${cacheId}`, metadata);

            return {
                success: true,
                filePath,
                cacheHit: false
            };
        } catch (error) {
            // Special handling for Schneider Electric authentication errors
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 403 && isSchneiderUrl) {
                    return {
                        success: false,
                        error: 'Authentication required: Schneider Electric requires you to be logged in to download PDFs. Please download manually from their website and import it.'
                    };
                } else if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
                    return {
                        success: false,
                        error: `Network error: Unable to connect to ${new URL(url).hostname}. Please check your internet connection.`
                    };
                }
            }
            throw error; // Re-throw for other errors
        }
    } catch (error) {
        console.error('Error downloading PDF:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Lists all PDFs in the cache by brand
 * @returns A record of brand to array of part number metadata
 */
export function listCachedPdfs(): Record<string, CutSheetMetadata[]> {
    const cutSheets = store.get('cutSheets') || {};

    // Group by brand
    const grouped: Record<string, CutSheetMetadata[]> = {};

    for (const key in cutSheets) {
        const sheet = cutSheets[key] as CutSheetMetadata;
        if (!grouped[sheet.brand]) {
            grouped[sheet.brand] = [];
        }
        grouped[sheet.brand].push(sheet);
    }

    return grouped;
}

/**
 * Clears specific entries from the cache
 * @param brand Optional brand to filter by
 * @param partNumber Optional part number to filter by
 * @returns Number of entries removed
 */
export function clearCache(brand?: string, partNumber?: string): number {
    if (!brand && !partNumber) {
        // Clear entire cache
        store.set('cutSheets', {});
        return Object.keys(store.get('cutSheets') || {}).length;
    }

    const cutSheets = store.get('cutSheets') || {};
    let removed = 0;

    for (const key in cutSheets) {
        const sheet = cutSheets[key] as CutSheetMetadata;
        if (
            (brand && sheet.brand.toLowerCase() === brand.toLowerCase()) ||
            (partNumber && sheet.partNumber === partNumber)
        ) {
            delete cutSheets[key];
            removed++;
        }
    }

    store.set('cutSheets', cutSheets);
    return removed;
} 