import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // File system operations
  openFile: (filePath: string): Promise<boolean> => ipcRenderer.invoke('file:open', filePath),
  selectFile: (fileTypeFilter?: string): Promise<string | null> => ipcRenderer.invoke('file:select', fileTypeFilter),
  selectFiles: (fileTypeFilter?: string): Promise<string[] | null> => ipcRenderer.invoke('files:select', fileTypeFilter),
  readFile: (filePath: string): Promise<string | null> => ipcRenderer.invoke('file:read', filePath),
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('folder:select'),

  // PDF operations - replace old API with new matching functionality
  scanPdfDirectory: (
    directory: string
  ): Promise<{
    success: boolean;
    pdfFiles?: Array<{
      pdfPath: string;
      fileName: string;
    }>;
    directory?: string;
    error?: string;
  }> => ipcRenderer.invoke('pdfs:scan', directory),

  findPdfMatch: (
    pdfDirectory: string,
    manufacturer: string,
    partNumber: string
  ): Promise<{
    success: boolean;
    manufacturer: string;
    partNumber: string;
    matched: boolean;
    pdfPath?: string;
    fileName?: string;
    error?: string;
  }> => ipcRenderer.invoke('pdf:find-match', pdfDirectory, manufacturer, partNumber),

  // PDF download operations
  downloadPdf: (
    manufacturer: string,
    partNumber: string,
    remoteUrl?: string,
    forceDownload?: boolean
  ): Promise<{
    success: boolean;
    localPath?: string;
    versionHash?: string;
    wasDownloaded?: boolean;
    error?: string;
    metadata?: {
      partNumber: string;
      manufacturer: string;
      localPath: string;
      remoteUrl?: string;
      versionHash: string;
      fileSize: number;
      lastUpdated: string;
      fileName: string;
    };
  }> => ipcRenderer.invoke('pdf:download', manufacturer, partNumber, remoteUrl, forceDownload),

  downloadMultiplePdfs: (
    items: Array<{
      manufacturer: string;
      partNumber: string;
      remoteUrl?: string;
    }>,
    forceDownload?: boolean
  ): Promise<{
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
  }> => ipcRenderer.invoke('pdfs:download-multiple', items, forceDownload),

  processBom: (
    csvFilePath: string,
    pdfDirectory: string
  ): Promise<{
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
  }> => ipcRenderer.invoke('bom:process', csvFilePath, pdfDirectory),

  // PDF merging operation
  createMergedPdf: (
    pdfPaths: string[],
    productInfo?: Array<{
      manufacturer: string;
      partNumber: string;
      fileName?: string;
    }>,
    outputDirectory?: string
  ): Promise<{
    success: boolean;
    outputPath?: string;
    error?: string;
  }> => ipcRenderer.invoke('pdf:merge', pdfPaths, productInfo, outputDirectory),

  // Session management
  saveSession: (
    sessionData: {
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
  ): Promise<{
    success: boolean;
    filePath?: string;
    error?: string;
  }> => ipcRenderer.invoke('session:save', sessionData),

  loadSession: (): Promise<{
    success: boolean;
    sessionData?: {
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
    };
    error?: string;
  }> => ipcRenderer.invoke('session:load'),

  // UploadThing integration
  uploadPdfs: (
    directory: string,
    extractMetadata?: boolean
  ): Promise<{
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
  }> => ipcRenderer.invoke('pdfs:upload', directory, extractMetadata),

  listUploads: (): Promise<{
    success: boolean;
    uploads?: Array<{
      partNumber: string;
      manufacturer: string;
      localPath: string;
      remoteUrl: string;
      versionHash: string;
      fileSize: number;
      lastUpdated: string;
      fileName: string;
    }>;
    error?: string;
  }> => ipcRenderer.invoke('uploads:list'),

  deleteUpload: (
    filePath: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> => ipcRenderer.invoke('upload:delete', filePath),

  // PDF metadata operations
  getPdfMetadata: (
    filePath: string
  ): Promise<{
    success: boolean;
    metadata?: {
      partNumber: string;
      manufacturer: string;
      localPath: string;
      remoteUrl?: string;
      versionHash: string;
      fileSize: number;
      lastUpdated: string;
      fileName: string;
    };
    error?: string;
  }> => ipcRenderer.invoke('pdf:get-metadata', filePath),

  updatePdfMetadata: (
    partNumber: string,
    manufacturer: string,
    localPath: string,
    remoteUrl?: string
  ): Promise<{
    success: boolean;
    metadata?: {
      partNumber: string;
      manufacturer: string;
      localPath: string;
      remoteUrl?: string;
      versionHash: string;
      fileSize: number;
      lastUpdated: string;
      fileName: string;
    };
    error?: string;
  }> => ipcRenderer.invoke('pdf:update-metadata', partNumber, manufacturer, localPath, remoteUrl),

  removePdfMetadata: (
    filePath: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> => ipcRenderer.invoke('pdf:remove-metadata', filePath),

  listPdfMetadata: (
    options?: { onlyWithRemoteUrl?: boolean }
  ): Promise<{
    success: boolean;
    metadata?: Array<{
      partNumber: string;
      manufacturer: string;
      localPath: string;
      remoteUrl?: string;
      versionHash: string;
      fileSize: number;
      lastUpdated: string;
      fileName: string;
    }>;
    error?: string;
  }> => ipcRenderer.invoke('pdf:list-metadata', options),

  // External URL handling
  openExternalUrl: (url: string): Promise<void> => ipcRenderer.invoke('url:open-external', url),
}); 