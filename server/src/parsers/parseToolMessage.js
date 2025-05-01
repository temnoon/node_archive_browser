// Tool message parser module
const mediaProcessor = require('../media-processor');

/**
 * Parse a tool message from the archive
 * @param {Object} msg - Raw message object from the archive
 * @returns {Object|null} - Parsed tool message data or null if parsing failed
 */
function parseToolMessage(msg) {
  if (!msg || !msg.author || msg.author.role !== "tool") {
    return null;
  }

  try {
    // Base message structure with tool name if available
    const parsed = {
      message_id: msg.id,
      has_unknown_fields: false
    };

    // Add tool name if available
    if (msg.author.name) {
      parsed.tool_name = msg.author.name;
    }

    // Process based on content type
    if (msg.content && msg.content.content_type) {
      parsed.content_type = msg.content.content_type;

      switch(msg.content.content_type) {
        case "tether_quote":
          parsed.url = msg.content.url;
          parsed.domain = msg.content.domain;
          parsed.text = msg.content.text;
          break;

        case "code":
          parsed.input = msg.content.input;
          parsed.language = msg.content.language;
          parsed.outputs = msg.content.outputs;
          break;

        case "file_citation":
          parsed.file_id = msg.content.file_id;
          parsed.citation_format = msg.content.citation_format;
          parsed.file_name = msg.content.file_name;
          parsed.citation = msg.content.citation;
          break;

        case "file_path":
          parsed.file_id = msg.content.file_id;
          parsed.file_name = msg.content.file_name;
          parsed.path = msg.content.path;
          break;

        case "execution_output":
          parsed.execution_id = msg.content.execution_id;
          parsed.output_type = msg.content.output_type;
          parsed.text = msg.content.text;
          break;

        case "search_results":
          parsed.results = msg.content.results;
          break;

        case "tool_result":
          parsed.tool_call_id = msg.content.tool_call_id;
          parsed.result = msg.content.result;
          break;

        default:
          // For any unknown content types, store the entire content
          parsed.raw_content = msg.content;
          parsed.has_unknown_fields = true;
          // Only log in development environment
          if (process.env.NODE_ENV === 'development') {
            console.debug(`Unknown tool content type: ${msg.content.content_type}`);
          }
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
          console.debug(`Unknown field in tool message: ${field}`);
        }
        break; // Stop after finding the first unknown field
      }
    }

    // Extract markdown for display
    parsed.markdown = mediaProcessor.extractMarkdown(msg);

    return parsed;
  } catch (err) {
    console.error('Error parsing tool message:', err);
    return {
      message_id: msg.id || 'unknown',
      content_type: 'error',
      error: err.message,
      has_unknown_fields: true
    };
  }
}

module.exports = {
  parseToolMessage
};