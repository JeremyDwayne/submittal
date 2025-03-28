import { useState } from 'react';
import './App.css';

function App() {
  const [pdfFiles, setPdfFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pdfDirectory, setPdfDirectory] = useState<string | null>(null);
  const [csvFilePath, setCsvFilePath] = useState<string | null>(null);
  const [results, setResults] = useState<{
    total: number;
    matched: number;
    notFound: number;
  } | null>(null);

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

    try {
      const result = await window.electron.processBom(csvFilePath, pdfDirectory);

      if (result.success && result.summary) {
        setResults(result.summary);
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
                disabled={isLoading}
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
                disabled={isLoading}
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
              disabled={isLoading || !pdfDirectory || !csvFilePath}
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