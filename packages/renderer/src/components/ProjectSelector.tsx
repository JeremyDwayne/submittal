import { useEffect, useState } from 'react';
import './ProjectSelector.css';

interface Project {
    id: string;
    name: string;
    createdAt: string;
    lastAccessedAt: string;
    directories: {
        root: string;
        output: string;
    };
}

interface ProjectSelectorProps {
    onProjectSelected: (projectId: string) => void;
    onCancelled?: () => void;
}

export default function ProjectSelector({ onProjectSelected, onCancelled }: ProjectSelectorProps) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [newProjectName, setNewProjectName] = useState('');
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadProjects = async () => {
            try {
                setLoading(true);
                const result = await window.electron.getAllProjects();

                if (result.success && result.projects) {
                    setProjects(result.projects);

                    // Check for last used project
                    const lastResult = await window.electron.getLastProject();
                    if (lastResult.success && lastResult.project) {
                        setSelectedProjectId(lastResult.project.id);
                    } else if (result.projects.length > 0) {
                        // Select the first project if there's no last used project
                        setSelectedProjectId(result.projects[0].id);
                    }
                } else if (result.error) {
                    setError(result.error);
                }
            } catch (err) {
                setError('Failed to load projects. Please try again.');
                console.error('Error loading projects:', err);
            } finally {
                setLoading(false);
            }
        };

        loadProjects();
    }, []);

    const handleSelectProject = (projectId: string) => {
        setSelectedProjectId(projectId);
        setIsCreatingNew(false);
    };

    const handleCreateProject = async () => {
        if (!newProjectName.trim()) {
            setError('Please enter a project name');
            return;
        }

        try {
            setLoading(true);
            const result = await window.electron.createProject(newProjectName.trim());

            if (result.success && result.project) {
                setProjects(prev => [...prev, result.project as Project]);
                setSelectedProjectId(result.project.id);
                setNewProjectName('');
                setIsCreatingNew(false);
            } else if (result.error) {
                setError(result.error);
            }
        } catch (err) {
            setError('Failed to create project. Please try again.');
            console.error('Error creating project:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (selectedProjectId) {
            try {
                // Set as last project
                await window.electron.setLastProject(selectedProjectId);
                onProjectSelected(selectedProjectId);
            } catch (err) {
                setError('Failed to select project. Please try again.');
                console.error('Error selecting project:', err);
            }
        } else {
            setError('Please select a project or create a new one');
        }
    };

    return (
        <div className="project-selector-overlay">
            <div className="project-selector-container">
                <h2>Submittal Builder</h2>
                <h3>Select Project</h3>

                {error && <div className="error-message">{error}</div>}

                {loading ? (
                    <div className="loading">Loading projects...</div>
                ) : (
                    <>
                        {projects.length > 0 && (
                            <div className="project-list">
                                {projects.map(project => (
                                    <div
                                        key={project.id}
                                        className={`project-item ${selectedProjectId === project.id ? 'selected' : ''}`}
                                        onClick={() => handleSelectProject(project.id)}
                                    >
                                        <div className="project-name">{project.name}</div>
                                        <div className="project-date">
                                            Last accessed: {new Date(project.lastAccessedAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {isCreatingNew ? (
                            <div className="new-project-form">
                                <input
                                    type="text"
                                    placeholder="Project Name"
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    className="new-project-input"
                                />
                                <div className="new-project-actions">
                                    <button
                                        onClick={() => setIsCreatingNew(false)}
                                        className="btn-secondary"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleCreateProject}
                                        className="btn-primary"
                                        disabled={!newProjectName.trim()}
                                    >
                                        Create
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsCreatingNew(true)}
                                className="btn-secondary new-project-btn"
                            >
                                Create New Project
                            </button>
                        )}

                        <div className="project-selector-actions">
                            {onCancelled && (
                                <button
                                    onClick={onCancelled}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                onClick={handleSubmit}
                                className="btn-primary"
                                disabled={!selectedProjectId || isCreatingNew}
                            >
                                Open Project
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
} 