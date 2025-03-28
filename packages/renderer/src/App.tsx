import { useState, useEffect } from 'react';
import './App.css';

// Extend MatchResult to support manual overrides
type MatchResult = {
  manufacturer: string;
  partNumber: string;
  matched: boolean;
  pdfPath?: string;
  fileName?: string;
  overridden?: boolean; // Flag to indicate manually overridden matches
};

type ResultSummary = {
  total: number;
  matched: number;
  notFound: number;
};

type UploadResult = {
  filePath: string;
  fileName: string;
  isUploaded: boolean;
  remoteUrl?: string;
  error?: string;
  wasSkipped?: boolean;
  manufacturer?: string;
  partNumber?: string;
};

type UploadSummary = {
  total: number;
  uploaded: number;
  failed: number;
  skipped: number;
};

// Updated to match the PdfMetadata interface from the main process
type UploadedFile = {
  partNumber: string;
  manufacturer: string;
  localPath: string;
  remoteUrl?: string;
  versionHash: string;
  fileSize: number;
  lastUpdated: string;
  fileName: string;
};

function App() {
  const [pdfFiles, setPdfFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pdfDirectory, setPdfDirectory] = useState<string | null>(null);
  const [csvFilePath, setCsvFilePath] = useState<string | null>(null);
  const [results, setResults] = useState<ResultSummary | null>(null);
  const [detailedResults, setDetailedResults] = useState<MatchResult[]>([]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [outputDirectory, setOutputDirectory] = useState<string | null>(null);
  const [sessionFile, setSessionFile] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'match' | 'uploads'>('match');
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [uploadSummary, setUploadSummary] = useState<UploadSummary | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isLoadingUploads, setIsLoadingUploads] = useState(false);

  // Track changes to determine if session needs saving
  useEffect(() => {
    if (detailedResults.length > 0) {
      setHasChanges(true);
    }
  }, [detailedResults, pdfDirectory, csvFilePath, outputDirectory]);

  // Load uploaded files when the uploads tab is selected
  useEffect(() => {
    if (activeTab === 'uploads') {
      loadUploadedFiles();
    }
  }, [activeTab]);

  const loadUploadedFiles = async () => {
    setIsLoadingUploads(true);
    try {
      const result = await window.electron.listUploads();
      if (result.success && result.uploads) {
        // Convert the PdfMetadata to the UploadedFile type
        const files: UploadedFile[] = result.uploads.map(upload => ({
          partNumber: upload.partNumber,
          manufacturer: upload.manufacturer,
          localPath: upload.localPath,
          remoteUrl: upload.remoteUrl,
          versionHash: upload.versionHash,
          fileSize: upload.fileSize,
          lastUpdated: upload.lastUpdated,
          fileName: upload.fileName
        }));
        setUploadedFiles(files);
      } else {
        setMessage(`Error loading uploads: ${result.error}`);
      }
    } catch (error) {
      console.error('Error loading uploads:', error);
      setMessage(`Error: ${(error as Error).message}`);
    } finally {
      setIsLoadingUploads(false);
    }
  };

  const selectPdfDirectory = async () => {
    try {
      const directory = await window.electron.selectFolder();
      if (directory) {
        setPdfDirectory(directory);
        setHasChanges(true);
        scanPdfDirectory(directory);
      }
    } catch (error) {
      console.error('Error selecting directory:', error);
      setMessage(`Error: ${(error as Error).message}`);
    }
  };

  const selectCsvFile = async () => {
    try {
      const filePath = await window.electron.selectFile('.csv');
      if (filePath) {
        setCsvFilePath(filePath);
        setHasChanges(true);
        setMessage(`CSV file selected: ${filePath.split('/').pop()}`);
      }
    } catch (error) {
      console.error('Error selecting CSV file:', error);
      setMessage(`Error: ${(error as Error).message}`);
    }
  };

  const selectOutputDirectory = async () => {
    try {
      const directory = await window.electron.selectFolder();
      if (directory) {
        setOutputDirectory(directory);
        setHasChanges(true);
        const fileName = generateDefaultFileName();
        const fullPath = `${directory}/${fileName}`;
        setMessage(`Output location selected: ${fullPath}`);
      }
    } catch (error) {
      console.error('Error selecting output directory:', error);
      setMessage(`Error: ${(error as Error).message}`);
    }
  };

  const generateDefaultFileName = () => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    return `Submittal-${dateStr}.pdf`;
  };

  const processBom = async () => {
    if (!csvFilePath) {
      setMessage('Please select a CSV file first');
      return;
    }

    if (!pdfDirectory) {
      setMessage('Please select a PDF directory first');
      return;
    }

    setIsLoading(true);
    setResults(null);
    setDetailedResults([]);
    setHasChanges(true);

    try {
      const result = await window.electron.processBom(csvFilePath, pdfDirectory);

      if (result.success && result.summary) {
        setResults(result.summary);

        if (result.results) {
          setDetailedResults(result.results);
        }

        setMessage(
          `Processed ${result.summary.total} items: ` +
          `${result.summary.matched} matched, ` +
          `${result.summary.notFound} not found`
        );
      } else {
        setMessage(result.error || 'Failed to process BOM');
      }
    } catch (error) {
      console.error('Error processing BOM:', error);
      setMessage(`Error: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const scanPdfDirectory = async (directory: string) => {
    setIsLoading(true);
    try {
      const result = await window.electron.scanPdfDirectory(directory);

      if (result.success && result.pdfFiles) {
        // Just get the filenames
        const fileNames = result.pdfFiles.map(pdf => pdf.fileName);
        setPdfFiles(fileNames);
        setMessage(`Found ${fileNames.length} PDF files in directory`);
      } else {
        setMessage(result.error || 'Error scanning directory');
      }
    } catch (error) {
      console.error('Error scanning directory:', error);
      setMessage(`Error: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const createMergedPdf = async () => {
    if (detailedResults.length === 0) {
      setMessage('No results to merge');
      return;
    }

    const matchedResults = detailedResults.filter(result => result.matched && result.pdfPath);

    if (matchedResults.length === 0) {
      setMessage('No matched PDFs to merge');
      return;
    }

    setIsGeneratingPdf(true);
    setMessage('Generating merged PDF...');

    try {
      // Get paths of all matched PDFs
      const pdfPaths = matchedResults.map(result => result.pdfPath as string);

      // Create product info array for the table of contents
      const productInfo = matchedResults.map(result => ({
        manufacturer: result.manufacturer,
        partNumber: result.partNumber,
        fileName: result.fileName
      }));

      // Call the main process to merge PDFs, passing the user-selected output directory if available
      const result = await window.electron.createMergedPdf(
        pdfPaths,
        productInfo,
        outputDirectory || undefined
      );

      if (result.success) {
        setMessage(`Merged PDF created successfully: ${result.outputPath}`);

        // Open the PDF automatically
        if (result.outputPath) {
          await window.electron.openFile(result.outputPath);
        }
      } else {
        setMessage(`Error creating merged PDF: ${result.error}`);
      }
    } catch (error) {
      console.error('Error merging PDFs:', error);
      setMessage(`Error: ${(error as Error).message}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Function to manually override a PDF match
  const overrideMatch = async (index: number) => {
    try {
      // Get the current result
      const result = detailedResults[index];

      // Select a replacement PDF file
      const pdfPath = await window.electron.selectFile('.pdf');

      if (!pdfPath) {
        return; // User canceled
      }

      // Get the filename from the path
      const fileName = pdfPath.split('/').pop() || '';

      // Update the result with the new match
      const updatedResults = [...detailedResults];
      updatedResults[index] = {
        ...result,
        matched: true,
        pdfPath,
        fileName,
        overridden: true // Mark as manually overridden
      };

      setDetailedResults(updatedResults);

      // Update the summary
      if (results) {
        const matched = updatedResults.filter(r => r.matched).length;
        const notFound = updatedResults.length - matched;
        setResults({
          ...results,
          matched,
          notFound
        });
      }

      setMessage(`Override successful: ${result.manufacturer} ${result.partNumber} → ${fileName}`);
      setHasChanges(true);
    } catch (error) {
      console.error('Error overriding match:', error);
      setMessage(`Error: ${(error as Error).message}`);
    }
  };

  // Function to clear a manual override
  const clearOverride = (index: number) => {
    try {
      // Get the current result
      const result = detailedResults[index];

      if (!result.overridden) {
        return; // Not an override, nothing to clear
      }

      // Reset to unmatched
      const updatedResults = [...detailedResults];
      updatedResults[index] = {
        ...result,
        matched: false,
        pdfPath: undefined,
        fileName: undefined,
        overridden: undefined
      };

      setDetailedResults(updatedResults);

      // Update the summary
      if (results) {
        const matched = updatedResults.filter(r => r.matched).length;
        const notFound = updatedResults.length - matched;
        setResults({
          ...results,
          matched,
          notFound
        });
      }

      setMessage(`Override cleared for: ${result.manufacturer} ${result.partNumber}`);
      setHasChanges(true);
    } catch (error) {
      console.error('Error clearing override:', error);
      setMessage(`Error: ${(error as Error).message}`);
    }
  };

  // Save current session to a JSON file
  const saveSession = async () => {
    if (!pdfDirectory || !csvFilePath) {
      setMessage('Please select both PDF directory and CSV file before saving');
      return;
    }

    setIsLoading(true);
    try {
      // Create session data
      const sessionData: SessionData = {
        pdfDirectory,
        csvFilePath,
        outputDirectory: outputDirectory || undefined,
        results: results || undefined,
        detailedResults: detailedResults.length > 0 ? detailedResults : undefined,
        createdAt: sessionFile ? (new Date().toISOString()) : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save session data to file
      const result = await window.electron.saveSession(sessionData);

      if (result.success && result.filePath) {
        setSessionFile(result.filePath);
        setMessage(`Session saved to: ${result.filePath}`);
        setHasChanges(false);
      } else {
        setMessage(`Error saving session: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving session:', error);
      setMessage(`Error: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Load session from a JSON file
  const loadSession = async () => {
    setIsLoading(true);
    try {
      // Load session data from file
      const result = await window.electron.loadSession();

      if (result.success && result.sessionData) {
        const { pdfDirectory, csvFilePath, outputDirectory, results, detailedResults, createdAt } = result.sessionData;

        // Set session state
        setPdfDirectory(pdfDirectory);
        setCsvFilePath(csvFilePath);
        setOutputDirectory(outputDirectory || null);
        setResults(results || null);
        setDetailedResults(detailedResults || []);
        setSessionFile(createdAt);
        setHasChanges(false);

        // Scan the PDF directory to update available files
        await scanPdfDirectory(pdfDirectory);

        setMessage('Session loaded successfully');
      } else {
        setMessage(`Error loading session: ${result.error}`);
      }
    } catch (error) {
      console.error('Error loading session:', error);
      setMessage(`Error: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Start a new session
  const newSession = () => {
    if (hasChanges) {
      const confirmNewSession = window.confirm(
        'You have unsaved changes. Are you sure you want to start a new session?'
      );

      if (!confirmNewSession) {
        return;
      }
    }

    // Reset all state
    setPdfDirectory(null);
    setCsvFilePath(null);
    setOutputDirectory(null);
    setResults(null);
    setDetailedResults([]);
    setPdfFiles([]);
    setSessionFile(null);
    setHasChanges(false);
    setMessage('New session started');
  };

  // Upload PDFs to UploadThing
  const uploadPdfs = async () => {
    if (!pdfDirectory) {
      setMessage('Please select a PDF directory first');
      return;
    }

    setIsUploading(true);
    setMessage('Uploading PDFs to cloud storage...');
    setUploadResults([]);
    setUploadSummary(null);

    try {
      const result = await window.electron.uploadPdfs(pdfDirectory);

      if (result.success) {
        if (result.results) {
          setUploadResults(result.results);
        }

        if (result.summary) {
          setUploadSummary(result.summary);
          setMessage(
            `Uploaded ${result.summary.uploaded} of ${result.summary.total} PDFs ` +
            `(${result.summary.skipped} skipped, ${result.summary.failed} failed)`
          );
        } else {
          setMessage('PDFs uploaded successfully');
        }

        // Refresh the list of uploaded files
        await loadUploadedFiles();
      } else {
        setMessage(`Error uploading PDFs: ${result.error}`);
      }
    } catch (error) {
      console.error('Error uploading PDFs:', error);
      setMessage(`Error: ${(error as Error).message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Delete a single uploaded file
  const deleteUploadedFile = async (localPath: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete ${fileName}?`)) {
      return;
    }

    setIsLoadingUploads(true);
    try {
      const result = await window.electron.deleteUpload(localPath);

      if (result.success) {
        // Remove the file from the list
        setUploadedFiles(uploadedFiles.filter(file => file.localPath !== localPath));
        setMessage(`Deleted ${fileName} successfully`);
      } else {
        setMessage(`Error deleting file: ${result.error}`);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      setMessage(`Error: ${(error as Error).message}`);
    } finally {
      setIsLoadingUploads(false);
    }
  };

  // Copy URL to clipboard
  const copyToClipboard = (text: string, fileName: string) => {
    navigator.clipboard.writeText(text)
      .then(() => setMessage(`Copied URL for ${fileName} to clipboard`))
      .catch(err => setMessage(`Failed to copy: ${err}`));
  };

  // Open URL in browser
  const openUrl = async (url: string) => {
    try {
      await window.electron.openExternalUrl(url);
    } catch (error) {
      console.error('Error opening URL:', error);
      setMessage(`Error: ${(error as Error).message}`);
    }
  };

  return (
    <div className="app">
      <h1>Submittal Manager</h1>

      <div className="session-controls">
        <button
          onClick={newSession}
          className="session-button new-session-button"
          disabled={isLoading || isGeneratingPdf || isUploading}
        >
          New Session
        </button>
        <button
          onClick={loadSession}
          className="session-button load-session-button"
          disabled={isLoading || isGeneratingPdf || isUploading}
        >
          Load Session
        </button>
        <button
          onClick={saveSession}
          className="session-button save-session-button"
          disabled={isLoading || isGeneratingPdf || isUploading || (!pdfDirectory && !csvFilePath)}
        >
          {hasChanges ? "Save Session*" : "Save Session"}
        </button>
        {sessionFile && (
          <div className="session-info">
            Session file: {sessionFile.split('/').pop()}
          </div>
        )}
      </div>

      <div className="tabs">
        <button
          className={`tab-button ${activeTab === 'match' ? 'active' : ''}`}
          onClick={() => setActiveTab('match')}
        >
          Match PDFs
        </button>
        <button
          className={`tab-button ${activeTab === 'uploads' ? 'active' : ''}`}
          onClick={() => setActiveTab('uploads')}
        >
          Cloud Uploads
        </button>
      </div>

      {activeTab === 'match' ? (
        <div className="main-container">
          <div className="input-section">
            <div className="file-input-group">
              <h2>1. Select PDF Directory</h2>
              <div className="file-input-container">
                <button
                  onClick={selectPdfDirectory}
                  disabled={isLoading || isGeneratingPdf}
                  className="file-select-button"
                >
                  {pdfDirectory ? 'Change PDF Directory' : 'Select PDF Directory'}
                </button>
                {pdfDirectory && (
                  <div className="file-info">
                    <p>{pdfDirectory}</p>
                    <p className="file-count">{pdfFiles.length} PDFs found</p>
                  </div>
                )}
              </div>
            </div>

            <div className="file-input-group">
              <h2>2. Select BOM CSV File</h2>
              <div className="file-input-container">
                <button
                  onClick={selectCsvFile}
                  disabled={isLoading || isGeneratingPdf}
                  className="file-select-button"
                >
                  {csvFilePath ? 'Change CSV File' : 'Select CSV File'}
                </button>
                {csvFilePath && (
                  <div className="file-info">
                    <p>{csvFilePath.split('/').pop()}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="file-input-group">
              <h2>3. Output Location (Optional)</h2>
              <div className="file-input-container">
                <button
                  onClick={selectOutputDirectory}
                  disabled={isLoading || isGeneratingPdf}
                  className="file-select-button"
                >
                  {outputDirectory ? 'Change Output Location' : 'Select Output Location'}
                </button>
                {outputDirectory && (
                  <div className="file-info">
                    <p>{outputDirectory}/{generateDefaultFileName()}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="submit-section">
              <button
                onClick={processBom}
                disabled={isLoading || isGeneratingPdf || !pdfDirectory || !csvFilePath}
                className="submit-button"
              >
                {isLoading ? 'Processing...' : 'Match BOM to PDFs'}
              </button>
            </div>

            {message && (
              <div className="message">
                {message}
                <button
                  className="close-button"
                  onClick={() => setMessage(null)}
                >
                  ×
                </button>
              </div>
            )}

            {results && (
              <div className="results-summary">
                <h3>Results</h3>
                <div className="stats">
                  <div className="stat">
                    <span className="stat-value">{results.total}</span>
                    <span className="stat-label">Total Items</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{results.matched}</span>
                    <span className="stat-label">Matched</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{results.notFound}</span>
                    <span className="stat-label">Not Found</span>
                  </div>
                </div>

                {results.matched > 0 && (
                  <div className="merge-pdf-container">
                    <button
                      className="merge-pdf-button"
                      onClick={createMergedPdf}
                      disabled={isLoading || isGeneratingPdf}
                    >
                      {isGeneratingPdf ? 'Creating PDF...' : 'Create Merged Submittal PDF'}
                    </button>
                    <p className="merge-help-text">Creates a single PDF containing all matched cut sheets</p>
                  </div>
                )}
              </div>
            )}

            {detailedResults.length > 0 && (
              <div className="results-table-container">
                <h3>Detailed Results</h3>
                <div className="results-table-wrapper">
                  <table className="results-table">
                    <thead>
                      <tr>
                        <th>Manufacturer</th>
                        <th>Part Number</th>
                        <th>Status</th>
                        <th>PDF Filename</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailedResults.map((result, index) => (
                        <tr key={index} className={
                          result.overridden
                            ? 'row-overridden'
                            : result.matched
                              ? 'row-matched'
                              : 'row-not-matched'
                        }>
                          <td>{result.manufacturer}</td>
                          <td>{result.partNumber}</td>
                          <td className="status-cell">
                            {result.matched ? (
                              <span className={result.overridden ? "status-overridden" : "status-matched"}>
                                {result.overridden ? '⚙️ Override' : '✅ Matched'}
                              </span>
                            ) : (
                              <span className="status-not-matched">❌ Not Found</span>
                            )}
                          </td>
                          <td>
                            {result.fileName ? (
                              <span className="filename" title={result.pdfPath}>{result.fileName}</span>
                            ) : (
                              <span className="no-filename">-</span>
                            )}
                          </td>
                          <td className="action-cell">
                            {result.overridden ? (
                              <button
                                className="clear-override-button"
                                onClick={() => clearOverride(index)}
                                title="Clear override"
                              >
                                ↩️ Undo
                              </button>
                            ) : (
                              <button
                                className="override-button"
                                onClick={() => overrideMatch(index)}
                                title="Manually select a PDF for this item"
                              >
                                Override
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="info-section">
            <div className="instructions">
              <h3>Instructions</h3>
              <ol>
                <li>Select a directory containing your PDF cut sheets</li>
                <li>Select a CSV file with your Bill of Materials</li>
                <li>Click "Match BOM to PDFs" to process</li>
                <li>Review matches in the results table</li>
                <li>Manually override any unmatched or incorrect PDFs</li>
                <li>Save your session to continue later</li>
                <li>Create a merged submittal PDF when ready</li>
              </ol>
              <p>CSV file must include these columns:</p>
              <ul>
                <li><strong>manufacturer</strong> - The manufacturer name</li>
                <li><strong>part_number</strong> - The part identifier</li>
              </ul>
              <p>PDF files should include both manufacturer name and part number in the filename.</p>
            </div>

            {pdfFiles.length > 0 && (
              <div className="pdf-list">
                <h3>Available PDFs</h3>
                <div className="pdf-container">
                  <ul>
                    {pdfFiles.map((file, index) => (
                      <li key={index}>{file}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="main-container">
          <div className="upload-section">
            <div className="file-input-group">
              <h2>Select PDF Directory to Upload</h2>
              <div className="file-input-container">
                <button
                  onClick={selectPdfDirectory}
                  disabled={isUploading || isLoadingUploads}
                  className="file-select-button"
                >
                  {pdfDirectory ? 'Change PDF Directory' : 'Select PDF Directory'}
                </button>
                {pdfDirectory && (
                  <div className="file-info">
                    <p>{pdfDirectory}</p>
                    <p className="file-count">{pdfFiles.length} PDFs found</p>
                  </div>
                )}
              </div>
            </div>

            <div className="submit-section">
              <button
                onClick={uploadPdfs}
                disabled={isUploading || isLoadingUploads || !pdfDirectory}
                className="submit-button upload-button"
              >
                {isUploading ? 'Uploading...' : 'Upload PDFs to Cloud'}
              </button>
              <p className="upload-help-text">
                Upload PDFs to secure cloud storage for sharing
              </p>
            </div>

            {message && (
              <div className="message">
                {message}
                <button
                  className="close-button"
                  onClick={() => setMessage(null)}
                >
                  ×
                </button>
              </div>
            )}

            {uploadSummary && (
              <div className="results-summary">
                <h3>Upload Results</h3>
                <div className="stats">
                  <div className="stat">
                    <span className="stat-value">{uploadSummary.total}</span>
                    <span className="stat-label">Total Files</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{uploadSummary.uploaded}</span>
                    <span className="stat-label">Uploaded</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{uploadSummary.skipped}</span>
                    <span className="stat-label">Skipped</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{uploadSummary.failed}</span>
                    <span className="stat-label">Failed</span>
                  </div>
                </div>
              </div>
            )}

            {uploadResults.length > 0 && (
              <div className="results-table-container">
                <h3>Detailed Upload Results</h3>
                <div className="results-table-wrapper">
                  <table className="results-table">
                    <thead>
                      <tr>
                        <th>File Name</th>
                        <th>Status</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadResults.map((result, index) => (
                        <tr key={index} className={
                          result.isUploaded
                            ? 'row-matched'
                            : result.wasSkipped
                              ? 'row-skipped'
                              : 'row-not-matched'
                        }>
                          <td>{result.fileName}</td>
                          <td className="status-cell">
                            {result.isUploaded ? (
                              <span className="status-matched">✅ Uploaded</span>
                            ) : result.wasSkipped ? (
                              <span className="status-skipped">⏭️ Skipped</span>
                            ) : (
                              <span className="status-not-matched">❌ Failed</span>
                            )}
                          </td>
                          <td>
                            {result.remoteUrl ? (
                              <div className="upload-actions">
                                <button
                                  className="copy-url-button"
                                  onClick={() => copyToClipboard(result.remoteUrl!, result.fileName)}
                                  title="Copy URL to clipboard"
                                >
                                  Copy URL
                                </button>
                                <button
                                  className="open-url-button"
                                  onClick={() => openUrl(result.remoteUrl!)}
                                  title="Open in browser"
                                >
                                  Open
                                </button>
                              </div>
                            ) : (
                              <span className="upload-error">{result.error || 'Already uploaded'}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="uploaded-files-section">
              <h3>Uploaded Files</h3>
              {isLoadingUploads ? (
                <p>Loading uploaded files...</p>
              ) : uploadedFiles.length === 0 ? (
                <p>No files have been uploaded yet.</p>
              ) : (
                <div className="results-table-wrapper">
                  <table className="results-table">
                    <thead>
                      <tr>
                        <th>File Name</th>
                        <th>Size</th>
                        <th>Upload Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadedFiles.map((file, index) => (
                        <tr key={index}>
                          <td>{file.fileName}</td>
                          <td>{(file.fileSize / 1024 / 1024).toFixed(2)} MB</td>
                          <td>{new Date(file.lastUpdated).toLocaleString()}</td>
                          <td>
                            <div className="upload-actions">
                              <button
                                className="copy-url-button"
                                onClick={() => copyToClipboard(file.remoteUrl || '', file.fileName)}
                                title="Copy URL to clipboard"
                              >
                                Copy URL
                              </button>
                              <button
                                className="open-url-button"
                                onClick={() => openUrl(file.remoteUrl || '')}
                                title="Open in browser"
                              >
                                Open
                              </button>
                              <button
                                className="delete-button"
                                onClick={() => deleteUploadedFile(file.localPath, file.fileName)}
                                title="Delete uploaded file"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="info-section">
            <div className="instructions">
              <h3>Cloud Upload Instructions</h3>
              <ol>
                <li>Select a directory containing your PDF cut sheets</li>
                <li>Click "Upload PDFs to Cloud" to begin uploading</li>
                <li>PDFs will be uploaded to secure cloud storage</li>
                <li>You'll receive shareable links for each PDF</li>
                <li>Use the "Copy URL" button to share links</li>
                <li>Links will remain active for 30 days</li>
              </ol>
              <div className="note">
                <p><strong>Note:</strong> Files that have already been uploaded will be skipped unless they've been modified.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App; 