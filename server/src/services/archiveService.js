// Archive Service - Core functionality for conversation management
const fs = require('fs-extra');
const path = require('path');
const canvasProcessor = require('../models/canvas-processor');
const gizmoResolver = require('../models/gizmo-resolver');
const mediaProcessor = require('../media-processor');
const { parseAnyMessage } = require('../parsers/parseAnyMessage');

// Cached archive index
let archiveIndex = [];

/**
 * Extract gizmo IDs for the index page display
 * @param {Object} conversation - Conversation JSON object
 * @returns {Object} Gizmo information
 */
const extractGizmoInfo = async (conversation) => {
  try {
    if (!conversation || !conversation.mapping) return { has_gizmo: false };
    
    // Check for gizmo IDs
    const hasGizmo = Object.values(conversation.mapping).some(
      m => m.message?.metadata?.gizmo_id
    );
    
    if (!hasGizmo) return { has_gizmo: false };
    
    // Extract unique gizmo IDs
    const gizmoIds = Array.from(new Set(
      Object.values(conversation.mapping)
        .filter(m => m.message?.metadata?.gizmo_id)
        .map(m => m.message.metadata.gizmo_id)
    ));
    
    if (gizmoIds.length === 0) return { has_gizmo: false };
    
    // Resolve gizmo names
    const gizmoNames = {};
    for (const gizmoId of gizmoIds) {
      gizmoNames[gizmoId] = await gizmoResolver.resolveGizmoName(gizmoId);
    }
    
    return {
      has_gizmo: true,
      gizmo_ids: gizmoIds,
      gizmo_names: gizmoNames
    };
  } catch (err) {
    console.error('Error extracting gizmo info:', err);
    return { has_gizmo: false };
  }
};

/**
 * Recursively index conversations and messages from the JSON-based structure
 * @param {string} archiveRoot - Root directory of the archive
 * @returns {Array} Array of conversation metadata
 */
