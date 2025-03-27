import { useState, FormEvent } from 'react';
import './ManualPartSearch.css';

interface ManualPartSearchProps {
  onSearchComplete?: (message: string) => void;
  onError?: (error: string) => void;
}

const ManualPartSearch = ({ onSearchComplete, onError }: ManualPartSearchProps) => {
  const [brand, setBrand] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!brand.trim()) {
      onError?.('Brand is required');
      return;
    }
    
    if (!partNumber.trim()) {
      onError?.('Part number is required');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Send single part to main process
      const result = await window.electron.processCsvData([{ 
        brand: brand.trim(), 
        part_number: partNumber.trim() 
      }]);
      
      if (result.success) {
        onSearchComplete?.(result.message || 'Started processing part');
        // Clear the form
        setBrand('');
        setPartNumber('');
      } else {
        onError?.(result.error || 'Failed to process part');
      }
    } catch (error) {
      onError?.(`Error: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadExample = () => {
    setBrand('Johnson Controls');
    setPartNumber('MS-VMA1620-0');
  };

  return (
    <div className="manual-search">
      <h2>Manual Part Search</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="brand">Brand</label>
          <input
            type="text"
            id="brand"
            value={brand}
            onChange={e => setBrand(e.target.value)}
            placeholder="e.g. Johnson Controls"
            disabled={isLoading}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="part-number">Part Number</label>
          <input
            type="text"
            id="part-number"
            value={partNumber}
            onChange={e => setPartNumber(e.target.value)}
            placeholder="e.g. MS-VMA1620-0"
            disabled={isLoading}
            required
          />
        </div>
        
        <button 
          type="submit" 
          disabled={isLoading}
          className="search-button"
        >
          {isLoading ? 'Searching...' : 'Search for Cut Sheet'}
        </button>
      </form>
      
      <div className="example-link">
        <button 
          onClick={loadExample} 
          className="link-button"
          disabled={isLoading}
        >
          Load example
        </button>
      </div>
      
      {isLoading && (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      )}
    </div>
  );
};

export default ManualPartSearch; 