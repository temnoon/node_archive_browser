const EnhancedPdfService = require('../services/enhancedPdfService');
const FontManager = require('../services/fontManager');
// const multer = require('multer'); // Temporarily disabled due to Node.js compatibility
const path = require('path');
const fs = require('fs-extra');

/**
 * Enhanced PDF Editor API Controller
 * Provides REST endpoints for Adobe Acrobat-level PDF editing capabilities
 */
class EnhancedPdfController {
  constructor() {
    this.pdfService = new EnhancedPdfService();
    this.fontManager = new FontManager();
    // this.setupMulter(); // Temporarily disabled
    this.setupEventHandlers();
  }

  // setupMulter() {
  //   // Temporarily disabled due to Node.js compatibility issues
  // }

  setupEventHandlers() {
    // Listen for real-time events from PDF service
    this.pdfService.on('document-created', (data) => {
      this.broadcastUpdate('document-created', data);
    });

    this.pdfService.on('element-updated', (data) => {
      this.broadcastUpdate('element-updated', data);
    });

    this.fontManager.on('custom-font-embedded', (data) => {
      this.broadcastUpdate('font-embedded', data);
    });
  }

  broadcastUpdate(event, data) {
    // WebSocket broadcasting would be implemented here
    // For now, we'll just log the events
    console.log(`Broadcasting ${event}:`, data);
  }

  /**
   * Document Management Endpoints
   */

