import { useState, useRef, ChangeEvent } from 'react';
import './CsvUploader.css';

interface CsvUploaderProps {
  onUploadComplete?: (message: string) => void;
  onError?: (error: string) => void;
  pdfDirectory: string | null;
  onSelectPdfDirectory: () => void;
}

const CsvUploader = ({
  onUploadComplete,
  onError,
  pdfDirectory,
  onSelectPdfDirectory
}: CsvUploaderProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvFilePath, setCsvFilePath] = useState<string | null>(null);
  const [results, setResults] = useState<{
    total: number;
    matched: number;
    notFound: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsLoading(true);

    try {
      // Get the file path using the system dialog
      const filePath = await window.electron.selectFile('.csv');

      if (!filePath) {
        setIsLoading(false);
        return;
      }

      setCsvFilePath(filePath);
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      onError?.(`Error selecting file: ${(error as Error).message}`);
    }
  };

  const handleProcessCsv = async () => {
    if (!csvFilePath) {
      onError?.('Please select a CSV file first');
      return;
    }

    if (!pdfDirectory) {
      onError?.('Please select a PDF directory first');
      return;
    }

    setIsLoading(true);

    try {
      const result = await window.electron.processBom(csvFilePath, pdfDirectory);

      if (result.success && result.summary) {
        setResults(result.summary);
        onUploadComplete?.(
          `Processed ${result.summary.total} items: ` +
          `${result.summary.matched} matched, ` +
          `${result.summary.notFound} not found`
        );
      } else {
        onError?.(result.error || 'Failed to process CSV');
      }
    } catch (error) {
      onError?.(`Error processing CSV: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFileName(null);
    setCsvFilePath(null);
    setResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="csv-uploader">
      <h2>Match BOM CSV to PDF Files</h2>

      <div className="directory-selection">
        <h3>PDF Directory</h3>
        <div className="directory-info">
          {pdfDirectory ? (
            <p>Selected: {pdfDirectory}</p>
          ) : (
            <p>No directory selected</p>
          )}
          <button
            onClick={onSelectPdfDirectory}
            className="directory-button"
          >
            {pdfDirectory ? 'Change Directory' : 'Select Directory'}
          </button>
        </div>
      </div>

      <div className="upload-container">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          ref={fileInputRef}
          disabled={isLoading}
          className="file-input"
          id="csv-file-input"
        />

        <label
          htmlFor="csv-file-input"
          className={`file-label ${isLoading ? 'disabled' : ''}`}
        >
          {fileName ? fileName : 'Choose CSV file'}
        </label>

        {fileName && (
          <button
            onClick={handleReset}
            className="reset-button"
            disabled={isLoading}
          >
            Reset
          </button>
        )}
      </div>

      {csvFilePath && pdfDirectory && (
        <div className="process-container">
          <button
            onClick={handleProcessCsv}
            className="process-button"
            disabled={isLoading}
          >
            Process BOM
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

      {isLoading && (
        <div className="loading">
          <p>Processing...</p>
          <div className="spinner"></div>
        </div>
      )}

      <div className="instructions">
        <h3>CSV Format Requirements</h3>
        <p>CSV file must include these columns:</p>
        <ul>
          <li><strong>manufacturer</strong> - The manufacturer name</li>
          <li><strong>part_number</strong> - The part identifier</li>
        </ul>
        <p>PDF files should include both manufacturer name and part number in the filename.</p>
      </div>
    </div>
  );
};

export default CsvUploader; 