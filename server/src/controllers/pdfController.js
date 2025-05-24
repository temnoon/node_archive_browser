const pdfService = require('../services/pdfService');
const fs = require('fs-extra');
const path = require('path');
const archiveService = require('../services/archiveService');

let ARCHIVE_ROOT = '';

/**
 * PDF Controller - Handles PDF export functionality
 */
class PDFController {
  constructor() {
    this.activeExports = new Map(); // Track active export processes
  }

  /**
   * Set the archive root directory
   */
  setArchiveRoot(root) {
    ARCHIVE_ROOT = root;
  }

  /**
   * Test PDF export with debug template (no media for debugging)
   */
  async testDebugExport(req, res) {
    const { id } = req.params;

    try {
      // Find conversation using archiveService
      const conv = archiveService.findConversationById(id);
      if (!conv) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // Load conversation data using archiveService
      const result = await archiveService.loadConversationMessages(conv.folder, ARCHIVE_ROOT);
      const messages = result.messages;

      // Generate debug PDF without media
      const pdfBuffer = await pdfService.generateDebugPDF({
        messages,
        title: `DEBUG (No Media): ${conv.title || `Conversation ${id}`}`,
        filter: {
          includeToolMessages: false,
          includeSystemMessages: false,
          roles: ['user', 'assistant']
        },
        style: {
          fontFamily: 'Times, serif',
          fontSize: '12pt',
          includeHeaders: true,
          includePageNumbers: true
        },
        layout: {
          format: 'A4',
          margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' }
        }
      });

      // Set response headers for binary PDF data
      const filename = `debug-no-media-${id}-${Date.now()}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Cache-Control', 'no-cache');

      // Send PDF using res.end() for binary data (not res.send())
      res.end(pdfBuffer, 'binary');

    } catch (error) {
      console.error('Error in debug export test:', error);
      res.status(500).json({ 
        error: 'Failed to generate debug test PDF',
        details: error.message 
      });
    }
  }

  /**
   * Test PDF export with simplified template (for debugging)
   */
  async testSimpleExport(req, res) {
    const { id } = req.params;

    try {
      // Find conversation using archiveService
      const conv = archiveService.findConversationById(id);
      if (!conv) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // Load conversation data using archiveService
      const result = await archiveService.loadConversationMessages(conv.folder, ARCHIVE_ROOT);
      const messages = result.messages;

      // Generate simple PDF without MathJax
      const pdfBuffer = await pdfService.generateSimplePDF({
        messages,
        title: `SIMPLE TEST: ${conv.title || `Conversation ${id}`}`,
        filter: {
          includeToolMessages: false,
          includeSystemMessages: false,
          roles: ['user', 'assistant']
        }
      });

      // Set response headers for binary PDF data
      const filename = `simple-test-${id}-${Date.now()}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Cache-Control', 'no-cache');

      // Send PDF using res.end() for binary data (not res.send())
      res.end(pdfBuffer, 'binary');

    } catch (error) {
      console.error('Error in simple export test:', error);
      res.status(500).json({ 
        error: 'Failed to generate simple test PDF',
        details: error.message 
      });
    }
  }

