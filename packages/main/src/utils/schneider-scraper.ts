import axios from 'axios';
import * as cheerio from 'cheerio';

export interface SchneiderSearchResult {
    title: string;
    url: string;
    description?: string;
    imageUrl?: string;
    partNumber: string;
}

/**
 * Searches Schneider Electric's website and returns search results 
 * @param query The search query (typically a part number)
 * @returns Array of search results
 */
export async function searchSchneiderProducts(query: string): Promise<SchneiderSearchResult[]> {
    try {
        const searchUrl = `https://www.se.com/us/en/search/?q=${encodeURIComponent(query)}&submit+search+query=Search`;

        console.log(`Searching Schneider Electric website: ${searchUrl}`);

        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'max-age=0',
            },
            timeout: 15000,
        });

        const $ = cheerio.load(response.data);
        const results: SchneiderSearchResult[] = [];

        // Extract product listings from search results
        $('.product-container').each((_, element) => {
            try {
                const productElement = $(element);

                // Extract title and URL
                const titleElement = productElement.find('.product-name a');
                const title = titleElement.text().trim();
                const url = titleElement.attr('href');

                // Extract image URL
                const imageUrl = productElement.find('.product-image img').attr('src') || undefined;

                // Extract description
                const description = productElement.find('.product-desc').text().trim() || undefined;

                // Extract part number
                let partNumber = '';
                const partNumberElement = productElement.find('.sku');
                if (partNumberElement.length > 0) {
                    partNumber = partNumberElement.text().trim().replace('Ref:', '').trim();
                } else {
                    // Try to extract from title or URL as fallback
                    const matches = title.match(/(\w+\d+\w*)/);
                    if (matches && matches.length > 1) {
                        partNumber = matches[1];
                    } else if (url) {
                        // Try to extract from URL
                        const urlMatches = url.match(/product\/([^/]+)/);
                        if (urlMatches && urlMatches.length > 1) {
                            partNumber = urlMatches[1];
                        }
                    }
                }

                if (title && url && partNumber) {
                    results.push({
                        title,
                        url: url.startsWith('http') ? url : `https://www.se.com${url}`,
                        description,
                        imageUrl,
                        partNumber
                    });
                }
            } catch (error) {
                console.error('Error parsing product element:', error);
            }
        });

        console.log(`Found ${results.length} search results for "${query}"`);
        return results;
    } catch (error) {
        console.error('Error searching Schneider Electric website:', error);
        throw error;
    }
}

/**
 * Gets product details and PDF download URLs from a product page
 * @param productUrl URL of the product page
 * @returns Object with product details and PDF URLs
 */
export async function getSchneiderProductDetails(productUrl: string): Promise<{
    title: string;
    description?: string;
    partNumber: string;
    datasheetUrl?: string;
    documentUrls: Array<{ title: string, url: string, type: string }>;
}> {
    try {
        console.log(`Getting product details from: ${productUrl}`);

        const response = await axios.get(productUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            timeout: 15000,
        });

        const $ = cheerio.load(response.data);

        // Extract basic product info
        const title = $('.product-main-info h1').text().trim();
        const description = $('.product-details-desc').text().trim() || undefined;

        // Extract part number
        let partNumber = '';
        $('.product-references tr').each((_, row) => {
            const label = $(row).find('th').text().trim();
            if (label.includes('Commercial Reference') || label.includes('Reference')) {
                partNumber = $(row).find('td').text().trim();
            }
        });

        // If we couldn't find part number in the table, try from the URL
        if (!partNumber) {
            const urlMatches = productUrl.match(/product\/([^/]+)/);
            if (urlMatches && urlMatches.length > 1) {
                partNumber = urlMatches[1];
            }
        }

        // Extract document URLs
        const documentUrls: Array<{ title: string, url: string, type: string }> = [];

        // Look for documents in the documents tab
        $('.documents-table tbody tr').each((_, row) => {
            const docTitle = $(row).find('.document-info-title').text().trim();
            const docUrl = $(row).find('a').attr('href');
            const docType = $(row).find('.document-type').text().trim();

            if (docUrl && docTitle) {
                documentUrls.push({
                    title: docTitle,
                    url: docUrl.startsWith('http') ? docUrl : `https://www.se.com${docUrl}`,
                    type: docType || 'unknown'
                });
            }
        });

        // Also look for "Documentation" links elsewhere on the page
        $('.documents-container a, .documents-downloads a, .product-documents a').each((_, link) => {
            const docUrl = $(link).attr('href');
            const docTitle = $(link).text().trim() || $(link).attr('title') || 'Document';

            if (docUrl && docUrl.endsWith('.pdf') && !documentUrls.some(doc => doc.url === docUrl)) {
                documentUrls.push({
                    title: docTitle,
                    url: docUrl.startsWith('http') ? docUrl : `https://www.se.com${docUrl}`,
                    type: 'Document'
                });
            }
        });

        // Find the datasheet URL (prioritize items with "datasheet" or "data sheet" in the title)
        let datasheetUrl: string | undefined = undefined;

        for (const doc of documentUrls) {
            const lowerTitle = doc.title.toLowerCase();
            if (
                lowerTitle.includes('datasheet') ||
                lowerTitle.includes('data sheet') ||
                lowerTitle.includes('product data') ||
                (lowerTitle.includes('technical') && lowerTitle.includes('publication'))
            ) {
                datasheetUrl = doc.url;
                break;
            }
        }

        // If no specific datasheet found, use the first PDF
        if (!datasheetUrl && documentUrls.length > 0) {
            datasheetUrl = documentUrls[0].url;
        }

        // If we still have no documents, try the direct PDF URL
        if (documentUrls.length === 0 && partNumber) {
            // Try using the direct PDF URL format as a fallback
            const directPdfUrl = `https://www.se.com/us/en/product/download-pdf/${partNumber}`;
            documentUrls.push({
                title: 'Product PDF',
                url: directPdfUrl,
                type: 'PDF'
            });

            if (!datasheetUrl) {
                datasheetUrl = directPdfUrl;
            }
        }

        return {
            title,
            description,
            partNumber,
            datasheetUrl,
            documentUrls
        };
    } catch (error) {
        console.error('Error getting product details:', error);
        throw error;
    }
}

