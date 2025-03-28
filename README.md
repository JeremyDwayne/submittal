# Submittal - Electron PDF App

A monorepo Electron application with React for the renderer process. This app allows you to match Bill of Materials (BOM) CSV files to PDF cut sheets based on manufacturer and part number.

## Project Structure

```
submittal/
├── packages/
│   ├── main/             # Electron main process
│   │   ├── src/          # TypeScript source files
│   │   └── dist/         # Compiled JavaScript output
│   └── renderer/         # React renderer process
│       ├── src/          # React components and TypeScript files
│       └── dist/         # Built React app output
├── public/               # Static assets
└── data/                 # Directory for storing PDF files
```

## Features

- Monorepo structure with separate packages for main and renderer processes
- IPC communication between main and renderer processes
- React with TypeScript for the renderer process
- Vite for React bundling
- PDF file import and matching with BOM entries
- CSV file parsing with flexible column mapping
- Intelligent PDF filename matching with fuzzy search

## BOM-to-PDF Matching

The application includes powerful functionality for matching BOM (Bill of Materials) entries to PDF files:

1. **CSV Parsing**: Parse CSV files with flexible column mapping for manufacturer and part number
2. **PDF Scanning**: Scan directories of PDF files and extract metadata
3. **Intelligent Matching**: Match BOM entries to PDFs by looking for manufacturer and part number in filenames
4. **Normalization**: Matching ignores case, spaces, dashes, underscores for better results
5. **Summary Reports**: Get detailed reports of matched and unmatched entries

### Usage Example

```typescript
import { parseBomCsv } from './utils/bom-parser';
import { matchBomToPdfs, scanPdfDirectory } from './utils/pdf-service';

// Parse a CSV file
const bomEntries = await parseBomCsv('path/to/bom.csv', {
  manufacturerField: ['manufacturer', 'brand', 'vendor'],
  partNumberField: ['part_number', 'partnumber', 'part no', 'model']
});

// Scan a directory for PDFs
const pdfFiles = await scanPdfDirectory('path/to/pdf/directory');

// Match BOM entries to PDF files
const results = matchBomToPdfs(bomEntries, pdfFiles);

console.log(`Total: ${results.summary.total}`);
console.log(`Matched: ${results.summary.matched}`);
console.log(`Not Found: ${results.summary.notFound}`);
```

## Development

1. Install dependencies:

```bash
npm install
```

2. Run the development server:

```bash
npm run dev
```

This will start both the Electron main process and the React development server.

## Building for Production

1. Build the application:

```bash
npm run build
```

2. Package the application:

```bash
npm run package
```

This will create executable files for your platform in the `packages/main/release` directory.

## IPC Communication

The app uses Electron's IPC (Inter-Process Communication) to securely communicate between the main and renderer processes:

- `file:select` - Open a file dialog to select files (e.g., CSV)
- `folder:select` - Select a directory (e.g., PDF directory)
- `pdfs:scan` - Scan a directory for PDF files
- `bom:process` - Process a BOM CSV file and match against PDFs

## License

ISC 