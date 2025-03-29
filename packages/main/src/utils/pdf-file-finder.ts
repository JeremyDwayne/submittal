import { promises as fs } from 'fs';
import path from 'path';

/**
 * Recursively searches for PDF files within a directory
 * 
 * @param directory Directory path to search in
 * @param options Optional configuration
 * @returns Promise that resolves to an array of PDF file paths
 */
export async function findPdfFiles(
    directory: string,
    options: {
        includeSubdirectories?: boolean;
        skipHiddenDirectories?: boolean;
    } = {
            includeSubdirectories: true,
            skipHiddenDirectories: true
        }
): Promise<string[]> {
    // Default options
    const { includeSubdirectories = true, skipHiddenDirectories = true } = options;

    // Results array
    const results: string[] = [];

    try {
        // Read the contents of the directory
        const entries = await fs.readdir(directory, { withFileTypes: true });

        // Process each entry
        for (const entry of entries) {
            const entryPath = path.join(directory, entry.name);

            // Skip hidden directories if option is enabled
            if (entry.isDirectory()) {
                const isHidden = entry.name.startsWith('.');
                if (includeSubdirectories && !(skipHiddenDirectories && isHidden)) {
                    // Recursively search subdirectories
                    const subdirectoryResults = await findPdfFiles(entryPath, options);
                    results.push(...subdirectoryResults);
                }
            } else if (entry.isFile()) {
                // Check if file is a PDF
                const extname = path.extname(entry.name).toLowerCase();
                if (extname === '.pdf') {
                    results.push(entryPath);
                }
            }
        }

        return results;
    } catch (error) {
        console.error(`Error searching directory ${directory}:`, error);
        throw new Error(`Failed to search directory: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Gets basic information about found PDF files
 * 
 * @param pdfPaths Array of PDF file paths
 * @returns Array of PDF file objects with path and name
 */
export async function getPdfInfo(pdfPaths: string[]): Promise<Array<{ path: string; name: string; size: number }>> {
    const results = await Promise.all(
        pdfPaths.map(async (filePath) => {
            try {
                const stats = await fs.stat(filePath);
                return {
                    path: filePath,
                    name: path.basename(filePath),
                    size: stats.size
                };
            } catch (error) {
                console.warn(`Could not get info for ${filePath}:`, error);
                return {
                    path: filePath,
                    name: path.basename(filePath),
                    size: 0
                };
            }
        })
    );

    return results;
}

/**
 * Example usage:
 * 
 * const pdfFiles = await findPdfFiles('/path/to/directory');
 * console.log(`Found ${pdfFiles.length} PDF files`);
 * 
 * // With options
 * const pdfFiles = await findPdfFiles('/path/to/directory', {
 *   includeSubdirectories: true,
 *   skipHiddenDirectories: true
 * });
 */ 