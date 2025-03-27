const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const fs = require('fs/promises');

// Import type definitions
import type { IpcMainInvokeEvent } from 'electron';

let mainWindow: typeof BrowserWindow | null = null;

// Create data directory if it doesn't exist
const createDataDir = async (): Promise<string> => {
  const dataPath = isDev
    ? path.join(__dirname, '../../..', 'data')
    : path.join(process.resourcesPath, 'data');

  try {
    await fs.access(dataPath);
  } catch (error) {
    await fs.mkdir(dataPath, { recursive: true });
  }

  return dataPath;
};

const createWindow = async (): Promise<void> => {
  // Create data directory but don't need to use the return value
  await createDataDir();

  // Get the correct path for the preload script
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('Preload script path:', preloadPath);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the appropriate URL based on development or production mode
  if (isDev) {
    console.log('Running in development mode, loading from localhost:3000');
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    console.log('Running in production mode');
    mainWindow.loadFile(path.join(__dirname, '../../renderer/dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

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

// IPC handlers
ipcMain.handle('dialog:open', async (_event: IpcMainInvokeEvent): Promise<string[]> => {
  if (!mainWindow) return [];

  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
  });

  return filePaths;
});

ipcMain.handle('pdf:save', async (
  _event: IpcMainInvokeEvent,
  { pdfPath, fileName }: { pdfPath: string; fileName: string }
): Promise<{ success: boolean; path?: string; error?: string }> => {
  try {
    const dataPath = await createDataDir();
    const targetPath = path.join(dataPath, fileName);

    const pdfData = await fs.readFile(pdfPath);
    await fs.writeFile(targetPath, pdfData);

    return { success: true, path: targetPath };
  } catch (error) {
    console.error('Error saving PDF:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('pdf:list', async (_event: IpcMainInvokeEvent): Promise<{
  success: boolean;
  files?: string[];
  error?: string;
}> => {
  try {
    const dataPath = await createDataDir();
    const files = await fs.readdir(dataPath);
    const pdfFiles = files.filter((file: string) => file.endsWith('.pdf'));

    return { success: true, files: pdfFiles };
  } catch (error) {
    console.error('Error listing PDFs:', error);
    return { success: false, error: (error as Error).message };
  }
});

// CSV processing handler
ipcMain.handle('csv:process', async (
  _event: IpcMainInvokeEvent,
  { parts }: { parts: Array<{ brand: string; part_number: string }> }
): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    console.log(`Received ${parts.length} parts for processing`);

    // Here you would implement the logic to fetch cut sheets for each part
    // This is a placeholder for the actual implementation
    for (const part of parts) {
      console.log(`Fetching cut sheet for ${part.brand} ${part.part_number}`);
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return {
      success: true,
      message: `Started processing ${parts.length} parts`
    };
  } catch (error) {
    console.error('Error processing CSV data:', error);
    return { success: false, error: (error as Error).message };
  }
}); 