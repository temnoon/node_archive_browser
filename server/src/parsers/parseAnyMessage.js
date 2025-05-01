// Dispatcher module for routing messages to the appropriate parser
const { parseUserMessage } = require('./parseUserMessage');
const { parseAssistantMessage } = require('./parseAssistantMessage');
const { parseToolMessage } = require('./parseToolMessage');
const { parseSystemMessage } = require('./parseSystemMessage');

/**
 * Parse any message type and route to the appropriate specialized parser
 * @param {Object} msg - Raw message object from the archive
 * @returns {Object|null} - Parsed message with type indicator or null if parsing failed
 */
function parseAnyMessage(msg) {
  if (!msg || !msg.author || !msg.author.role) {
    return null;
  }

  switch(msg.author.role) {
    case "user": 
      const userResult = parseUserMessage(msg);
      return userResult ? { type: "user", data: userResult } : null;
    
    case "assistant": 
      const assistantResult = parseAssistantMessage(msg);
      return assistantResult ? { type: "assistant", data: assistantResult } : null;
    
    case "tool": 
      const toolResult = parseToolMessage(msg);
      return toolResult ? { type: "tool", data: toolResult } : null;
    
    case "system": 
      const systemResult = parseSystemMessage(msg);
      return systemResult ? { type: "system", data: systemResult } : null;
    
    default:
      console.warn(`Unknown message role: ${msg.author.role}`);
      return null;
  }
}

module.exports = {
  parseAnyMessage
};