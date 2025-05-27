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
 * @param {boolean} recursive - Whether to scan subdirectories recursively
 * @returns {Array} Array of conversation metadata
 */
async function indexArchive(archiveRoot, recursive = true) {
  const conversations = [];
  try {
    if (!await fs.pathExists(archiveRoot)) {
      console.error(`Archive root directory not found: ${archiveRoot}`);
      return [];
    }
    
    // Read all items in the archive root
    const allItems = await fs.readdir(archiveRoot);
    
    // Function to scan a directory for conversation folders
    const scanDirectory = async (dirPath, relativePath = '') => {
      const foundConversations = [];
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stat = await fs.stat(itemPath);
        
        if (stat.isDirectory()) {
          const jsonPath = path.join(itemPath, 'conversation.json');
          
          // Check if this directory contains a conversation.json
          if (await fs.pathExists(jsonPath)) {
            // This is a conversation folder
            const relativeConvPath = relativePath ? path.join(relativePath, item) : item;
            foundConversations.push(relativeConvPath);
          } else if (recursive) {
            // This is a subdirectory, scan it recursively
            const subRelativePath = relativePath ? path.join(relativePath, item) : item;
            const subConversations = await scanDirectory(itemPath, subRelativePath);
            foundConversations.push(...subConversations);
          }
        }
      }
      
      return foundConversations;
    };
    
    // Get all conversation directories (supporting nested structure)
    const convDirs = await scanDirectory(archiveRoot);
    
    console.log(`Found ${convDirs.length} conversation directories (recursive: ${recursive})`);
    if (convDirs.length > 0 && convDirs.some(dir => dir.includes(path.sep))) {
      console.log('Detected nested archive structure with subdirectories');
    }
    
    let claudeCount = 0;
    let chatgptCount = 0;
    
    for (const convDir of convDirs) {
      const convPath = path.join(archiveRoot, convDir);
      const jsonPath = path.join(convPath, 'conversation.json');
      
      // Load the full conversation JSON
      const conversation = await fs.readJson(jsonPath);
      
      // Determine conversation format (ChatGPT vs Claude)
      const isChatGPT = !!conversation.mapping;
      const isClaude = !!conversation.messages && Array.isArray(conversation.messages);
      
      // Extract gizmo information (ChatGPT only)
      const gizmoInfo = isChatGPT ? await extractGizmoInfo(conversation) : { has_gizmo: false };
      
      // Extract essential metadata with format-specific handling
      const metadata = {
        // ID handling - try multiple field names
        id: conversation.id || conversation.conversation_id || convDir.split('_')[0] || convDir,
        // Title handling - try multiple field names  
        title: conversation.title || conversation.name || 'Untitled',
        // Time handling - try multiple field names and formats
        create_time: conversation.create_time || 
                    (conversation.created_at ? new Date(conversation.created_at).getTime() / 1000 : null),
        update_time: conversation.update_time || 
                    (conversation.updated_at ? new Date(conversation.updated_at).getTime() / 1000 : null),
        folder: convDir,
        // Message count - format-specific
        message_count: isChatGPT ? Object.keys(conversation.mapping).length :
                      isClaude ? conversation.messages.length : 0,
        // ChatGPT-specific features
        has_gizmo: gizmoInfo.has_gizmo,
        gizmo_ids: gizmoInfo.gizmo_ids || [],
        gizmo_names: gizmoInfo.gizmo_names || {},
        // Canvas content (ChatGPT only for now)
        has_canvas: isChatGPT ? Object.values(conversation.mapping || {}).some(
          m => canvasProcessor.extractCanvasReferences(m.message).length > 0
        ) : false,
        // Model types - format-specific extraction
        models: isChatGPT ? [...new Set(
          Object.values(conversation.mapping || {})
            .filter(m => m.message?.metadata?.model_slug)
            .map(m => m.message.metadata.model_slug)
        )] : isClaude ? ['claude'] : [], // Claude conversations don't have model info in same format
        // Web search - ChatGPT only for now
        has_web_search: isChatGPT ? Object.values(conversation.mapping || {}).some(
          m => m.message?.author?.role === 'tool' && m.message?.author?.name === 'web'
        ) : false,
        // Media detection
        has_media: await fs.pathExists(path.join(convPath, 'media')) && 
                  (await fs.readdir(path.join(convPath, 'media'))).length > 0,
        // Add format indicator for debugging
        format: isChatGPT ? 'chatgpt' : isClaude ? 'claude' : 'unknown'
      };
      
      conversations.push(metadata);
      
      // Count conversation types
      if (metadata.format === 'claude') claudeCount++;
      if (metadata.format === 'chatgpt') chatgptCount++;
    }
    
    console.log(`Indexed ${conversations.length} conversations: ${chatgptCount} ChatGPT, ${claudeCount} Claude`);
    
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
    
    // Determine conversation format
    const isChatGPT = !!conversation.mapping;
    const isClaude = !!conversation.messages && Array.isArray(conversation.messages);
    
    console.log(`Loading messages for ${convFolder} - Format: ${isChatGPT ? 'ChatGPT' : isClaude ? 'Claude' : 'Unknown'}`);
    
    if (isClaude) {
      return await loadClaudeConversationMessages(conversation, convPath, messageIds);
    } else if (isChatGPT) {
      return await loadChatGPTConversationMessages(conversation, convPath, messageIds);
    } else {
      console.warn(`Unknown conversation format for ${convFolder}`);
      return { messages: [], canvas_ids: [] };
    }
  } catch (err) {
    console.error(`Error loading conversation messages for ${convFolder}:`, err);
    return { messages: [], canvas_ids: [] };
  }
}

