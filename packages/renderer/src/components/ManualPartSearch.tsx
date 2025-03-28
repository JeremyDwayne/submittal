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
  const [downloadResult, setDownloadResult] = useState<{
    success: boolean;
    filePath?: string;
    url?: string;
    cacheHit?: boolean;
  } | null>(null);
  const [authError, setAuthError] = useState<{
    message: string;
    url?: string;
  } | null>(null);
  const [showDirectUrl, setShowDirectUrl] = useState(false);
  const [directUrl, setDirectUrl] = useState('');

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
    setDownloadResult(null);
    setAuthError(null);

    try {
      // If a direct URL is provided, use it instead of searching
      if (showDirectUrl && directUrl) {
        const result = await window.electron.downloadPdf(
          directUrl,
          brand.trim(),
          partNumber.trim(),
          false // Don't force refresh by default
        );

        if (result.success) {
          setDownloadResult({
            ...result,
            url: directUrl
          });

          onSearchComplete?.(`Downloaded PDF from direct URL to: ${result.filePath}`);
        } else {
          // Check for authentication errors
          if (result.error?.includes('Authentication required') || result.error?.includes('login')) {
            setAuthError({
              message: result.error,
              url: directUrl
            });
          } else {
            onError?.(result.error || 'Failed to download PDF from URL');
          }
        }
      }
      // Special handling for Schneider Electric - use their API
      else if (brand.trim().toLowerCase() === 'schneider electric') {
        console.log('Using Schneider Electric API integration');
        const result = await window.electron.findAndDownloadSchneiderPdf(
          partNumber.trim(),
          false // Don't force refresh by default
        );

        if (result.success) {
          setDownloadResult(result);

          const message = result.cacheHit
            ? `Found Schneider Electric PDF in cache at: ${result.filePath}`
            : `Downloaded Schneider Electric PDF to: ${result.filePath}`;

          onSearchComplete?.(message);
        } else {
          // Check for authentication errors
          if (result.error?.includes('Authentication required') || result.error?.includes('login')) {
            setAuthError({
              message: result.error,
              url: result.url
            });
          } else {
            onError?.(result.error || 'Failed to find or download Schneider Electric PDF');
          }
        }
      }
      // For all other brands, use the general method
      else {
        const result = await window.electron.findAndDownloadPdf(
          brand.trim(),
          partNumber.trim(),
          false // Don't force refresh by default
        );

        if (result.success) {
          setDownloadResult(result);

          const message = result.cacheHit
            ? `Found PDF in cache at: ${result.filePath}`
            : `Downloaded PDF to: ${result.filePath}`;

          onSearchComplete?.(message);
        } else {
          // Check for authentication errors
          if (result.error?.includes('Authentication required') || result.error?.includes('login')) {
            setAuthError({
              message: result.error,
              url: result.url
            });
          } else {
            onError?.(result.error || 'Failed to find or download PDF');
          }
        }
      }
    } catch (error) {
      onError?.(`Error: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadExample = () => {
    setBrand('Schneider Electric');
    setPartNumber('SE8600U5045');
  };

  const toggleDirectUrl = () => {
    setShowDirectUrl(!showDirectUrl);
  };

  // Function to determine if we're using the Schneider API
  const isSchneiderElectric = (): boolean => {
    return brand.trim().toLowerCase() === 'schneider electric';
  };

  const openInBrowser = (url?: string) => {
    if (url) {
      window.electron.openExternalUrl(url);
    }
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
            placeholder="e.g. Schneider Electric"
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
            placeholder="e.g. SE8600U5045"
            disabled={isLoading}
            required
          />
        </div>

        {isSchneiderElectric() && (
          <div className="api-notice">
            Using Schneider Electric Product Catalog API for enhanced search
          </div>
        )}

        {isSchneiderElectric() && (
          <div className="auth-notice">
            Note: Schneider Electric requires authentication to download documents.
            You may need to download PDFs manually from their website and import them.
          </div>
        )}

        <div className="toggle-container">
          <button
            type="button"
            className="toggle-button"
            onClick={toggleDirectUrl}
          >
            {showDirectUrl ? 'Hide Direct URL' : 'Test with Direct URL'}
          </button>
        </div>

        {showDirectUrl && (
          <div className="form-group">
            <label htmlFor="direct-url">Direct PDF URL (for testing)</label>
            <input
              type="text"
              id="direct-url"
              value={directUrl}
              onChange={e => setDirectUrl(e.target.value)}
              placeholder="e.g. https://example.com/document.pdf"
              disabled={isLoading}
            />
            <div className="hint">Use this to test downloading from a known URL</div>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="search-button"
        >
          {isLoading ? 'Searching...' : (showDirectUrl && directUrl) ? 'Download from URL' : 'Find and Download PDF'}
        </button>
      </form>

      {authError && (
        <div className="error-panel">
          <h3>Authentication Required</h3>
          <p>{authError.message}</p>
          {authError.url && (
            <div className="error-actions">
              <button
                onClick={() => openInBrowser(authError.url)}
                className="open-browser-button"
              >
                Open in Browser
              </button>
              <p className="hint">
                You can download the PDF manually and import it later.
              </p>
            </div>
          )}
        </div>
      )}

      {downloadResult && downloadResult.success && (
        <div className="result-panel">
          <h3>PDF {downloadResult.cacheHit ? 'Found in Cache' : 'Downloaded'}</h3>
          <div className="result-info">
            <p><strong>File Path:</strong> {downloadResult.filePath}</p>
            {downloadResult.url && (
              <p><strong>Source URL:</strong> {downloadResult.url}</p>
            )}
            <p><strong>From Cache:</strong> {downloadResult.cacheHit ? 'Yes' : 'No'}</p>
          </div>
        </div>
      )}

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