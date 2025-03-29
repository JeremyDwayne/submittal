import React, { useState } from 'react';
import './PdfFinderExample.css';

const PdfFinderExample: React.FC = () => {
    const [directory, setDirectory] = useState<string | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [includeSubdirs, setIncludeSubdirs] = useState(true);
    const [skipHidden, setSkipHidden] = useState(true);
    const [results, setResults] = useState<{
        pdfFiles: string[];
        fileInfo: Array<{ path: string; name: string; size: number }>;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Select directory to search
    const handleSelectDirectory = async () => {
        const selected = await window.electron.selectFolder();
        if (selected) {
            setDirectory(selected);
            setError(null);
            setResults(null);
        }
    };

    // Find PDF files recursively
    const handleFindPdfs = async () => {
        if (!directory) {
            setError('Please select a directory first');
            return;
        }

        setIsSearching(true);
        setError(null);

        try {
            const response = await window.electron.findPdfFilesRecursively(directory, {
                includeSubdirectories: includeSubdirs,
                skipHiddenDirectories: skipHidden
            });

            if (response.success && response.pdfFiles && response.fileInfo) {
                setResults({
                    pdfFiles: response.pdfFiles,
                    fileInfo: response.fileInfo
                });
            } else {
                setError(response.error || 'Failed to find PDF files');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSearching(false);
        }
    };

    // Format file size
    const formatFileSize = (sizeInBytes: number): string => {
        if (sizeInBytes < 1024) {
            return `${sizeInBytes} B`;
        } else if (sizeInBytes < 1024 * 1024) {
            return `${(sizeInBytes / 1024).toFixed(2)} KB`;
        } else {
            return `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
        }
    };

    // Open PDF file
    const handleOpenPdf = async (filePath: string) => {
        await window.electron.openFile(filePath);
    };

    return (
        <div className="pdf-finder-example">
            <h2>PDF Finder</h2>

            <div className="directory-selection">
                <div className="input-row">
                    <button
                        className="select-directory-button"
                        onClick={handleSelectDirectory}
                    >
                        Select Directory
                    </button>
                    {directory && (
                        <div className="directory-path">
                            <span>Selected: </span>
                            <code>{directory}</code>
                        </div>
                    )}
                </div>

                <div className="options">
                    <label className="option-label">
                        <input
                            type="checkbox"
                            checked={includeSubdirs}
                            onChange={e => setIncludeSubdirs(e.target.checked)}
                        />
                        Include subdirectories
                    </label>

                    <label className="option-label">
                        <input
                            type="checkbox"
                            checked={skipHidden}
                            onChange={e => setSkipHidden(e.target.checked)}
                        />
                        Skip hidden directories
                    </label>
                </div>

                <button
                    className="find-pdfs-button"
                    onClick={handleFindPdfs}
                    disabled={!directory || isSearching}
                >
                    {isSearching ? 'Searching...' : 'Find PDF Files'}
                </button>
            </div>

            {error && (
                <div className="error-message">
                    <p>{error}</p>
                </div>
            )}

            {results && (
                <div className="results-container">
                    <div className="results-header">
                        <h3>Found {results.pdfFiles.length} PDF files</h3>
                    </div>

                    <div className="file-list">
                        <table>
                            <thead>
                                <tr>
                                    <th>File Name</th>
                                    <th>Size</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.fileInfo.map((file, index) => (
                                    <tr key={index}>
                                        <td className="file-name">{file.name}</td>
                                        <td className="file-size">{formatFileSize(file.size)}</td>
                                        <td className="file-actions">
                                            <button
                                                className="open-file-button"
                                                onClick={() => handleOpenPdf(file.path)}
                                            >
                                                Open
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PdfFinderExample; 