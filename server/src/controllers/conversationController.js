/**
 * Load conversation messages with retry functionality
 * @param {string} folder - Conversation folder
 * @param {string} archiveRoot - Archive root path
 * @param {number} retries - Number of retries (default: 2)
 * @returns {Promise<Object>} Conversation messages
 */
async function loadConversationWithRetry(folder, archiveRoot, retries = 2) {
  let lastError = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await archiveService.loadConversationMessages(folder, archiveRoot);
    } catch (err) {
      lastError = err;
      console.error(`Error loading conversation (attempt ${attempt}):`, err);
      
      // If this isn't the last attempt, wait before retrying
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
  
  // If we get here, all retries failed
  throw lastError;
}// Conversation Controller - Handles conversation-related API endpoints
const path = require('path');
const fs = require('fs-extra');
const archiveService = require('../services/archiveService');
const gizmoResolver = require('../models/gizmo-resolver');

/**
 * Load conversation messages with retry functionality
 * @param {string} folder - Conversation folder
 * @param {string} archiveRoot - Archive root path
 * @param {number} retries - Number of retries (default: 2)
 * @returns {Promise<Object>} Conversation messages
 */
async function loadConversationWithRetry(folder, archiveRoot, retries = 2) {
  let lastError = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await archiveService.loadConversationMessages(folder, archiveRoot);
    } catch (err) {
      lastError = err;
      console.error(`Error loading conversation (attempt ${attempt}):`, err);
      
      // If this isn't the last attempt, wait before retrying
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
  
  // If we get here, all retries failed
  throw lastError;
}

// Get archive root from environment or config - will be injected in main server file
let ARCHIVE_ROOT = '';

/**
 * Set the archive root directory
 * @param {string} rootPath - Path to the archive root
 */
function setArchiveRoot(rootPath) {
  ARCHIVE_ROOT = rootPath;
}