  /**
   * Export a single conversation to PDF
   */
  async exportConversation(req, res) {
    const { id } = req.params;
    
    // Handle both GET and POST requests - GET requests use default options
    const {
      layout = {},
      style = {},
      filter = {},
      messageIds = null, // Optional: specific message IDs to export
      messageRange = null // Optional: start/end indices for message range
    } = req.body || {}; // Use empty object if no body (GET request)

    try {
      // Find conversation using archiveService
      const conv = archiveService.findConversationById(id);
      if (!conv) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // Load conversation data using archiveService
      const result = await archiveService.loadConversationMessages(conv.folder, ARCHIVE_ROOT);
      let messages = result.messages;
      
      // Filter messages if specific IDs or range specified
      if (messageIds && Array.isArray(messageIds)) {
        messages = messages.filter(msg => messageIds.includes(msg.id));
      } else if (messageRange && messageRange.start !== undefined && messageRange.end !== undefined) {
        messages = messages.slice(messageRange.start, messageRange.end + 1);
      }

      // Generate PDF
      const pdfBuffer = await pdfService.generatePDF({
        messages,
        title: conv.title || `Conversation ${id}`,
        layout: {
          format: layout.format || 'A4',
          margin: layout.margin || { top: '1in', right: '1in', bottom: '1in', left: '1in' }
        },
        style: {
          fontFamily: style.fontFamily || 'Times, serif',
          fontSize: style.fontSize || '12pt',
          includeHeaders: style.includeHeaders !== false,
          includePageNumbers: style.includePageNumbers !== false
        },
        filter: {
          includeToolMessages: filter.includeToolMessages || false,
          includeSystemMessages: filter.includeSystemMessages || false,
          roles: filter.roles || ['user', 'assistant']
        },
        mediaBaseUrl: req.protocol + '://' + req.get('host') + '/api/media',
        conversationFolder: conv.folder
      });

      // Set response headers for binary PDF data
      const filename = `conversation-${id}-${Date.now()}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Cache-Control', 'no-cache');

      // Send PDF using res.end() for binary data (not res.send())
      res.end(pdfBuffer, 'binary');

    } catch (error) {
      console.error('Error exporting conversation:', error);
      res.status(500).json({ 
        error: 'Failed to export conversation',
        details: error.message 
      });
    }
  }

  /**
   * Export multiple conversations to a single PDF
   */
  async exportMultipleConversations(req, res) {
    const {
      conversationIds,
      layout = {},
      style = {},
      filter = {},
      includeTableOfContents = true
    } = req.body;

    if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
      return res.status(400).json({ error: 'conversationIds array is required' });
    }

    try {
      // Load all conversations
      const conversations = [];
      
      for (const id of conversationIds) {
        const conversationPath = path.join(ARCHIVE_ROOT, `${id}.json`);
        
        if (await fs.exists(conversationPath)) {
          const conversationData = await fs.readJson(conversationPath);
          const messages = conversationData.mapping ? Object.values(conversationData.mapping) : [];
          
          conversations.push({
            id,
            title: conversationData.title || `Conversation ${id}`,
            messages: this.filterMessages(messages, filter),
            folder: this.getConversationFolder(conversationData),
            createTime: conversationData.create_time
          });
        }
      }

      if (conversations.length === 0) {
        return res.status(404).json({ error: 'No valid conversations found' });
      }

      // Generate PDF
      const pdfBuffer = await pdfService.generateMultiConversationPDF(conversations, {
        layout: {
          format: layout.format || 'A4',
          margin: layout.margin || { top: '1in', right: '1in', bottom: '1in', left: '1in' }
        },
        style: {
          fontFamily: style.fontFamily || 'Times, serif',
          fontSize: style.fontSize || '12pt',
          includeHeaders: style.includeHeaders !== false,
          includePageNumbers: style.includePageNumbers !== false
        },
        mediaBaseUrl: req.protocol + '://' + req.get('host') + '/api/media',
        includeTableOfContents
      });

      // Set response headers for binary PDF data
      const filename = `conversations-export-${Date.now()}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Cache-Control', 'no-cache');

      // Send PDF using res.end() for binary data (not res.send())
      res.end(pdfBuffer, 'binary');

    } catch (error) {
      console.error('Error exporting multiple conversations:', error);
      res.status(500).json({ 
        error: 'Failed to export conversations',
        details: error.message 
      });
    }
  }

