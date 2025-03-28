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
    }>
  ): Promise<{
    success: boolean;
    outputPath?: string;
    error?: string;
  }> => ipcRenderer.invoke('pdf:merge', pdfPaths, productInfo),

  // External URL handling
  openExternalUrl: (url: string): Promise<void> => ipcRenderer.invoke('url:open-external', url),
}); 