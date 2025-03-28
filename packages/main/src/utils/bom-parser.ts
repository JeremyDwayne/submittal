import fs from 'fs/promises';
import { parse } from 'csv-parse/sync';

/**
 * Configuration options for parsing a BOM CSV file
 */
export interface BomParserOptions {
    /**
     * Column name or index for manufacturer field
     * @default "manufacturer"
     */
    manufacturerField?: string | number | string[];

    /**
     * Column name or index for part number field
     * @default "part_number"
     */
    partNumberField?: string | number | string[];

    /**
     * Whether to skip the header row
     * @default true
     */
    hasHeaderRow?: boolean;

    /**
     * CSV delimiter character
     * @default ","
     */
    delimiter?: string;
}

/**
 * A BOM entry with manufacturer and part number
 */
export interface BomEntry {
    manufacturer: string;
    partNumber: string;
    [key: string]: any; // Allow additional fields
}

/**
 * Parse a CSV file containing BOM entries
 * @param filePath Path to the CSV file
 * @param options Parsing options
 * @returns Array of BOM entries
 */
export async function parseBomCsv(
    filePath: string,
    options: BomParserOptions = {}
): Promise<BomEntry[]> {
    // Set default options
    const {
        manufacturerField = 'manufacturer',
        partNumberField = 'part_number',
        hasHeaderRow = true,
        delimiter = ','
    } = options;

    try {
        // Read the CSV file
        const fileContent = await fs.readFile(filePath, 'utf-8');

        // Parse CSV content
        const records = parse(fileContent, {
            columns: hasHeaderRow,
            skip_empty_lines: true,
            trim: true,
            delimiter
        });

        if (records.length === 0) {
            return [];
        }

        // Map records to BOM entries
        return records.map((record: any) => {
            // Handle column names or indices based on the options
            let manufacturer = '', partNumber = '';

            if (typeof manufacturerField === 'string') {
                // Single string column name
                manufacturer = record[manufacturerField];
            } else if (Array.isArray(manufacturerField)) {
                // Array of possible column names - find the first that exists
                for (const field of manufacturerField) {
                    if (record[field]) {
                        manufacturer = record[field];
                        break;
                    }
                }
            } else {
                // Column index
                const keys = Object.keys(record);
                manufacturer = record[keys[manufacturerField] || 0];
            }

            if (typeof partNumberField === 'string') {
                // Single string column name
                partNumber = record[partNumberField];
            } else if (Array.isArray(partNumberField)) {
                // Array of possible column names - find the first that exists
                for (const field of partNumberField) {
                    if (record[field]) {
                        partNumber = record[field];
                        break;
                    }
                }
            } else {
                // Column index
                const keys = Object.keys(record);
                partNumber = record[keys[partNumberField] || 1];
            }

            return {
                manufacturer: manufacturer || '',
                partNumber: partNumber || '',
                ...record // Include all other fields
            };
        }).filter((entry: BomEntry) => entry.manufacturer && entry.partNumber);
    } catch (error) {
        console.error('Error parsing BOM CSV file:', error);
        throw new Error(`Failed to parse BOM CSV: ${(error as Error).message}`);
    }
}

/**
 * Convert an array of objects to a CSV string
 * @param data Array of objects to convert
 * @param headers Column headers
 * @returns CSV string
 */
export function convertToCSV(data: any[], headers?: string[]): string {
    if (!data.length) return '';

    // Use provided headers or extract from first object
    const csvHeaders = headers || Object.keys(data[0]);

    // Create header row
    const headerRow = csvHeaders.join(',');

    // Create data rows
    const rows = data.map(item => {
        return csvHeaders.map(header => {
            // Handle values with commas by wrapping in quotes
            const value = item[header] !== undefined ? String(item[header]) : '';
            return value.includes(',') ? `"${value}"` : value;
        }).join(',');
    });

    // Combine header and data rows
    return [headerRow, ...rows].join('\n');
} 