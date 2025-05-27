# Claude Archive Import - Quick Start Guide

The Node Archive Browser now supports importing Claude/Anthropic conversation archives in addition to ChatGPT/OpenAI archives.

## Setup

1. **Download your Claude archive**:
   - Log into your Claude account
   - Go to account settings
   - Request and download your conversation export
   - Extract the zip file to a folder (e.g., `/Users/you/claude_archive`)

2. **Start the Archive Browser**:
   ```bash
   # Start the backend server
   cd /Users/tem/nab/server
   npm start
   
   # Start the frontend (in a new terminal)
   cd /Users/tem/nab/client
   npm run dev
   ```

3. **Import your Claude archive**:
   - Open http://localhost:5173 in your browser
   - Click "Import Archive" in the navigation
   - Configure the import settings:
     - **Archive Type**: Select "Auto-detect" (recommended) or "Anthropic / Claude"
     - **Source Folder**: Path to your extracted Claude archive folder
     - **Output Directory**: Where to create the processed archive
   - Click "Preview Structure" to see what will be created
   - Click "Import & Explode" to start the process

## Archive Format Support

### Claude Archive Structure
Your Claude export will contain:
- `conversations.json` - All your conversations with Claude
- `projects.json` - Information about any Claude projects (if any)
- `users.json` - Your user information

### Output Structure
After import, Claude conversations are converted to the same format as ChatGPT:
```
exploded_archive/
  conversation_id_date_title/
    conversation.json          # Claude conversation data
    messages/                  # Individual message files
      message_id/
        message.json
    media/                     # Any attachments or images
      [media files]
```

## Features

### Auto-Detection
The system automatically detects whether you're importing a Claude or ChatGPT archive by examining the conversation structure.

### Media Support
- **Inline Images**: Base64 encoded images are extracted and saved as files
- **File Attachments**: Document attachments are copied to the media folder
- **Image References**: Images are properly linked in the conversation data

### Message Structure
Claude's linear message structure is preserved while being organized into the standard exploded format for compatibility with the browser interface.

## Configuration Options

- **Use Message References**: Reduces disk space by storing message content once and referencing it
- **Skip Failed Conversations**: Continue import even if some conversations fail to process
- **Custom Naming Patterns**: Configure how conversation folders are named

## Troubleshooting

### Large Archives
Claude archives can be very large. If you experience timeouts:
- Enable "Skip Failed Conversations" 
- Use "Message References" to reduce disk usage
- Consider processing in smaller batches if available

### Missing Media
If some media files are missing after import:
- Check the `claude_import_errors.json` file in the output directory
- Media files might be embedded as base64 or stored in a different location

### Memory Issues
For very large archives (100MB+ conversations.json):
- Close other applications to free up memory
- Consider increasing Node.js memory limit: `node --max-old-space-size=4096`

## After Import

Once imported, your Claude conversations will be available in the Archive Browser with:
- Full conversation browsing
- Search functionality  
- Media gallery
- Export to PDF
- All standard Archive Browser features

## Support

The Claude import functionality supports the current Claude export format. If you encounter issues:
1. Check the server logs for error details
2. Review the import error files created during processing
3. Ensure your Claude archive is completely extracted
4. Verify file permissions on source and destination folders

For the latest updates and additional features, see the main project documentation.
