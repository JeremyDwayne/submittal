import { useState, useRef, ChangeEvent } from 'react';
import Papa from 'papaparse';
import './CsvUploader.css';

interface CsvPart {
  brand: string;
  part_number: string;
}

interface CsvUploaderProps {
  onUploadComplete?: (message: string) => void;
  onError?: (error: string) => void;
}

const CsvUploader = ({ onUploadComplete, onError }: CsvUploaderProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [partCount, setPartCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsLoading(true);

    Papa.parse<CsvPart>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.toLowerCase().trim(),
      complete: async (results) => {
        try {
          // Filter out rows that don't have both brand and part_number
          const validParts = results.data.filter(
            (part) => part.brand && part.part_number
          );

          setPartCount(validParts.length);

          if (validParts.length === 0) {
            setIsLoading(false);
            onError?.('No valid parts found in CSV. Please check the format.');
            return;
          }

          // Send to main process
          const result = await window.electron.processCsvData(validParts);

          if (result.success) {
            onUploadComplete?.(result.message || 'CSV processed successfully');
          } else {
            onError?.(result.error || 'Failed to process CSV');
          }
        } catch (error) {
          onError?.(`Error processing CSV: ${(error as Error).message}`);
        } finally {
          setIsLoading(false);
        }
      },
      error: (error) => {
        setIsLoading(false);
        onError?.(`Error parsing CSV: ${error.message}`);
      },
    });
  };

  const handleReset = () => {
    setFileName(null);
    setPartCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="csv-uploader">
      <h2>Upload Parts CSV</h2>
      
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
      
      {fileName && partCount > 0 && (
        <div className="file-info">
          <p>Found {partCount} parts to process</p>
        </div>
      )}
      
      {isLoading && (
        <div className="loading">
          <p>Processing CSV...</p>
          <div className="spinner"></div>
        </div>
      )}
      
      <div className="instructions">
        <h3>CSV Format Requirements</h3>
        <p>CSV file must include these columns:</p>
        <ul>
          <li><strong>brand</strong> - The manufacturer name</li>
          <li><strong>part_number</strong> - The part identifier</li>
        </ul>
      </div>
    </div>
  );
};

export default CsvUploader; 