  /**
   * Export specific messages to PDF
   */
  async exportMessages(req, res) {
    const {
      conversationId,
      messageIds,
      layout = {},
      style = {},
      title = null
    } = req.body;

    if (!conversationId || !Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ error: 'conversationId and messageIds array are required' });
    }

    try {
      // Find conversation using archiveService
      const conv = archiveService.findConversationById(conversationId);
      if (!conv) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // Load conversation data using archiveService
      const result = await archiveService.loadConversationMessages(conv.folder, ARCHIVE_ROOT);
      const allMessages = result.messages;
      
      // Filter to specific message IDs
      const selectedMessages = allMessages.filter(msg => messageIds.includes(msg.id));

      if (selectedMessages.length === 0) {
        return res.status(404).json({ error: 'No messages found with specified IDs' });
      }

      // Generate PDF
      const pdfBuffer = await pdfService.generatePDF({
        messages: selectedMessages,
        title: title || `Selected Messages from ${conv.title || conversationId}`,
        layout: {
          format: layout.format || 'A4',
          margin: layout.margin || { top: '1in', right: '1in', bottom: '1in', left: '1in' }
        },
        style: {
          fontFamily: style.fontFamily || 'Times, serif',
          fontSize: style.fontSize || '12pt',
          includeHeaders: style.includeHeaders !== false,
          includePageNumbers: style.includePageNumbers !== false
        },
        filter: {
          includeToolMessages: true, // Include all when specifically selected
          includeSystemMessages: true,
          roles: ['user', 'assistant', 'tool', 'system']
        },
        mediaBaseUrl: req.protocol + '://' + req.get('host') + '/api/media',
        conversationFolder: conv.folder
      });

      // Set response headers for binary PDF data
      const filename = `messages-${conversationId}-${Date.now()}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Cache-Control', 'no-cache');

      // Send PDF using res.end() for binary data (not res.send())
      res.end(pdfBuffer, 'binary');

    } catch (error) {
      console.error('Error exporting messages:', error);
      res.status(500).json({ 
        error: 'Failed to export messages',
        details: error.message 
      });
    }
  }

  /**
   * Get PDF export configuration options
   */
  async getExportOptions(req, res) {
    try {
      const options = {
        layouts: {
          formats: ['A4', 'Letter', 'Legal', 'A3', 'Tabloid'],
          margins: {
            narrow: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
            normal: { top: '1in', right: '1in', bottom: '1in', left: '1in' },
            wide: { top: '1in', right: '2in', bottom: '1in', left: '2in' }
          }
        },
        styles: {
          fonts: ['Times, serif', 'Arial, sans-serif', 'Courier, monospace', 'Georgia, serif'],
          fontSizes: ['10pt', '11pt', '12pt', '14pt', '16pt', '18pt']
        },
        filters: {
          roles: ['user', 'assistant', 'tool', 'system'],
          defaultRoles: ['user', 'assistant']
        }
      };

      res.json(options);
    } catch (error) {
      console.error('Error getting export options:', error);
      res.status(500).json({ error: 'Failed to get export options' });
    }
  }

  /**
   * Preview export (returns HTML instead of PDF for quick preview)
   */
  async previewExport(req, res) {
    const { id } = req.params;
    const {
      layout = {},
      style = {},
      filter = {},
      messageIds = null,
      messageRange = null
    } = req.body;

    try {
      // Find conversation using archiveService
      const conv = archiveService.findConversationById(id);
      if (!conv) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // Load conversation data using archiveService
      const result = await archiveService.loadConversationMessages(conv.folder, ARCHIVE_ROOT);
      let messages = result.messages;
      
      // Filter messages if specified
      if (messageIds && Array.isArray(messageIds)) {
        messages = messages.filter(msg => messageIds.includes(msg.id));
      } else if (messageRange && messageRange.start !== undefined && messageRange.end !== undefined) {
        messages = messages.slice(messageRange.start, messageRange.end + 1);
      }

      // Filter by criteria
      messages = this.filterMessages(messages, filter);

      // Return preview data
      res.json({
        title: conv.title || `Conversation ${id}`,
        messageCount: messages.length,
        estimatedPages: Math.ceil(messages.length / 10), // Rough estimate
        preview: messages.slice(0, 5).map(msg => ({
          role: msg.message?.author?.role,
          timestamp: msg.message?.create_time,
          textPreview: this.getTextPreview(msg.message),
          hasMedia: this.hasMedia(msg.message)
        }))
      });

    } catch (error) {
      console.error('Error previewing export:', error);
      res.status(500).json({ 
        error: 'Failed to preview export',
        details: error.message 
      });
    }
  }

  /**
   * Helper: Filter messages based on criteria
   */
  filterMessages(messages, filter) {
    if (!Array.isArray(messages)) return [];

    return messages.filter(msg => {
      const role = msg.message?.author?.role;
      
      if (filter.roles && !filter.roles.includes(role)) {
        return false;
      }
      
      if (!filter.includeToolMessages && role === 'tool') {
        return false;
      }
      
      if (!filter.includeSystemMessages && role === 'system') {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Helper: Get text preview of message
   */
  getTextPreview(message) {
    if (!message || !message.content) return '';
    
    let text = '';
    const content = message.content;
    
    if (content.content_type === 'text' && Array.isArray(content.parts)) {
      text = content.parts.join(' ');
    } else if (content.content_type === 'multimodal_text' && Array.isArray(content.parts)) {
      text = content.parts
        .filter(part => typeof part === 'string')
        .join(' ');
    }
    
    return text.slice(0, 200) + (text.length > 200 ? '...' : '');
  }

  /**
   * Helper: Check if message has media
   */
  hasMedia(message) {
    if (!message || !message.content) return false;
    
    const content = message.content;
    
    // Check for media in multimodal content
    if (content.content_type === 'multimodal_text' && Array.isArray(content.parts)) {
      return content.parts.some(part => 
        part && typeof part === 'object' && 
        (part.content_type === 'image_asset_pointer' || part.content_type === 'audio_asset_pointer')
      );
    }
    
    // Check for attachments
    if (message.metadata && message.metadata.attachments && Array.isArray(message.metadata.attachments)) {
      return message.metadata.attachments.length > 0;
    }
    
    return false;
  }
}

const controller = new PDFController();

module.exports = {
  setArchiveRoot: (root) => controller.setArchiveRoot(root),
  exportConversation: (req, res) => controller.exportConversation(req, res),
  exportMultipleConversations: (req, res) => controller.exportMultipleConversations(req, res),
  exportMessages: (req, res) => controller.exportMessages(req, res),
  getExportOptions: (req, res) => controller.getExportOptions(req, res),
  previewExport: (req, res) => controller.previewExport(req, res),
  testSimpleExport: (req, res) => controller.testSimpleExport(req, res),
  testDebugExport: (req, res) => controller.testDebugExport(req, res)
};
