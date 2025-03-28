/// <reference types="vite/client" />

interface ElectronAPI {
    openFile: (filePath: string) => Promise<boolean>;
    selectFile: (fileTypeFilter?: string) => Promise<string | null>;
    selectFiles: (fileTypeFilter?: string) => Promise<string[] | null>;
    readFile: (filePath: string) => Promise<string | null>;
    selectFolder: () => Promise<string | null>;

    findPdfUrl: (brand: string, partNumber: string) => Promise<string | null>;

    downloadPdf: (
        url: string,
        brand: string,
        partNumber: string,
        forceRefresh?: boolean
    ) => Promise<{
        success: boolean;
        filePath?: string;
        cacheHit?: boolean;
        error?: string;
    }>;

    findAndDownloadPdf: (
        brand: string,
        partNumber: string,
        forceRefresh?: boolean
    ) => Promise<{
        success: boolean;
        filePath?: string;
        url?: string;
        cacheHit?: boolean;
        error?: string;
    }>;

    findSchneiderPdf: (partNumber: string) => Promise<{
        success: boolean;
        url?: string;
        error?: string;
        multipleResults?: boolean;
    }>;

    searchSchneiderProducts: (query: string) => Promise<{
        success: boolean;
        results?: Array<{
            title: string;
            url: string;
            description?: string;
            imageUrl?: string;
            partNumber: string;
        }>;
        error?: string;
    }>;

    getSchneiderProductDetails: (productUrl: string) => Promise<{
        success: boolean;
        title?: string;
        description?: string;
        partNumber?: string;
        datasheetUrl?: string;
        documentUrls?: Array<{ title: string, url: string, type: string }>;
        error?: string;
    }>;

    findAndDownloadSchneiderPdf: (
        partNumber: string,
        forceRefresh?: boolean
    ) => Promise<{
        success: boolean;
        filePath?: string;
        url?: string;
        cacheHit?: boolean;
        error?: string;
        multipleResults?: boolean;
    }>;

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