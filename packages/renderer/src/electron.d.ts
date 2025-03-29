interface ElectronAPI {
  openFileDialog: () => Promise<string[]>;
  savePDF: (pdfPath: string, fileName: string) => Promise<{
    success: boolean;
    path?: string;
    error?: string;
  }>;
  listPDFs: () => Promise<{
    success: boolean;
    files?: string[];
    error?: string;
  }>;
  processCsvData: (parts: Array<{ brand: string, part_number: string }>) => Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }>;
  findSchneiderPdf: (partNumber: string) => Promise<{
    success: boolean;
    url?: string;
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
  }>;
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
  listCachedPdfs: () => Promise<{
    success: boolean;
    data?: Record<string, any[]>;
    error?: string;
  }>;
  clearPdfCache: (
    brand?: string,
    partNumber?: string
  ) => Promise<{
    success: boolean;
    entriesRemoved: number;
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
  openFile: (filePath: string) => Promise<boolean>;
  selectFile: (fileTypeFilter?: string) => Promise<string | null>;
  selectFiles: (fileTypeFilter?: string) => Promise<string[] | null>;
  readFile: (filePath: string) => Promise<string | null>;
  selectFolder: () => Promise<string | null>;
  findPdfUrl: (brand: string, partNumber: string) => Promise<string | null>;
  saveCsvParts: (
    csvData: string,
    fileName: string
  ) => Promise<{
    success: boolean;
    filePath?: string;
    error?: string;
  }>;
  processCsvData: (
    filePath: string
  ) => Promise<{
    success: boolean;
    results?: Array<{
      brand: string;
      partNumber: string;
      filePath?: string;
      url?: string;
      error?: string;
      cacheHit?: boolean;
    }>;
    summary?: {
      total: number;
      successful: number;
      failed: number;
      fromCache: number;
    };
    error?: string;
  }>;
  openExternalUrl: (url: string) => Promise<void>;
  findPdfFilesRecursively: (
    directory: string,
    options?: {
      includeSubdirectories?: boolean;
      skipHiddenDirectories?: boolean;
    }
  ) => Promise<{
    success: boolean;
    pdfFiles?: string[];
    fileInfo?: Array<{
      path: string;
      name: string;
      size: number;
    }>;
    error?: string;
  }>;
}

interface Window {
  electron: ElectronAPI;
} 