/**
 * Load messages for Claude format conversations
 */
async function loadClaudeConversationMessages(conversation, convPath, messageIds = null) {
  const messages = [];
  const canvasIds = new Set();
  
  // Claude conversations have messages as an array
  const claudeMessages = conversation.messages || [];
  
  // Filter messages if specific IDs requested
  const targetMessages = messageIds ? 
    claudeMessages.filter(msg => messageIds.includes(msg.id)) : 
    claudeMessages;
  
  for (const message of targetMessages) {
    // Check if this is a message reference (Claude import with references)
    if (message._reference && message._reference.startsWith('messages/')) {
      // Load the referenced message
      const refPath = path.join(convPath, message._reference);
      if (await fs.pathExists(refPath)) {
        const refMessage = await fs.readJson(refPath);
        
        // Extract markdown content
        const markdown = extractClaudeMessageContent(refMessage);
        
        // Parse the referenced message
        const parsedMessage = parseAnyMessage(refMessage);
        
        messages.push({
          id: message.id || `claude_msg_${messages.length}`,
          message: refMessage,
          parent: null, // Claude doesn't have parent/child structure like ChatGPT
          children: [],
          markdown: markdown,
          canvas_ids: [], // Claude doesn't have canvas content
          parsed: parsedMessage,
          is_reference: true
        });
      } else {
        // Use summary if reference missing
        const syntheticMessage = {
          ...message._summary,
          content: ['[Message content not available]'],
          id: message.id
        };
        
        const parsedMessage = parseAnyMessage(syntheticMessage);
        
        messages.push({
          id: message.id || `claude_msg_${messages.length}`,
          message: syntheticMessage,
          parent: null,
          children: [],
          markdown: '[Message content not available]',
          parsed: parsedMessage,
          is_reference: true,
          is_missing_reference: true
        });
      }
    } else {
      // This is a regular Claude message
      const markdown = extractClaudeMessageContent(message);
      const parsedMessage = parseAnyMessage(message);
      
      messages.push({
        id: message.id || `claude_msg_${messages.length}`,
        message: message,
        parent: null,
        children: [],
        markdown: markdown,
        canvas_ids: [],
        parsed: parsedMessage
      });
    }
  }
  
  // Sort by timestamp (Claude uses created_at or timestamp)
  messages.sort((a, b) => {
    const timeA = new Date(a.message.created_at || a.message.timestamp || 0).getTime();
    const timeB = new Date(b.message.created_at || b.message.timestamp || 0).getTime();
    return timeA - timeB;
  });
  
  return {
    messages,
    canvas_ids: Array.from(canvasIds)
  };
}

/**
 * Load messages for ChatGPT format conversations
 */
async function loadChatGPTConversationMessages(conversation, convPath, messageIds = null) {
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
            markdown: markdown,
            canvas_ids: messageCanvasIds,
            parsed: parsedMessage,
            is_reference: true
          });
        } else {
          // If reference file doesn't exist, use the summary
          const syntheticMessage = {
            ...messageObj.message._summary,
            content: { content_type: 'text', parts: ['[Message content not available]'] },
            id: id
          };
          
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
          markdown: markdown,
          canvas_ids: messageCanvasIds,
          parsed: parsedMessage
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
  
  return {
    messages,
    canvas_ids: Array.from(canvasIds)
  };
}

/**
 * Extract content from Claude message for markdown display
 */
function extractClaudeMessageContent(message) {
  try {
    if (!message) return '';
    
    // Claude messages can have content as string or array
    if (typeof message.content === 'string') {
      return message.content;
    }
    
    if (Array.isArray(message.content)) {
      return message.content
        .map(item => {
          if (typeof item === 'string') {
            return item;
          }
          if (item.type === 'text' && item.text) {
            return item.text;
          }
          if (item.type === 'tool_use') {
            return `[Tool: ${item.name || 'unknown'}]`;
          }
          return JSON.stringify(item);
        })
        .join('\n');
    }
    
    return JSON.stringify(message.content);
  } catch (err) {
    console.error('Error extracting Claude message content:', err);
    return '[Error extracting content]';
  }
}

/**
 * Refresh the archive index
 * @param {string} archiveRoot - Root directory of the archive
 * @param {boolean} recursive - Whether to scan subdirectories recursively
 */
async function refreshIndex(archiveRoot, recursive = true) {
  archiveIndex = await indexArchive(archiveRoot, recursive);
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
