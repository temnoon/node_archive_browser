// Express backend for archive-browser (reads from exploded_archive, json-preserved format)
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const importController = require('./src/import-controller');
const mediaProcessor = require('./src/media-processor');

// Load environment variables from .env file if it exists
try {
  require('dotenv').config();
} catch (err) {
  console.warn('Could not load dotenv, using default environment');
}

const app = express();
const PORT = process.env.PORT || 3001;

// Get archive root from environment or use default
const ARCHIVE_ROOT = process.env.ARCHIVE_ROOT 
  ? path.resolve(__dirname, process.env.ARCHIVE_ROOT)
  : path.resolve(__dirname, '../../exploded_archive_node');

app.use(cors());
app.use(express.json());

// Import API routes
app.get('/api/import/config', importController.getConfig);
app.post('/api/import/config', importController.saveConfig);
app.post('/api/import/preview', importController.generatePreview);
app.post('/api/import/start', importController.startImport);
app.get('/api/import/status', importController.getStatus);

// List all media files in a conversation
app.get('/api/media/:conv', async (req, res) => {
  try {
    const { conv } = req.params;
    const mediaFolder = path.join(ARCHIVE_ROOT, conv, 'media');
    
    if (!await fs.pathExists(mediaFolder)) {
      return res.json([]);
    }
    
    const files = await fs.readdir(mediaFolder);
    res.json(files);
  } catch (err) {
    console.error('Error listing media files:', err);
    res.status(500).json({ error: 'Failed to list media files' });
  }
});

// Serve media files from the conversation-level media folder with proper MIME type detection
app.get('/api/media/:conv/:filename', (req, res) => {
  const { conv, filename } = req.params;
  const filePath = path.join(ARCHIVE_ROOT, conv, 'media', filename);
  
  fs.pathExists(filePath).then(exists => {
    if (!exists) {
      res.status(404).send('Media file not found');
    } else {
      // Determine content type based on file extension
      const ext = path.extname(filename).toLowerCase();
      let contentType = 'application/octet-stream'; // Default
      
      // Map common extensions to MIME types
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm'
      };
      
      if (mimeTypes[ext]) {
        contentType = mimeTypes[ext];
      }
      
      res.setHeader('Content-Type', contentType);
      res.sendFile(filePath);
    }
  }).catch(e => {
    console.error('Error serving media file:', e);
    res.status(500).send('Error accessing media file');
  });
});

// Helper: Recursively index conversations and messages from the new JSON-based structure
async function indexArchive() {
  const conversations = [];
  try {
    if (!await fs.pathExists(ARCHIVE_ROOT)) {
      console.error(`Archive root directory not found: ${ARCHIVE_ROOT}`);
      return [];
    }
    
    // Read all conversation directories
    const allDirs = await fs.readdir(ARCHIVE_ROOT);
    
    // Only include actual conversation directories (using a more flexible pattern)
    const convDirs = allDirs.filter(dir => {
      // Check for conversation.json file to determine valid conversation directory
      const jsonPath = path.join(ARCHIVE_ROOT, dir, 'conversation.json');
      return fs.existsSync(jsonPath);
    });
    
    console.log(`Found ${convDirs.length} conversation directories`);
    
    for (const convDir of convDirs) {
      const convPath = path.join(ARCHIVE_ROOT, convDir);
      const jsonPath = path.join(convPath, 'conversation.json');
      
      // Load the full conversation JSON
      const conversation = await fs.readJson(jsonPath);
      
      // Extract essential metadata
      const metadata = {
        id: conversation.id || conversation.conversation_id,
        title: conversation.title || 'Untitled',
        create_time: conversation.create_time,
        update_time: conversation.update_time,
        folder: convDir,
        message_count: conversation.mapping ? Object.keys(conversation.mapping).length : 0,
        // Include whether this conversation has gizmo/Custom GPT content
        has_gizmo: Object.values(conversation.mapping || {}).some(
          m => m.message?.metadata?.gizmo_id
        ),
        // Include model types used
        models: [...new Set(
          Object.values(conversation.mapping || {})
            .filter(m => m.message?.metadata?.model_slug)
            .map(m => m.message.metadata.model_slug)
        )],
        // Include if conversation has web search results
        has_web_search: Object.values(conversation.mapping || {}).some(
          m => m.message?.author?.role === 'tool' && m.message?.author?.name === 'web'
        ),
        // Include if conversation has media files
        has_media: await fs.pathExists(path.join(convPath, 'media')) && 
                  (await fs.readdir(path.join(convPath, 'media'))).length > 0
      };
      
      conversations.push(metadata);
    }
    
    // Sort conversations by create_time in descending order (newest first)
    conversations.sort((a, b) => (b.create_time || 0) - (a.create_time || 0));
    
  } catch (err) {
    console.error('Error indexing archive:', err);
  }
  
  return conversations;
}

