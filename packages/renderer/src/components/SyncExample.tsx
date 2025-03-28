import React, { useState } from 'react';
import SyncStatusManager from './SyncStatusManager';
import './SyncExample.css';

const SyncExample: React.FC = () => {
    const [projectId, setProjectId] = useState('demo-project');
    const [message, setMessage] = useState('');
    const [showResults, setShowResults] = useState(false);
    const [syncResults, setSyncResults] = useState<any>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setProjectId(e.target.value);
    };

    const handleSyncComplete = (results: any) => {
        setSyncResults(results);
        setShowResults(true);
        setMessage('Sync completed successfully');
    };

    const handleError = (error: string) => {
        setMessage(`Error: ${error}`);
        setShowResults(false);
    };

    const renderSyncResults = () => {
        if (!syncResults || !showResults) return null;

        return (
            <div className="sync-results">
                <h3>Last Sync Results</h3>
                <div className="summary">
                    <p>Total Files: {syncResults.summary.total}</p>
                    <p>Downloaded: {syncResults.summary.downloaded}</p>
                    <p>Uploaded: {syncResults.summary.uploaded}</p>
                    <p>Up-to-date: {syncResults.summary.upToDate}</p>
                    <p>Failed: {syncResults.summary.failed}</p>
                </div>
            </div>
        );
    };

    return (
        <div className="sync-example">
            <div className="project-selector">
                <h2>PDF Sync System</h2>
                <div className="input-group">
                    <label htmlFor="project-id">Project ID</label>
                    <input
                        id="project-id"
                        type="text"
                        value={projectId}
                        onChange={handleInputChange}
                        placeholder="Enter project ID"
                    />
                </div>
                {message && <div className="message">{message}</div>}
                {renderSyncResults()}
            </div>

            <SyncStatusManager
                projectId={projectId}
                onSyncComplete={handleSyncComplete}
                onError={handleError}
            />
        </div>
    );
};

export default SyncExample; 