/**
 * PDF Match Demo - Example of using the PDF matching functions
 * 
 * This file provides examples of how to use the PDF matching functions
 * in a Node.js environment.
 */

import { parseBomCsv } from './bom-parser';
import { matchBomToPdfs, scanPdfDirectory } from './pdf-service';

/**
 * Demo 1: Match BOM entries directly to PDF filenames
 */
async function directMatchDemo() {
    // Example BOM entries
    const bomEntries = [
        { manufacturer: 'Schneider Electric', partNumber: 'SE8600U5045' },
        { manufacturer: 'Johnson Controls', partNumber: 'MS-VMA1620-0' },
        { manufacturer: 'ABB', partNumber: 'ACH550-01-012A-4' }
    ];

    // Example PDF filenames
    const pdfFiles = [
        'schneider_electric_se8600u5045_datasheet.pdf',
        'JohnsonControls-MS-VMA1620-0-Cut-Sheet.pdf',
        'siemens_building_controller_599-90812.pdf'
    ];

    // Match BOM entries to PDF filenames
    const results = matchBomToPdfs(bomEntries, pdfFiles);

    console.log('Direct Match Results:');
    console.log(JSON.stringify(results, null, 2));
}

/**
 * Demo 2: Parse a CSV file and match against PDF files in a directory
 */
async function csvFileMatchDemo(csvFilePath: string, pdfDirectory: string) {
    try {
        // Parse the CSV file
        const bomEntries = await parseBomCsv(csvFilePath, {
            manufacturerField: ['manufacturer', 'brand', 'vendor'],
            partNumberField: ['part_number', 'partnumber', 'part no', 'model'],
            hasHeaderRow: true
        });

        // Scan the PDF directory
        const pdfFiles = await scanPdfDirectory(pdfDirectory);

        // Match BOM entries to PDF files
        const results = matchBomToPdfs(bomEntries, pdfFiles);

        console.log('CSV File Match Results:');
        console.log(`Total Entries: ${results.summary.total}`);
        console.log(`Matched: ${results.summary.matched}`);
        console.log(`Not Found: ${results.summary.notFound}`);

        // Print detailed results
        console.log('\nDetailed Results:');
        results.results.forEach((result, index) => {
            console.log(`Entry ${index + 1}: ${result.manufacturer} ${result.partNumber}`);
            if (result.matched) {
                console.log(`  ✅ Matched: ${result.fileName}`);
            } else {
                console.log(`  ❌ Not Found`);
            }
        });

        return results;
    } catch (error) {
        console.error('Error in CSV file match demo:', error);
        throw error;
    }
}

/**
 * Run the demos
 */
async function runDemos() {
    // Demo 1: Direct Matching
    await directMatchDemo();

    // Demo 2: CSV File Matching
    // Uncomment and update paths to run
    /*
    // Uncomment to use path
    // import path from 'path';
    const csvFilePath = './data/sample.csv';
    const pdfDirectory = './data/pdfs';
    await csvFileMatchDemo(csvFilePath, pdfDirectory);
    */
}

// Only run if called directly
if (require.main === module) {
    runDemos().catch(console.error);
}

// Export the demo functions
export { directMatchDemo, csvFileMatchDemo }; 