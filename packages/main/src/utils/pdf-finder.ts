import fs from 'fs';
import path from 'path';

/**
 * Finds PDF files in a directory with optional recursive search
 * @param directory The directory to search
 * @param recursive Whether to search subdirectories
 * @returns An object containing success status and found PDF files
 */
export async function findPdfs(directory: string, recursive: boolean = false): Promise<{
    success: boolean;
    files?: Array<{ path: string; name: string; size: number }>;
    error?: string;
}> {
    try {
        if (!fs.existsSync(directory)) {
            return {
                success: false,
                error: 'Directory does not exist'
            };
        }

        const pdfFiles: Array<{ path: string; name: string; size: number }> = [];

        // Function to search for PDFs in a directory
        const searchDirectory = (dir: string) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                // Skip hidden files and directories
                if (entry.name.startsWith('.')) {
                    continue;
                }

                if (entry.isDirectory() && recursive) {
                    // Search subdirectory recursively
                    searchDirectory(fullPath);
                } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
                    const stats = fs.statSync(fullPath);
                    pdfFiles.push({
                        path: fullPath,
                        name: entry.name,
                        size: stats.size
                    });
                }
            }
        };

        // Start the search
        searchDirectory(directory);

        return {
            success: true,
            files: pdfFiles
        };
    } catch (error) {
        console.error('Error finding PDFs:', error);
        return {
            success: false,
            error: (error as Error).message
        };
    }
} 