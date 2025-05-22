/**
 * Message utility functions for the Archive Browser
 * Handles message content extraction and parsing
 */

import { determineMediaType } from './mediaUtils';
import { processLatexInText } from '../latexUtils';

/**
 * Extract text content and media references from a message
 * @param {Object} message - The message object to process
 * @returns {Object} - Object containing text, mediaRefs, segments, and canvasIds
 */
export function extractMessageContent(message) {
  if (!message || !message.content) {
    return { text: '', mediaRefs: [], segments: [], canvasIds: [] };
  }
  
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
    if (msg.message?.author?.role === 'assistant') {
      lastAssistantId = msg.id;
    } else if ((msg.message?.author?.role === 'tool' || msg.message?.author?.role === 'system') && lastAssistantId) {
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
  
  // Find the first user message
  let firstUserIdx = messages.findIndex(msg => 
    msg.message && msg.message.author && msg.message.author.role === 'user'
  );
  
  let filteredMessages = [];
  
  if (firstUserIdx !== -1) {
    filteredMessages = messages.slice(firstUserIdx);
    
    // Always filter out empty system messages
    if (filteredMessages.length > 0) {
      filteredMessages = [filteredMessages[0]].concat(
        filteredMessages.slice(1).filter(msg => {
          // Skip empty system messages
          if (msg.message?.author?.role === 'system' && 
              (!msg.message.content || !msg.message.content.parts || msg.message.content.parts.length === 0)) {
            return false;
          }
          
          // Hide tool or system messages if enabled
          if (hideToolMessages) {
            if (msg.message?.author?.role === 'tool' || msg.message?.author?.role === 'system') {
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
      filteredMessages = filteredMessages.filter(msg => 
        msg.message?.author?.role !== 'tool' && msg.message?.author?.role !== 'system'
      );
    }
  }
  
  // Second pass: add tool media to assistant messages if hiding tool messages
  if (hideToolMessages && Object.keys(mediaByAssistantMsg).length > 0) {
    filteredMessages = filteredMessages.map(msg => {
      if (msg.message?.author?.role === 'assistant' && mediaByAssistantMsg[msg.id]) {
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
