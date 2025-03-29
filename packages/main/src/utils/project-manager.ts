import { app } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import Store from 'electron-store';
import isDev from 'electron-is-dev';

// Interface for project metadata
export interface Project {
    id: string;
    name: string;
    createdAt: string;
    lastAccessedAt: string;
    directories: {
        root: string;
        output: string;
    };
}

// Interface for the store schema
interface ProjectStoreSchema {
    projects: Record<string, Project>;
    lastProjectId: string | null;
    sharedPdfDirectory: string;
}

// Create the store with defaults
const store = new Store<ProjectStoreSchema>({
    name: 'submittal-projects',
    defaults: {
        projects: {},
        lastProjectId: null,
        sharedPdfDirectory: ''
    }
});

/**
 * Sets up the initial project storage and shared directories
 */
export async function initializeProjectSystem(): Promise<void> {
    // Get the base directory (Documents folder)
    const baseDir = getBaseDirectory();

    // Setup the shared PDF directory if not already set
    let sharedPdfDir = store.get('sharedPdfDirectory');
    if (!sharedPdfDir) {
        sharedPdfDir = path.join(baseDir, 'Submittal', 'SharedPDFs');
        store.set('sharedPdfDirectory', sharedPdfDir);
    }

    // Create shared PDF directory if it doesn't exist
    await fs.mkdir(sharedPdfDir, { recursive: true });

    // Ensure each project directory exists
    const projects = store.get('projects');
    for (const projectId in projects) {
        const project = projects[projectId];
        await fs.mkdir(project.directories.root, { recursive: true });
        await fs.mkdir(project.directories.output, { recursive: true });
    }
}

/**
 * Gets the user's Documents directory
 */
export function getBaseDirectory(): string {
    if (isDev) {
        return path.join(__dirname, '../../../..', 'data');
    }

    // In production, use the Documents folder
    const documentsDir = path.join(app.getPath('documents'));
    return documentsDir;
}

/**
 * Gets the shared PDF directory
 */
export function getSharedPdfDirectory(): string {
    let dir = store.get('sharedPdfDirectory');

    if (!dir) {
        const baseDir = getBaseDirectory();
        dir = path.join(baseDir, 'Submittal', 'SharedPDFs');
        store.set('sharedPdfDirectory', dir);
    }

    return dir;
}

/**
 * Sets the shared PDF directory
 */
export function setSharedPdfDirectory(directory: string): void {
    store.set('sharedPdfDirectory', directory);
}

/**
 * Creates a new project
 */
export async function createProject(
    name: string
): Promise<Project> {
    // Generate a unique project ID
    const projectId = `project_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Create project directory structure
    const baseDir = getBaseDirectory();
    const projectRoot = path.join(baseDir, 'Submittal', 'Projects', sanitizeName(name));
    const outputDir = path.join(projectRoot, 'Output');

    // Create directories
    await fs.mkdir(projectRoot, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });

    const now = new Date().toISOString();

    // Create project data
    const project: Project = {
        id: projectId,
        name,
        createdAt: now,
        lastAccessedAt: now,
        directories: {
            root: projectRoot,
            output: outputDir
        }
    };

    // Save to store
    const projects = store.get('projects');
    projects[projectId] = project;
    store.set('projects', projects);

    // Set as last project
    setLastProject(projectId);

    return project;
}

/**
 * Sanitizes a project name for use in a directory name
 */
function sanitizeName(name: string): string {
    return name
        .replace(/[/\\?%*:|"<>]/g, '-') // Replace invalid chars with dash
        .replace(/\s+/g, '_')           // Replace spaces with underscore
        .replace(/_{2,}/g, '_');        // Remove multiple underscores
}

/**
 * Gets all projects
 */
export function getAllProjects(): Project[] {
    const projects = store.get('projects');
    return Object.values(projects).sort((a, b) =>
        new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
    );
}

/**
 * Gets a project by ID
 */
export function getProject(projectId: string): Project | null {
    const projects = store.get('projects');
    return projects[projectId] || null;
}

/**
 * Gets the last used project
 */
export function getLastProject(): Project | null {
    const lastProjectId = store.get('lastProjectId');
    if (!lastProjectId) return null;

    return getProject(lastProjectId);
}

/**
 * Sets the last used project
 */
export function setLastProject(projectId: string | null): void {
    store.set('lastProjectId', projectId);

    // Update last accessed time if project exists
    if (projectId) {
        const projects = store.get('projects');
        if (projects[projectId]) {
            projects[projectId].lastAccessedAt = new Date().toISOString();
            store.set('projects', projects);
        }
    }
}

/**
 * Updates a project
 */
export async function updateProject(project: Project): Promise<Project> {
    const projects = store.get('projects');

    // Ensure project exists
    if (!projects[project.id]) {
        throw new Error(`Project with ID ${project.id} not found`);
    }

    // Update project in store
    projects[project.id] = {
        ...project,
        lastAccessedAt: new Date().toISOString()
    };

    store.set('projects', projects);
    return projects[project.id];
}

/**
 * Deletes a project
 * Note: This only removes the project metadata, not the actual files
 */
export function deleteProject(projectId: string): boolean {
    const projects = store.get('projects');

    // Ensure project exists
    if (!projects[projectId]) {
        return false;
    }

    // Remove project from store
    delete projects[projectId];
    store.set('projects', projects);

    // Clear last project if it's the deleted one
    if (store.get('lastProjectId') === projectId) {
        store.set('lastProjectId', null);
    }

    return true;
}

/**
 * Gets the default directories for a project
 */
export function getProjectDirectories(projectId: string): {
    pdfDirectory: string;
    outputDirectory: string;
} | null {
    const project = getProject(projectId);
    if (!project) return null;

    return {
        pdfDirectory: getSharedPdfDirectory(),
        outputDirectory: project.directories.output
    };
} 