/**
 * Searches for a product and attempts to find its datasheet URL directly
 * @param partNumber The part number to search for
 * @returns The datasheet URL if found, or null
 */
export async function findSchneiderPdfUrl(partNumber: string): Promise<string | null> {
    try {
        // First try direct URL as the fastest method
        const normalizedPartNum = partNumber.replace(/\s+/g, '').toUpperCase();
        const directPdfUrl = `https://www.se.com/us/en/product/download-pdf/${normalizedPartNum}`;

        // Search for the product
        const searchResults = await searchSchneiderProducts(partNumber);

        // If no results, return the direct URL as a fallback
        if (searchResults.length === 0) {
            return directPdfUrl;
        }

        // If we have exactly one result, get its details
        if (searchResults.length === 1) {
            const details = await getSchneiderProductDetails(searchResults[0].url);
            return details.datasheetUrl || directPdfUrl;
        }

        // If we have multiple results, return null and let the UI handle it
        return null;
    } catch (error) {
        console.error('Error finding PDF URL:', error);
        return null;
    }
}

/**
 * Alternative approach using the Schneider product page directly if known
 * @param partNumber The Schneider Electric part number
 * @returns The URL of the first matching PDF or null if not found
 */
export async function findSchneiderPdfUrlDirectly(partNumber: string): Promise<string | null> {
    try {
        // Normalize the part number
        const normalizedPartNum = partNumber.replace(/\s+/g, '').toUpperCase();

        // Use the direct PDF URL
        return `https://www.se.com/us/en/product/download-pdf/${normalizedPartNum}`;

        // Fallback to scraping if needed
        /*
        // Try to access the product page directly (may require knowledge of URL pattern)
        const productPageUrl = `https://www.se.com/us/en/product/${normalizedPartNum}`;

        const response = await axios.get(productPageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
            timeout: 10000,
        });

        const $ = cheerio.load(response.data);

        // Look for document links, especially in the "Documents and Downloads" section
        const pdfLinks: string[] = [];

        // Target document sections or tabs
        $('.documents-and-downloads a[href$=".pdf"], .document-tab a[href$=".pdf"]').each((_, element) => {
            const href = $(element).attr('href');
            if (href) {
                pdfLinks.push(href);
            }
        });

        // If specific sections aren't found, try generic PDF links
        if (pdfLinks.length === 0) {
            $('a[href$=".pdf"]').each((_, element) => {
                const href = $(element).attr('href');
                if (href) {
                    pdfLinks.push(href);
                }
            });
        }

        // Filter for links containing the part number
        const matchingPdfLinks = pdfLinks.filter(link => {
            const filename = link.split('/').pop() || '';
            return filename.toUpperCase().includes(normalizedPartNum);
        });

        return matchingPdfLinks.length > 0 ? matchingPdfLinks[0] : null;
        */

    } catch (error) {
        // Check if this is a 403 Forbidden error (website blocking our request)
        if (axios.isAxiosError(error) && error.response?.status === 403) {
            console.error('Access denied by Schneider Electric website (403 Forbidden)');
            throw new Error('Access to Schneider Electric website is blocked. Website may have anti-scraping measures in place.');
        }

        console.error('Error finding Schneider PDF directly:', error);
        throw error;
    }
} 