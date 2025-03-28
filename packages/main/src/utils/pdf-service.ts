import fs from 'fs/promises';
import path from 'path';

interface PdfMatch {
    manufacturer: string;
    partNumber: string;
    pdfPath: string;
    fileName: string;
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
        const normalizedManufacturer = manufacturer.toLowerCase().replace(/[_\-\s]/g, '');
        const normalizedPartNumber = partNumber.toLowerCase().replace(/[_\-\s]/g, '');

        // Get all files in the directory
        const files = await fs.readdir(directory);

        // Filter for PDF files only
        const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === '.pdf');

        // Look for a match
        for (const pdfFile of pdfFiles) {
            // Normalize the filename - lowercase and remove special characters
            const normalizedFilename = pdfFile.toLowerCase().replace(/[_\-\s]/g, '');

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
 * Process a CSV row and find matching PDF
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
    try {
        const matchedPdfPath = await findMatchingPdf(directory, manufacturer, partNumber);

        if (matchedPdfPath) {
            return {
                manufacturer,
                partNumber,
                matched: true,
                pdfPath: matchedPdfPath,
                fileName: path.basename(matchedPdfPath)
            };
        } else {
            return {
                manufacturer,
                partNumber,
                matched: false
            };
        }
    } catch (error) {
        console.error('Error processing BOM entry:', error);
        return {
            manufacturer,
            partNumber,
            matched: false
        };
    }
}

/**
 * Process multiple CSV entries and find matching PDFs
 * @param directory The directory containing PDFs
 * @param entries Array of manufacturer and part number pairs
 * @returns Results with match status for each entry
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
    const results = [];
    let matched = 0;
    let notFound = 0;

    for (const entry of entries) {
        const result = await processBomEntry(directory, entry.manufacturer, entry.partNumber);
        results.push(result);

        if (result.matched) {
            matched++;
        } else {
            notFound++;
        }
    }

    return {
        results,
        summary: {
            total: entries.length,
            matched,
            notFound
        }
    };
} 