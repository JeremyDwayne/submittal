import Store from 'electron-store';
import path from 'path';
import axios from 'axios';

// Cache schema for the API
interface ApiCacheSchema {
    auth: {
        token?: string;
        expiresAt?: number;
    };
    products: Record<string, ProductInfo>;
}

// Product info type
interface ProductInfo {
    reference: string;
    description?: string;
    documents?: ProductDocument[];
    lastFetched: number;
}

// Document type
interface ProductDocument {
    type: string;
    mimeCode: string;
    description: string;
    url: string;
    language: string;
}

// Initialize the API cache
const apiCache = new Store<ApiCacheSchema>({
    name: 'schneider-api-cache',
    defaults: {
        auth: {},
        products: {}
    }
});

/**
 * Search for a product in Schneider's catalog
 * @param partNumber The product reference to search for
 * @returns Product information including document URLs
 */
export async function searchSchneiderProduct(partNumber: string): Promise<ProductInfo | null> {
    // Normalize part number
    const normalizedPartNumber = partNumber.trim().toUpperCase();

    // Check cache first
    const cachedProduct = apiCache.get('products')[normalizedPartNumber] as ProductInfo | undefined;
    if (cachedProduct && (Date.now() - cachedProduct.lastFetched) < (24 * 60 * 60 * 1000)) { // Cache for 24 hours
        return cachedProduct;
    }

    try {
        // Since we don't have actual API credentials, we'll use a mock response
        // In a real implementation with actual credentials, you would:
        /*
        const API_BASE_URL = 'https://api.se.com/v2/reference-data/product/product-catalog';
        const queryParams = new URLSearchParams({
            'supplierid': '99887766', // Your supplier ID
            'supplierid-type': 'specific',
            'customerid': '1122334455', // Your customer ID
            'customerid-type': 'specific',
            'product-reference': normalizedPartNumber,
            'product-identifier': 'commercialReference',
            'etim-version': 'ETIM-9.0',
            'english-descriptions': 'true',
            'mime-filtering': 'MD22,MD21,MD14,MD36',
            'data-filtering': 'digital-asset-media'
        });
        
        // Get auth token
        const token = await getAuthToken();
        const apiUrl = `${API_BASE_URL}/products?${queryParams.toString()}`;
        const response = await axios.get(apiUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
        
        // Parse response and extract product info
        */

        // Mock product for now
        const mockProduct: ProductInfo = {
            reference: normalizedPartNumber,
            description: `${normalizedPartNumber} - Example Product`,
            documents: [
                {
                    type: 'Product Data Sheet',
                    mimeCode: 'MD22',
                    description: 'Product Data Sheet',
                    url: `https://www.se.com/us/en/product/download-pdf/${normalizedPartNumber}`,
                    language: 'en'
                }
            ],
            lastFetched: Date.now()
        };

        // Cache the result
        const products = apiCache.get('products');
        apiCache.set('products', {
            ...products,
            [normalizedPartNumber]: mockProduct
        });

        return mockProduct;
    } catch (error) {
        console.error('Error searching for Schneider product:', error);
        return null;
    }
}

/**
 * Check if a URL is accessible without authorization
 * @param url URL to check
 * @returns true if accessible, false if authentication required or error
 */
async function isUrlAccessible(url: string): Promise<boolean> {
    try {
        // Make a HEAD request to check if the URL is accessible
        const response = await axios.head(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.se.com/us/en/product/search',
                'Origin': 'https://www.se.com'
            },
            maxRedirects: 5,
            timeout: 5000
        });

        // Check if the response indicates we have access
        return response.status === 200;
    } catch (error) {
        // Any error means we don't have access
        return false;
    }
}

/**
 * Get the PDF URL for a specific product
 * @param partNumber The product reference to search for
 * @returns The URL of the first matching PDF or null if not found
 */
export async function findSchneiderPdfUrlFromApi(partNumber: string): Promise<string | null> {
    try {
        // Normalize part number
        const normalizedPartNumber = partNumber.trim().toUpperCase();

        // First try the direct URL approach which is more reliable
        const directUrl = `https://www.se.com/us/en/product/download-pdf/${normalizedPartNumber}`;

        // Check if URL is accessible (useful for debugging, result not used for now)
        const accessible = await isUrlAccessible(directUrl);
        console.log(`URL ${directUrl} is ${accessible ? 'accessible' : 'not accessible'}`);

        // Note: We'll return the URL regardless of accessibility - the downloader
        // will handle the authentication error and provide user feedback
        return directUrl;

        // For actual API integration in the future, we would use the following:
        /*
        // Check if the URL is accessible first to save time on failures
        const isAccessible = await isUrlAccessible(directUrl);
        if (isAccessible) {
            return directUrl;
        }
        
        // If direct URL isn't accessible, try the product search API
        const product = await searchSchneiderProduct(partNumber);
        if (!product || !product.documents || product.documents.length === 0) {
            return null;
        }

        // Find the first document that has a PDF URL
        // Prioritize data sheets (MD22) first
        const dataSheet = product.documents.find(doc => doc.mimeCode === 'MD22');
        if (dataSheet && dataSheet.url) {
            return dataSheet.url;
        }

        // Then try instruction sheets (MD21)
        const instructionSheet = product.documents.find(doc => doc.mimeCode === 'MD21');
        if (instructionSheet && instructionSheet.url) {
            return instructionSheet.url;
        }

        // Then try any other document
        const anyDoc = product.documents.find(doc => doc.url);
        return anyDoc ? anyDoc.url : null;
        */
    } catch (error) {
        console.error('Error finding PDF URL from API:', error);
        return null;
    }
}

/**
 * Clear the product cache
 * @param partNumber Optional specific part number to clear from cache
 */
export function clearProductCache(partNumber?: string): void {
    if (partNumber) {
        const normalizedPartNumber = partNumber.trim().toUpperCase();
        const products = apiCache.get('products');
        if (products[normalizedPartNumber]) {
            const updatedProducts = { ...products };
            delete updatedProducts[normalizedPartNumber];
            apiCache.set('products', updatedProducts);
        }
    } else {
        apiCache.set('products', {});
    }
}

/**
 * Extracts a file name from a URL
 * @param url The URL to extract a filename from
 * @returns A sanitized filename
 */
export function getFileNameFromUrl(url: string): string {
    const urlPath = new URL(url).pathname;
    const baseName = path.basename(urlPath);

    // If there's a valid filename, use it
    if (baseName && baseName.includes('.')) {
        return baseName;
    }

    // Otherwise generate a filename based on the URL
    return `document_${Math.floor(Date.now() / 1000)}.pdf`;
} 