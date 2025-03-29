import Store from 'electron-store';
import fs from 'fs/promises';

// Define the schema for settings
interface SettingsSchema {
    directories: {
        defaultPdfDirectory: string | null;
        defaultOutputDirectory: string | null;
    };
    preferences: {
        rememberLastProject: boolean;
        autoScanDirectory: boolean;
    };
    lastSession: {
        pdfDirectory: string | null;
        outputDirectory: string | null;
        projectName: string | null;
    };
}

// Create the store with defaults
const store = new Store<SettingsSchema>({
    name: 'submittal-settings',
    defaults: {
        directories: {
            defaultPdfDirectory: null,
            defaultOutputDirectory: null,
        },
        preferences: {
            rememberLastProject: true,
            autoScanDirectory: true,
        },
        lastSession: {
            pdfDirectory: null,
            outputDirectory: null,
            projectName: null,
        }
    }
});

/**
 * Gets all application settings
 */
export function getSettings(): SettingsSchema {
    return store.store;
}

/**
 * Updates directory settings
 */
export function setDirectorySettings(settings: Partial<SettingsSchema['directories']>): void {
    const currentSettings = store.get('directories');
    store.set('directories', { ...currentSettings, ...settings });
}

/**
 * Updates preference settings
 */
export function setPreferenceSettings(settings: Partial<SettingsSchema['preferences']>): void {
    const currentSettings = store.get('preferences');
    store.set('preferences', { ...currentSettings, ...settings });
}

/**
 * Updates last session information
 */
export function setLastSession(sessionInfo: Partial<SettingsSchema['lastSession']>): void {
    const currentSession = store.get('lastSession');
    store.set('lastSession', { ...currentSession, ...sessionInfo });
}

/**
 * Gets directory settings with validation
 * Checks if directories still exist and returns valid paths
 */
export async function getValidatedDirectories(): Promise<{
    defaultPdfDirectory: string | null;
    defaultOutputDirectory: string | null;
}> {
    const directories = store.get('directories');

    // Validate PDF directory
    let pdfDir = directories.defaultPdfDirectory;
    if (pdfDir) {
        try {
            await fs.access(pdfDir);
        } catch {
            // Directory doesn't exist anymore
            pdfDir = null;
        }
    }

    // Validate output directory
    let outputDir = directories.defaultOutputDirectory;
    if (outputDir) {
        try {
            await fs.access(outputDir);
        } catch {
            // Directory doesn't exist anymore
            outputDir = null;
        }
    }

    return {
        defaultPdfDirectory: pdfDir,
        defaultOutputDirectory: outputDir
    };
}

/**
 * Gets last session with validation
 * Checks if directories still exist
 */
export async function getValidatedLastSession(): Promise<{
    pdfDirectory: string | null;
    outputDirectory: string | null;
    projectName: string | null;
}> {
    const lastSession = store.get('lastSession');
    const preferences = store.get('preferences');

    // If remember last project is disabled, return null values
    if (!preferences.rememberLastProject) {
        return {
            pdfDirectory: null,
            outputDirectory: null,
            projectName: null
        };
    }

    // Validate PDF directory
    let pdfDir = lastSession.pdfDirectory;
    if (pdfDir) {
        try {
            await fs.access(pdfDir);
        } catch {
            // Directory doesn't exist anymore
            pdfDir = null;
        }
    }

    // Validate output directory
    let outputDir = lastSession.outputDirectory;
    if (outputDir) {
        try {
            await fs.access(outputDir);
        } catch {
            // Directory doesn't exist anymore
            outputDir = null;
        }
    }

    return {
        pdfDirectory: pdfDir,
        outputDirectory: outputDir,
        projectName: lastSession.projectName
    };
}

/**
 * Determines the default directories based on settings and context
 */
export async function getDefaultDirectories(projectName?: string): Promise<{
    pdfDirectory: string | null;
    outputDirectory: string | null;
}> {
    const preferences = store.get('preferences');

    // If remember last project is enabled, use last project directories
    if (preferences.rememberLastProject) {
        const lastSession = await getValidatedLastSession();

        // If a project name is provided and matches the last session, use those directories
        if (projectName && projectName === lastSession.projectName) {
            return {
                pdfDirectory: lastSession.pdfDirectory,
                outputDirectory: lastSession.outputDirectory
            };
        }
    }

    // Otherwise, use the global default directories
    const defaultDirs = await getValidatedDirectories();

    return {
        pdfDirectory: defaultDirs.defaultPdfDirectory,
        outputDirectory: defaultDirs.defaultOutputDirectory
    };
}

/**
 * Resets all settings to default values
 */
export function resetSettings(): void {
    store.clear();
} 