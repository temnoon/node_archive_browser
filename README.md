# Node Archive Browser

A flexible browser for AI conversation archives with import/explode functionality. This tool allows you to view and manage ChatGPT/OpenAI conversation exports (with planned support for Anthropic/Claude).

## Features

- Browse conversations in an exploded archive
- View messages with proper markdown rendering
- Display media attachments (images, etc.)
- Search across conversations
- Import and explode OpenAI/ChatGPT archives with customizable structure

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### Configuration

The browser can be configured through environment variables or by editing the `.env` file in the server directory:

```
# .env file
ARCHIVE_ROOT=../../exploded_archive_node
PORT=3001
```

### Running the Application

1. Start the server:

```bash
cd server
npm run dev
```

2. In a separate terminal, start the client:

```bash
cd client
npm run dev
```

3. Access the application in your browser at http://localhost:5173

## Using the Archive Import Wizard

The Import Wizard allows you to convert an OpenAI/ChatGPT export into an exploded archive that can be browsed with this tool.

1. Click "Import Archive" in the top-right corner
2. Configure your import settings:
   - Select archive type (OpenAI/ChatGPT)
   - Specify source folder (where your unzipped export is located)
   - Specify output folder and archive name
   - Customize folder naming patterns
3. Click "Preview Structure" to see what the result will look like
4. Click "Import & Explode" to start the process
5. Once complete, update your `.env` file to point to the new archive location

## Customizing Archive Structure

The import wizard allows you to customize the structure of your exploded archive through several naming patterns:

- **Conversation Folder Pattern**: How conversation folders are named
  - Available variables: `{conversation_id}`, `{title}`, `{date}`
  - Default: `{conversation_id}_{title}_{date}`

- **Message Folder Pattern**: How message folders are named
  - Available variables: `{timestamp}`, `{role}`, `{uuid}`
  - Default: `{timestamp}_{role}_{uuid}`

- **Media Folder Name**: What to call the media folder in each conversation
  - Default: `media`

## Switching Between Archives

To switch to a different archive:

1. Update the `ARCHIVE_ROOT` in the `.env` file to point to your new archive
2. Restart the server

## Troubleshooting

- **Media Not Displaying**: Check that the media paths in markdown files correctly point to the media folder. The browser supports relative paths like `../media/filename` or direct references to media files.
- **Import Failing**: Make sure the source folder contains a valid OpenAI/ChatGPT export with a `conversations.json` file.
- **Server Errors**: Check the server console for detailed error messages.

## Architecture

- **Server**: Node.js/Express backend that serves conversation data and media files
- **Client**: React frontend that displays conversations and messages with proper formatting
- **Import System**: Streams and processes large conversation JSON files to create the exploded archive structure
