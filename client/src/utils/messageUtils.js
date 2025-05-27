/**
 * Message utility functions for the Archive Browser
 * Handles message content extraction and parsing
 */

import { determineMediaType } from './mediaUtils';
import { processLatexInText } from '../latexUtils';

/**
 * Detect if a message is Claude format vs ChatGPT format
 * @param {Object} message - The message object to check
 * @returns {string} - 'claude' or 'chatgpt'
 */
function detectMessageFormat(message) {
  if (!message || !message.content) return 'unknown';
  
  // Claude format: content is string or array, no content_type
  if (typeof message.content === 'string' || 
      (Array.isArray(message.content) && !message.content.content_type)) {
    return 'claude';
  }
  
  // ChatGPT format: content has content_type and parts
  if (message.content.content_type && message.content.parts) {
    return 'chatgpt';
  }
  
  return 'unknown';
}

/**
 * Extract text content from Claude format message
 * @param {Object} message - The Claude message object
 * @returns {Object} - Object containing text, mediaRefs, segments, and canvasIds
 */
function extractClaudeMessageContent(message) {
  let textContent = '';
  const mediaRefs = [];
  const canvasIds = [];
  
  if (typeof message.content === 'string') {
    textContent = message.content;
  } else if (Array.isArray(message.content)) {
    textContent = message.content
      .map(item => {
        if (typeof item === 'string') {
          return item;
        }
        if (item && typeof item === 'object') {
          if (item.type === 'text' && item.text) {
            return item.text;
          }
          if (item.type === 'tool_use') {
            return `[Tool: ${item.name || 'unknown'}]`;
          }
          if (item.type === 'tool_result') {
            return `[Tool Result: ${typeof item.content === 'string' ? item.content : JSON.stringify(item.content)}]`;
          }
          // Handle image attachments if any
          if (item.type === 'image') {
            // Claude image format might be different - add handling if needed
            return '[Image]';
          }
        }
        return JSON.stringify(item);
      })
      .join('\n\n');
  } else {
    textContent = JSON.stringify(message.content);
  }
  
  // Process LaTeX in the text content
  const processedContent = processLatexInText(textContent);
  
  return {
    text: processedContent.text,
    mediaRefs,
    segments: processedContent.segments,
    canvasIds
  };
}

/**
 * Extract text content from ChatGPT format message  
 * @param {Object} message - The ChatGPT message object
 * @returns {Object} - Object containing text, mediaRefs, segments, and canvasIds
 */
