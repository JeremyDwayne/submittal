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

// Define settings interfaces
interface DirectorySettings {
    defaultPdfDirectory: string | null;
    defaultOutputDirectory: string | null;
}

interface PreferenceSettings {
    rememberLastProject: boolean;
    autoScanDirectory: boolean;
}

interface LastSessionInfo {
    pdfDirectory: string | null;
    outputDirectory: string | null;
    projectName: string | null;
}

interface SettingsSchema {
    directories: DirectorySettings;
    preferences: PreferenceSettings;
    lastSession: LastSessionInfo;
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

interface ProjectData {
    id: string;
    name: string;
    createdAt: string;
    lastAccessedAt: string;
    directories: {
        root: string;
        output: string;
    };
}

interface ProjectDirectoriesData {
    pdfDirectory: string;
    outputDirectory: string;
}

// Define the Electron API interface
interface ElectronAPI {
    // File system operations
    openFile: (filePath: string) => Promise<boolean>;
    selectFile: (fileTypeFilter?: string) => Promise<string | null>;
    selectFiles: (fileTypeFilter?: string) => Promise<string[] | null>;
    readFile: (filePath: string) => Promise<string | null>;
    selectFolder: () => Promise<string | null>;
    openExternalUrl: (url: string) => Promise<boolean>;

    // PDF operations
    scanPdfDirectory: (directory: string) => Promise<{
        success: boolean;
        pdfFiles?: Array<{ pdfPath: string; fileName: string }>;
        directory?: string;
        error?: string;
    }>;
    findPdfMatch: (pdfDirectory: string, manufacturer: string, partNumber: string) => Promise<{
        success: boolean;
        manufacturer: string;
        partNumber: string;
        matched: boolean;
        pdfPath?: string;
        fileName?: string;
        error?: string;
    }>;
    processBom: (csvPath: string, pdfDirectory: string) => Promise<{
        success: boolean;
        summary?: {
            total: number;
            matched: number;
            notFound: number;
        };
        results?: Array<{
            manufacturer: string;
            partNumber: string;
            matched: boolean;
            pdfPath?: string;
            fileName?: string;
        }>;
        error?: string;
    }>;
    overrideMatch: (pdfDirectory: string, manufacturer: string, partNumber: string) => Promise<{
        success: boolean;
        manufacturer: string;
        partNumber: string;
        matched: boolean;
        pdfPath?: string;
        fileName?: string;
        overridden?: boolean;
        error?: string;
    }>;
    clearOverride: (manufacturer: string, partNumber: string) => Promise<{
        success: boolean;
        manufacturer: string;
        partNumber: string;
        matched: boolean;
        error?: string;
    }>;
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
    saveSession: (sessionData: SessionData) => Promise<{
        success: boolean;
        filePath?: string;
        error?: string;
    }>;
    loadSession: () => Promise<{
        success: boolean;
        sessionData?: SessionData;
        error?: string;
    }>;

    // Upload operations
    uploadPdfs: (directory: string) => Promise<{
        success: boolean;
        results?: Array<{
            fileName: string;
            success: boolean;
            url?: string;
            size?: number;
            error?: string;
        }>;
        error?: string;
    }>;
    getUploadedFiles: () => Promise<{
        success: boolean;
        files?: Array<{
            fileName: string;
            url: string;
            size: number;
            localPath: string;
        }>;
        error?: string;
    }>;
    deleteUpload: (localPath: string) => Promise<{
        success: boolean;
        error?: string;
    }>;

    // PDF finder operations
    findPdfFilesRecursively: (
        directory: string,
        options?: {
            includeSubdirectories?: boolean;
            skipHiddenDirectories?: boolean;
        }
    ) => Promise<{
        success: boolean;
        pdfFiles?: string[];
        fileInfo?: Array<{ path: string; name: string; size: number }>;
        error?: string;
    }>;

    // Manifest operations
    createManifest: (
        projectName: string
    ) => Promise<{
        success: boolean;
        url?: string;
        manifestData?: object;
        error?: string;
    }>;
    downloadManifest: (
        url: string
    ) => Promise<{
        success: boolean;
        manifestData?: object;
        error?: string;
    }>;

    // Settings management
    getSettings: () => Promise<{
        success: boolean;
        settings?: SettingsSchema;
        error?: string;
    }>;
    setDirectorySettings: (settings: Partial<DirectorySettings>) => Promise<{
        success: boolean;
        error?: string;
    }>;
    setPreferenceSettings: (settings: Partial<PreferenceSettings>) => Promise<{
        success: boolean;
        error?: string;
    }>;
    setLastSession: (sessionInfo: Partial<LastSessionInfo>) => Promise<{
        success: boolean;
        error?: string;
    }>;
    getDefaultDirectories: (projectName?: string) => Promise<{
        success: boolean;
        directories?: {
            pdfDirectory: string | null;
            outputDirectory: string | null;
        };
        error?: string;
    }>;
    resetSettings: () => Promise<{
        success: boolean;
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

    // Project management
    createProject: (name: string) => Promise<{
        success: boolean;
        project?: ProjectData;
        error?: string;
    }>;
    getAllProjects: () => Promise<{
        success: boolean;
        projects?: ProjectData[];
        error?: string;
    }>;
    getProject: (projectId: string) => Promise<{
        success: boolean;
        project?: ProjectData;
        error?: string;
    }>;
    getLastProject: () => Promise<{
        success: boolean;
        project?: ProjectData | null;
        error?: string;
    }>;
    setLastProject: (projectId: string | null) => Promise<{
        success: boolean;
        error?: string;
    }>;
    updateProject: (project: ProjectData) => Promise<{
        success: boolean;
        project?: ProjectData;
        error?: string;
    }>;
    deleteProject: (projectId: string) => Promise<{
        success: boolean;
        error?: string;
    }>;
    getProjectDirectories: (projectId: string) => Promise<{
        success: boolean;
        directories?: ProjectDirectoriesData;
        error?: string;
    }>;
    getSharedPdfDirectory: () => Promise<{
        success: boolean;
        directory?: string;
        error?: string;
    }>;
    setSharedPdfDirectory: (directory: string) => Promise<{
        success: boolean;
        error?: string;
    }>;

    // PDF finder
    findPdfs: (directory: string, recursive: boolean) => Promise<{
        success: boolean;
        files?: Array<{ path: string; name: string; size: number }>;
        error?: string;
    }>;
}

interface Window {
    electron: ElectronAPI;
} 