import { useEffect, useState, useRef } from 'react';
import './Settings.css';

export interface SettingsProps {
    onClose: () => void;
    pdfDirectory: string | null;
    outputDirectory: string | null;
    onPdfDirectoryChange: (directory: string | null) => void;
    onOutputDirectoryChange: (directory: string | null) => void;
    onSelectPdfDirectory: () => Promise<void>;
    onSelectOutputDirectory: () => Promise<void>;
}

export default function Settings({
    onClose,
    pdfDirectory,
    outputDirectory,
    onPdfDirectoryChange,
    onOutputDirectoryChange,
    onSelectPdfDirectory,
    onSelectOutputDirectory
}: SettingsProps) {
    const [sharedPdfDirectory, setSharedPdfDirectory] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    // Load shared PDF directory on mount
    useEffect(() => {
        const loadSharedPdfDirectory = async () => {
            try {
                setIsLoading(true);
                const result = await window.electron.getSharedPdfDirectory();
                if (result.success && result.directory) {
                    setSharedPdfDirectory(result.directory);
                }
            } catch (error) {
                console.error('Error loading shared PDF directory:', error);
                setMessage(`Error: ${(error as Error).message}`);
            } finally {
                setIsLoading(false);
            }
        };

        loadSharedPdfDirectory();
    }, []);

    // Handle click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        // Handle escape key to close
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    const selectSharedPdfDirectory = async () => {
        try {
            const directory = await window.electron.selectFolder();
            if (directory) {
                setSharedPdfDirectory(directory);
                await window.electron.setSharedPdfDirectory(directory);
                setMessage('Shared PDF directory updated successfully');
            }
        } catch (error) {
            console.error('Error selecting shared PDF directory:', error);
            setMessage(`Error: ${(error as Error).message}`);
        }
    };

    const resetSettings = async () => {
        try {
            setIsLoading(true);
            const result = await window.electron.resetSettings();
            if (result.success) {
                setMessage('Settings reset successfully');

                // Get updated directories
                const dirResult = await window.electron.getDefaultDirectories();
                if (dirResult.success && dirResult.directories) {
                    onPdfDirectoryChange(dirResult.directories.pdfDirectory);
                    onOutputDirectoryChange(dirResult.directories.outputDirectory);
                }

                // Get updated shared PDF directory
                const sharedResult = await window.electron.getSharedPdfDirectory();
                if (sharedResult.success && sharedResult.directory) {
                    setSharedPdfDirectory(sharedResult.directory);
                }
            } else {
                setMessage(`Error resetting settings: ${result.error}`);
            }
        } catch (error) {
            console.error('Error resetting settings:', error);
            setMessage(`Error: ${(error as Error).message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="settings-overlay" onClick={onClose}>
            <div className="settings-container" ref={modalRef} onClick={(e) => e.stopPropagation()}>
                <div className="settings-header">
                    <h2>Settings</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>

                {message && (
                    <div className="settings-message">
                        {message}
                        <button
                            className="message-close-button"
                            onClick={() => setMessage(null)}
                        >
                            ×
                        </button>
                    </div>
                )}

                <div className="settings-section">
                    <h3>Project Directories</h3>

                    <div className="settings-group">
                        <label>Default PDF Directory:</label>
                        <div className="input-group">
                            <input
                                type="text"
                                value={pdfDirectory || ''}
                                readOnly
                                placeholder="No directory selected"
                            />
                            <button
                                onClick={onSelectPdfDirectory}
                                disabled={isLoading}
                            >
                                Browse
                            </button>
                        </div>
                    </div>

                    <div className="settings-group">
                        <label>Default Output Directory:</label>
                        <div className="input-group">
                            <input
                                type="text"
                                value={outputDirectory || ''}
                                readOnly
                                placeholder="No directory selected"
                            />
                            <button
                                onClick={onSelectOutputDirectory}
                                disabled={isLoading}
                            >
                                Browse
                            </button>
                        </div>
                    </div>
                </div>

                <div className="settings-section">
                    <h3>Shared Resources</h3>

                    <div className="settings-group">
                        <label>Shared PDF Directory:</label>
                        <div className="input-group">
                            <input
                                type="text"
                                value={sharedPdfDirectory}
                                readOnly
                                placeholder="No directory selected"
                            />
                            <button
                                onClick={selectSharedPdfDirectory}
                                disabled={isLoading}
                            >
                                Browse
                            </button>
                        </div>
                        <p className="settings-help">
                            This directory contains PDFs accessible to all projects
                        </p>
                    </div>
                </div>

                <div className="settings-actions">
                    <button
                        className="reset-button"
                        onClick={resetSettings}
                        disabled={isLoading}
                    >
                        Reset All Settings
                    </button>
                    <button
                        className="save-button"
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
} 