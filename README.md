# Node Archive Browser

A flexible browser for AI conversation archives with import/explode functionality. This tool allows you to view and manage ChatGPT/OpenAI and Claude/Anthropic conversation exports with a user-friendly web interface.

## Features

- 🔍 **Browse Conversations**: Navigate through your conversation archives with an intuitive interface
- 📝 **Rich Message Display**: View messages with proper markdown rendering and syntax highlighting
- 🖼️ **Media Support**: Display images, audio, and video attachments inline
- 🔎 **Search & Filter**: Search across conversations with date filtering and media filtering
- 📄 **PDF Export**: Export conversations to high-quality PDFs with LaTeX math rendering
- 📥 **Import Wizard**: Convert ChatGPT/OpenAI and Claude exports into browsable archives
- 📁 **Archive Management**: Switch between different archive locations easily

## Quick Start

### Prerequisites

- Node.js 16+ and npm
- A ChatGPT/OpenAI or Claude conversation export (optional, for importing)

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
4. Select "OpenAI" as the archive type
5. Follow the Import Wizard to process your conversations
6. The archive location will be automatically set after import

### Option 2: Import a Claude Export

1. Export your Claude conversations from Anthropic
2. Unzip the export file (should contain `conversations.json`)
3. In the Archive Browser, click "IMPORT ARCHIVE"
4. Select "Claude" as the archive type
5. Configure import settings:
   - **Source Directory**: Path to your unzipped Claude export
   - **Use Message References**: Recommended for better performance
   - **Archive Name**: Name for your processed archive
6. Follow the Import Wizard to process your conversations
7. The system will:
   - Convert Claude format to browser-compatible format
   - Extract any embedded base64 images to separate files
   - Create individual message files for efficient loading
   - Generate proper conversation metadata

### Option 3: Use Existing Archive

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

## PDF Export

The Archive Browser includes a powerful PDF export feature that converts conversations into professional, printable documents with full LaTeX math rendering.

### Accessing PDF Export

1. **From Conversation View**: Click the "Export PDF" button in the conversation controls
2. **Export Options**: Choose from multiple layout and filtering options
3. **Download**: Generated PDFs are automatically downloaded to your browser's download folder

### Export Features

#### Layout Options
- **Format**: A4, Letter, Legal page sizes
- **Margins**: Customizable margins (0.5in to 2in)
- **Orientation**: Portrait or landscape
- **Headers/Footers**: Optional page numbering and titles

#### Content Filtering
- **Message Selection**: Export all messages or filter by:
  - Message author (user, assistant, system)
  - Date range
  - Message type
- **Content Types**: Include/exclude:
  - Tool messages and outputs
  - Media attachments
  - System messages

#### Advanced Features
- **LaTeX Math Rendering**: Full support for mathematical expressions
  - Display math: `\[...\]` and `$$...$$`
  - Inline math: `\(...\)` and `$...$`
  - Complex equations, matrices, integrals, and symbols
- **Markdown Formatting**: Proper rendering of:
  - Headers, bold, italic, strikethrough
  - Code blocks and inline code
  - Lists (ordered and unordered)
  - Links and tables
- **Media Integration**: Embedded images with proper scaling
- **Clean Output**: Automatic filtering of internal file references

### PDF Export Dialog Options

#### Layout Tab
```
Format: [A4 ▼] [Portrait ▼]
Margins: Top [1in] Right [1in] Bottom [1in] Left [1in]
□ Include page headers
□ Include page numbers
```

#### Content Tab
```
Messages to Include:
□ User messages
□ Assistant messages  
□ System messages
□ Tool outputs

Content Filtering:
□ Hide tool messages
□ Include media attachments
Date Range: [Start Date] to [End Date]
```

#### Style Tab
```
Font Size: [12pt ▼]
Line Spacing: [1.2 ▼]
□ Syntax highlighting for code
□ Mathematical expressions
```

### Supported Content Types

- **Text Messages**: Full markdown with LaTeX support
- **Code Blocks**: Syntax-highlighted programming code
- **Mathematical Expressions**: Rendered using MathJax
- **Images**: Embedded with proper scaling and captions
- **Lists and Tables**: Properly formatted structures
- **Mixed Content**: Seamless integration of all content types

### LaTeX Math Support

The PDF export fully supports LaTeX mathematical notation:

