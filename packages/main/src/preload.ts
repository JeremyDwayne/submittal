import { contextBridge, ipcRenderer } from 'electron';

type CsvPart = {
  brand: string;
  part_number: string;
};

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // File system operations
  openFileDialog: (): Promise<string[]> => 
    ipcRenderer.invoke('dialog:open'),
    
  savePDF: (pdfPath: string, fileName: string): Promise<{
    success: boolean;
    path?: string;
    error?: string;
  }> => ipcRenderer.invoke('pdf:save', { pdfPath, fileName }),
    
  listPDFs: (): Promise<{
    success: boolean;
    files?: string[];
    error?: string;
  }> => ipcRenderer.invoke('pdf:list'),
  
  // CSV operations
  processCsvData: (parts: CsvPart[]): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> => ipcRenderer.invoke('csv:process', { parts }),
}); 