/**
 * Get paginated conversations list with optional filters
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getConversations(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const per_page = Math.max(1, parseInt(req.query.limit) || 10);
    
    // Get current archive index
    const archiveIndex = archiveService.getArchiveIndex();
    
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
}

/**
 * Get conversation metadata for filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function getConversationsMeta(req, res) {
  try {
    // Get current archive index
    const archiveIndex = archiveService.getArchiveIndex();
    
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
}

// Simple in-memory cache for conversation data
const messageCache = {
  cache: new Map(),
  maxSize: 100, // Increased from 50 to 100 maximum cached conversations
  maxAge: 10 * 60 * 1000, // Increased from 5 to 10 minutes in milliseconds
  
  getCacheKey(id, page, perPage) {
    return `${id}_${page}_${perPage}`;
  },
  
  get(id, page, perPage) {
    const key = this.getCacheKey(id, page, perPage);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    // Check if cache entry has expired
    if (Date.now() - cached.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  },
  
  set(id, page, perPage, data) {
    const key = this.getCacheKey(id, page, perPage);
    
    // If cache is at max size, remove oldest entry
    if (this.cache.size >= this.maxSize) {
      let oldestKey = null;
      let oldestTime = Infinity;
      
      for (const [k, v] of this.cache.entries()) {
        if (v.timestamp < oldestTime) {
          oldestTime = v.timestamp;
          oldestKey = k;
        }
      }
      
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  },
  
  invalidate(id) {
    // Remove all cache entries for this conversation ID
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${id}_`)) {
        this.cache.delete(key);
      }
    }
  }
};

/**
 * Get detailed conversation with messages
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getConversationById(req, res) {
  try {
    const conv = archiveService.findConversationById(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const per_page = Math.max(1, parseInt(req.query.limit) || 20);
    
    // Check cache first
    const cachedData = messageCache.get(req.params.id, page, per_page);
    if (cachedData) {
      // Add cache header for client-side caching
      res.set('Cache-Control', 'private, max-age=600'); // 10 minutes
      res.set('X-Cache', 'HIT');
      return res.json(cachedData);
    }
    
    // Load message details for this conversation
    let result;
    try {
      // Use the retry function instead of direct call
      result = await loadConversationWithRetry(conv.folder, ARCHIVE_ROOT, 3);
    } catch (err) {
      console.error(`Failed to load conversation ${req.params.id} after retries:`, err);
      return res.status(500).json({ 
        error: 'Failed to load conversation. Please try again.',
        id: req.params.id
      });
    }
    const messages = result.messages;
    const total_messages = messages.length;
    
    // Apply pagination
    const start = (page - 1) * per_page;
    const pageMessages = messages.slice(start, start + per_page);
    
    // Extract gizmo IDs and resolve names
    if (conv.has_gizmo) {
      // Find gizmo IDs in the conversation
      const gizmoIds = [];
      const gizmoNames = {};
      
      for (const message of messages) {
        const gizmoId = message.message?.metadata?.gizmo_id;
        if (gizmoId && !gizmoIds.includes(gizmoId)) {
          gizmoIds.push(gizmoId);
          // Resolve gizmo name
          const name = await gizmoResolver.resolveGizmoName(gizmoId);
          gizmoNames[gizmoId] = name;
        }
      }
      
      if (gizmoIds.length > 0) {
        pageMessages.forEach(msg => {
          const gizmoId = msg.message?.metadata?.gizmo_id;
          if (gizmoId && gizmoNames[gizmoId]) {
            // Add resolved name to each message for client-side use
            msg.gizmo_name = gizmoNames[gizmoId];
          }
        });
      }
    }
    
    // Check for unknown message types or fields for the UI to highlight (more efficiently)
    const unknownTypes = {};
    let unknownCount = 0;
    
    // Only check a sample of messages to avoid performance issues
    const messagesToCheck = messages.slice(0, 20); // Check only first 20 messages 
    
    messagesToCheck.forEach(msg => {
      if (msg.parsed && msg.parsed.data && msg.parsed.data.has_unknown_fields) {
        const type = msg.parsed.type || 'unknown';
        unknownTypes[type] = (unknownTypes[type] || 0) + 1;
        unknownCount++;
      }
    });
    
    // If we found unknown fields in the sample, assume there might be more
    if (unknownCount > 0 && messages.length > messagesToCheck.length) {
      unknownTypes._estimated = true;
    }
    
    // Create the response object
    const responseData = {
      id: conv.id,
      title: conv.title,
      create_time: conv.create_time,
      folder: conv.folder,
      has_gizmo: conv.has_gizmo,
      has_web_search: conv.has_web_search,
      has_media: conv.has_media,
      has_canvas: result.canvas_ids && result.canvas_ids.length > 0,
      canvas_ids: result.canvas_ids || [],
      models: conv.models,
      total_messages,
      page,
      per_page,
      messages: pageMessages,
      unknown_types: Object.keys(unknownTypes).length > 0 ? unknownTypes : null
    };
    
    // Store in cache for future requests
    messageCache.set(req.params.id, page, per_page, responseData);
    
    // Add cache header for client-side caching
    res.set('Cache-Control', 'private, max-age=600'); // 10 minutes
    res.set('X-Cache', 'MISS');
    
    // Return conversation data with paginated messages
    res.json(responseData);
  } catch (err) {
    console.error(`Error fetching conversation ${req.params.id}:`, err);
    res.status(500).json({ error: 'Failed to fetch conversation details' });
  }
}

/**
 * Search across conversations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function searchConversations(req, res) {
  try {
    const query = (req.query.q || '').toLowerCase();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const per_page = Math.max(1, parseInt(req.query.limit) || 10);
    
    if (!query) {
      return res.json({ items: [], total: 0, page, per_page });
    }
    
    // Get current archive index
    const archiveIndex = archiveService.getArchiveIndex();
    
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
}

/**
 * Get information about the archive
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function getArchiveInfo(req, res) {
  try {
    // Get current archive index
    const archiveIndex = archiveService.getArchiveIndex();
    
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
}

/**
 * Refresh the archive index
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function refreshArchiveIndex(req, res) {
  try {
    await archiveService.refreshIndex(ARCHIVE_ROOT);
    const archiveIndex = archiveService.getArchiveIndex();
    
    res.json({ 
      success: true, 
      conversationCount: archiveIndex.length 
    });
  } catch (err) {
    console.error('Error refreshing index:', err);
    res.status(500).json({ error: 'Failed to refresh index' });
  }
}

module.exports = {
  setArchiveRoot,
  getConversations,
  getConversationsMeta,
  getConversationById,
  searchConversations,
  getArchiveInfo,
  refreshArchiveIndex
};
