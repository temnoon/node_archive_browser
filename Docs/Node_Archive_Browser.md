# Archive Browser Project: Comprehensive State Overview

## Project Overview

The Archive Browser is a web application designed to view and navigate ChatGPT archive exports. The application has two main components: a client-side React application and a server-side Node.js/Express application. It provides a user-friendly interface for browsing conversations, viewing messages, and exploring media files from ChatGPT exports.

## Architecture

### Client-Side (React + Material UI)

The frontend is built with React and Material UI, providing a responsive and user-friendly interface. Key components include:

1. **App.jsx** - Main application container with routing
2. **ConversationList.jsx** - Navigation sidebar displaying available conversations
3. **ConversationView.jsx** - Core component for displaying conversation messages
4. **ConversationSearchTable.jsx** - Searchable, filterable conversation list
5. **MediaGallery.jsx** - Gallery view of all media from conversations
6. **ArchiveImportWizard.jsx** - UI for importing and processing archives

### Server-Side (Node.js/Express)

The backend provides APIs for accessing conversation data, media files, and processing imports:

1. **index.js** - Main Express server with API routes
2. **import-controller.js** - Handles archive import process
3. **media-processor.js** - Processes and organizes media files
4. **conversation-controller.js** - Manages conversation data access

## Key Components & Functionality

### ConversationView.jsx

The central component for displaying conversation messages with these key features:

1. **Message Rendering** - Displays user, assistant, tool, and system messages
2. **Media Handling** - Shows images, audio, and video with fallback paths
3. **Tool/System Message Toggle** - Allows hiding technical messages while preserving media
4. **Pagination** - Supports viewing large conversations in manageable chunks
5. **Canvas Support** - Renders ChatGPT canvas content

Key functions:
- `fetchPage()` - Loads conversation data with pagination
- `extractMessageContent()` - Parses message structure for content and media
- `getMediaPath()` - Resolves media file paths with fallbacks
- `loadMediaFilenames()` - Maps file IDs to full filenames

### ConversationSearchTable.jsx

Provides a searchable, filterable list of conversations:

1. **Text Search** - Full-text search across conversation titles and content
2. **Date Filtering** - Filter by date range with clear labels
3. **Media Filtering** - Option to show only conversations with media
4. **Pagination** - Handle large archives efficiently

### ArchiveImportWizard.jsx

Manages the import process for ChatGPT archives:

1. **Configuration** - Select import options and paths
2. **Preview** - See folder structure before import
3. **Progress Tracking** - Real-time progress with error reporting
4. **Media Processing** - Handles various media file sources and formats

## State Management

The application uses React's built-in state management:

1. **Component State** - Local state for UI components
2. **URL Parameters** - For navigation between conversations
3. **Caching** - Client-side caching for better performance

## API Structure

Key API endpoints include:

1. `/api/conversations` - List all conversations
2. `/api/conversations/:id` - Get conversation details with pagination
3. `/api/media/:folder` - List media files for a conversation
4. `/api/import/*` - Import-related endpoints

## Recent Improvements

### 1. UI Enhancements

- Fixed cut-off labels in form fields
- Implemented proper positioning for date filters and dropdown menus
- Added explicit Typography components above form fields

### 2. Message Visibility Controls

- Added toggle to hide tool and system messages
- Preserved media from hidden messages by moving to associated assistant messages
- Added clear labels and tooltips for better usability

### 3. Conversation Synchronization

- Fixed issues with title and media synchronization between conversations
- Implemented comprehensive state reset between conversation changes
- Added proper media path resolution with fallbacks

### 4. Error Handling

- Enhanced error handling with alerts and recovery options
- Implemented auto-retry logic for API requests
- Added fallback paths for media loading

## Best Practices

### 1. UI Component Design

- Use Typography + form control instead of FormControl with internal label
- Always provide sufficient space for labels without overlap
- Add tooltips to explain functionality when needed
- Use consistent styling and spacing across the application

### 2. Media Handling

- Create a centralized function for path resolution (`getMediaPath`)
- Implement proper error handling with fallbacks
- Use small delays (e.g., setTimeout) to avoid race conditions in state updates
- Always clear state when switching contexts (conversations, pages)

### 3. Message Processing

- Extract message content systematically using helper functions
- Handle different message roles consistently (user, assistant, tool, system)
- Provide toggles for hiding non-essential messages
- Preserve important content (like media) even when messages are hidden

### 4. Performance Optimization

- Use pagination for large datasets
- Implement caching where appropriate
- Avoid unnecessary re-renders with useCallback and useMemo
- Reset state completely when switching contexts

### 5. JSON Preservation

- Maintain original JSON structure as source of truth
- Create parser modules for each message role
- Handle unknown message types gracefully
- Log unrecognized formats for future improvements

## Key Symbols/Variables

### ConversationView.jsx

- `filteredMessages` - Messages after filtering out empty system messages and tool/system messages if toggled
- `mediaFilenames` - Mapping between file IDs and full filenames
- `mediaByAssistantMsg` - Media from hidden messages mapped to assistant messages
- `getMediaPath` - Function to resolve media paths with fallbacks
- `hideToolMessages` - State for the tool/system message toggle