// Load message details when needed
async function loadConversationMessages(convFolder, messageIds = null) {
  try {
    const convPath = path.join(ARCHIVE_ROOT, convFolder);
    const jsonPath = path.join(convPath, 'conversation.json');
    
    // Load full conversation JSON
    const conversation = await fs.readJson(jsonPath);
    
    // If specific message IDs are requested, only load those
    const targetIds = messageIds || Object.keys(conversation.mapping || {});
    
    // Extract message data and organize chronologically
    const messages = [];
    for (const id of targetIds) {
      const messageObj = conversation.mapping[id];
      if (messageObj && messageObj.message) {
        // Check if this is a message reference
        if (messageObj.message._reference && messageObj.message._reference.startsWith('messages/')) {
          // Load the referenced message
          const refPath = path.join(convPath, messageObj.message._reference);
          if (await fs.pathExists(refPath)) {
            const refMessage = await fs.readJson(refPath);
            
            // Extract markdown content
            const markdown = mediaProcessor.extractMarkdown(refMessage);
            
            messages.push({
              id: id,
              message: refMessage,
              parent: messageObj.parent,
              children: messageObj.children,
              markdown: markdown // Add extracted markdown
            });
          } else {
            // If reference file doesn't exist, use the summary
            messages.push({
              id: id,
              message: {
                ...messageObj.message._summary,
                content: { content_type: 'text', parts: ['[Message content not available]'] }
              },
              parent: messageObj.parent,
              children: messageObj.children,
              markdown: '[Message content not available]'
            });
          }
        } else {
          // This is a regular message
          // Extract markdown content
          const markdown = mediaProcessor.extractMarkdown(messageObj.message);
          
          messages.push({
            id: id,
            message: messageObj.message,
            parent: messageObj.parent,
            children: messageObj.children,
            markdown: markdown // Add extracted markdown
          });
        }
      }
    }
    
    // Sort by create_time
    messages.sort((a, b) => {
      const timeA = a.message.create_time || 0;
      const timeB = b.message.create_time || 0;
      return timeA - timeB;
    });
    
    return messages;
  } catch (err) {
    console.error(`Error loading conversation messages for ${convFolder}:`, err);
    return [];
  }
}

let archiveIndex = [];

async function refreshIndex() {
  archiveIndex = await indexArchive();
  console.log(`Indexed ${archiveIndex.length} conversations`);
}
refreshIndex();