function extractChatGPTMessageContent(message) {
  const content = message.content;
  const mediaRefs = [];
  let textContent = '';
  let segments = [];
  
  // Check for canvas IDs in metadata
  const canvasIds = [];
  if (message.metadata && message.metadata.canvas_id) {
    canvasIds.push(message.metadata.canvas_id);
  }
  
  // Check for canvas content
  if (content.content_type === 'canvas' && content.canvas_id) {
    canvasIds.push(content.canvas_id);
  }

  if (content.content_type === 'text') {
    // Simple text content
    const joinedText = Array.isArray(content.parts) ? content.parts.join('\n\n') : '';
    // Process LaTeX in the text content
    const processedContent = processLatexInText(joinedText);
    textContent = processedContent.text;
    segments = processedContent.segments;
  } 
  else if (content.content_type === 'multimodal_text') {
    // Mixed text and media
    let combinedText = '';
    if (Array.isArray(content.parts)) {
      content.parts.forEach(part => {
        if (typeof part === 'string') {
          combinedText += part + '\n\n';
        } else if (part && typeof part === 'object') {
          // Check for audio transcription
          if (part.content_type === 'audio_transcription' && part.text) {
            // Remove excessive logging
            // console.log('Found audio transcription:', part.text);
            combinedText += part.text + '\n\n';
          }
          
          // Handle audio assets
          if ((part.content_type === 'audio_asset_pointer' || 
               (part.audio_asset_pointer && part.audio_asset_pointer.asset_pointer))) {
            
            const assetPointer = part.asset_pointer || 
                                (part.audio_asset_pointer && part.audio_asset_pointer.asset_pointer);
            
            if (assetPointer) {
              const fileMatch = assetPointer.match(/([^/\\]+)$/); // Get last part of path/URL
              
              if (fileMatch) {
                const fileId = fileMatch[1];
                // Optimize regex operations by caching results
                const coreFileIdMatch = fileId.match(/file[-_][A-Za-z0-9]+/);
                const coreFileId = coreFileIdMatch ? coreFileIdMatch[0] : fileId;
                
                // Optimize duplicate checking
                const isDuplicate = mediaRefs.some(ref => {
                  // Cache regex operation result
                  if (!ref._coreId) {
                    const refCoreIdMatch = ref.filename.match(/file[-_][A-Za-z0-9]+/);
                    ref._coreId = refCoreIdMatch ? refCoreIdMatch[0] : ref.filename;
                  }
                  return ref._coreId === coreFileId;
                });
                
                if (!isDuplicate) {
                  mediaRefs.push({
                    type: 'audio',
                    filename: fileId,
                    fileId: coreFileId,
                    _coreId: coreFileId, // Cache for future comparisons
                    duration: part.metadata?.end || 
                             (part.audio_asset_pointer && part.audio_asset_pointer.metadata?.end) || 0
                  });
                }
              }
            }
          }
          
          // Check for image asset pointers
          if (part.content_type === 'image_asset_pointer' && part.asset_pointer) {
            // Extract file ID from asset pointer
            const fileMatch = part.asset_pointer.match(/([^/\\]+)$/); // Get last part of path/URL
            if (fileMatch) {
              const fileId = fileMatch[1];
              // Optimize regex operations by caching results
              const coreFileIdMatch = fileId.match(/file[-_][A-Za-z0-9]+/);
              const coreFileId = coreFileIdMatch ? coreFileIdMatch[0] : fileId;
              
              // Optimize duplicate checking
              const isDuplicate = mediaRefs.some(ref => {
                // Cache regex operation result
                if (!ref._coreId) {
                  const refCoreIdMatch = ref.filename.match(/file[-_][A-Za-z0-9]+/);
                  ref._coreId = refCoreIdMatch ? refCoreIdMatch[0] : ref.filename;
                }
                return ref._coreId === coreFileId;
              });
              
              if (!isDuplicate) {
                const type = determineMediaType(fileId);
                mediaRefs.push({
                  type,
                  filename: fileId,
                  fileId: coreFileId,
                  _coreId: coreFileId, // Cache for future comparisons
                  width: part.width,
                  height: part.height
                });
              }
            }
          }
        }
      });
    }
    // Process LaTeX in the combined text
    const processedContent = processLatexInText(combinedText);
    textContent = processedContent.text;
    segments = processedContent.segments;
  }
  else if (content.content_type === 'code') {
    // Code block
    const language = content.language || '';
    const codeText = content.text || '';
    textContent = '```' + language + '\n' + codeText + '\n```';
  }

  // Check for attachments in metadata
  if (message.metadata && message.metadata.attachments && Array.isArray(message.metadata.attachments)) {
    message.metadata.attachments.forEach(attachment => {
      if (!attachment.id) return; // Skip attachments without ID
      
      // Optimize regex operations by caching results
      const coreAttachmentIdMatch = attachment.id.match(/file[-_][A-Za-z0-9]+/);
      const coreAttachmentId = coreAttachmentIdMatch ? coreAttachmentIdMatch[0] : attachment.id;
      
      // Optimize duplicate checking
      const isDuplicate = mediaRefs.some(ref => {
        // Cache regex operation result
        if (!ref._coreId) {
          const refCoreIdMatch = ref.filename.match(/file[-_][A-Za-z0-9]+/);
          ref._coreId = refCoreIdMatch ? refCoreIdMatch[0] : ref.filename;
        }
        return ref.filename === attachment.id || (ref._coreId === coreAttachmentId);
      });
      
      if (!isDuplicate) {
        // Determine media type based on mime_type or filename
        let type = 'unknown';
        
        if (attachment.mime_type) {
          // Determine from MIME type
          if (attachment.mime_type.startsWith('image/')) {
            type = 'image';
          } else if (attachment.mime_type.startsWith('audio/')) {
            type = 'audio';
          } else if (attachment.mime_type.startsWith('video/')) {
            type = 'video';
          }
        } else if (attachment.name) {
          // Try to determine from filename
          type = determineMediaType(attachment.name);
        }
        
        mediaRefs.push({
          type,
          filename: attachment.id,
          originalName: attachment.name,
          _coreId: coreAttachmentId, // Cache for future comparisons
          width: attachment.width,
          height: attachment.height
        });
      }
    });
  }

  // Clean up cached properties before returning
  mediaRefs.forEach(ref => {
    delete ref._coreId;
  });

  return { 
    text: textContent.trim(),
    mediaRefs,
    segments,
    canvasIds
  };
}

/**
 * Extract text content and media references from a message (unified function)
 * @param {Object} message - The message object to process
 * @returns {Object} - Object containing text, mediaRefs, segments, and canvasIds
 */
export function extractMessageContent(message) {
  if (!message || !message.content) {
    return { text: '', mediaRefs: [], segments: [], canvasIds: [] };
  }
  
  const format = detectMessageFormat(message);
  
  switch (format) {
    case 'claude':
      return extractClaudeMessageContent(message);
    case 'chatgpt':
      return extractChatGPTMessageContent(message);
    default:
      console.warn('Unknown message format, attempting ChatGPT extraction:', message);
      return extractChatGPTMessageContent(message);
  }
}

