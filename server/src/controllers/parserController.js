// Parser Controller - Provides statistics about message parsing
const archiveService = require('../services/archiveService');
const { parseAnyMessage } = require('../parsers/parseAnyMessage');

// Get archive root from environment or config - will be injected in main server file
let ARCHIVE_ROOT = '';

/**
 * Set the archive root directory
 * @param {string} rootPath - Path to the archive root
 */
function setArchiveRoot(rootPath) {
  ARCHIVE_ROOT = rootPath;
}

/**
 * Get parser statistics for the archive
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getParserStats(req, res) {
  try {
    // Get current archive index
    const archiveIndex = archiveService.getArchiveIndex();
    
    // Initialize statistics containers
    const stats = {
      counts: {
        user: 0,
        assistant: 0,
        tool: 0,
        system: 0
      },
      unknown_fields: {
        user: 0,
        assistant: 0,
        tool: 0,
        system: 0,
        total: 0
      },
      tool_types: {},
      models: {},
      gizmos: {},
      total_processed: 0,
      sample_size: Math.min(archiveIndex.length, 10) // Limit to first 10 conversations for quick stats
    };
    
    // Process a subset of conversations to generate statistics
    const sampled = archiveIndex.slice(0, stats.sample_size);
    
    for (const conv of sampled) {
      // Load full conversation messages
      const result = await archiveService.loadConversationMessages(conv.folder, ARCHIVE_ROOT);
      const messages = result.messages;
      
      // Update message counts
      for (const msg of messages) {
        // Skip if no message or no parsed data
        if (!msg.message || !msg.parsed) continue;
        
        // Update total processed count
        stats.total_processed++;
        
        // Update counts by message type
        if (msg.parsed.type) {
          stats.counts[msg.parsed.type] = (stats.counts[msg.parsed.type] || 0) + 1;
          
          // Check for unknown fields
          if (msg.parsed.data && msg.parsed.data.has_unknown_fields) {
            stats.unknown_fields[msg.parsed.type] = (stats.unknown_fields[msg.parsed.type] || 0) + 1;
            stats.unknown_fields.total++;
          }
          
          // For tool messages, track content types
          if (msg.parsed.type === 'tool' && msg.parsed.data && msg.parsed.data.content_type) {
            const contentType = msg.parsed.data.content_type;
            stats.tool_types[contentType] = (stats.tool_types[contentType] || 0) + 1;
          }
        }
        
        // Track model usage
        if (msg.message.metadata && msg.message.metadata.model_slug) {
          const model = msg.message.metadata.model_slug;
          stats.models[model] = (stats.models[model] || 0) + 1;
        }
        
        // Track gizmo/custom GPT usage
        if (msg.message.metadata && msg.message.metadata.gizmo_id) {
          const gizmoId = msg.message.metadata.gizmo_id;
          const gizmoName = msg.gizmo_name || gizmoId;
          stats.gizmos[gizmoName] = (stats.gizmos[gizmoName] || 0) + 1;
        }
      }
    }
    
    res.json(stats);
  } catch (err) {
    console.error('Error generating parser statistics:', err);
    res.status(500).json({ error: 'Failed to generate parser statistics' });
  }
}

module.exports = {
  setArchiveRoot,
  getParserStats
};