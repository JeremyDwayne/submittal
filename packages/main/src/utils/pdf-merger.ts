import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { PDFDocument as PDFLib, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import isDev from 'electron-is-dev';

/**
 * Creates a directory for storing merged PDFs
 * @returns Path to the merged PDFs directory
 */
async function ensureMergedPdfDirectory(): Promise<string> {
    const userDataPath = isDev
        ? path.join(__dirname, '../../../..', 'data')
        : path.join(app.getPath('userData'), 'data');

    const mergedPdfsDir = path.join(userDataPath, 'merged_pdfs');

    try {
        await fs.mkdir(mergedPdfsDir, { recursive: true });
        return mergedPdfsDir;
    } catch (error) {
        console.error('Error creating merged PDFs directory:', error);
        throw error;
    }
}

/**
 * Merges multiple PDF files into a single PDF
 * @param pdfPaths Array of paths to PDF files to merge
 * @param outputFileName Optional name for the output file
 * @param outputDirectory Optional user-selected directory to save the file
 * @param productInfo Optional information about the products for the table of contents
 * @returns Path to the merged PDF file
 */
export async function mergePdfs(
    pdfPaths: string[],
    outputFileName?: string,
    outputDirectory?: string,
    productInfo?: Array<{
        manufacturer: string;
        partNumber: string;
        fileName?: string;
    }>
): Promise<string> {
    try {
        if (!pdfPaths.length) {
            throw new Error('No PDF paths provided');
        }

        // Ensure all paths exist
        for (const pdfPath of pdfPaths) {
            await fs.access(pdfPath).catch(() => {
                throw new Error(`PDF file not found: ${pdfPath}`);
            });
        }

        // Determine output directory
        let outputDir: string;

        if (outputDirectory) {
            // Use user-selected directory
            outputDir = outputDirectory;

            // Ensure directory exists
            await fs.access(outputDir).catch(async () => {
                throw new Error(`Output directory not found: ${outputDir}`);
            });
        } else {
            // Use default directory
            outputDir = await ensureMergedPdfDirectory();
        }

        // Generate output filename if not provided
        const fileName = outputFileName || `Submittal.pdf`;
        const outputPath = path.join(outputDir, fileName);

        // Use pdf-lib to merge PDFs
        const mergedPdf = await PDFLib.create();

        // Add fonts for the table of contents
        const helveticaBold = await mergedPdf.embedFont(StandardFonts.HelveticaBold);
        const helvetica = await mergedPdf.embedFont(StandardFonts.Helvetica);

        // Create a table of contents page if product info is provided
        if (productInfo && productInfo.length > 0) {
            const tocPage = mergedPdf.addPage([612, 792]); // Letter size

            // Add title
            tocPage.drawText('SUBMITTAL PACKAGE', {
                x: 50,
                y: 730,
                size: 24,
                font: helveticaBold,
                color: rgb(0, 0, 0)
            });

            tocPage.drawText('TABLE OF CONTENTS', {
                x: 50,
                y: 700,
                size: 16,
                font: helveticaBold,
                color: rgb(0, 0, 0)
            });

            // Add date
            const currentDate = new Date().toLocaleDateString();
            tocPage.drawText(`Date: ${currentDate}`, {
                x: 50,
                y: 670,
                size: 12,
                font: helvetica,
                color: rgb(0, 0, 0)
            });

            // Add table header
            tocPage.drawText('ITEM', {
                x: 50,
                y: 630,
                size: 12,
                font: helveticaBold,
                color: rgb(0, 0, 0)
            });

            tocPage.drawText('MANUFACTURER', {
                x: 100,
                y: 630,
                size: 12,
                font: helveticaBold,
                color: rgb(0, 0, 0)
            });

            tocPage.drawText('PART NUMBER', {
                x: 300,
                y: 630,
                size: 12,
                font: helveticaBold,
                color: rgb(0, 0, 0)
            });

            tocPage.drawText('PAGE', {
                x: 500,
                y: 630,
                size: 12,
                font: helveticaBold,
                color: rgb(0, 0, 0)
            });

            // Add divider line
            tocPage.drawLine({
                start: { x: 50, y: 620 },
                end: { x: 562, y: 620 },
                thickness: 1,
                color: rgb(0, 0, 0)
            });

            // Add items
            let y = 600;
            productInfo.forEach((product, index) => {
                // Draw item number
                tocPage.drawText(`${index + 1}`, {
                    x: 50,
                    y,
                    size: 11,
                    font: helvetica,
                    color: rgb(0, 0, 0)
                });

                // Draw manufacturer (limit to 25 chars)
                const manufacturer = product.manufacturer.length > 25
                    ? product.manufacturer.substring(0, 22) + '...'
                    : product.manufacturer;

                tocPage.drawText(manufacturer, {
                    x: 100,
                    y,
                    size: 11,
                    font: helvetica,
                    color: rgb(0, 0, 0)
                });

                // Draw part number
                tocPage.drawText(product.partNumber, {
                    x: 300,
                    y,
                    size: 11,
                    font: helvetica,
                    color: rgb(0, 0, 0)
                });

                // Draw page number (starts at 2 because TOC is page 1)
                tocPage.drawText(`${index + 2}`, {
                    x: 500,
                    y,
                    size: 11,
                    font: helvetica,
                    color: rgb(0, 0, 0)
                });

                // Decrease y for next row
                y -= 20;

                // If we run out of space, we should create a new page
                // but for simplicity we'll just continue on the same page
                if (y < 100) {
                    y = 600;
                }
            });
        }

        // Add each PDF in order
        for (const pdfPath of pdfPaths) {
            const pdfBytes = await fs.readFile(pdfPath);
            const pdf = await PDFLib.load(pdfBytes);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page: PDFPage) => {
                mergedPdf.addPage(page);
            });
        }

        const mergedPdfBytes = await mergedPdf.save();
        await fs.writeFile(outputPath, mergedPdfBytes);

        return outputPath;
    } catch (error) {
        console.error('Error merging PDFs:', error);
        throw error;
    }
} 