  // POST /api/enhanced-pdf/documents
  createDocument = async (req, res) => {
    try {
      const options = req.body;
      const document = await this.pdfService.createDocument(options);
      
      res.status(201).json({
        success: true,
        document,
        message: 'Document created successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  // GET /api/enhanced-pdf/documents/:id
  getDocument = async (req, res) => {
    try {
      const { id } = req.params;
      const document = await this.pdfService.loadDocument(id);
      
      res.json({
        success: true,
        document
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  };

  // PUT /api/enhanced-pdf/documents/:id
  updateDocument = async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const operation = {
        type: 'update-document',
        updates
      };
      
      const document = await this.pdfService.applyEdit(id, operation);
      
      res.json({
        success: true,
        document,
        message: 'Document updated successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  // DELETE /api/enhanced-pdf/documents/:id
  deleteDocument = async (req, res) => {
    try {
      const { id } = req.params;
      await this.pdfService.deleteDocument(id);
      
      res.json({
        success: true,
        message: 'Document deleted successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  // GET /api/enhanced-pdf/documents/:id/state
  getDocumentState = async (req, res) => {
    try {
      const { id } = req.params;
      const state = await this.pdfService.getDocumentState(id);
      
      res.json({
        success: true,
        state
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Page Management Endpoints
   */

  // POST /api/enhanced-pdf/documents/:id/pages
  addPage = async (req, res) => {
    try {
      const { id } = req.params;
      const pageSettings = req.body;
      
      const page = await this.pdfService.addPage(id, pageSettings);
      
      res.status(201).json({
        success: true,
        page,
        message: 'Page added successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  // DELETE /api/enhanced-pdf/documents/:id/pages/:pageId
  deletePage = async (req, res) => {
    try {
      const { id, pageId } = req.params;
      await this.pdfService.deletePage(id, pageId);
      
      res.json({
        success: true,
        message: 'Page deleted successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Element Management Endpoints
   */

  // POST /api/enhanced-pdf/documents/:id/pages/:pageId/elements
  addElement = async (req, res) => {
    try {
      const { id, pageId } = req.params;
      const elementData = req.body;
      
      const element = await this.pdfService.addElement(id, pageId, elementData);
      
      res.status(201).json({
        success: true,
        element,
        message: 'Element added successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  // PUT /api/enhanced-pdf/documents/:id/pages/:pageId/elements/:elementId
  updateElement = async (req, res) => {
    try {
      const { id, pageId, elementId } = req.params;
      const updates = req.body;
      
      const element = await this.pdfService.updateElement(id, pageId, elementId, updates);
      
      res.json({
        success: true,
        element,
        message: 'Element updated successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  // DELETE /api/enhanced-pdf/documents/:id/pages/:pageId/elements/:elementId
  deleteElement = async (req, res) => {
    try {
      const { id, pageId, elementId } = req.params;
      await this.pdfService.deleteElement(id, pageId, elementId);
      
      res.json({
        success: true,
        message: 'Element deleted successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Font Management Endpoints
   */

  // GET /api/enhanced-pdf/fonts
  getFonts = async (req, res) => {
    try {
      const { type, search, category, limit } = req.query;
      let fonts;

      if (search) {
        fonts = this.fontManager.searchFonts(search, { type, limit: parseInt(limit) });
      } else if (category) {
        fonts = this.fontManager.getFontsByCategory(category);
      } else if (type) {
        switch (type) {
          case 'system':
            fonts = this.fontManager.getSystemFonts();
            break;
          case 'web':
            fonts = this.fontManager.getWebFonts();
            break;
          case 'custom':
            fonts = this.fontManager.getCustomFonts();
            break;
          default:
            fonts = this.fontManager.getAvailableFonts();
        }
      } else {
        fonts = this.fontManager.getAvailableFonts();
      }

      res.json({
        success: true,
        fonts: fonts.map(font => ({
          familyName: font.familyName,
          type: font.type,
          variants: font.variants,
          weight: font.weight,
          style: font.style,
          loaded: font.loaded,
          features: font.features
        }))
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  // GET /api/enhanced-pdf/fonts/:fontFamily
  getFontDetails = async (req, res) => {
    try {
      const { fontFamily } = req.params;
      const fontData = this.fontManager.getFontData(fontFamily);
      
      if (!fontData) {
        return res.status(404).json({
          success: false,
          error: 'Font not found'
        });
      }

      res.json({
        success: true,
        font: fontData
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  // POST /api/enhanced-pdf/fonts/web
  loadWebFont = async (req, res) => {
    try {
      const { fontFamily, variants = ['regular'], provider = 'google' } = req.body;
      
      if (!fontFamily) {
        return res.status(400).json({
          success: false,
          error: 'Font family is required'
        });
      }

      const fontData = await this.fontManager.loadWebFont(fontFamily, variants, provider);
      
      res.json({
        success: true,
        font: fontData,
        message: 'Web font loaded successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  // POST /api/enhanced-pdf/fonts/custom
  uploadCustomFont = async (req, res) => {
    res.status(501).json({
      success: false,
      error: 'Custom font upload temporarily disabled. Coming soon!'
    });
  };

  // DELETE /api/enhanced-pdf/fonts/custom/:fontName
  deleteCustomFont = async (req, res) => {
    try {
      const { fontName } = req.params;
      await this.fontManager.removeCustomFont(fontName);
      
      res.json({
        success: true,
        message: 'Custom font deleted successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  // GET /api/enhanced-pdf/fonts/stats
  getFontStats = async (req, res) => {
    try {
      const stats = this.fontManager.getStats();
      
      res.json({
        success: true,
        stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Typography Endpoints
   */

  // POST /api/enhanced-pdf/typography/metrics
  calculateTextMetrics = async (req, res) => {
    try {
      const { text, fontFamily, fontSize, options = {} } = req.body;
      
      if (!text || !fontFamily || !fontSize) {
        return res.status(400).json({
          success: false,
          error: 'Text, fontFamily, and fontSize are required'
        });
      }

      const metrics = this.fontManager.calculateTextMetrics(text, fontFamily, fontSize, options);
      
      res.json({
        success: true,
        metrics
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  // POST /api/enhanced-pdf/typography/features
  applyOpenTypeFeatures = async (req, res) => {
    try {
      const { text, fontFamily, features = {} } = req.body;
      
      if (!text || !fontFamily) {
        return res.status(400).json({
          success: false,
          error: 'Text and fontFamily are required'
        });
      }

      const processedText = this.fontManager.applyOpenTypeFeatures(text, fontFamily, features);
      
      res.json({
        success: true,
        processedText,
        originalText: text,
        appliedFeatures: features
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Export Endpoints
   */

  // POST /api/enhanced-pdf/documents/:id/export
  exportDocument = async (req, res) => {
    try {
      const { id } = req.params;
      const { format = 'pdf', options = {} } = req.body;
      
      const buffer = await this.pdfService.exportToBuffer(id, format);
      
      const filename = `document_${id}.${format}`;
      const contentType = format === 'pdf' ? 'application/pdf' : 'application/octet-stream';
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      
      res.end(buffer, 'binary');
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  // POST /api/enhanced-pdf/documents/:id/preview
  generatePreview = async (req, res) => {
    try {
      const { id } = req.params;
      const { pageIndex = 0, resolution = 150 } = req.query;
      
      // Generate preview would involve rendering a specific page as an image
      // This is a simplified response for now
      const document = await this.pdfService.loadDocument(id);
      
      res.json({
        success: true,
        preview: {
          documentId: id,
          pageIndex: parseInt(pageIndex),
          resolution: parseInt(resolution),
          url: `/api/enhanced-pdf/documents/${id}/preview/${pageIndex}.png`
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Template Endpoints
   */

  // POST /api/enhanced-pdf/templates
  createTemplate = async (req, res) => {
    try {
      const { name, templateData } = req.body;
      
      if (!name || !templateData) {
        return res.status(400).json({
          success: false,
          error: 'Template name and data are required'
        });
      }

      const template = await this.pdfService.createTemplate(name, templateData);
      
      res.status(201).json({
        success: true,
        template,
        message: 'Template created successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  // POST /api/enhanced-pdf/documents/:id/apply-template
  applyTemplate = async (req, res) => {
    try {
      const { id } = req.params;
      const { templateName, data = {} } = req.body;
      
      if (!templateName) {
        return res.status(400).json({
          success: false,
          error: 'Template name is required'
        });
      }

      const document = await this.pdfService.applyTemplate(id, templateName, data);
      
      res.json({
        success: true,
        document,
        message: 'Template applied successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Real-time Editing Endpoints
   */

  // POST /api/enhanced-pdf/documents/:id/operations
  applyOperation = async (req, res) => {
    try {
      const { id } = req.params;
      const operation = req.body;
      
      const result = await this.pdfService.applyEdit(id, operation);
      
      res.json({
        success: true,
        result,
        operation
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Integration with Existing Archive Browser
   */

  // POST /api/enhanced-pdf/from-conversation/:conversationId
  createFromConversation = async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { template = 'conversation', options = {} } = req.body;
      
      // Get conversation data via HTTP call
      const fetch = require('node-fetch');
      const conversationResponse = await fetch(`http://localhost:3001/api/conversations/${conversationId}`);
      
      if (!conversationResponse.ok) {
        throw new Error(`Failed to load conversation: ${conversationResponse.statusText}`);
      }
      
      const conversationData = await conversationResponse.json();
      
      // Create document with conversation title
      const document = await this.pdfService.createDocument({
        title: conversationData.title || `Conversation ${conversationId}`,
        template: 'conversation',
        pageFormat: 'A4',
        ...options
      });
      
      // Process messages and add as text elements
      if (conversationData.messages && conversationData.messages.length > 0) {
        let yPosition = 100; // Start position
        const pageWidth = 595; // A4 width in points
        const margins = { left: 72, right: 72, top: 72, bottom: 72 };
        const contentWidth = pageWidth - margins.left - margins.right;
        
        for (const message of conversationData.messages) {
          if (message.content && message.content.parts) {
            for (const part of message.content.parts) {
              if (typeof part === 'string' && part.trim()) {
                // Add role header (User/Assistant)
                const roleText = message.author?.role === 'user' ? 'User:' : 'Assistant:';
                await this.pdfService.addElement(document.id, document.pages[0].id, {
                  type: 'text',
                  content: roleText,
                  bounds: { x: margins.left, y: yPosition, width: contentWidth, height: 20 },
                  style: {
                    fontFamily: 'Helvetica',
                    fontSize: 14,
                    fontWeight: 'bold',
                    color: message.author?.role === 'user' ? '#2E7D32' : '#1976D2'
                  }
                });
                yPosition += 25;
                
                // Add message content
                const messageHeight = Math.max(50, part.length / 80 * 15);
                await this.pdfService.addElement(document.id, document.pages[0].id, {
                  type: 'text',
                  content: part.trim(),
                  bounds: { x: margins.left, y: yPosition, width: contentWidth, height: messageHeight },
                  style: {
                    fontFamily: 'Helvetica',
                    fontSize: 11,
                    color: '#000000'
                  }
                });
                yPosition += messageHeight + 20;
                
                // Add some spacing between messages
                yPosition += 15;
                
                // Check if we need a new page
                if (yPosition > 750) { // Near bottom of page
                  // Add new page logic would go here
                  yPosition = 100; // Reset for new page
                }
              }
            }
          }
        }
      }
      
      // Save document after adding all elements
      await this.pdfService.saveDocument(document);
      
      // Get the updated document
      const updatedDocument = await this.pdfService.loadDocument(document.id);
      
      res.status(201).json({
        success: true,
        document: updatedDocument,
        message: 'Document created from conversation with content'
      });
    } catch (error) {
      console.error('Error creating document from conversation:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Utility Endpoints
   */

  // GET /api/enhanced-pdf/health
  getHealth = async (req, res) => {
    try {
      const fontStats = this.fontManager.getStats();
      
      res.json({
        success: true,
        health: 'OK',
        services: {
          pdfService: 'running',
          fontManager: 'running'
        },
        stats: {
          fonts: fontStats
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  // GET /api/enhanced-pdf/capabilities
  getCapabilities = async (req, res) => {
    try {
      res.json({
        success: true,
        capabilities: {
          document: {
            create: true,
            edit: true,
            delete: true,
            multiPage: true,
            templates: true
          },
          text: {
            richFormatting: true,
            customFonts: true,
            webFonts: true,
            openTypeFeatures: true,
            advancedTypography: true
          },
          graphics: {
            vectorShapes: true,
            images: true,
            gradients: true,
            bezierCurves: true
          },
          export: {
            pdf: true,
            highResolution: true,
            print: true
          },
          collaboration: {
            realTime: true,
            multiUser: false, // Future feature
            versionControl: false // Future feature
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };
}

module.exports = new EnhancedPdfController();