/// <reference types="vite/client" />

// Define session data interface
interface SessionData {
    pdfDirectory: string;
    csvFilePath: string;
    outputDirectory?: string;
    results?: {
        total: number;
        matched: number;
        notFound: number;
    };
    detailedResults?: Array<{
        manufacturer: string;
        partNumber: string;
        matched: boolean;
        pdfPath?: string;
        fileName?: string;
        overridden?: boolean;
    }>;
    createdAt: string;
    updatedAt: string;
}

// Define PdfMetadata interface
interface PdfMetadata {
    partNumber: string;
    manufacturer: string;
    localPath: string;
    remoteUrl?: string;
    versionHash: string;
    fileSize: number;
    lastUpdated: string;
    fileName: string;
}

interface ManifestEntry {
    remote_url: string;
    version_hash: string;
    file_size: number;
    manufacturer: string;
    last_updated: string;
}

interface PdfManifest {
    metadata: {
        generated_at: string;
        version: string;
    };
    files: Record<string, ManifestEntry>;
}

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

    // PDF download operations
    downloadPdf: (
        manufacturer: string,
        partNumber: string,
        remoteUrl?: string,
        forceDownload?: boolean
    ) => Promise<{
        success: boolean;
        localPath?: string;
        versionHash?: string;
        wasDownloaded?: boolean;
        error?: string;
        metadata?: PdfMetadata;
    }>;

    downloadMultiplePdfs: (
        items: Array<{
            manufacturer: string;
            partNumber: string;
            remoteUrl?: string;
        }>,
        forceDownload?: boolean
    ) => Promise<{
        success: boolean;
        results: Array<{
            manufacturer: string;
            partNumber: string;
            success: boolean;
            localPath?: string;
            wasDownloaded?: boolean;
            error?: string;
        }>;
        summary: {
            total: number;
            downloaded: number;
            alreadyCached: number;
            failed: number;
        };
    }>;

    // PDF sync operations
    syncPdfs: (
        projectId: string,
        forceRefresh?: boolean
    ) => Promise<{
        success: boolean;
        syncedFiles: {
            downloaded: Array<{
                manufacturer: string;
                partNumber: string;
                fileName: string;
                localPath?: string;
                remoteUrl?: string;
                action: 'downloaded' | 'uploaded' | 'up-to-date' | 'failed';
                error?: string;
            }>;
            uploaded: Array<{
                manufacturer: string;
                partNumber: string;
                fileName: string;
                localPath?: string;
                remoteUrl?: string;
                action: 'downloaded' | 'uploaded' | 'up-to-date' | 'failed';
                error?: string;
            }>;
            upToDate: Array<{
                manufacturer: string;
                partNumber: string;
                fileName: string;
                localPath?: string;
                remoteUrl?: string;
                action: 'downloaded' | 'uploaded' | 'up-to-date' | 'failed';
                error?: string;
            }>;
            failed: Array<{
                manufacturer: string;
                partNumber: string;
                fileName: string;
                localPath?: string;
                remoteUrl?: string;
                action: 'downloaded' | 'uploaded' | 'up-to-date' | 'failed';
                error?: string;
            }>;
        };
        summary: {
            total: number;
            downloaded: number;
            uploaded: number;
            upToDate: number;
            failed: number;
        };
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

    // PDF merging operation
    createMergedPdf: (
        pdfPaths: string[],
        productInfo?: Array<{
            manufacturer: string;
            partNumber: string;
            fileName?: string;
        }>,
        outputDirectory?: string
    ) => Promise<{
        success: boolean;
        outputPath?: string;
        error?: string;
    }>;

    // Session management
    saveSession: (
        sessionData: SessionData
    ) => Promise<{
        success: boolean;
        filePath?: string;
        error?: string;
    }>;

    loadSession: () => Promise<{
        success: boolean;
        sessionData?: SessionData;
        error?: string;
    }>;

    // UploadThing integration
    uploadPdfs: (
        directory: string,
        extractMetadata?: boolean
    ) => Promise<{
        success: boolean;
        results?: Array<{
            filePath: string;
            fileName: string;
            isUploaded: boolean;
            remoteUrl?: string;
            error?: string;
            wasSkipped?: boolean;
            manufacturer?: string;
            partNumber?: string;
        }>;
        summary?: {
            total: number;
            uploaded: number;
            failed: number;
            skipped: number;
        };
        error?: string;
    }>;

    listUploads: () => Promise<{
        success: boolean;
        uploads?: Array<PdfMetadata>;
        error?: string;
    }>;

    deleteUpload: (
        filePath: string
    ) => Promise<{
        success: boolean;
        error?: string;
    }>;

    // PDF metadata operations
    getPdfMetadata: (
        filePath: string
    ) => Promise<{
        success: boolean;
        metadata?: PdfMetadata;
        error?: string;
    }>;

    updatePdfMetadata: (
        partNumber: string,
        manufacturer: string,
        localPath: string,
        remoteUrl?: string
    ) => Promise<{
        success: boolean;
        metadata?: PdfMetadata;
        error?: string;
    }>;

    removePdfMetadata: (
        filePath: string
    ) => Promise<{
        success: boolean;
        error?: string;
    }>;

    listPdfMetadata: (
        options?: { onlyWithRemoteUrl?: boolean }
    ) => Promise<{
        success: boolean;
        metadata?: Array<PdfMetadata>;
        error?: string;
    }>;

    // External URL handling
    openExternalUrl: (url: string) => Promise<void>;

    // Manifest operations
    createManifest: (
        projectName?: string
    ) => Promise<{
        success: boolean;
        url?: string;
        manifestData?: PdfManifest;
        error?: string;
    }>;

    downloadManifest: (
        url: string
    ) => Promise<{
        success: boolean;
        manifest?: PdfManifest;
        error?: string;
    }>;
}

interface Window {
    electron: ElectronAPI;
} 