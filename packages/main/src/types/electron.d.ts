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
    'schneider:find-pdf': (event: IpcMainInvokeEvent, partNumber: string) => Promise<{ success: boolean, url?: string, error?: string }>;
    'pdf:download': (event: IpcMainInvokeEvent, args: { url: string, brand: string, partNumber: string, forceRefresh?: boolean }) => Promise<{ success: boolean, filePath?: string, cacheHit?: boolean, error?: string }>;
    'pdf:list-cache': (event: IpcMainInvokeEvent) => Promise<{ success: boolean, data?: Record<string, any[]>, error?: string }>;
    'pdf:clear-cache': (event: IpcMainInvokeEvent, args: { brand?: string, partNumber?: string }) => Promise<{ success: boolean, entriesRemoved: number, error?: string }>;
    'pdf:find-and-download': (event: IpcMainInvokeEvent, args: { brand: string, partNumber: string, forceRefresh?: boolean }) => Promise<{ success: boolean, filePath?: string, url?: string, cacheHit?: boolean, error?: string }>;
  }
} 