async function indexArchive(archiveRoot) {
  const conversations = [];
  try {
    if (!await fs.pathExists(archiveRoot)) {
      console.error(`Archive root directory not found: ${archiveRoot}`);
      return [];
    }
    
    // Read all conversation directories
    const allDirs = await fs.readdir(archiveRoot);
    
    // Only include actual conversation directories with conversation.json
    const convDirs = allDirs.filter(dir => {
      const jsonPath = path.join(archiveRoot, dir, 'conversation.json');
      return fs.existsSync(jsonPath);
    });
    
    console.log(`Found ${convDirs.length} conversation directories`);
    
    for (const convDir of convDirs) {
      const convPath = path.join(archiveRoot, convDir);
      const jsonPath = path.join(convPath, 'conversation.json');
      
      // Load the full conversation JSON
      const conversation = await fs.readJson(jsonPath);
      
      // Extract gizmo information
      const gizmoInfo = await extractGizmoInfo(conversation);
      
      // Extract essential metadata
      const metadata = {
        id: conversation.id || conversation.conversation_id,
        title: conversation.title || 'Untitled',
        create_time: conversation.create_time,
        update_time: conversation.update_time,
        folder: convDir,
        message_count: conversation.mapping ? Object.keys(conversation.mapping).length : 0,
        // Include whether this conversation has gizmo/Custom GPT content
        has_gizmo: gizmoInfo.has_gizmo,
        // Include gizmo IDs and names if available
        gizmo_ids: gizmoInfo.gizmo_ids || [],
        gizmo_names: gizmoInfo.gizmo_names || {},
        // Include whether conversation has canvas content
        has_canvas: Object.values(conversation.mapping || {}).some(
          m => canvasProcessor.extractCanvasReferences(m.message).length > 0
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

/**
 * Load message details for a conversation
 * @param {string} convFolder - Conversation folder name
 * @param {string} archiveRoot - Root directory of the archive
 * @param {Array} messageIds - Optional specific message IDs to load
 * @returns {Object} Messages and canvas IDs
 */
async function loadConversationMessages(convFolder, archiveRoot, messageIds = null) {
  try {
    const convPath = path.join(archiveRoot, convFolder);
    const jsonPath = path.join(convPath, 'conversation.json');
    
    // Load full conversation JSON
    const conversation = await fs.readJson(jsonPath);
    
    // If specific message IDs are requested, only load those
    const targetIds = messageIds || Object.keys(conversation.mapping || {});
    
    // Extract message data and organize chronologically
    const messages = [];
    // Track canvas IDs in this conversation
    const canvasIds = new Set();
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
            
            // Check for canvas references
            const messageCanvasIds = canvasProcessor.extractCanvasReferences(refMessage);
            if (messageCanvasIds.length > 0) {
              messageCanvasIds.forEach(id => canvasIds.add(id));
            }
            
            // Parse the referenced message
            const parsedMessage = parseAnyMessage(refMessage);
            
            messages.push({
              id: id,
              message: refMessage,
              parent: messageObj.parent,
              children: messageObj.children,
              markdown: markdown, // Add extracted markdown
              canvas_ids: messageCanvasIds,
              parsed: parsedMessage, // Add parsed message data
              is_reference: true // Mark this as a referenced message
            });
          } else {
            // If reference file doesn't exist, use the summary
            // Create a synthetic message for parsing
            const syntheticMessage = {
              ...messageObj.message._summary,
              content: { content_type: 'text', parts: ['[Message content not available]'] },
              id: id
            };
            
            // Parse the synthetic message
            const parsedMessage = parseAnyMessage(syntheticMessage);
            
            messages.push({
              id: id,
              message: syntheticMessage,
              parent: messageObj.parent,
              children: messageObj.children,
              markdown: '[Message content not available]',
              parsed: parsedMessage,
              is_reference: true,
              is_missing_reference: true
            });
          }
        } else {
          // This is a regular message
          // Extract markdown content
          const markdown = mediaProcessor.extractMarkdown(messageObj.message);
          
          // Check for canvas references
          const messageCanvasIds = canvasProcessor.extractCanvasReferences(messageObj.message);
          if (messageCanvasIds.length > 0) {
            messageCanvasIds.forEach(id => canvasIds.add(id));
          }
          
          // Parse the message using our specialized parsers
          const parsedMessage = parseAnyMessage(messageObj.message);
          
          messages.push({
            id: id,
            message: messageObj.message,
            parent: messageObj.parent,
            children: messageObj.children,
            markdown: markdown, // Add extracted markdown
            canvas_ids: messageCanvasIds,
            parsed: parsedMessage // Add parsed message data
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
    
    // Create a list of all unique canvas IDs in this conversation
    const conversationCanvasIds = Array.from(canvasIds);
    
    return {
      messages,
      canvas_ids: conversationCanvasIds
    };
  } catch (err) {
    console.error(`Error loading conversation messages for ${convFolder}:`, err);
    return { messages: [], canvas_ids: [] };
  }
}

/**
 * Refresh the archive index
 * @param {string} archiveRoot - Root directory of the archive
 */
async function refreshIndex(archiveRoot) {
  archiveIndex = await indexArchive(archiveRoot);
  console.log(`Indexed ${archiveIndex.length} conversations`);
  return archiveIndex;
}

/**
 * Get the current archive index
 * @returns {Array} Current archive index
 */
function getArchiveIndex() {
  return archiveIndex;
}

/**
 * Find a conversation by ID
 * @param {string} id - Conversation ID to find
 * @returns {Object|null} Conversation metadata or null if not found
 */
function findConversationById(id) {
  return archiveIndex.find(c => c.id === id) || null;
}

module.exports = {
  indexArchive,
  loadConversationMessages,
  refreshIndex,
  getArchiveIndex,
  findConversationById,
  extractGizmoInfo
};
