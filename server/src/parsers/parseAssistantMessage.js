// Assistant message parser module
const mediaProcessor = require('../media-processor');
const canvasProcessor = require('../models/canvas-processor');

/**
 * Parse an assistant message from the archive
 * @param {Object} msg - Raw message object from the archive
 * @returns {Object|null} - Parsed assistant message data or null if parsing failed
 */
function parseAssistantMessage(msg) {
  if (!msg || !msg.author || msg.author.role !== "assistant") {
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
        parsed.text = msg.content.parts.filter(part => typeof part === 'string').join('\n');
      } else if (typeof msg.content.parts === 'string') {
        parsed.text = msg.content.parts;
      }
    }

    // Extract content type
    if (msg.content && msg.content.content_type) {
      parsed.content_type = msg.content.content_type;
    }

    // Extract metadata
    if (msg.metadata) {
      // Model information
      if (msg.metadata.model_slug) {
        parsed.model = msg.metadata.model_slug;
      }

      // Gizmo/Custom GPT information
      if (msg.metadata.gizmo_id) {
        parsed.gizmo_id = msg.metadata.gizmo_id;
      }

      // Canvas information
      if (msg.metadata.canvas_id) {
        parsed.canvas_id = msg.metadata.canvas_id;
      }
    }

    // Extract canvas references from the message
    const canvasIds = canvasProcessor.extractCanvasReferences(msg);
    if (canvasIds && canvasIds.length > 0) {
      parsed.canvas_ids = canvasIds;
    }

    // Extract function calls (legacy format)
    if (msg.content && msg.content.function_call) {
      parsed.function_call = {
        name: msg.content.function_call.name,
        arguments: msg.content.function_call.arguments
      };
    }

    // Extract tool calls (newer format)
    if (msg.content && msg.content.tool_calls && Array.isArray(msg.content.tool_calls)) {
      parsed.tool_calls = msg.content.tool_calls.map(call => ({
        id: call.id,
        type: call.type,
        function: call.function
      }));
    }

    // Extract annotations (links, citations, etc.)
    if (msg.content && msg.content.annotations && Array.isArray(msg.content.annotations)) {
      parsed.annotations = msg.content.annotations.map(annotation => ({
        type: annotation.type,
        text: annotation.text,
        file_citation: annotation.file_citation,
        file_path: annotation.file_path
      }));
    }

    // Check for unexpected/unknown fields for future-proofing
    const knownFields = [
      'id', 'author', 'content', 'metadata', 'create_time', 'update_time',
      'status', 'end_turn', 'weight', 'recipient'
    ];
    const msgFields = Object.keys(msg);
    
    for (const field of msgFields) {
      if (!knownFields.includes(field)) {
        parsed.has_unknown_fields = true;
        // Only log unknown fields in development environment
        if (process.env.NODE_ENV === 'development') {
          console.debug(`Unknown field in assistant message: ${field}`);
        }
        break; // Stop after finding the first unknown field
      }
    }

    // Extract markdown for display
    parsed.markdown = mediaProcessor.extractMarkdown(msg);

    return parsed;
  } catch (err) {
    console.error('Error parsing assistant message:', err);
    return {
      message_id: msg.id || 'unknown',
      content_type: 'error',
      error: err.message,
      has_unknown_fields: true
    };
  }
}

module.exports = {
  parseAssistantMessage
};