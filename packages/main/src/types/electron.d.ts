// Type declarations for Electron specific APIs
import { BrowserWindow, IpcMainEvent, IpcMainInvokeEvent } from 'electron';

declare global {
  namespace NodeJS {
    interface Process {
      resourcesPath: string;
    }
  }

  interface IpcEventHandlers {
    'dialog:open': (event: IpcMainInvokeEvent) => Promise<string[]>;
    'pdf:save': (event: IpcMainInvokeEvent, args: { pdfPath: string, fileName: string }) => Promise<{ success: boolean, path?: string, error?: string }>;
    'pdf:list': (event: IpcMainInvokeEvent) => Promise<{ success: boolean, files?: string[], error?: string }>;
    'csv:process': (event: IpcMainInvokeEvent, args: { parts: Array<{ brand: string, part_number: string }> }) => Promise<{ success: boolean, message?: string, error?: string }>;
  }
} 