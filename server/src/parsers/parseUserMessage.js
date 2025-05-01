// User message parser module
const mediaProcessor = require('../media-processor');

/**
 * Parse a user message from the archive
 * @param {Object} msg - Raw message object from the archive
 * @returns {Object|null} - Parsed user message data or null if parsing failed
 */
function parseUserMessage(msg) {
  if (!msg || !msg.author || msg.author.role !== "user") {
    return null;
  }

  try {
    // Base message structure
    const parsed = {
      message_id: msg.id,
      content_type: "text",
      has_unknown_fields: false
    };

    // Extract text content
    if (msg.content && msg.content.parts) {
      // Handle parts array (main content)
      if (Array.isArray(msg.content.parts)) {
        // Most user messages have text content in parts[0]
        parsed.text = msg.content.parts.filter(part => typeof part === 'string').join('\n');
      } else if (typeof msg.content.parts === 'string') {
        parsed.text = msg.content.parts;
      }
    }

    // Extract content type
    if (msg.content && msg.content.content_type) {
      parsed.content_type = msg.content.content_type;
    }

    // Extract uploaded files
    const fileIds = [];
    
    // Check content.files (newer format)
    if (msg.content && msg.content.files && Array.isArray(msg.content.files)) {
      msg.content.files.forEach(file => {
        if (file.file_id) {
          fileIds.push(file.file_id);
        }
      });
    }
    
    // Check metadata.attachments (older format)
    if (msg.metadata && msg.metadata.attachments && Array.isArray(msg.metadata.attachments)) {
      msg.metadata.attachments.forEach(attachment => {
        if (attachment.id && !fileIds.includes(attachment.id)) {
          fileIds.push(attachment.id);
        }
      });
    }
    
    if (fileIds.length > 0) {
      parsed.file_ids = fileIds;
    }

    // Extract function call/tool use
    if (msg.content && msg.content.function_call) {
      parsed.function_call = {
        name: msg.content.function_call.name,
        arguments: msg.content.function_call.arguments
      };
    }

    // Extract search query
    if (msg.content && msg.content.search_query) {
      parsed.search_query = msg.content.search_query;
    }

    // Check for unexpected/unknown fields for future-proofing
    const knownFields = ['id', 'author', 'content', 'metadata', 'create_time', 'update_time'];
    const msgFields = Object.keys(msg);
    
    for (const field of msgFields) {
      if (!knownFields.includes(field)) {
        parsed.has_unknown_fields = true;
        // Only log unknown fields in development environment
        if (process.env.NODE_ENV === 'development') {
          console.debug(`Unknown field in user message: ${field}`);
        }
        break; // Stop after finding the first unknown field
      }
    }

    // Extract markdown for display
    parsed.markdown = mediaProcessor.extractMarkdown(msg);

    return parsed;
  } catch (err) {
    console.error('Error parsing user message:', err);
    return {
      message_id: msg.id || 'unknown',
      content_type: 'error',
      error: err.message,
      has_unknown_fields: true
    };
  }
}

module.exports = {
  parseUserMessage
};