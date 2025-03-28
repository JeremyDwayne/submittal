/// <reference types="vite/client" />

interface ElectronAPI {
    // File system operations
    openFile: (filePath: string) => Promise<boolean>;
    selectFile: (fileTypeFilter?: string) => Promise<string | null>;
    selectFiles: (fileTypeFilter?: string) => Promise<string[] | null>;
    readFile: (filePath: string) => Promise<string | null>;
    selectFolder: () => Promise<string | null>;

    // PDF/BOM matching operations
    scanPdfDirectory: (
        directory: string
    ) => Promise<{
        success: boolean;
        pdfFiles?: Array<{
            pdfPath: string;
            fileName: string;
        }>;
        directory?: string;
        error?: string;
    }>;

    findPdfMatch: (
        pdfDirectory: string,
        manufacturer: string,
        partNumber: string
    ) => Promise<{
        success: boolean;
        manufacturer: string;
        partNumber: string;
        matched: boolean;
        pdfPath?: string;
        fileName?: string;
        error?: string;
    }>;

    processBom: (
        csvFilePath: string,
        pdfDirectory: string
    ) => Promise<{
        success: boolean;
        results?: Array<{
            manufacturer: string;
            partNumber: string;
            matched: boolean;
            pdfPath?: string;
            fileName?: string;
        }>;
        summary?: {
            total: number;
            matched: number;
            notFound: number;
        };
        error?: string;
    }>;

    // External URL handling
    openExternalUrl: (url: string) => Promise<void>;
}

interface Window {
    electron: ElectronAPI;
} 