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
  processCsvData: (parts: Array<{brand: string, part_number: string}>) => Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }>;
}

interface Window {
  electron: ElectronAPI;
} 