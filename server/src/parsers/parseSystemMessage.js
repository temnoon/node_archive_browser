// System message parser module

/**
 * Parse a system message from the archive
 * @param {Object} msg - Raw message object from the archive
 * @returns {Object|null} - Parsed system message data or null if parsing failed
 */
function parseSystemMessage(msg) {
  if (!msg || !msg.author || msg.author.role !== "system") {
    return null;
  }

  try {
    // Base message structure
    const parsed = {
      message_id: msg.id,
      content_type: "system",
      has_unknown_fields: false
    };

    // Extract metadata
    if (msg.metadata) {
      // Model information
      if (msg.metadata.model_slug) {
        parsed.model = msg.metadata.model_slug;
      }

      // Tools list
      if (msg.metadata.tools && Array.isArray(msg.metadata.tools)) {
        parsed.tools = msg.metadata.tools.map(tool => ({
          type: tool.type,
          name: tool.name,
          description: tool.description
        }));
      }

      // Canvas ID
      if (msg.metadata.canvas_id) {
        parsed.canvas_id = msg.metadata.canvas_id;
      }

      // Attachments (files)
      if (msg.metadata.attachments && Array.isArray(msg.metadata.attachments)) {
        parsed.attachments = msg.metadata.attachments.map(attachment => ({
          file_id: attachment.id,
          name: attachment.name,
          size: attachment.size,
          width: attachment.width,
          height: attachment.height,
          mime_type: attachment.mime_type
        }));
      }
    }

    // Extract any system text (rare but possible)
    if (msg.content && msg.content.parts) {
      if (Array.isArray(msg.content.parts)) {
        parsed.text = msg.content.parts.filter(part => typeof part === 'string').join('\n');
      } else if (typeof msg.content.parts === 'string') {
        parsed.text = msg.content.parts;
      }
    }

    // Check for unexpected/unknown fields for future-proofing
    const knownFields = ['id', 'author', 'content', 'metadata', 'create_time', 'update_time'];
    const msgFields = Object.keys(msg);
    
    for (const field of msgFields) {
      if (!knownFields.includes(field)) {
        parsed.has_unknown_fields = true;
        // Only log unknown fields in development environment
        if (process.env.NODE_ENV === 'development') {
          console.debug(`Unknown field in system message: ${field}`);
        }
        break; // Stop after finding the first unknown field
      }
    }

    return parsed;
  } catch (err) {
    console.error('Error parsing system message:', err);
    return {
      message_id: msg.id || 'unknown',
      content_type: 'error',
      error: err.message,
      has_unknown_fields: true
    };
  }
}

module.exports = {
  parseSystemMessage
};