// Paginated conversations list with filters
app.get('/api/conversations', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const per_page = Math.max(1, parseInt(req.query.limit) || 10);
    
    // Apply filters if provided
    let filteredItems = [...archiveIndex];
    
    // Filter by model if specified
    if (req.query.model) {
      filteredItems = filteredItems.filter(c => 
        c.models.some(model => model.includes(req.query.model))
      );
    }
    
    // Filter by gizmo/Custom GPT if specified
    if (req.query.gizmo === 'true') {
      filteredItems = filteredItems.filter(c => c.has_gizmo);
    }
    
    // Filter by web search if specified
    if (req.query.web_search === 'true') {
      filteredItems = filteredItems.filter(c => c.has_web_search);
    }
    
    // Filter by media content if specified
    if (req.query.has_media === 'true') {
      filteredItems = filteredItems.filter(c => c.has_media);
    }
    
    // Filter by date range if specified
    if (req.query.from_date) {
      const fromTime = new Date(req.query.from_date).getTime() / 1000;
      filteredItems = filteredItems.filter(c => c.create_time >= fromTime);
    }
    
    if (req.query.to_date) {
      const toTime = new Date(req.query.to_date).getTime() / 1000;
      filteredItems = filteredItems.filter(c => c.create_time <= toTime);
    }
    
    // Filter by search term if provided
    if (req.query.q) {
      const searchTerm = req.query.q.toLowerCase();
      filteredItems = filteredItems.filter(c => 
        c.title.toLowerCase().includes(searchTerm)
      );
    }
    
    const total = filteredItems.length;
    const start = (page - 1) * per_page;
    const pageItems = filteredItems.slice(start, start + per_page);
    
    res.json({ 
      items: pageItems, 
      total, 
      page, 
      per_page 
    });
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Conversations metadata for filtering
app.get('/api/conversations/meta', (req, res) => {
  try {
    // Extract unique model and gizmo information
    const models = new Set();
    const gizmos = new Set();
    let hasWebSearch = false;
    let hasMedia = false;
    
    archiveIndex.forEach(conv => {
      // Add models
      if (conv.models && Array.isArray(conv.models)) {
        conv.models.forEach(model => models.add(model));
      }
      
      // Check for web search
      if (conv.has_web_search) {
        hasWebSearch = true;
      }
      
      // Check for media
      if (conv.has_media) {
        hasMedia = true;
      }
    });
    
    // Get date range
    let oldestDate = null;
    let newestDate = null;
    
    if (archiveIndex.length > 0) {
      // Find oldest and newest conversations
      const sorted = [...archiveIndex].sort((a, b) => a.create_time - b.create_time);
      oldestDate = new Date(sorted[0].create_time * 1000).toISOString().split('T')[0];
      newestDate = new Date(sorted[sorted.length - 1].create_time * 1000).toISOString().split('T')[0];
    }
    
    res.json({
      models: Array.from(models),
      has_web_search: hasWebSearch,
      has_media: hasMedia,
      date_range: {
        oldest: oldestDate,
        newest: newestDate
      }
    });
  } catch (err) {
    console.error('Error fetching metadata:', err);
    res.status(500).json({ error: 'Failed to fetch metadata' });
  }
});

// Get conversation details including messages
app.get('/api/conversations/:id', async (req, res) => {
  try {
    const conv = archiveIndex.find(c => c.id === req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const per_page = Math.max(1, parseInt(req.query.limit) || 20);
    
    // Load message details for this conversation
    const messages = await loadConversationMessages(conv.folder);
    const total_messages = messages.length;
    
    // Apply pagination
    const start = (page - 1) * per_page;
    const pageMessages = messages.slice(start, start + per_page);
    
    // Return conversation data with paginated messages
    res.json({
      id: conv.id,
      title: conv.title,
      create_time: conv.create_time,
      folder: conv.folder,
      has_gizmo: conv.has_gizmo,
      has_web_search: conv.has_web_search,
      has_media: conv.has_media,
      models: conv.models,
      total_messages,
      page,
      per_page,
      messages: pageMessages
    });
  } catch (err) {
    console.error(`Error fetching conversation ${req.params.id}:`, err);
    res.status(500).json({ error: 'Failed to fetch conversation details' });
  }
});

// Search across conversations
app.get('/api/search', async (req, res) => {
  try {
    const query = (req.query.q || '').toLowerCase();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const per_page = Math.max(1, parseInt(req.query.limit) || 10);
    
    if (!query) {
      return res.json({ items: [], total: 0, page, per_page });
    }
    
    // First pass: find conversations by title
    const titleMatches = archiveIndex.filter(conv => 
      conv.title.toLowerCase().includes(query)
    );
    
    // Second pass: search within conversation content (more intensive)
    const contentMatches = [];
    const alreadyMatchedIds = new Set(titleMatches.map(c => c.id));
    
    // Limit to first 100 conversations for performance
    const conversationsToSearch = archiveIndex
      .filter(c => !alreadyMatchedIds.has(c.id))
      .slice(0, 100);
    
    for (const conv of conversationsToSearch) {
      // Load full conversation JSON to search content
      const jsonPath = path.join(ARCHIVE_ROOT, conv.folder, 'conversation.json');
      const conversation = await fs.readJson(jsonPath);
      
      // Check if any message content contains the query
      const hasMatch = Object.values(conversation.mapping || {}).some(messageObj => {
        if (!messageObj.message || !messageObj.message.content) return false;
        
        // If it's a reference, check if we need to load the referenced message
        if (messageObj.message._reference) {
          // We'll skip these for now in the search to improve performance
          return false;
        }
        
        // Search in text content parts
        if (messageObj.message.content.parts) {
          return messageObj.message.content.parts.some(part => {
            if (typeof part === 'string') {
              return part.toLowerCase().includes(query);
            }
            return false;
          });
        }
        return false;
      });
      
      if (hasMatch) {
        contentMatches.push(conv);
      }
      
      // Limit search for performance
      if (contentMatches.length >= 50) break;
    }
    
    // Combine results, ensuring no duplicates
    const allMatches = [...titleMatches];
    for (const match of contentMatches) {
      if (!alreadyMatchedIds.has(match.id)) {
        allMatches.push(match);
      }
    }
    
    const total = allMatches.length;
    const start = (page - 1) * per_page;
    const pageItems = allMatches.slice(start, start + per_page);
    
    res.json({ items: pageItems, total, page, per_page });
  } catch (err) {
    console.error('Error searching conversations:', err);
    res.status(500).json({ error: 'Failed to search conversations' });
  }
});

// API endpoint for the media gallery
app.get('/api/media-gallery', async (req, res) => {
  try {
    // Get conversations with media
    const conversationsWithMedia = archiveIndex.filter(conv => conv.has_media);
    
    // Get media files from these conversations
    const mediaFiles = [];
    
    // Limit to max 500 files to prevent performance issues
    const maxFilesToProcess = 500;
    let processedCount = 0;
    
    for (const conv of conversationsWithMedia) {
      // Skip if we've reached the limit
      if (processedCount >= maxFilesToProcess) break;
      
      const mediaFolder = path.join(ARCHIVE_ROOT, conv.folder, 'media');
      if (!await fs.pathExists(mediaFolder)) continue;
      
      const files = await fs.readdir(mediaFolder);
      
      for (const file of files) {
        // Skip if we've reached the limit
        if (processedCount >= maxFilesToProcess) break;
        processedCount++;
        
        try {
          // Get file info
          const filePath = path.join(mediaFolder, file);
          const stats = await fs.stat(filePath);
          const fileExtension = path.extname(file).toLowerCase();
          
          // Extract the file ID by removing the extension
          let fileId = path.basename(file, fileExtension);
          let fileType = 'unknown';
          
          // Determine file type based on extension
          if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(fileExtension)) {
            fileType = 'image';
          } else if (['.mp3', '.wav', '.ogg'].includes(fileExtension)) {
            fileType = 'audio';
          } else if (['.mp4', '.webm'].includes(fileExtension)) {
            fileType = 'video';
          }
          
          mediaFiles.push({
            id: fileId,
            originalFilename: file,
            conversationId: conv.id,
            conversationTitle: conv.title || 'Untitled',
            folder: conv.folder,
            path: `/api/media/${conv.folder}/${file}`,
            size: stats.size,
            type: fileType
          });
        } catch (fileErr) {
          console.error(`Error processing file ${file}:`, fileErr);
          // Continue with next file
        }
      }
    }
    
    res.json({ 
      mediaFiles,
      total: mediaFiles.length,
      limited: processedCount >= maxFilesToProcess,
      maxFiles: maxFilesToProcess
    });
  } catch (err) {
    console.error('Error fetching media gallery:', err);
    res.status(500).json({ error: 'Failed to fetch media gallery' });
  }
});

// Add a route to search for media files by ID
app.get('/api/media-search/:id', async (req, res) => {
  try {
    const searchId = req.params.id;
    if (!searchId) {
      return res.status(400).json({ error: 'No search ID provided' });
    }
    
    // Get conversations with media
    const conversationsWithMedia = archiveIndex.filter(conv => conv.has_media);
    const matchingFiles = [];
    
    for (const conv of conversationsWithMedia) {
      const mediaFolder = path.join(ARCHIVE_ROOT, conv.folder, 'media');
      if (!await fs.pathExists(mediaFolder)) continue;
      
      const files = await fs.readdir(mediaFolder);
      
      // Look for files that match the search ID
      const matches = files.filter(file => {
        const fileExtension = path.extname(file).toLowerCase();
        const fileId = path.basename(file, fileExtension);
        return fileId === searchId || file.includes(searchId);
      });
      
      if (matches.length > 0) {
        for (const match of matches) {
          const filePath = path.join(mediaFolder, match);
          const stats = await fs.stat(filePath);
          const fileExtension = path.extname(match).toLowerCase();
          
          // Extract the file ID
          const fileId = path.basename(match, fileExtension);
          let fileType = 'unknown';
          
          // Determine file type based on extension
          if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(fileExtension)) {
            fileType = 'image';
          } else if (['.mp3', '.wav', '.ogg'].includes(fileExtension)) {
            fileType = 'audio';
          } else if (['.mp4', '.webm'].includes(fileExtension)) {
            fileType = 'video';
          }
          
          matchingFiles.push({
            id: fileId,
            originalFilename: match,
            conversationId: conv.id,
            conversationTitle: conv.title || 'Untitled',
            folder: conv.folder,
            path: `/api/media/${conv.folder}/${match}`,
            size: stats.size,
            type: fileType
          });
        }
      }
    }
    
    res.json({ 
      matches: matchingFiles,
      total: matchingFiles.length
    });
  } catch (err) {
    console.error(`Error searching for media ID ${req.params.id}:`, err);
    res.status(500).json({ error: 'Failed to search for media' });
  }
});