### ConversationSearchTable.jsx

- `cachedData` - Client-side cache for conversation data
- `filtered` - Conversations after applying search and filters
- `sortedFiltered` - Sorted conversations (newest first)
- `paginated` - Current page of conversations to display

## Future Development Considerations

1. **Anthropic/Claude Support** - Extend import functionality for Claude exports
2. **Electron Integration** - Add native OS features like file dialogs
3. **Export Functionality** - Allow exporting conversations in various formats
4. **Enhanced Media Gallery** - Improve navigation and organization options
5. **Search Improvements** - Add advanced search functionality with filters

## Documentation

All recent improvements and best practices have been stored in the project's knowledge base for future reference, including:

1. Conversation synchronization bug fixes
2. Media handling implementation details
3. UI component improvements
4. Tool/system message toggle functionality

This comprehensive overview provides a solid foundation for understanding the current state of the Archive Browser project and for making further improvements.

# Archive Browser Project - Quick Start Guide

## Project Structure

```
/Users/tem/nab/
├── client/                    # Frontend React application
│   ├── src/                   # React source files
│   │   ├── App.jsx            # Main application container with routing
│   │   ├── ConversationList.jsx        # Simple conversation list component
│   │   ├── ConversationSearchTable.jsx # Enhanced searchable conversation list
│   │   ├── ConversationView.jsx        # Core component for conversation display
│   │   ├── ArchiveImportWizard.jsx     # UI for importing archives
│   │   ├── MediaGallery.jsx            # Gallery view for media files
│   │   ├── Markdown.jsx               # Markdown renderer
│   │   ├── ToolMessageRenderer.jsx    # Renders tool messages
│   │   └── ...                        # Other UI components
│   ├── package.json           # Frontend dependencies
│   └── vite.config.js         # Vite configuration
│
├── server/                    # Backend Node.js/Express application
│   ├── src/                   # Server source files
│   │   ├── controllers/       # API controllers
│   │   │   ├── import-controller.js    # Handles archive import
│   │   │   ├── media-processor.js      # Processes media files
│   │   │   └── conversation-controller.js # Manages conversation data
│   │   └── routes/            # API routes
│   ├── index.js               # Main Express server
│   └── package.json           # Backend dependencies
```

## Development Quickstart

1. **Setup Environment**

   ```bash
   # Clone the repository (if needed)
   cd /Users/tem/nab/

   # Install backend dependencies
   cd server
   npm install

   # Install frontend dependencies
   cd ../client
   npm install
   ```

2. **Run the Application**

   ```bash
   # Start the backend server (in terminal 1)
   cd /Users/tem/nab/server
   npm start

   # Start the frontend development server (in terminal 2)
   cd /Users/tem/nab/client
   npm run dev
   ```

   The application should be accessible at: http://localhost:5173 (or the port configured in vite.config.js)

## Key Files for Common Tasks

- **Modify conversation display**: `/Users/tem/nab/client/src/ConversationView.jsx`
- **Change search/filtering options**: `/Users/tem/nab/client/src/ConversationSearchTable.jsx`
- **Update import wizard**: `/Users/tem/nab/client/src/ArchiveImportWizard.jsx`
- **Modify API endpoints**: `/Users/tem/nab/server/src/routes/*`
- **Change how media is processed**: `/Users/tem/nab/server/src/controllers/media-processor.js`

## Important Functions and Components

- `extractMessageContent()` - Parses message content and media in ConversationView.jsx
- `getMediaPath()` - Resolves media paths with fallbacks
- `fetchPage()` - Loads conversation data with pagination
- `loadMediaFilenames()` - Maps file IDs to full filenames

## Common Workflows

1. **Adding a new feature to conversation view**:
   - Edit `/Users/tem/nab/client/src/ConversationView.jsx`
   - Add necessary state variables
   - Update render function with new UI elements
   - Implement required handlers/functions

2. **Modifying import process**:
   - Update `/Users/tem/nab/server/src/controllers/import-controller.js`
   - Update `/Users/tem/nab/client/src/ArchiveImportWizard.jsx` for UI changes

3. **Adding new message type support**:
   - Update the message extraction logic in `extractMessageContent()`
   - Add appropriate rendering in ConversationView.jsx

## Best Practices

- Reset state completely when switching conversations
- Use MediaUI components consistently with proper labels
- Implement error handling with fallbacks for media
- Use Typography components above form fields instead of floating labels
- Maintain consistent styling across the application
- Avoid unnecessary re-renders with React hooks (useCallback, useMemo)
- Preserve meaningful content (like media) even when hiding tool/system messages

## Recent Enhancements

- Fixed label cutoff issues in form fields
- Added toggle for hiding tool and system messages
- Improved conversation synchronization
- Enhanced media handling with fallbacks

This guide provides the essential information needed to quickly understand and work with the Archive Browser project. For more detailed documentation, refer to the comments in the code and the stored knowledge base.
