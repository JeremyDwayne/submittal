const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const fs = require('fs/promises');

// Import type definitions
import type { IpcMainInvokeEvent } from 'electron';
import { scanPdfDirectory, processBomEntry, processBomEntries } from './utils/pdf-service';
import { parseBomCsv } from './utils/bom-parser';
import { mergePdfs } from './utils/pdf-merger';
import { uploadDirectoryPdfs, getUploadedFiles, deleteRemoteFile } from './utils/upload-service';
import {
  getPdfMetadata,
  listPdfMetadata,
  updatePdfMetadata,
  removePdfMetadata
} from './utils/pdf-metadata';
import {
  downloadPdfFromUploadThing,
  downloadMultiplePdfs
} from './utils/pdf-downloader';
import { syncPdfs } from './utils/sync-service';
import { createAndUploadManifest, downloadManifest } from './utils/manifest-service';
import { findPdfFiles, getPdfInfo as getPdfInfoFromFinder } from './utils/pdf-file-finder';
import {
  getSettings,
  setDirectorySettings,
  setPreferenceSettings,
  setLastSession,
  getDefaultDirectories,
  resetSettings
} from './utils/settings-service';
import {
  initializeProjectSystem,
  createProject,
  getAllProjects,
  getProject,
  getLastProject,
  setLastProject,
  updateProject,
  deleteProject,
  getProjectDirectories,
  getSharedPdfDirectory,
  setSharedPdfDirectory,
  Project
} from './utils/project-manager';
import { findPdfs } from './utils/pdf-finder';

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
  // Initialize project system
  await initializeProjectSystem();

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

  // PDF download from UploadThing
  ipcMain.handle('pdf:download', handleDownloadPdf);
  ipcMain.handle('pdfs:download-multiple', handleDownloadMultiplePdfs);

  // PDF syncing
  ipcMain.handle('pdfs:sync', handleSyncPdfs);

  // Session management
  ipcMain.handle('session:save', handleSaveSession);
  ipcMain.handle('session:load', handleLoadSession);

  // PDF metadata operations
  ipcMain.handle('pdf:get-metadata', handleGetPdfMetadata);
  ipcMain.handle('pdf:update-metadata', handleUpdatePdfMetadata);
  ipcMain.handle('pdf:remove-metadata', handleRemovePdfMetadata);
  ipcMain.handle('pdf:list-metadata', handleListPdfMetadata);

  // UploadThing operations
  ipcMain.handle('pdfs:upload', handleUploadPdfs);
  ipcMain.handle('uploads:list', handleListUploads);
  ipcMain.handle('upload:delete', handleDeleteUpload);

  // External URL handling
  ipcMain.handle('url:open-external', async (_event: IpcMainInvokeEvent, url: string) => {
    return shell.openExternal(url);
  });

  // Manifest related operations
  ipcMain.handle('manifest:create', handleCreateManifest);
  ipcMain.handle('manifest:download', handleDownloadManifest);

  // PDF Finder operations
  ipcMain.handle('pdfs:find-recursive', handleFindPdfFilesRecursively);

  // Settings management
  ipcMain.handle('settings:get', handleGetSettings);
  ipcMain.handle('settings:set-directories', handleSetDirectorySettings);
  ipcMain.handle('settings:set-preferences', handleSetPreferenceSettings);
  ipcMain.handle('settings:set-last-session', handleSetLastSession);
  ipcMain.handle('settings:get-defaults', handleGetDefaultDirectories);
  ipcMain.handle('settings:reset', handleResetSettings);

  // Project management
  ipcMain.handle('project:create', handleCreateProject);
  ipcMain.handle('project:get-all', handleGetAllProjects);
  ipcMain.handle('project:get', handleGetProject);
  ipcMain.handle('project:get-last', handleGetLastProject);
  ipcMain.handle('project:set-last', handleSetLastProject);
  ipcMain.handle('project:update', handleUpdateProject);
  ipcMain.handle('project:delete', handleDeleteProject);
  ipcMain.handle('project:get-directories', handleGetProjectDirectories);
  ipcMain.handle('project:get-shared-pdf-dir', handleGetSharedPdfDirectory);
  ipcMain.handle('project:set-shared-pdf-dir', handleSetSharedPdfDirectory);

  // Add this handler for finding PDFs
  ipcMain.handle('pdf:find', async (_: Electron.IpcMainInvokeEvent, directory: string, recursive: boolean) => {
    return await findPdfs(directory, recursive);
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

// New handlers for PDF metadata

/**
 * Handles getting metadata for a specific PDF file
 */
async function handleGetPdfMetadata(_event: IpcMainInvokeEvent, filePath: string) {
  try {
    if (!filePath) {
      return {
        success: false,
        error: 'No file path provided'
      };
    }

    const metadata = await getPdfMetadata(filePath);

    if (!metadata) {
      return {
        success: false,
        error: 'Metadata not found for the specified file'
      };
    }

    return {
      success: true,
      metadata
    };
  } catch (error) {
    console.error('Error getting PDF metadata:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles updating metadata for a PDF file
 */
async function handleUpdatePdfMetadata(
  _event: IpcMainInvokeEvent,
  partNumber: string,
  manufacturer: string,
  localPath: string,
  remoteUrl?: string
) {
  try {
    if (!localPath || !partNumber || !manufacturer) {
      return {
        success: false,
        error: 'Missing required parameters: partNumber, manufacturer, and localPath are required'
      };
    }

    // Check if file exists
    await fs.access(localPath).catch(() => {
      throw new Error(`File not found: ${localPath}`);
    });

    const metadata = await updatePdfMetadata(partNumber, manufacturer, localPath, remoteUrl);

    return {
      success: true,
      metadata
    };
  } catch (error) {
    console.error('Error updating PDF metadata:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles removing metadata for a PDF file
 */
async function handleRemovePdfMetadata(_event: IpcMainInvokeEvent, filePath: string) {
  try {
    if (!filePath) {
      return {
        success: false,
        error: 'No file path provided'
      };
    }

    const removed = await removePdfMetadata(filePath);

    return {
      success: removed,
      error: removed ? undefined : 'Metadata not found for the specified file'
    };
  } catch (error) {
    console.error('Error removing PDF metadata:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles listing all PDF metadata
 */
async function handleListPdfMetadata(_event: IpcMainInvokeEvent, options?: { onlyWithRemoteUrl?: boolean }) {
  try {
    let metadata = await listPdfMetadata();

    // Filter for only files with remote URLs if requested
    if (options?.onlyWithRemoteUrl) {
      metadata = metadata.filter(item => !!item.remoteUrl);
    }

    return {
      success: true,
      metadata
    };
  } catch (error) {
    console.error('Error listing PDF metadata:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles uploading PDFs to cloud storage
 */
async function handleUploadPdfs(_event: IpcMainInvokeEvent, directory: string, extractMetadata: boolean = true) {
  try {
    if (!directory) {
      return {
        success: false,
        error: 'No directory provided'
      };
    }

    // Check if directory exists
    await fs.access(directory).catch(() => {
      throw new Error(`Directory not found: ${directory}`);
    });

    // Upload PDFs with metadata extraction enabled
    const result = await uploadDirectoryPdfs(directory, extractMetadata);
    return result;
  } catch (error) {
    console.error('Error uploading PDFs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles listing uploaded files
 */
async function handleListUploads() {
  try {
    const uploads = await getUploadedFiles();
    return {
      success: true,
      uploads
    };
  } catch (error) {
    console.error('Error listing uploads:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles deleting an uploaded file
 */
async function handleDeleteUpload(_event: IpcMainInvokeEvent, filePath: string) {
  try {
    if (!filePath) {
      return {
        success: false,
        error: 'No file path provided'
      };
    }

    const result = await deleteRemoteFile(filePath);
    return {
      success: result,
      error: result ? undefined : 'Failed to delete file'
    };
  } catch (error) {
    console.error('Error deleting upload:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles downloading a PDF from UploadThing
 */
async function handleDownloadPdf(
  _event: IpcMainInvokeEvent,
  manufacturer: string,
  partNumber: string,
  remoteUrl?: string,
  forceDownload: boolean = false
) {
  try {
    if (!manufacturer || !partNumber) {
      return {
        success: false,
        error: 'Manufacturer and part number are required'
      };
    }

    const result = await downloadPdfFromUploadThing(manufacturer, partNumber, remoteUrl, forceDownload);
    return result;
  } catch (error) {
    console.error('Error downloading PDF:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles downloading multiple PDFs from UploadThing
 */
async function handleDownloadMultiplePdfs(
  _event: IpcMainInvokeEvent,
  items: Array<{
    manufacturer: string;
    partNumber: string;
    remoteUrl?: string;
  }>,
  forceDownload: boolean = false
) {
  try {
    if (!items || items.length === 0) {
      return {
        success: false,
        error: 'No items provided for download'
      };
    }

    return await downloadMultiplePdfs(items, forceDownload);
  } catch (error) {
    console.error('Error downloading multiple PDFs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles syncing PDFs
 */
async function handleSyncPdfs(
  _event: IpcMainInvokeEvent,
  projectId: string,
  forceRefresh: boolean = false
) {
  try {
    if (!projectId) {
      return {
        success: false,
        error: 'Project ID is required'
      };
    }

    const result = await syncPdfs(projectId, forceRefresh);
    return result;
  } catch (error) {
    console.error('Error syncing PDFs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Creates and uploads a manifest file
 */
async function handleCreateManifest(_event: IpcMainInvokeEvent, projectName?: string) {
  try {
    const name = projectName || 'manifest';
    const result = await createAndUploadManifest(name);

    return {
      success: result.success,
      url: result.url,
      manifestData: result.manifestData,
      error: result.error
    };
  } catch (error) {
    console.error('Error creating manifest:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Downloads and parses a manifest from a URL
 */
async function handleDownloadManifest(_event: IpcMainInvokeEvent, url: string) {
  try {
    if (!url) {
      return {
        success: false,
        error: 'URL is required'
      };
    }

    const result = await downloadManifest(url);

    return {
      success: result.success,
      manifest: result.manifest,
      error: result.error
    };
  } catch (error) {
    console.error('Error downloading manifest:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles recursively finding PDF files in a directory
 */
async function handleFindPdfFilesRecursively(
  _event: IpcMainInvokeEvent,
  directory: string,
  options?: {
    includeSubdirectories?: boolean;
    skipHiddenDirectories?: boolean;
  }
): Promise<{
  success: boolean;
  pdfFiles?: string[];
  fileInfo?: Array<{ path: string; name: string; size: number }>;
  error?: string;
}> {
  try {
    // Verify directory exists
    try {
      await fs.access(directory);
    } catch (error) {
      return {
        success: false,
        error: `Directory does not exist: ${directory}`
      };
    }

    // Find all PDF files
    const pdfFiles = await findPdfFiles(directory, options);

    // Get basic info about the files
    const fileInfo = await getPdfInfoFromFinder(pdfFiles);

    return {
      success: true,
      pdfFiles,
      fileInfo
    };
  } catch (error) {
    console.error('Error finding PDF files recursively:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles getting all settings
 */
async function handleGetSettings(_event: IpcMainInvokeEvent) {
  try {
    return {
      success: true,
      settings: getSettings()
    };
  } catch (error) {
    console.error('Error getting settings:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles setting directory preferences
 */
async function handleSetDirectorySettings(_event: IpcMainInvokeEvent, dirSettings: {
  defaultPdfDirectory?: string | null;
  defaultOutputDirectory?: string | null;
}) {
  try {
    setDirectorySettings(dirSettings);
    return {
      success: true
    };
  } catch (error) {
    console.error('Error setting directory settings:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles setting user preferences
 */
async function handleSetPreferenceSettings(_event: IpcMainInvokeEvent, prefSettings: {
  rememberLastProject?: boolean;
  autoScanDirectory?: boolean;
}) {
  try {
    setPreferenceSettings(prefSettings);
    return {
      success: true
    };
  } catch (error) {
    console.error('Error setting preference settings:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles updating last session information
 */
async function handleSetLastSession(_event: IpcMainInvokeEvent, sessionInfo: {
  pdfDirectory?: string | null;
  outputDirectory?: string | null;
  projectName?: string | null;
}) {
  try {
    setLastSession(sessionInfo);
    return {
      success: true
    };
  } catch (error) {
    console.error('Error setting last session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles getting default directories based on settings
 */
async function handleGetDefaultDirectories(_event: IpcMainInvokeEvent, projectName?: string) {
  try {
    const directories = await getDefaultDirectories(projectName);
    return {
      success: true,
      directories
    };
  } catch (error) {
    console.error('Error getting default directories:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles resetting all settings
 */
async function handleResetSettings(_event: IpcMainInvokeEvent) {
  try {
    resetSettings();
    return {
      success: true
    };
  } catch (error) {
    console.error('Error resetting settings:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles creating a new project
 */
async function handleCreateProject(_event: IpcMainInvokeEvent, name: string) {
  try {
    const project = await createProject(name);
    return {
      success: true,
      project
    };
  } catch (error) {
    console.error('Error creating project:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles getting all projects
 */
async function handleGetAllProjects(_event: IpcMainInvokeEvent) {
  try {
    const projects = getAllProjects();
    return {
      success: true,
      projects
    };
  } catch (error) {
    console.error('Error getting all projects:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles getting a project by ID
 */
async function handleGetProject(_event: IpcMainInvokeEvent, projectId: string) {
  try {
    const project = getProject(projectId);
    if (!project) {
      return {
        success: false,
        error: `Project with ID ${projectId} not found`
      };
    }
    return {
      success: true,
      project
    };
  } catch (error) {
    console.error('Error getting project:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles getting the last used project
 */
async function handleGetLastProject(_event: IpcMainInvokeEvent) {
  try {
    const project = getLastProject();
    return {
      success: true,
      project: project || null
    };
  } catch (error) {
    console.error('Error getting last project:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles setting the last used project
 */
async function handleSetLastProject(_event: IpcMainInvokeEvent, projectId: string | null) {
  try {
    setLastProject(projectId);
    return {
      success: true
    };
  } catch (error) {
    console.error('Error setting last project:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles updating a project
 */
async function handleUpdateProject(_event: IpcMainInvokeEvent, project: Project) {
  try {
    const updatedProject = await updateProject(project);
    return {
      success: true,
      project: updatedProject
    };
  } catch (error) {
    console.error('Error updating project:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles deleting a project
 */
async function handleDeleteProject(_event: IpcMainInvokeEvent, projectId: string) {
  try {
    const success = deleteProject(projectId);
    return {
      success
    };
  } catch (error) {
    console.error('Error deleting project:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles getting the default directories for a project
 */
async function handleGetProjectDirectories(_event: IpcMainInvokeEvent, projectId: string) {
  try {
    const directories = getProjectDirectories(projectId);
    return {
      success: true,
      directories
    };
  } catch (error) {
    console.error('Error getting project directories:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles getting the shared PDF directory
 */
async function handleGetSharedPdfDirectory(_event: IpcMainInvokeEvent) {
  try {
    const directory = getSharedPdfDirectory();
    return {
      success: true,
      directory
    };
  } catch (error) {
    console.error('Error getting shared PDF directory:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handles setting the shared PDF directory
 */
async function handleSetSharedPdfDirectory(_event: IpcMainInvokeEvent, directory: string) {
  try {
    setSharedPdfDirectory(directory);
    return {
      success: true
    };
  } catch (error) {
    console.error('Error setting shared PDF directory:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
} 