import { useCallback, useEffect, useState } from 'react';
import './App.css';
import Settings from './components/Settings';
import ProjectSelector from './components/ProjectSelector';

// Define the types for our application
interface PdfFile {
  path: string;
  name: string;
  size: number;
}

function App() {
  // State for main functionality
  const [pdfDirectory, setPdfDirectory] = useState<string | null>(null);
  const [outputDirectory, setOutputDirectory] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [fileName, setFileName] = useState<string>('submittal.pdf');
  const [recursiveSearch, setRecursiveSearch] = useState(false);
  const [pdfFiles, setPdfFiles] = useState<PdfFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Add active tab state
  const [activeTab, setActiveTab] = useState<'pdfs' | 'csv' | 'sync' | 'manual'>('pdfs');

  // State for project management
  const [showSettings, setShowSettings] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [showProjectSelector, setShowProjectSelector] = useState(false);

  // Load project on startup
  useEffect(() => {
    const loadLastProject = async () => {
      try {
        setProjectLoading(true);
        const result = await window.electron.getLastProject();

        if (result.success && result.project) {
          setProjectId(result.project.id);
          setProjectName(result.project.name);

          // Load project directories
          const dirResult = await window.electron.getProjectDirectories(result.project.id);
          if (dirResult.success && dirResult.directories) {
            setPdfDirectory(dirResult.directories.pdfDirectory);
            setOutputDirectory(dirResult.directories.outputDirectory);
          }
        } else {
          // No last project, show project selector
          setShowProjectSelector(true);
        }
      } catch (err) {
        console.error('Error loading last project:', err);
        setShowProjectSelector(true);
      } finally {
        setProjectLoading(false);
      }
    };

    loadLastProject();
  }, []);

  // Handle project selection
  const handleProjectSelected = async (selectedProjectId: string) => {
    try {
      setProjectLoading(true);

      const projectResult = await window.electron.getProject(selectedProjectId);
      if (projectResult.success && projectResult.project) {
        setProjectId(selectedProjectId);
        setProjectName(projectResult.project.name);

        // Load project directories
        const dirResult = await window.electron.getProjectDirectories(selectedProjectId);
        if (dirResult.success && dirResult.directories) {
          setPdfDirectory(dirResult.directories.pdfDirectory);
          setOutputDirectory(dirResult.directories.outputDirectory);
        }

        setShowProjectSelector(false);
      }
    } catch (err) {
      console.error('Error selecting project:', err);
    } finally {
      setProjectLoading(false);
    }
  };

  // Scan PDF directory to find PDF files
  const scanPdfDirectory = async (directory: string) => {
    try {
      setMessage('Searching for PDF files...');
      setIsProcessing(true);

      const result = await window.electron.findPdfs(directory, recursiveSearch);

      if (result.success && result.files) {
        setMessage(`Found ${result.files.length} PDF files in ${directory}`);
        setPdfFiles(result.files);
      } else {
        setMessage(`Error: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error scanning PDF directory:', error);
      setMessage(`Error: ${(error as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Select PDF directory
  const selectPdfDirectory = useCallback(async () => {
    try {
      const directory = await window.electron.selectFolder();

      if (directory) {
        setPdfDirectory(directory);
        setMessage(`PDF directory selected: ${directory}`);

        // Scan the directory for PDF files
        await scanPdfDirectory(directory);

        if (projectId && directory) {
          // Save to project settings
          await window.electron.updateProject({
            id: projectId,
            name: projectName,
            createdAt: '', // Will be ignored by the backend
            lastAccessedAt: '', // Will be updated by the backend
            directories: {
              root: directory,
              output: outputDirectory || ''
            }
          });
        }
      }
    } catch (error) {
      console.error('Error selecting PDF directory:', error);
      setMessage(`Error: ${(error as Error).message}`);
    }
  }, [pdfDirectory, projectId, projectName, outputDirectory, recursiveSearch]);

  // Select output directory
  const selectOutputDirectory = useCallback(async () => {
    try {
      const directory = await window.electron.selectFolder();

      if (directory) {
        setOutputDirectory(directory);
        const fullPath = `${directory}/${fileName}`;
        setMessage(`Output location selected: ${fullPath}`);

        if (projectId && directory) {
          // Save to project settings
          await window.electron.updateProject({
            id: projectId,
            name: projectName,
            createdAt: '', // Will be ignored by the backend
            lastAccessedAt: '', // Will be updated by the backend
            directories: {
              root: pdfDirectory || '',
              output: directory
            }
          });
        }
      }
    } catch (error) {
      console.error('Error selecting output directory:', error);
      setMessage(`Error: ${(error as Error).message}`);
    }
  }, [outputDirectory, projectId, projectName, pdfDirectory, fileName]);

  // Function to create the merged PDF
  const createMergedPdf = async () => {
    try {
      if (!pdfDirectory || !outputDirectory) {
        setMessage('Please select both PDF directory and output location');
        return;
      }

      setIsProcessing(true);
      setMessage('Creating merged PDF...');

      // Here you'd call your PDF creation function via the Electron API
      // For now, just simulate success
      await new Promise(resolve => setTimeout(resolve, 1500));

      setMessage(`PDF successfully created at: ${outputDirectory}/${fileName}`);
    } catch (error) {
      console.error('Error creating PDF:', error);
      setMessage(`Error: ${(error as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="app">
      {projectLoading ? (
        <div className="loading-container">
          <p>Loading project...</p>
        </div>
      ) : showProjectSelector ? (
        <ProjectSelector
          onProjectSelected={handleProjectSelected}
        />
      ) : (
        <div className="app-content">
          <div className="app-header">
            <h1>Submittal Builder</h1>
            <div className="app-header-controls">
              <div className="project-info">
                <span className="project-label">Project:</span>
                <span className="project-name">{projectName}</span>
                <button
                  className="project-switch-btn"
                  onClick={() => setShowProjectSelector(true)}
                >
                  Switch Project
                </button>
              </div>
              <button
                className="settings-button"
                onClick={() => setShowSettings(true)}
              >
                Settings
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="tabs">
            <button
              className={`tab-button ${activeTab === 'pdfs' ? 'active' : ''}`}
              onClick={() => setActiveTab('pdfs')}
            >
              PDF Processing
            </button>
            <button
              className={`tab-button ${activeTab === 'csv' ? 'active' : ''}`}
              onClick={() => setActiveTab('csv')}
            >
              CSV Upload
            </button>
            <button
              className={`tab-button ${activeTab === 'sync' ? 'active' : ''}`}
              onClick={() => setActiveTab('sync')}
            >
              Sync Files
            </button>
            <button
              className={`tab-button ${activeTab === 'manual' ? 'active' : ''}`}
              onClick={() => setActiveTab('manual')}
            >
              Manual Search
            </button>
          </div>

          {/* PDF Processing Tab Content */}
          {activeTab === 'pdfs' && (
            <div className="tab-content">
              <div className="controls">
                <div className="control-group">
                  <label>PDF Directory:</label>
                  <div className="control-row">
                    <input
                      type="text"
                      value={pdfDirectory || ''}
                      onChange={e => setPdfDirectory(e.target.value)}
                      placeholder="Select PDF directory"
                    />
                    <button onClick={selectPdfDirectory}>Browse</button>
                  </div>

                  <div className="checkbox-control">
                    <input
                      type="checkbox"
                      id="recursiveSearch"
                      checked={recursiveSearch}
                      onChange={e => setRecursiveSearch(e.target.checked)}
                    />
                    <label htmlFor="recursiveSearch">Enable recursive PDF search</label>
                  </div>
                </div>

                <div className="control-group">
                  <label>Output Location:</label>
                  <div className="control-row">
                    <input
                      type="text"
                      value={outputDirectory || ''}
                      onChange={e => setOutputDirectory(e.target.value)}
                      placeholder="Select output directory"
                    />
                    <button onClick={selectOutputDirectory}>Browse</button>
                  </div>
                  <div className="control-row">
                    <input
                      type="text"
                      value={fileName}
                      onChange={e => setFileName(e.target.value)}
                      placeholder="Enter output filename"
                    />
                  </div>
                </div>
              </div>

              <div className="message-box">
                {message}
              </div>

              {/* PDF file list section */}
              {pdfFiles.length > 0 && (
                <div className="pdf-search-results">
                  <h3>Found PDF Files ({pdfFiles.length})</h3>
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
                        {pdfFiles.slice(0, 10).map((file, index) => (
                          <tr key={index}>
                            <td className="file-name">{file.name}</td>
                            <td className="file-size">{(file.size / 1024).toFixed(1)} KB</td>
                            <td className="file-actions">
                              <button
                                className="open-file-button"
                                onClick={() => window.electron.openFile(file.path)}
                              >
                                Open
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {pdfFiles.length > 10 && (
                      <div className="more-files-notice">
                        and {pdfFiles.length - 10} more files...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Create PDF button */}
              <div className="merge-pdf-container">
                <button
                  className="merge-pdf-button"
                  onClick={createMergedPdf}
                  disabled={isProcessing || !pdfDirectory || !outputDirectory}
                >
                  {isProcessing ? 'Processing...' : 'Create Submittal PDF'}
                </button>
                {!pdfDirectory && (
                  <p className="merge-help-text">Please select a PDF directory first</p>
                )}
                {!outputDirectory && (
                  <p className="merge-help-text">Please select an output location</p>
                )}
              </div>
            </div>
          )}

          {/* CSV Upload Tab Content (Placeholder) */}
          {activeTab === 'csv' && (
            <div className="tab-content">
              <div className="file-input-group">
                <h2>Upload CSV File</h2>
                <div className="file-input-container">
                  <button className="file-select-button">
                    Select CSV File
                  </button>
                  <div className="file-info">
                    <p>No file selected</p>
                  </div>
                </div>
              </div>
              <div className="message-box">
                Select a CSV file containing manufacturer and part number information.
              </div>
              <div className="submit-section">
                <button className="submit-button" disabled>Process CSV</button>
              </div>
            </div>
          )}

          {/* Sync Files Tab Content (Placeholder) */}
          {activeTab === 'sync' && (
            <div className="tab-content">
              <div className="message-box">
                Sync PDF files with remote storage.
              </div>
              <div className="session-controls">
                <button className="session-button sync-all-btn">Sync All Files</button>
                <button className="session-button refresh-btn">Refresh Status</button>
              </div>
            </div>
          )}

          {/* Manual Search Tab Content (Placeholder) */}
          {activeTab === 'manual' && (
            <div className="tab-content">
              <div className="file-input-group">
                <h2>Manual Part Search</h2>
                <div className="form-group">
                  <label>Manufacturer:</label>
                  <input type="text" placeholder="e.g. Schneider Electric" />
                </div>
                <div className="form-group">
                  <label>Part Number:</label>
                  <input type="text" placeholder="e.g. SE8600U5045" />
                </div>
                <button className="file-select-button">
                  Search
                </button>
              </div>
              <div className="message-box">
                Manually search for part information.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Settings modal rendered outside of the main content flow */}
      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          pdfDirectory={pdfDirectory}
          outputDirectory={outputDirectory}
          onPdfDirectoryChange={setPdfDirectory}
          onOutputDirectoryChange={setOutputDirectory}
          onSelectPdfDirectory={selectPdfDirectory}
          onSelectOutputDirectory={selectOutputDirectory}
        />
      )}
    </div>
  );
}

export default App; 