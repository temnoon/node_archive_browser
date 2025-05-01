// Canvas processor for handling Canvas structures in ChatGPT archives
const fs = require('fs-extra');
const path = require('path');

/**
 * Extract canvas IDs from conversation or messages
 * @param {Object} obj - Conversation or message object
 * @returns {Array} Array of unique canvas IDs
 */
function extractCanvasReferences(obj) {
  const references = new Set();
  
  // Helper function to recursively process objects
  function processObject(obj) {
    if (!obj || typeof obj !== 'object') return;
    
    // Check for canvas_id in metadata
    if (obj.metadata && obj.metadata.canvas_id) {
      references.add(obj.metadata.canvas_id);
    }
    
    // Check for canvas references in content
    if (obj.content && obj.content.content_type === 'canvas' && obj.content.canvas_id) {
      references.add(obj.content.canvas_id);
    }
    
    // For arrays, process each element
    if (Array.isArray(obj)) {
      obj.forEach(item => processObject(item));
      return;
    }
    
    // For objects, process each property
    for (const key in obj) {
      if (obj.hasOwnProperty(key) && obj[key] !== null && typeof obj[key] === 'object') {
        processObject(obj[key]);
      }
    }
  }
  
  processObject(obj);
  return Array.from(references);
}

/**
 * Find canvas data in the archive
 * @param {string} canvasId - Canvas ID to find
 * @param {string} archiveRoot - Root directory of the archive
 * @returns {Object|null} Canvas data or null if not found
 */
async function findCanvasData(canvasId, archiveRoot) {
  if (!canvasId) return null;
  
  try {
    // Check common locations for canvas data
    const possiblePaths = [
      // Direct canvas file
      path.join(archiveRoot, 'canvases', `${canvasId}.json`),
      // In conversation-level canvas directory
      path.join(archiveRoot, 'canvas_data', `${canvasId}.json`),
      // Search in all conversations
      ...await findCanvasInConversations(canvasId, archiveRoot)
    ];
    
    // Try each possible path
    for (const canvasPath of possiblePaths) {
      if (await fs.pathExists(canvasPath)) {
        const canvasData = await fs.readJson(canvasPath);
        return processCanvasData(canvasData);
      }
    }
    
    // Canvas not found
    console.warn(`Canvas not found: ${canvasId}`);
    return null;
  } catch (err) {
    console.error(`Error finding canvas data for ${canvasId}:`, err);
    return null;
  }
}

/**
 * Process canvas data to make it suitable for rendering
 * @param {Object} canvasData - Raw canvas data
 * @returns {Object} Processed canvas data
 */
function processCanvasData(canvasData) {
  // Keep a deep copy of the original data
  const processed = JSON.parse(JSON.stringify(canvasData));
  
  // Process nodes to extract text content and structure
  if (processed.nodes && Array.isArray(processed.nodes)) {
    processed.nodes = processed.nodes.map(node => {
      // Process based on node type
      if (node.type === 'text') {
        // Extract plain text content for searching
        if (node.content && node.content.text) {
          node.plainText = extractPlainText(node.content.text);
        }
      }
      
      return node;
    });
  }
  
  return processed;
}

/**
 * Extract plain text from canvas text nodes
 * @param {Object} textData - Canvas text node data
 * @returns {string} Plain text content
 */
function extractPlainText(textData) {
  if (!textData || !textData.length) return '';
  
  // Extract text from each text segment
  return textData.reduce((text, segment) => {
    if (typeof segment === 'string') {
      return text + segment;
    } else if (segment && segment.text) {
      return text + segment.text;
    }
    return text;
  }, '');
}

/**
 * Find canvas data within conversations
 * @param {string} canvasId - Canvas ID to find
 * @param {string} archiveRoot - Root directory of the archive
 * @returns {Array} List of possible canvas file paths
 */
async function findCanvasInConversations(canvasId, archiveRoot) {
  const possiblePaths = [];
  
  try {
    // Get all conversation directories
    const allDirs = await fs.readdir(archiveRoot);
    
    // Filter for conversation directories
    const convDirs = allDirs.filter(dir => {
      const jsonPath = path.join(archiveRoot, dir, 'conversation.json');
      return fs.existsSync(jsonPath);
    });
    
    // Look for canvas data within each conversation
    for (const convDir of convDirs) {
      const canvasPath = path.join(archiveRoot, convDir, 'canvas', `${canvasId}.json`);
      if (await fs.pathExists(canvasPath)) {
        possiblePaths.push(canvasPath);
      }
    }
  } catch (err) {
    console.error('Error finding canvas in conversations:', err);
  }
  
  return possiblePaths;
}

module.exports = {
  extractCanvasReferences,
  findCanvasData,
  processCanvasData
};
