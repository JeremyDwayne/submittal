# Submittal - Electron PDF App

A monorepo Electron application with React for the renderer process. This app allows you to import PDF files and store them in the application's data directory.

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
└── data/                 # Directory for caching PDF downloads
```

## Features

- Monorepo structure with separate packages for main and renderer processes
- IPC communication between main and renderer processes
- React with TypeScript for the renderer process
- Vite for React bundling
- PDF file import and caching

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

- `dialog:open` - Open a file dialog to select PDF files
- `pdf:save` - Save a PDF file to the data directory
- `pdf:list` - List all PDFs in the data directory

## License

ISC 