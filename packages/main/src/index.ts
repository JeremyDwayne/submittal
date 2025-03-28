const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const fs = require('fs/promises');

// Import type definitions
import type { IpcMainInvokeEvent } from 'electron';
import { scanPdfDirectory, processBomEntry, processBomEntries } from './utils/pdf-service';
import { parseBomCsv } from './utils/bom-parser';
import { mergePdfs } from './utils/pdf-merger';

// Add session type definition
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

let mainWindow: typeof BrowserWindow | null = null;

// Create data directory if it doesn't exist
const createDataDir = async (): Promise<string> => {
  const userDataPath = isDev
    ? path.join(__dirname, '../../../..', 'data')
    : path.join(app.getPath('userData'), 'data');

  try {
    await fs.mkdir(userDataPath, { recursive: true });
    return userDataPath;
  } catch (error) {
    console.error('Error creating data directory:', error);
    throw error;
  }
};

const createWindow = async (): Promise<void> => {
  const dataDir = await createDataDir();
  console.log('Data directory:', dataDir);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    await mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../../renderer/dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Register IPC handlers
  registerIpcHandlers();
};

// Register all IPC handlers
function registerIpcHandlers() {
  // File operations
  ipcMain.handle('file:open', async (_event: IpcMainInvokeEvent, filePath: string) => {
    return shell.openPath(filePath);
  });

  ipcMain.handle('file:select', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'All Files', extensions: ['*'] }]
    });

    if (canceled || filePaths.length === 0) {
      return null;
    }

    return filePaths[0];
  });

  ipcMain.handle('files:select', async (_event: IpcMainInvokeEvent, fileTypeFilter?: string) => {
    let filters = [];

    if (fileTypeFilter) {
      const extension = fileTypeFilter.startsWith('.') ? fileTypeFilter.slice(1) : fileTypeFilter;
      filters = [
        { name: `${extension.toUpperCase()} Files`, extensions: [extension] },
        { name: 'All Files', extensions: ['*'] }
      ];
    } else {
      filters = [{ name: 'All Files', extensions: ['*'] }];
    }

    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters
    });

    if (canceled || filePaths.length === 0) {
      return null;
    }

    return filePaths;
  });

  ipcMain.handle('file:read', async (_event: IpcMainInvokeEvent, filePath: string) => {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      console.error('Error reading file:', error);
      return null;
    }
  });

  ipcMain.handle('folder:select', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });

    if (canceled || filePaths.length === 0) {
      return null;
    }

    return filePaths[0];
  });

  // PDF/BOM operations
  ipcMain.handle('bom:process', handleProcessBom);
  ipcMain.handle('pdfs:scan', handleScanPdfs);
  ipcMain.handle('pdf:find-match', handleFindPdfMatch);
  ipcMain.handle('pdf:merge', handleMergePdfs);

  // Session management
  ipcMain.handle('session:save', handleSaveSession);
  ipcMain.handle('session:load', handleLoadSession);

  // External URL handling
  ipcMain.handle('url:open-external', async (_event: IpcMainInvokeEvent, url: string) => {
    return shell.openExternal(url);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handlers for PDF matching
/**
 * Handles scanning a directory for PDFs
 */
async function handleScanPdfs(_event: IpcMainInvokeEvent, pdfDirectory: string) {
  try {
    if (!pdfDirectory) {
      return {
        success: false,
        error: 'No directory provided'
      };
    }

    const pdfFiles = await scanPdfDirectory(pdfDirectory);

    return {
      success: true,
      pdfFiles,
      directory: pdfDirectory
    };
  } catch (error) {
    console.error('Error scanning PDFs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles finding a PDF match for a single manufacturer/part number
 */
async function handleFindPdfMatch(
  _event: IpcMainInvokeEvent,
  pdfDirectory: string,
  manufacturer: string,
  partNumber: string
) {
  try {
    if (!pdfDirectory || !manufacturer || !partNumber) {
      return {
        success: false,
        error: 'Missing required parameters'
      };
    }

    const result = await processBomEntry(pdfDirectory, manufacturer, partNumber);

    return {
      success: true,
      ...result
    };
  } catch (error) {
    console.error('Error finding PDF match:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles processing a BOM CSV file
 */
async function handleProcessBom(_event: IpcMainInvokeEvent, csvFilePath: string, pdfDirectory: string) {
  try {
    if (!csvFilePath || !pdfDirectory) {
      return {
        success: false,
        error: 'Missing required parameters'
      };
    }

    // Parse CSV file using the BOM parser
    const entries = await parseBomCsv(csvFilePath, {
      // Try multiple common column names for manufacturer and part number
      manufacturerField: ['manufacturer', 'brand', 'vendor'],
      partNumberField: ['part_number', 'partnumber', 'part number', 'part no', 'model'],
      hasHeaderRow: true
    });

    if (entries.length === 0) {
      return {
        success: false,
        error: 'No valid entries found in the CSV file'
      };
    }

    // Process BOM entries against PDF directory
    const results = await processBomEntries(pdfDirectory, entries);

    return {
      success: true,
      ...results
    };
  } catch (error) {
    console.error('Error processing BOM CSV:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles merging multiple PDF files into a single PDF
 */
async function handleMergePdfs(_event: IpcMainInvokeEvent, pdfPaths: string[], productInfo?: Array<{ manufacturer: string; partNumber: string; fileName?: string }>, outputDirectory?: string) {
  try {
    if (!pdfPaths || pdfPaths.length === 0) {
      return {
        success: false,
        error: 'No PDF paths provided'
      };
    }

    // Generate a filename with current date
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const outputFileName = `Submittal-${dateStr}.pdf`;

    // If user has pre-selected an output directory in the UI, use that
    if (outputDirectory) {
      // Merge PDFs
      const outputPath = await mergePdfs(pdfPaths, outputFileName, outputDirectory, productInfo);

      // Attempt to open the PDF after creation
      shell.openPath(outputPath);

      return {
        success: true,
        outputPath
      };
    }

    // Otherwise, allow user to select output directory
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Output Directory for Submittal Package',
      buttonLabel: 'Save Here'
    });

    if (canceled || filePaths.length === 0) {
      // User canceled the dialog, use default directory
      const outputPath = await mergePdfs(pdfPaths, outputFileName, undefined, productInfo);

      // Attempt to open the PDF after creation
      shell.openPath(outputPath);

      return {
        success: true,
        outputPath
      };
    } else {
      // User selected a directory
      const selectedDirectory = filePaths[0];
      const outputPath = await mergePdfs(pdfPaths, outputFileName, selectedDirectory, productInfo);

      // Attempt to open the PDF after creation
      shell.openPath(outputPath);

      return {
        success: true,
        outputPath
      };
    }
  } catch (error) {
    console.error('Error merging PDFs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles saving the current session to a JSON file
 */
async function handleSaveSession(_event: IpcMainInvokeEvent, sessionData: SessionData) {
  try {
    if (!sessionData) {
      return {
        success: false,
        error: 'No session data provided'
      };
    }

    // Add timestamps
    sessionData.updatedAt = new Date().toISOString();

    // Allow user to select output file
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save Session',
      defaultPath: `submittal-session-${new Date().toISOString().split('T')[0]}.json`,
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['createDirectory']
    });

    if (canceled || !filePath) {
      return {
        success: false,
        error: 'Save operation canceled'
      };
    }

    // Save session data to file
    await fs.writeFile(filePath, JSON.stringify(sessionData, null, 2), 'utf-8');

    return {
      success: true,
      filePath
    };
  } catch (error) {
    console.error('Error saving session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles loading a session from a JSON file
 */
async function handleLoadSession(_event: IpcMainInvokeEvent) {
  try {
    // Allow user to select file
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Load Session',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (canceled || filePaths.length === 0) {
      return {
        success: false,
        error: 'Load operation canceled'
      };
    }

    // Read session data from file
    const filePath = filePaths[0];
    const fileData = await fs.readFile(filePath, 'utf-8');
    const sessionData = JSON.parse(fileData) as SessionData;

    // Validate session data
    if (!sessionData.pdfDirectory || !sessionData.csvFilePath) {
      return {
        success: false,
        error: 'Invalid session data: missing required fields'
      };
    }

    // Verify files exist
    const pdfDirectoryExists = await fileExists(sessionData.pdfDirectory);
    const csvFileExists = await fileExists(sessionData.csvFilePath);

    if (!pdfDirectoryExists || !csvFileExists) {
      return {
        success: false,
        error: `Some referenced files no longer exist: ${!pdfDirectoryExists ? 'PDF directory' : ''} ${!csvFileExists ? 'CSV file' : ''}`
      };
    }

    // If there are detailed results, verify that the PDF paths still exist
    if (sessionData.detailedResults) {
      const verifiedResults = await Promise.all(
        sessionData.detailedResults.map(async (result) => {
          if (result.pdfPath) {
            const exists = await fileExists(result.pdfPath);
            if (!exists) {
              // Mark as not matched if the file no longer exists
              return {
                ...result,
                matched: false,
                pdfPath: undefined,
                fileName: undefined
              };
            }
          }
          return result;
        })
      );

      sessionData.detailedResults = verifiedResults;

      // Recalculate summary
      if (sessionData.results) {
        const matched = verifiedResults.filter(r => r.matched).length;
        sessionData.results.matched = matched;
        sessionData.results.notFound = sessionData.results.total - matched;
      }
    }

    return {
      success: true,
      sessionData
    };
  } catch (error) {
    console.error('Error loading session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Helper function to check if a file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
} 