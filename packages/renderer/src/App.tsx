import { useState, useEffect } from 'react';
import CsvUploader from './components/CsvUploader';
import ManualPartSearch from './components/ManualPartSearch';
import './App.css';

function App() {
  const [pdfFiles, setPdfFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' or 'csv'

  // Load PDF list on mount
  useEffect(() => {
    loadPDFs();
  }, []);

  const loadPDFs = async () => {
    setIsLoading(true);
    try {
      const result = await window.electron.listPDFs();
      if (result.success && result.files) {
        setPdfFiles(result.files);
      } else {
        setMessage(`Error loading PDFs: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to load PDFs:', error);
      setMessage(`Error: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenFile = async () => {
    try {
      const filePaths = await window.electron.openFileDialog();
      if (filePaths.length === 0) return;

      setIsLoading(true);
      setMessage('Saving selected PDFs...');

      for (const filePath of filePaths) {
        const fileName = filePath.split('/').pop() || 'unknown.pdf';
        const result = await window.electron.savePDF(filePath, fileName);
        
        if (!result.success) {
          console.error(`Failed to save ${fileName}:`, result.error);
          setMessage(`Error saving ${fileName}: ${result.error}`);
        }
      }

      await loadPDFs();
      setMessage('PDFs successfully imported!');
    } catch (error) {
      console.error('Error importing PDFs:', error);
      setMessage(`Error: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadComplete = (msg: string) => {
    setMessage(msg);
    // Refresh the PDF list after processing
    loadPDFs();
  };

  const handleUploadError = (error: string) => {
    setMessage(error);
  };

  return (
    <div className="app">
      <h1>Submittal Manager</h1>
      
      <div className="card">
        <button onClick={handleOpenFile} disabled={isLoading}>
          {isLoading ? 'Processing...' : 'Import PDF Files'}
        </button>
        
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

      <div className="tab-container">
        <div className="tab-buttons">
          <button 
            className={`tab-button ${activeTab === 'manual' ? 'active' : ''}`} 
            onClick={() => setActiveTab('manual')}
          >
            Manual Search
          </button>
          <button 
            className={`tab-button ${activeTab === 'csv' ? 'active' : ''}`} 
            onClick={() => setActiveTab('csv')}
          >
            CSV Upload
          </button>
        </div>
        
        <div className="tab-content">
          {activeTab === 'manual' ? (
            <ManualPartSearch 
              onSearchComplete={handleUploadComplete}
              onError={handleUploadError}
            />
          ) : (
            <CsvUploader 
              onUploadComplete={handleUploadComplete}
              onError={handleUploadError}
            />
          )}
        </div>
      </div>

      <div className="pdf-list">
        <h2>Saved PDFs</h2>
        {pdfFiles.length > 0 ? (
          <ul>
            {pdfFiles.map((file) => (
              <li key={file}>{file}</li>
            ))}
          </ul>
        ) : (
          <p>No PDFs found. Import some files to get started.</p>
        )}
      </div>
    </div>
  );
}

export default App; 