#### Display Math (Block Equations)
```latex
\[
E = mc^2
\]

$$
\nabla \cdot \mathbf{E} = \frac{\rho}{\varepsilon_0}
$$
```

#### Inline Math
```latex
The equation \( E = mc^2 \) or $E = mc^2$ represents mass-energy equivalence.
```

#### Complex Expressions
- Fractions: `\frac{a}{b}`
- Integrals: `\int_{-\infty}^{\infty} f(x) dx`
- Matrices: `\begin{pmatrix} a & b \\ c & d \end{pmatrix}`
- Greek letters: `\alpha, \beta, \gamma`
- Special symbols: `\nabla, \partial, \infty`

### Technical Details

#### PDF Generation
- **Engine**: Puppeteer with Chromium for high-quality rendering
- **MathJax**: Version 3 for mathematical expression rendering
- **Output**: PDF/A compatible for archival and accessibility
- **Size**: Optimized compression for reasonable file sizes

#### Browser Compatibility
- **Chrome/Chromium**: Full support
- **Firefox**: Full support
- **Safari**: Full support
- **Edge**: Full support

#### Adobe Acrobat Compatibility
- Enhanced PDF metadata for Adobe Reader compatibility
- Tagged PDF structure for accessibility
- Standard PDF format for cross-platform viewing

### Troubleshooting PDF Export

#### Common Issues

**PDF Won't Generate**
- Ensure server dependencies are installed: `npm install` in server directory
- Check that Chromium is available (automatically installed with Puppeteer)
- Verify sufficient disk space for temporary files

**LaTeX Not Rendering**
- Mathematical expressions should use proper LaTeX delimiters
- Check browser console for MathJax loading errors
- Ensure internet connection for MathJax CDN (first load)

**Adobe Acrobat Issues**
- PDFs are optimized for Adobe compatibility
- If PDF won't open, try another PDF viewer first
- Check for Adobe Reader updates

**Large File Sizes**
- Use content filtering to reduce export size
- Consider splitting long conversations into multiple PDFs
- Exclude media attachments if not needed

**Missing Content**
- Check message filtering settings in export dialog
- Verify date range includes desired messages
- Ensure tool messages are included if needed

#### Performance Tips

- **Large Conversations**: Use date filtering for conversations with 100+ messages
- **Media Heavy**: Consider excluding images for text-only exports
- **Multiple Exports**: Process one conversation at a time for best performance

## Import Wizard Configuration

### Archive Structure Customization

- **Conversation Folder Pattern**: `{date}_{title}_{uuid}` (default)
- **Message Organization**: Chronological with media preservation
- **File Management**: Automatic media file detection and organization

### Supported Import Sources

- **ChatGPT/OpenAI conversation exports** - Full support for all ChatGPT export formats
- **Claude/Anthropic conversation exports** - Complete format conversion with base64 image extraction
- **Various media file formats** - Images, audio, video with automatic organization
- **DALL-E generated content** - AI-generated images and creative content
- **User uploaded files** - Personal files attached to conversations

#### Claude Import Features

- **Format Conversion**: Automatic conversion from Claude's `chat_messages` format to browser-compatible structure
- **Role Mapping**: Converts Claude roles (`human`/`assistant`) to standard format (`user`/`assistant`)
- **Base64 Image Extraction**: Embedded images are extracted and saved as separate media files
- **Timestamp Conversion**: ISO timestamps converted to Unix format for consistency
- **Individual Message Files**: Creates separate JSON files for each message for efficient loading
- **Metadata Preservation**: Maintains original Claude metadata while adding compatibility fields

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
- **Import Fails**: Verify the source export is a valid ChatGPT/OpenAI or Claude export
- **Claude Import Issues**: 
  - Ensure the Claude export contains `conversations.json` file
  - Check that the source directory is the unzipped Claude export folder
  - Verify sufficient disk space for message file creation and base64 image extraction
- **PDF Export Fails**: Ensure server is running and Puppeteer dependencies are installed
- **LaTeX Not Rendering in PDF**: Check mathematical expressions use proper delimiters (`\[...\]`, `\(...\)`, `$...$`)
- **PDF Too Large**: Use content filtering to reduce size or split long conversations

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

- Batch PDF export for multiple conversations
- Advanced search capabilities
- Custom PDF themes and styling
- Electron desktop app features
