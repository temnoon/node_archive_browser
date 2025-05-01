# Archive Import Wizard Implementation Guide

This guide provides instructions for implementing and using the Archive Import Wizard in the node_archive_browser project.

## Files Added/Modified

### Frontend (React)

1. **Added `ArchiveImportWizard.jsx`**
   - Path: `/client/src/ArchiveImportWizard.jsx`
   - Main React component for the wizard UI with form inputs for all configurable options

2. **Updated `App.jsx`**
   - Added Import Wizard route and navigation button to the app bar
   - Modified routing to support the new Import Wizard page

### Backend (Node.js/Express)

1. **Added `import-controller.js`**
   - Path: `/server/src/import-controller.js`
   - Handles all logic for archive imports, configuration, and status tracking

2. **Updated `index.js`**
   - Added new API routes for the Import Wizard
   - Connected routes to controller methods

3. **Updated `package.json`**
   - Added the `JSONStream` dependency for efficient handling of large JSON files
   - Added dev dependency for `nodemon` and improved npm scripts

## Features Implemented

- **User Configuration**:
  - Archive type selection (OpenAI support now, Anthropic planned)
  - Source/destination folder paths
  - Custom naming patterns for conversations and messages
  - Media folder structure settings

- **Configuration Management**:
  - Saves user preferences to `~/.carchive_config.json`
  - Loads saved settings automatically

- **Preview Functionality**:
  - Shows a preview of the folder structure before importing
  - Uses sample data from the actual archive

- **Efficient Import Process**:
  - Stream-based processing of large JSON files
  - Handles both old and new media format variants
  - Real-time progress tracking

- **Media File Handling**:
  - Properly resolves file references in content.md
  - Preserves relative paths for frontend display

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/import/config` | GET | Get saved import configuration |
| `/api/import/config` | POST | Save import configuration |
| `/api/import/preview` | POST | Generate a preview of the folder structure |
| `/api/import/start` | POST | Start the import process |
| `/api/import/status` | GET | Get current import status |

## Installation Steps

1. Install the required dependencies:

```bash
# Navigate to the server directory
cd server

# Install dependencies
npm install
```

2. Start the development server:

```bash
# Start the server in development mode
npm run dev
```

3. Build the client:

```bash
# Navigate to the client directory
cd client

# Install dependencies if needed
npm install

# Build the client
npm run build
```

## Usage

1. Access the application in your browser (typically at http://localhost:3001)
2. Click on the "Import Archive" button in the top-right corner
3. Configure your import settings:
   - Select archive type (OpenAI/ChatGPT)
   - Specify source folder (where your unzipped export is located)
   - Specify output folder and archive name
   - Customize naming patterns if desired
4. Click "Preview Structure" to see a sample of the resulting folder structure
5. Click "Save as Default" to save your configuration for future use
6. Click "Import & Explode" to start the import process
7. Monitor progress in the status area

## Configuration Format

The import configuration is saved as a JSON file at `~/.carchive_config.json` with the following structure:

```json
{
  "archiveType": "openai",
  "sourceDir": "/path/to/source",
  "outputDir": "/path/to/output",
  "archiveName": "exploded_archive",
  "conversationPattern": "{conversation_id}_{title}_{date}",
  "messagePattern": "{timestamp}_{role}_{uuid}",
  "mediaFolder": "media"
}
```

## Future Enhancements

1. **Electron Integration**: Add native folder selection
2. **Anthropic/Claude Support**: Support for Claude exports
3. **Enhanced Progress Reporting**: Add file counts and more detailed status
4. **Error Recovery**: Improve handling of partial imports
5. **Plugin Architecture**: Allow extensions for custom processing

## Troubleshooting

- **Large File Issues**: If experiencing memory problems with large archives, try:
  - Increasing Node.js memory limit: `NODE_OPTIONS=--max_old_space_size=4096`
  - Breaking up the conversations.json file
  
- **Media File Paths**: If images aren't displaying correctly:
  - Check the content.md files for proper relative paths
  - Ensure the conversation folder structure matches expected pattern
  
- **Permission Errors**: Ensure the app has read/write permissions to:
  - Source directory (read)
  - Output directory (write)
  - Home directory for config file (write)