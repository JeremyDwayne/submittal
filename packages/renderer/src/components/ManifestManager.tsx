import React, { useState } from 'react';
import './ManifestManager.css';

interface ManifestManagerProps {
    onCreateSuccess?: (url: string) => void;
    onDownloadSuccess?: (manifest: any) => void;
    onError?: (error: string) => void;
}

const ManifestManager: React.FC<ManifestManagerProps> = ({
    onCreateSuccess,
    onDownloadSuccess,
    onError
}) => {
    const [projectName, setProjectName] = useState('');
    const [manifestUrl, setManifestUrl] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [manifestData, setManifestData] = useState<any>(null);

    const handleCreateManifest = async () => {
        setIsCreating(true);
        setSuccessMessage('');

        try {
            const result = await window.electron.createManifest(projectName);

            if (result.success && result.url) {
                setManifestUrl(result.url);
                setManifestData(result.manifestData);
                setSuccessMessage(`Manifest created and uploaded!`);

                if (onCreateSuccess) {
                    onCreateSuccess(result.url);
                }
            } else {
                const errorMsg = result.error || 'Failed to create manifest';
                setSuccessMessage('');

                if (onError) {
                    onError(errorMsg);
                }
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);

            if (onError) {
                onError(errorMsg);
            }
        } finally {
            setIsCreating(false);
        }
    };

    const handleDownloadManifest = async () => {
        if (!manifestUrl) {
            if (onError) {
                onError('Please enter a manifest URL');
            }
            return;
        }

        setIsDownloading(true);
        setSuccessMessage('');

        try {
            const result = await window.electron.downloadManifest(manifestUrl);

            if (result.success && result.manifest) {
                setManifestData(result.manifest);
                setSuccessMessage('Manifest downloaded successfully!');

                if (onDownloadSuccess) {
                    onDownloadSuccess(result.manifest);
                }
            } else {
                const errorMsg = result.error || 'Failed to download manifest';
                setSuccessMessage('');

                if (onError) {
                    onError(errorMsg);
                }
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);

            if (onError) {
                onError(errorMsg);
            }
        } finally {
            setIsDownloading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setSuccessMessage('URL copied to clipboard!');
            setTimeout(() => {
                setSuccessMessage('');
            }, 2000);
        });
    };

    const openInBrowser = async (url: string) => {
        await window.electron.openExternalUrl(url);
    };

    return (
        <div className="manifest-manager">
            <h2>PDF Manifest Manager</h2>

            <div className="manifest-section">
                <h3>Create New Manifest</h3>
                <div className="input-group">
                    <input
                        type="text"
                        placeholder="Project Name (optional)"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        disabled={isCreating}
                    />
                    <button
                        className="create-button"
                        onClick={handleCreateManifest}
                        disabled={isCreating}
                    >
                        {isCreating ? 'Creating...' : 'Create Manifest'}
                    </button>
                </div>
            </div>

            <div className="manifest-section">
                <h3>Download Manifest</h3>
                <div className="input-group">
                    <input
                        type="text"
                        placeholder="Manifest URL"
                        value={manifestUrl}
                        onChange={(e) => setManifestUrl(e.target.value)}
                        disabled={isDownloading}
                    />
                    <button
                        className="download-button"
                        onClick={handleDownloadManifest}
                        disabled={isDownloading || !manifestUrl}
                    >
                        {isDownloading ? 'Downloading...' : 'Download Manifest'}
                    </button>
                </div>
            </div>

            {successMessage && (
                <div className="success-message">
                    {successMessage}
                </div>
            )}

            {manifestUrl && (
                <div className="manifest-url-section">
                    <h3>Manifest URL</h3>
                    <div className="url-display">
                        <span className="url">{manifestUrl}</span>
                        <div className="url-actions">
                            <button onClick={() => copyToClipboard(manifestUrl)} className="copy-button">
                                Copy
                            </button>
                            <button onClick={() => openInBrowser(manifestUrl)} className="open-button">
                                Open
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {manifestData && (
                <div className="manifest-data-section">
                    <h3>Manifest Data</h3>
                    <div className="manifest-info">
                        <p>Generated: {new Date(manifestData.metadata.generated_at).toLocaleString()}</p>
                        <p>Version: {manifestData.metadata.version}</p>
                        <p>Total Files: {Object.keys(manifestData.files).length}</p>
                    </div>

                    <div className="manifest-files-preview">
                        <h4>Files</h4>
                        <ul>
                            {Object.entries(manifestData.files).slice(0, 5).map(([key, entry]: [string, any]) => (
                                <li key={key}>
                                    <strong>{key}</strong>
                                    <span className="manufacturer">{entry.manufacturer}</span>
                                    <span className="hash">{entry.version_hash.substring(0, 8)}...</span>
                                </li>
                            ))}
                            {Object.keys(manifestData.files).length > 5 && (
                                <li className="more-files">
                                    And {Object.keys(manifestData.files).length - 5} more files...
                                </li>
                            )}
                        </ul>
                    </div>

                    <div className="view-raw-json">
                        <button
                            onClick={() => openInBrowser(manifestUrl)}
                            className="view-raw-button"
                        >
                            View Raw JSON
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManifestManager; 