// Add a route to get archive info
app.get('/api/archive-info', (req, res) => {
  try {
    // Count total messages across all conversations
    const totalMessages = archiveIndex.reduce((total, conv) => total + (conv.message_count || 0), 0);
    
    // Count conversations with special features
    const gizmoCount = archiveIndex.filter(c => c.has_gizmo).length;
    const webSearchCount = archiveIndex.filter(c => c.has_web_search).length;
    const mediaCount = archiveIndex.filter(c => c.has_media).length;
    
    res.json({
      path: ARCHIVE_ROOT,
      conversationCount: archiveIndex.length,
      messageCount: totalMessages,
      gizmoCount: gizmoCount,
      webSearchCount: webSearchCount,
      mediaCount: mediaCount,
      lastIndexed: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error getting archive info:', err);
    res.status(500).json({ error: 'Failed to get archive info' });
  }
});

// Add a dedicated route for finding media by specific file ID
app.get('/api/media-file/:id', async (req, res) => {
  try {
    const fileId = req.params.id;
    if (!fileId) {
      return res.status(400).json({ error: 'No file ID provided' });
    }
    
    console.log(`Searching for media file with ID: ${fileId}`);
    
    // Get conversations with media
    const conversationsWithMedia = archiveIndex.filter(conv => conv.has_media);
    const matchingFiles = [];
    
    for (const conv of conversationsWithMedia) {
      const mediaFolder = path.join(ARCHIVE_ROOT, conv.folder, 'media');
      if (!await fs.pathExists(mediaFolder)) continue;
      
      const files = await fs.readdir(mediaFolder);
      
      // Look for exact file ID match or files that contain the ID
      const matches = files.filter(file => {
        const fileExtension = path.extname(file).toLowerCase();
        const fileBase = path.basename(file, fileExtension);
        
        // For exact match
        if (fileBase === fileId) return true;
        
        // For partial match (file ID is contained in the filename)
        if (fileBase.includes(fileId)) return true;
        
        return false;
      });
      
      if (matches.length > 0) {
        for (const match of matches) {
          const filePath = path.join(mediaFolder, match);
          const stats = await fs.stat(filePath);
          const fileExtension = path.extname(match).toLowerCase();
          
          // Determine file type based on extension
          let fileType = 'unknown';
          if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(fileExtension)) {
            fileType = 'image';
          } else if (['.mp3', '.wav', '.ogg'].includes(fileExtension)) {
            fileType = 'audio';
          } else if (['.mp4', '.webm'].includes(fileExtension)) {
            fileType = 'video';
          }
          
          matchingFiles.push({
            id: path.basename(match, fileExtension),
            originalFilename: match,
            conversationId: conv.id,
            conversationTitle: conv.title || 'Untitled',
            folder: conv.folder,
            path: `/api/media/${conv.folder}/${match}`,
            size: stats.size,
            type: fileType
          });
        }
      }
    }
    
    if (matchingFiles.length === 0) {
      return res.status(404).json({ 
        message: `No media files found matching ID: ${fileId}`, 
        matches: []
      });
    }
    
    res.json({ 
      matches: matchingFiles,
      total: matchingFiles.length
    });
  } catch (err) {
    console.error(`Error searching for media file ${req.params.id}:`, err);
    res.status(500).json({ error: 'Failed to search for media file' });
  }
});

// Route to refresh the index
app.post('/api/refresh-index', async (req, res) => {
  try {
    await refreshIndex();
    res.json({ 
      success: true, 
      conversationCount: archiveIndex.length 
    });
  } catch (err) {
    console.error('Error refreshing index:', err);
    res.status(500).json({ error: 'Failed to refresh index' });
  }
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../client/dist')));

// The "catchall" handler for any request not handled by routes above
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Archive browser backend running on port ${PORT} - Using archive at ${ARCHIVE_ROOT}`);
});