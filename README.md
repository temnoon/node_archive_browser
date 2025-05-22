# Node Archive Browser

A flexible browser for AI conversation archives with import/explode functionality. This tool allows you to view and manage ChatGPT/OpenAI conversation exports with a user-friendly web interface.

## Features

- 🔍 **Browse Conversations**: Navigate through your conversation archives with an intuitive interface
- 📝 **Rich Message Display**: View messages with proper markdown rendering and syntax highlighting
- 🖼️ **Media Support**: Display images, audio, and video attachments inline
- 🔎 **Search & Filter**: Search across conversations with date filtering and media filtering
- 📥 **Import Wizard**: Convert ChatGPT/OpenAI exports into browsable archives
- 📁 **Archive Management**: Switch between different archive locations easily

## Quick Start

### Prerequisites

- Node.js 16+ and npm
- A ChatGPT/OpenAI conversation export (optional, for importing)

### Installation

1. **Clone and Install**:
   ```bash
   git clone <repository-url>
   cd node-archive-browser
   
   # Install server dependencies
   cd server
   npm install
   
   # Install client dependencies
   cd ../client
   npm install
   ```

2. **Setup Environment**:
   ```bash
   # Copy example environment file
   cp .env.example .env
   
   # Copy server environment file
   cd server
   cp .env.example .env
   ```

3. **Configure Archive Location** (Edit `server/.env`):
   ```env
   PORT=3001
   ARCHIVE_ROOT=/path/to/your/exploded_archive_node
   ```

### Running the Application

1. **Start the Backend**:
   ```bash
   cd server
   npm start
   ```

2. **Start the Frontend** (in a new terminal):
   ```bash
   cd client
   npm run dev
   ```

3. **Access the Application**: Open http://localhost:5173 in your browser

## Getting Your First Archive

### Option 1: Import a ChatGPT Export

1. Export your ChatGPT conversations from OpenAI
2. Unzip the export file
3. In the Archive Browser, click "IMPORT ARCHIVE"
4. Follow the Import Wizard to process your conversations
5. The archive location will be automatically set after import

### Option 2: Use Existing Archive

If you already have a processed archive:

1. Go to the home page
2. Enter the path to your archive in "Current Archive Location"
3. Click "Save & Apply"

## Using the Interface

### Conversation View
- **Message Types**: User messages, assistant responses, tool outputs, and system messages
- **Hide Tool Messages**: Toggle to show/hide technical messages while preserving media
- **Media Display**: Images, audio, and video files are displayed inline with fallback paths
- **Canvas Support**: View ChatGPT canvas content

### Search & Navigation
- **Text Search**: Search across conversation titles and content
- **Date Filtering**: Filter conversations by date range
- **Media Filtering**: Show only conversations containing media files
- **Pagination**: Navigate large archives efficiently

### Media Gallery
- View all media files from your conversations in a gallery format
- Organized by conversation with proper navigation

## Import Wizard Configuration

### Archive Structure Customization

- **Conversation Folder Pattern**: `{date}_{title}_{uuid}` (default)
- **Message Organization**: Chronological with media preservation
- **File Management**: Automatic media file detection and organization

### Supported Import Sources

- ChatGPT/OpenAI conversation exports
- Various media file formats (images, audio, video)
- DALL-E generated content
- User uploaded files

## Archive Management

### Switching Archives

You can easily switch between different archives:

1. Use the "Current Archive Location" section on the home page
2. Enter the path to your archive directory
3. The system validates the archive and provides status feedback
4. Click "Save & Apply" to switch

### Archive Structure

A valid archive should contain:
```
your-archive/
├── 2024-01-15_Conversation-Title_uuid1/
│   ├── conversation.json
│   └── media/
│       ├── image1.png
│       └── audio1.wav
├── 2024-01-16_Another-Chat_uuid2/
│   ├── conversation.json
│   └── media/
│       └── image2.jpg
```

## Troubleshooting

### Common Issues

- **"Directory Not Found"**: Check that the archive path is correct and accessible
- **"Invalid Archive"**: Ensure the directory contains conversation folders with `conversation.json` files
- **Media Not Loading**: Check that media files exist in the expected locations
- **Import Fails**: Verify the source export is a valid ChatGPT/OpenAI export

### Getting Help

- Check the browser console for detailed error messages
- Verify file permissions on archive directories
- Ensure Node.js and npm are up to date

## Development

### Project Structure

```
node-archive-browser/
├── client/                 # React frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   └── ...
│   └── package.json
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   └── ...
│   ├── index.js
│   └── package.json
└── README.md
```

### Key Components

- **ConversationView.jsx**: Main conversation display
- **ArchiveImportWizard.jsx**: Import functionality
- **ArchiveLocationSelector.jsx**: Archive management
- **ConversationSearchTable.jsx**: Search and filtering

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

[Add your license information here]

## Future Enhancements

- Anthropic/Claude conversation support
- Enhanced export functionality
- Advanced search capabilities
- Electron desktop app features
