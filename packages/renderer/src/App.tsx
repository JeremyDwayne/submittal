import { useState } from 'react';
import CsvUploader from './components/CsvUploader';
import './App.css';

function App() {
  const [pdfFiles, setPdfFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pdfDirectory, setPdfDirectory] = useState<string | null>(null);

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

  const handleMessage = (msg: string) => {
    setMessage(msg);
  };

  const handleError = (error: string) => {
    setMessage(error);
  };

  return (
    <div className="app">
      <h1>Submittal Manager</h1>

      <div className="card">
        <button onClick={selectPdfDirectory} disabled={isLoading}>
          {isLoading ? 'Processing...' : pdfDirectory ? 'Change PDF Directory' : 'Select PDF Directory'}
        </button>

        {pdfDirectory && (
          <div className="directory-info">
            <p>PDF Directory: {pdfDirectory}</p>
          </div>
        )}

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
      </div>

      <div className="tab-content">
        <CsvUploader
          onUploadComplete={handleMessage}
          onError={handleError}
          pdfDirectory={pdfDirectory}
          onSelectPdfDirectory={selectPdfDirectory}
        />
      </div>

      <div className="pdf-list">
        <h2>Available PDFs</h2>
        {pdfFiles.length > 0 ? (
          <ul>
            {pdfFiles.map((file, index) => (
              <li key={index}>{file}</li>
            ))}
          </ul>
        ) : (
          <p>{pdfDirectory ? 'No PDFs found in selected directory.' : 'No directory selected. Please select a PDF directory to get started.'}</p>
        )}
      </div>
    </div>
  );
}

export default App; 