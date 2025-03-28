import { useState } from 'react';
import './App.css';

type MatchResult = {
  manufacturer: string;
  partNumber: string;
  matched: boolean;
  pdfPath?: string;
  fileName?: string;
};

type ResultSummary = {
  total: number;
  matched: number;
  notFound: number;
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

  const selectPdfDirectory = async () => {
    try {
      const directory = await window.electron.selectFolder();
      if (directory) {
        setPdfDirectory(directory);
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
        setMessage(`CSV file selected: ${filePath.split('/').pop()}`);
      }
    } catch (error) {
      console.error('Error selecting CSV file:', error);
      setMessage(`Error: ${(error as Error).message}`);
    }
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

      // Call the main process to merge PDFs
      const result = await window.electron.createMergedPdf(pdfPaths, productInfo);

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

  return (
    <div className="app">
      <h1>Submittal Manager</h1>

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
                    </tr>
                  </thead>
                  <tbody>
                    {detailedResults.map((result, index) => (
                      <tr key={index} className={result.matched ? 'row-matched' : 'row-not-matched'}>
                        <td>{result.manufacturer}</td>
                        <td>{result.partNumber}</td>
                        <td className="status-cell">
                          {result.matched ? (
                            <span className="status-matched">✅ Matched</span>
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
              <li>Create a merged submittal PDF of all matches</li>
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
    </div>
  );
}

export default App; 