/**
 * Checks if a string is likely a JSON tool output
 * @param {string} content - The content to check
 * @returns {boolean} - True if the content looks like a JSON tool output
 */
export function isLikelyToolJson(content) {
  if (typeof content !== 'string') return false;
  const trimmed = content.trim();
  return trimmed.startsWith('{') && (trimmed.length > 120 || trimmed.includes('\"') || trimmed.includes('\n'));
}

/**
 * Creates a map of media from hidden (tool/system) messages to their preceding assistant messages
 * @param {Array} messages - The complete list of messages
 * @returns {Object} - Map of assistant message IDs to arrays of media refs from hidden messages
 */
export function createHiddenMediaMap(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return {};
  }
  
  // Create a map of media references from hidden messages
  const mediaByAssistantMsg = {};
  
  // Find all tool messages with media and map them to the preceding assistant message
  let lastAssistantId = null;
  
  messages.forEach(msg => {
    const role = getMessageRole(msg);
    if (role === 'assistant') {
      lastAssistantId = msg.id;
    } else if ((role === 'tool' || role === 'system') && lastAssistantId) {
      // Extract any media from tool messages
      const content = extractMessageContent(msg.message);
      if (content.mediaRefs && content.mediaRefs.length > 0) {
        if (!mediaByAssistantMsg[lastAssistantId]) {
          mediaByAssistantMsg[lastAssistantId] = [];
        }
        mediaByAssistantMsg[lastAssistantId].push(...content.mediaRefs);
      }
    }
  });
  
  return mediaByAssistantMsg;
}

/**
 * Get the role of a message, handling both ChatGPT and Claude formats
 * @param {Object} msg - The message object
 * @returns {string} - The role (user, assistant, tool, system, etc.)
 */
function getMessageRole(msg) {
  if (!msg || !msg.message) return 'unknown';
  
  const message = msg.message;
  
  // ChatGPT format: message.author.role
  if (message.author && message.author.role) {
    return message.author.role;
  }
  
  // Claude format: message.role (direct field)
  if (message.role) {
    return message.role;
  }
  
  // Fallback: try to detect from content structure
  if (message.content && typeof message.content === 'string') {
    // Claude messages with string content are usually assistant responses
    return 'assistant';
  }
  
  return 'unknown';
}

/**
 * Filters out empty system messages and optionally tool/system messages
 * @param {Array} messages - The messages to filter
 * @param {boolean} hideToolMessages - Whether to hide tool/system messages
 * @param {Object} mediaByAssistantMsg - Map of assistant message IDs to media refs from hidden messages
 * @returns {Array} - The filtered messages with any necessary media transferred
 */
export function filterMessages(messages, hideToolMessages, mediaByAssistantMsg = {}) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }
  
  // Find the first user message using format-agnostic role detection
  let firstUserIdx = messages.findIndex(msg => getMessageRole(msg) === 'user');
  
  let filteredMessages = [];
  
  if (firstUserIdx !== -1) {
    filteredMessages = messages.slice(firstUserIdx);
    
    // Always filter out empty system messages
    if (filteredMessages.length > 0) {
      filteredMessages = [filteredMessages[0]].concat(
        filteredMessages.slice(1).filter(msg => {
          const role = getMessageRole(msg);
          
          // Skip empty system messages
          if (role === 'system') {
            // Check if content is empty (handle both formats)
            const message = msg.message;
            if (!message.content) return false;
            
            // ChatGPT format: check parts array
            if (message.content.parts && message.content.parts.length === 0) {
              return false;
            }
            
            // Claude format: check if content is empty string or empty array
            if (typeof message.content === 'string' && message.content.trim() === '') {
              return false;
            }
            if (Array.isArray(message.content) && message.content.length === 0) {
              return false;
            }
          }
          
          // Hide tool or system messages if enabled
          if (hideToolMessages) {
            if (role === 'tool' || role === 'system') {
              return false;
            }
          }
          
          return true;
        })
      );
    }
  } else {
    // If no user message found, just use all messages
    filteredMessages = messages;
    
    // If hiding tool/system messages, filter those out
    if (hideToolMessages) {
      filteredMessages = filteredMessages.filter(msg => {
        const role = getMessageRole(msg);
        return role !== 'tool' && role !== 'system';
      });
    }
  }
  
  // Second pass: add tool media to assistant messages if hiding tool messages
  if (hideToolMessages && Object.keys(mediaByAssistantMsg).length > 0) {
    filteredMessages = filteredMessages.map(msg => {
      const role = getMessageRole(msg);
      if (role === 'assistant' && mediaByAssistantMsg[msg.id]) {
        // Clone the message to avoid mutating the original
        const msgClone = {...msg};
        
        // Add the media from hidden messages to the assistant message
        msgClone.toolMedia = mediaByAssistantMsg[msg.id];
        
        return msgClone;
      }
      return msg;
    });
  }
  
  return filteredMessages;
}
