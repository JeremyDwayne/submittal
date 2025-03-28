import fs from 'fs/promises';
import path from 'path';

interface PdfMatch {
    manufacturer: string;
    partNumber: string;
    pdfPath: string;
    fileName: string;
}

/**
 * Normalizes a string by converting to lowercase and removing special characters
 * @param input The string to normalize
 * @returns Normalized string
 */
function normalizeString(input: string): string {
    return input.toLowerCase().replace(/[_\-\s.]/g, '');
}

/**
 * Matches a BOM (Bill of Materials) array with a list of PDF filenames
 * @param bomEntries Array of BOM entries with manufacturer and partNumber
 * @param pdfFiles Array of PDF filenames or file info objects
 * @param pdfBasePath Optional base path to prepend to matched PDF filenames
 * @returns Results with match status for each entry and summary
 */
export function matchBomToPdfs(
    bomEntries: Array<{ manufacturer: string; partNumber: string }>,
    pdfFiles: Array<string | { fileName: string; pdfPath: string }>,
    pdfBasePath?: string
): {
    results: Array<{
        manufacturer: string;
        partNumber: string;
        matched: boolean;
        pdfPath?: string;
        fileName?: string;
    }>;
    summary: {
        total: number;
        matched: number;
        notFound: number;
    };
} {
    const results = [];
    let matched = 0;
    let notFound = 0;

    // Normalize PDF filenames for more accurate matching
    const normalizedPdfMap = new Map<string, { fileName: string; pdfPath: string }>();

    pdfFiles.forEach(pdfFile => {
        // Handle both string filenames and objects with fileName/pdfPath
        let fileName: string, pdfPath: string;

        if (typeof pdfFile === 'string') {
            fileName = pdfFile;
            pdfPath = pdfBasePath ? path.join(pdfBasePath, fileName) : fileName;
        } else {
            fileName = pdfFile.fileName;
            pdfPath = pdfFile.pdfPath;
        }

        normalizedPdfMap.set(normalizeString(fileName), { fileName, pdfPath });
    });

    // Process each BOM entry
    for (const entry of bomEntries) {
        const normalizedManufacturer = normalizeString(entry.manufacturer);
        const normalizedPartNumber = normalizeString(entry.partNumber);
        let matchFound = false;
        let matchedPdf: { fileName: string; pdfPath: string } | undefined;

        // Check each PDF filename for a match
        for (const [normalizedFileName, pdfInfo] of normalizedPdfMap.entries()) {
            if (
                normalizedFileName.includes(normalizedManufacturer) &&
                normalizedFileName.includes(normalizedPartNumber)
            ) {
                matchFound = true;
                matchedPdf = pdfInfo;
                break;
            }
        }

        if (matchFound && matchedPdf) {
            results.push({
                manufacturer: entry.manufacturer,
                partNumber: entry.partNumber,
                matched: true,
                pdfPath: matchedPdf.pdfPath,
                fileName: matchedPdf.fileName
            });
            matched++;
        } else {
            results.push({
                manufacturer: entry.manufacturer,
                partNumber: entry.partNumber,
                matched: false
            });
            notFound++;
        }
    }

    return {
        results,
        summary: {
            total: bomEntries.length,
            matched,
            notFound
        }
    };
}

/**
 * Scans a directory for PDF files and matches them to manufacturer and part numbers
 * @param directory The directory to scan for PDFs
 * @returns An array of matched PDFs with their metadata
 */
export async function scanPdfDirectory(directory: string): Promise<PdfMatch[]> {
    try {
        // Get all files in the directory (non-recursive)
        const files = await fs.readdir(directory);

        // Filter for PDF files only
        const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === '.pdf');

        // We'll return this array of matched files
        const matches: PdfMatch[] = [];

        // Create basic metadata for each PDF file found
        for (const pdfFile of pdfFiles) {
            matches.push({
                manufacturer: '', // Will be filled when matched with BOM
                partNumber: '',   // Will be filled when matched with BOM
                pdfPath: path.join(directory, pdfFile),
                fileName: pdfFile
            });
        }

        return matches;
    } catch (error) {
        console.error('Error scanning PDF directory:', error);
        return [];
    }
}

/**
 * Matches a manufacturer and part number against available PDFs
 * @param directory The directory containing PDFs
 * @param manufacturer The manufacturer name
 * @param partNumber The part number
 * @returns The matched PDF path or null if no match
 */
export async function findMatchingPdf(
    directory: string,
    manufacturer: string,
    partNumber: string
): Promise<string | null> {
    try {
        // Normalize the search terms - lowercase and remove special characters
        const normalizedManufacturer = normalizeString(manufacturer);
        const normalizedPartNumber = normalizeString(partNumber);

        // Get all files in the directory
        const files = await fs.readdir(directory);

        // Filter for PDF files only
        const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === '.pdf');

        // Look for a match
        for (const pdfFile of pdfFiles) {
            // Normalize the filename - lowercase and remove special characters
            const normalizedFilename = normalizeString(pdfFile);

            // Check if both manufacturer and part number are in the filename
            if (
                normalizedFilename.includes(normalizedManufacturer) &&
                normalizedFilename.includes(normalizedPartNumber)
            ) {
                return path.join(directory, pdfFile);
            }
        }

        // No match found
        return null;
    } catch (error) {
        console.error('Error finding matching PDF:', error);
        return null;
    }
}

/**
 * Processes a CSV row to find a matching PDF
 * @param directory The directory containing PDFs
 * @param manufacturer The manufacturer name
 * @param partNumber The part number
 * @returns Result object with match status
 */
export async function processBomEntry(
    directory: string,
    manufacturer: string,
    partNumber: string
): Promise<{
    manufacturer: string;
    partNumber: string;
    matched: boolean;
    pdfPath?: string;
    fileName?: string;
}> {
    const pdfPath = await findMatchingPdf(directory, manufacturer, partNumber);

    if (pdfPath) {
        return {
            manufacturer,
            partNumber,
            matched: true,
            pdfPath,
            fileName: path.basename(pdfPath)
        };
    } else {
        return {
            manufacturer,
            partNumber,
            matched: false
        };
    }
}

/**
 * Processes multiple CSV entries and finds matching PDFs
 * @param directory The directory containing PDFs
 * @param entries Array of manufacturer and part number entries
 * @returns Results with match status and summary
 */
export async function processBomEntries(
    directory: string,
    entries: Array<{ manufacturer: string; partNumber: string }>
): Promise<{
    results: Array<{
        manufacturer: string;
        partNumber: string;
        matched: boolean;
        pdfPath?: string;
        fileName?: string;
    }>;
    summary: {
        total: number;
        matched: number;
        notFound: number;
    };
}> {
    try {
        // For efficiency, first get all PDF files in the directory
        const pdfFilesInfo = await scanPdfDirectory(directory);

        // Use the new matching function for bulk processing
        return matchBomToPdfs(entries, pdfFilesInfo, directory);
    } catch (error) {
        console.error('Error processing BOM entries:', error);
        return {
            results: entries.map(entry => ({
                manufacturer: entry.manufacturer,
                partNumber: entry.partNumber,
                matched: false
            })),
            summary: {
                total: entries.length,
                matched: 0,
                notFound: entries.length
            }
        };
    }
} 