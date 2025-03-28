import React, { useState, useEffect } from 'react';
import './SyncStatusManager.css';

// Define types for sync status
type SyncStatus = 'up-to-date' | 'needs-download' | 'needs-upload' | 'missing';

// Define the download response type to match what's in vite-env.d.ts
interface DownloadPdfResponse {
    success: boolean;
    localPath?: string;
    versionHash?: string;
    wasDownloaded?: boolean;
    error?: string;
    metadata?: {
        partNumber: string;
        manufacturer: string;
        localPath: string;
        remoteUrl?: string;
        versionHash: string;
        fileSize: number;
        lastUpdated: string;
        fileName: string;
    };
}

interface PartItem {
    manufacturer: string;
    partNumber: string;
    fileName?: string;
    localPath?: string;
    remoteUrl?: string;
    versionHash?: string;
    lastUpdated?: string;
    status: SyncStatus;
}

interface SyncStatusManagerProps {
    projectId: string;
    onSyncComplete?: (results: any) => void;
    onError?: (error: string) => void;
}

const SyncStatusManager: React.FC<SyncStatusManagerProps> = ({
    projectId,
    onSyncComplete,
    onError
}) => {
    const [parts, setParts] = useState<PartItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isFullSyncing, setIsFullSyncing] = useState(false);
    const [manifestUrl, setManifestUrl] = useState('');
    const [message, setMessage] = useState('');

    // Load local PDFs and determine their sync status
    useEffect(() => {
        if (!projectId) return;

        loadSyncStatusData();
    }, [projectId]);

    const loadSyncStatusData = async () => {
        setIsLoading(true);
        try {
            // Get local metadata
            const localResult = await window.electron.listPdfMetadata();
            if (!localResult.success || !localResult.metadata) {
                throw new Error(localResult.error || 'Failed to load PDF metadata');
            }

            // Create parts array from local data, initially set all as "needs-upload"
            let localParts = localResult.metadata.map(item => ({
                manufacturer: item.manufacturer,
                partNumber: item.partNumber,
                fileName: item.fileName,
                localPath: item.localPath,
                remoteUrl: item.remoteUrl,
                versionHash: item.versionHash,
                lastUpdated: item.lastUpdated,
                status: item.remoteUrl ? 'up-to-date' as SyncStatus : 'needs-upload' as SyncStatus
            }));

            setParts(localParts);

            // Try to load manifest if we have it
            try {
                // This would be where you load your manifest URL from storage
                // For now we'll just try to generate a new one
                const manifestResult = await window.electron.createManifest(projectId);
                if (manifestResult.success && manifestResult.url && manifestResult.manifestData) {
                    setManifestUrl(manifestResult.url);

                    // Update statuses based on manifest data
                    updateStatusesFromManifest(manifestResult.manifestData, localParts);
                }
            } catch (manifestError) {
                console.error('Failed to load manifest:', manifestError);
                // Continue with just local data
            }

        } catch (error) {
            setMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
            if (onError) onError(String(error));
        } finally {
            setIsLoading(false);
        }
    };

    const updateStatusesFromManifest = (manifestData: any, localItems: PartItem[]) => {
        if (!manifestData || !manifestData.files) return;

        // Create a map for easy lookup
        const localMap = new Map(
            localItems.map(item => [
                `${item.manufacturer.toLowerCase()}-${item.partNumber.toLowerCase()}`.replace(/[^a-z0-9]/g, '-'),
                item
            ])
        );

        // Check each manifest item
        const updatedParts: PartItem[] = [...localItems];

        // First update existing items
        Object.entries(manifestData.files).forEach(([key, entry]: [string, any]) => {
            const localItem = localMap.get(key);

            if (localItem) {
                // File exists locally and remotely
                if (localItem.versionHash !== entry.version_hash) {
                    // Versions don't match
                    // Determine if local is newer (needs upload) or remote is newer (needs download)
                    const localDate = localItem.localPath ? new Date(localItem.lastUpdated || 0) : new Date(0);
                    const remoteDate = new Date(entry.last_updated);

                    if (localDate > remoteDate) {
                        localItem.status = 'needs-upload';
                    } else {
                        localItem.status = 'needs-download';
                        // Update remote URL in case it changed
                        localItem.remoteUrl = entry.remote_url;
                    }
                } else {
                    // Versions match, file is up-to-date
                    localItem.status = 'up-to-date';
                    // Ensure we have the latest remote URL
                    localItem.remoteUrl = entry.remote_url;
                }
            } else {
                // File exists in manifest but not locally - needs download
                // Add to our parts list
                updatedParts.push({
                    manufacturer: entry.manufacturer,
                    partNumber: key.split('-').pop() || '',
                    remoteUrl: entry.remote_url,
                    versionHash: entry.version_hash,
                    status: 'needs-download'
                });
            }
        });

        setParts(updatedParts);
    };

    const syncAllParts = async () => {
        if (!projectId) {
            setMessage('Project ID is required for sync');
            return;
        }

        setIsSyncing(true);
        setMessage('Syncing all parts...');

        try {
            const result = await window.electron.syncPdfs(projectId, false);

            if (result.success) {
                setMessage(`Sync completed: ${result.summary.downloaded} downloaded, ${result.summary.uploaded} uploaded, ${result.summary.upToDate} up-to-date, ${result.summary.failed} failed`);

                if (onSyncComplete) {
                    onSyncComplete(result);
                }

                // Refresh data
                await loadSyncStatusData();
            } else {
                setMessage(`Sync failed: ${result.error}`);
                if (onError) onError(result.error || 'Sync failed');
            }
        } catch (error) {
            setMessage(`Error during sync: ${error instanceof Error ? error.message : String(error)}`);
            if (onError) onError(String(error));
        } finally {
            setIsSyncing(false);
        }
    };

    const downloadPart = async (part: PartItem) => {
        if (!part.remoteUrl) {
            setMessage(`Cannot download ${part.manufacturer} ${part.partNumber}: No remote URL`);
            return;
        }

        try {
            setMessage(`Downloading ${part.manufacturer} ${part.partNumber}...`);

            const result = await window.electron.downloadPdf(
                part.manufacturer,
                part.partNumber,
                part.remoteUrl,
                true // Force download
            ) as DownloadPdfResponse;

            if (result.success) {
                setMessage(`Downloaded ${part.manufacturer} ${part.partNumber} successfully`);

                setParts(prev => prev.map(item =>
                    item.manufacturer === part.manufacturer && item.partNumber === part.partNumber
                        ? {
                            ...item,
                            status: 'up-to-date',
                            localPath: result.localPath || (result.metadata ? result.metadata.localPath : item.localPath),
                            versionHash: result.versionHash || (result.metadata ? result.metadata.versionHash : item.versionHash)
                        }
                        : item
                ));
            } else {
                setMessage(`Failed to download ${part.manufacturer} ${part.partNumber}: ${result.error}`);
            }
        } catch (error) {
            setMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const uploadPart = async (part: PartItem) => {
        if (!part.localPath) {
            setMessage(`Cannot upload ${part.manufacturer} ${part.partNumber}: No local file`);
            return;
        }

        try {
            setMessage(`Uploading ${part.manufacturer} ${part.partNumber}...`);

            // We'll simulate upload by uploading the specific PDF directory
            const dirPath = part.localPath.substring(0, part.localPath.lastIndexOf('/'));

            const result = await window.electron.uploadPdfs(dirPath);

            if (result.success) {
                // Find the specific result for our file
                const fileResult = result.results?.find(r => r.filePath === part.localPath);

                if (fileResult?.isUploaded) {
                    setMessage(`Uploaded ${part.manufacturer} ${part.partNumber} successfully`);

                    // Update the part
                    setParts(prev => prev.map(item =>
                        item.manufacturer === part.manufacturer && item.partNumber === part.partNumber
                            ? { ...item, status: 'up-to-date', remoteUrl: fileResult.remoteUrl }
                            : item
                    ));

                    // Refresh the manifest
                    await refreshManifest();
                } else {
                    setMessage(`Failed to upload ${part.manufacturer} ${part.partNumber}`);
                }
            } else {
                setMessage(`Upload failed: ${result.error}`);
            }
        } catch (error) {
            setMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const refreshManifest = async () => {
        try {
            const result = await window.electron.createManifest(projectId);
            if (result.success && result.url) {
                setManifestUrl(result.url);
                // No need to update statuses again, we'll do that on the next load
            }
        } catch (error) {
            console.error('Failed to refresh manifest:', error);
        }
    };

    const fullSync = async () => {
        if (!projectId) {
            setMessage('Project ID is required for sync');
            return;
        }

        setIsFullSyncing(true);
        setMessage('Starting full sync process...');

        try {
            // Step 1: Scan directories for new PDFs
            setMessage('Scanning for new PDF files...');

            // Get the base directory where PDFs are stored
            const baseDirResult = await window.electron.listPdfMetadata();
            if (!baseDirResult.success || !baseDirResult.metadata || baseDirResult.metadata.length === 0) {
                throw new Error('Could not determine PDF directories');
            }

            // Extract directory from a known PDF file path
            const samplePath = baseDirResult.metadata[0].localPath;
            const pdfDir = samplePath.substring(0, samplePath.lastIndexOf('/'));

            // Step 2: Upload any new or modified files
            setMessage('Uploading new and modified files...');
            const uploadResult = await window.electron.uploadPdfs(pdfDir, true);

            if (!uploadResult.success) {
                throw new Error(`Upload failed: ${uploadResult.error}`);
            }

            setMessage(`Upload complete: ${uploadResult.summary?.uploaded} files uploaded, ${uploadResult.summary?.skipped} skipped`);

            // Step 3: Perform bidirectional sync
            setMessage('Performing bidirectional sync...');
            const syncResult = await window.electron.syncPdfs(projectId, true);

            if (syncResult.success) {
                setMessage(`Full sync completed: ${syncResult.summary.downloaded} downloaded, ${syncResult.summary.uploaded} uploaded, ${syncResult.summary.upToDate} up-to-date, ${syncResult.summary.failed} failed`);

                if (onSyncComplete) {
                    onSyncComplete(syncResult);
                }

                // Refresh data to show updated status
                await loadSyncStatusData();
            } else {
                throw new Error(syncResult.error || 'Sync failed');
            }
        } catch (error) {
            setMessage(`Error during full sync: ${error instanceof Error ? error.message : String(error)}`);
            if (onError) onError(String(error));
        } finally {
            setIsFullSyncing(false);
        }
    };

    const getStatusIcon = (status: SyncStatus) => {
        switch (status) {
            case 'up-to-date':
                return <span className="status-icon status-ok">✅</span>;
            case 'needs-download':
                return <span className="status-icon status-download">⬇️</span>;
            case 'needs-upload':
                return <span className="status-icon status-upload">⬆️</span>;
            case 'missing':
                return <span className="status-icon status-missing">❌</span>;
            default:
                return null;
        }
    };

    const getStatusText = (status: SyncStatus) => {
        switch (status) {
            case 'up-to-date': return 'Up-to-date';
            case 'needs-download': return 'Needs download';
            case 'needs-upload': return 'Needs upload';
            case 'missing': return 'Missing';
            default: return 'Unknown';
        }
    };

    const renderParts = () => {
        if (parts.length === 0) {
            return <p className="no-parts">No parts found. Add some PDFs to your project.</p>;
        }

        return (
            <div className="parts-table-container">
                <table className="parts-table">
                    <thead>
                        <tr>
                            <th>Manufacturer</th>
                            <th>Part Number</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {parts.map((part, index) => (
                            <tr key={index} className={`status-${part.status}`}>
                                <td className="manufacturer">{part.manufacturer}</td>
                                <td className="part-number">{part.partNumber}</td>
                                <td className="status">
                                    {getStatusIcon(part.status)}
                                    <span className="status-text">{getStatusText(part.status)}</span>
                                </td>
                                <td className="actions">
                                    {part.status === 'needs-download' && (
                                        <button
                                            className="action-btn download-btn"
                                            onClick={() => downloadPart(part)}
                                            disabled={isSyncing || isFullSyncing}
                                        >
                                            Download
                                        </button>
                                    )}
                                    {part.status === 'needs-upload' && (
                                        <button
                                            className="action-btn upload-btn"
                                            onClick={() => uploadPart(part)}
                                            disabled={isSyncing || isFullSyncing}
                                        >
                                            Upload
                                        </button>
                                    )}
                                    {part.status === 'up-to-date' && (
                                        <button
                                            className="action-btn view-btn"
                                            onClick={() => window.electron.openFile(part.localPath || '')}
                                            disabled={!part.localPath}
                                        >
                                            View
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderStats = () => {
        if (parts.length === 0) return null;

        const upToDate = parts.filter(p => p.status === 'up-to-date').length;
        const needsDownload = parts.filter(p => p.status === 'needs-download').length;
        const needsUpload = parts.filter(p => p.status === 'needs-upload').length;
        const missing = parts.filter(p => p.status === 'missing').length;

        return (
            <div className="sync-stats">
                <div className="stat">
                    <span className="stat-value">{upToDate}</span>
                    <span className="stat-label">Up-to-date</span>
                </div>
                <div className="stat">
                    <span className="stat-value">{needsDownload}</span>
                    <span className="stat-label">Need Download</span>
                </div>
                <div className="stat">
                    <span className="stat-value">{needsUpload}</span>
                    <span className="stat-label">Need Upload</span>
                </div>
                <div className="stat">
                    <span className="stat-value">{missing}</span>
                    <span className="stat-label">Missing</span>
                </div>
            </div>
        );
    };

    return (
        <div className="sync-status-manager">
            <div className="header">
                <h2>PDF Sync Status</h2>
                <div className="actions">
                    <button
                        className="refresh-btn"
                        onClick={loadSyncStatusData}
                        disabled={isLoading || isSyncing || isFullSyncing}
                    >
                        Refresh
                    </button>
                    <button
                        className="sync-all-btn"
                        onClick={syncAllParts}
                        disabled={isLoading || isSyncing || isFullSyncing}
                    >
                        Sync All
                    </button>
                    <button
                        className="full-sync-btn"
                        onClick={fullSync}
                        disabled={isLoading || isSyncing || isFullSyncing}
                    >
                        Full Scan & Sync
                    </button>
                </div>
            </div>

            {message && <div className="message">{message}</div>}

            {isLoading ? (
                <div className="loading">Loading sync status...</div>
            ) : (
                <>
                    {renderStats()}
                    {renderParts()}

                    {manifestUrl && (
                        <div className="manifest-info">
                            <h3>Manifest</h3>
                            <div className="manifest-url">
                                <span className="url">{manifestUrl}</span>
                                <button
                                    className="copy-btn"
                                    onClick={() => {
                                        navigator.clipboard.writeText(manifestUrl);
                                        setMessage('Manifest URL copied to clipboard');
                                    }}
                                >
                                    Copy URL
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default SyncStatusManager; 