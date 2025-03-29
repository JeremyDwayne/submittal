import { findPdfFiles, getPdfInfo } from './pdf-file-finder';
import path from 'path';
import { app } from 'electron';
import isDev from 'electron-is-dev';
import { matchBomToPdfs } from './pdf-service';

/**
 * Example usage of PDF file finder for the Submittal Builder app
 */
async function pdfFinderDemo() {
    try {
        // Get the base directory for PDF files (data/cut_sheets in development)
        const baseDir = isDev
            ? path.join(__dirname, '../../../..', 'data', 'cut_sheets')
            : path.join(app.getPath('userData'), 'data', 'cut_sheets');

        console.log(`Searching for PDFs in: ${baseDir}`);

        // Find all PDF files in the directory and subdirectories
        const pdfFiles = await findPdfFiles(baseDir);

        console.log(`Found ${pdfFiles.length} PDF files`);

        // Get additional info about the files
        const pdfInfoList = await getPdfInfo(pdfFiles);

        // Print information about the first 5 files
        console.log('\nFirst 5 PDFs:');
        pdfInfoList.slice(0, 5).forEach(pdf => {
            console.log(`- ${pdf.name} (${(pdf.size / 1024).toFixed(2)} KB)`);
        });

        // Example: Use with the existing PDF matching service
        const sampleBom = [
            { manufacturer: 'Schneider Electric', partNumber: 'BDL36060' },
            { manufacturer: 'ABB', partNumber: 'ACH550-01-012A-4' },
            { manufacturer: 'Johnson Controls', partNumber: 'MS-VMA1620-0' }
        ];

        console.log('\nMatching BOM entries to found PDFs...');

        // Use the matchBomToPdfs function from pdf-service.ts with our found files
        const matchResults = matchBomToPdfs(sampleBom, pdfFiles);

        console.log('\nMatch results:');
        console.log(`Total entries: ${matchResults.summary.total}`);
        console.log(`Matched: ${matchResults.summary.matched}`);
        console.log(`Not found: ${matchResults.summary.notFound}`);

        // Print detailed results
        console.log('\nDetailed matches:');
        matchResults.results.forEach(result => {
            if (result.matched) {
                console.log(`✅ ${result.manufacturer} ${result.partNumber} -> ${path.basename(result.pdfPath!)}`);
            } else {
                console.log(`❌ ${result.manufacturer} ${result.partNumber} -> Not found`);
            }
        });

        return {
            pdfFiles,
            pdfInfoList,
            matchResults
        };
    } catch (error) {
        console.error('Error in PDF finder demo:', error);
        throw error;
    }
}

// Only run if called directly (for testing)
if (require.main === module) {
    pdfFinderDemo().catch(console.error);
}

export { pdfFinderDemo }; 