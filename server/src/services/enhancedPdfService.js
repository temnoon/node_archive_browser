const PDFDocument = require('pdfkit');
const fontkit = require('fontkit');
const fs = require('fs-extra');
const path = require('path');
const { EventEmitter } = require('events');

/**
 * Enhanced PDF Engine Service
 * Provides Adobe Acrobat-level PDF editing capabilities with real-time collaboration
 */
class EnhancedPdfService extends EventEmitter {
  constructor() {
    super();
    this.activeDocuments = new Map();
    this.fontCache = new Map();
    this.templateCache = new Map();
    this.documentStorage = path.join(__dirname, '../../documents');
    this.fontStorage = path.join(__dirname, '../../fonts');
    this.init();
  }

  async init() {
    await this.ensureDirectories();
    await this.loadSystemFonts();
    console.log('Enhanced PDF Service initialized');
  }

  async ensureDirectories() {
    await fs.ensureDir(this.documentStorage);
    await fs.ensureDir(this.fontStorage);
  }

  /**
   * Document Management
   */
  
  async createDocument(options = {}) {
    const documentId = this.generateId();
    const document = {
      id: documentId,
      version: '1.0',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      metadata: {
        title: options.title || 'Untitled Document',
        author: options.author || 'Archive Browser',
        subject: options.subject || '',
        keywords: options.keywords || []
      },
      settings: {
        size: options.size || 'A4',
        orientation: options.orientation || 'portrait',
        margins: options.margins || { top: 72, right: 72, bottom: 72, left: 72 },
        units: options.units || 'points'
      },
      pages: [],
      styles: {
        fonts: [],
        colors: [],
        gradients: [],
        themes: []
      },
      collaborators: []
    };

    // Create initial page
    const firstPage = this.createPage(document.settings);
    document.pages.push(firstPage);

    this.activeDocuments.set(documentId, document);
    await this.saveDocument(document);

    this.emit('document-created', { documentId, document });
    return document;
  }

  async loadDocument(documentId) {
    if (this.activeDocuments.has(documentId)) {
      return this.activeDocuments.get(documentId);
    }

    try {
      const documentPath = path.join(this.documentStorage, `${documentId}.json`);
      const documentData = await fs.readJSON(documentPath);
      this.activeDocuments.set(documentId, documentData);
      
      this.emit('document-loaded', { documentId, document: documentData });
      return documentData;
    } catch (error) {
      throw new Error(`Failed to load document ${documentId}: ${error.message}`);
    }
  }

  async saveDocument(document) {
    document.modified = new Date().toISOString();
    const documentPath = path.join(this.documentStorage, `${document.id}.json`);
    await fs.writeJSON(documentPath, document, { spaces: 2 });
    
    this.emit('document-saved', { documentId: document.id, document });
    return document;
  }

  async deleteDocument(documentId) {
    const documentPath = path.join(this.documentStorage, `${documentId}.json`);
    await fs.remove(documentPath);
    this.activeDocuments.delete(documentId);
    
    this.emit('document-deleted', { documentId });
  }

  /**
   * Page Management
   */

  createPage(settings = {}) {
    const pageId = this.generateId();
    return {
      id: pageId,
      size: settings.size || 'A4',
      orientation: settings.orientation || 'portrait',
      margins: settings.margins || { top: 72, right: 72, bottom: 72, left: 72 },
      background: settings.background || { color: '#ffffff' },
      elements: [],
      grid: {
        enabled: false,
        size: 12,
        color: '#e0e0e0',
        snap: true
      },
      guides: []
    };
  }

  async addPage(documentId, pageSettings = {}) {
    const document = await this.loadDocument(documentId);
    const newPage = this.createPage(pageSettings);
    document.pages.push(newPage);
    
    await this.saveDocument(document);
    this.emit('page-added', { documentId, pageId: newPage.id, page: newPage });
    
    return newPage;
  }

  async deletePage(documentId, pageId) {
    const document = await this.loadDocument(documentId);
    const pageIndex = document.pages.findIndex(page => page.id === pageId);
    
    if (pageIndex === -1) {
      throw new Error(`Page ${pageId} not found`);
    }

    if (document.pages.length === 1) {
      throw new Error('Cannot delete the last page');
    }

    document.pages.splice(pageIndex, 1);
    await this.saveDocument(document);
    
    this.emit('page-deleted', { documentId, pageId });
  }

  /**
   * Element Management
   */

  async addElement(documentId, pageId, elementData) {
    const document = await this.loadDocument(documentId);
    const page = this.getPageById(document, pageId);
    
    const element = {
      id: this.generateId(),
      type: elementData.type,
      bounds: elementData.bounds,
      style: elementData.style || {},
      content: elementData.content,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      zIndex: elementData.zIndex || page.elements.length,
      locked: false,
      visible: true
    };

    page.elements.push(element);
    await this.saveDocument(document);
    
    this.emit('element-added', { documentId, pageId, elementId: element.id, element });
    return element;
  }

  async updateElement(documentId, pageId, elementId, updates) {
    const document = await this.loadDocument(documentId);
    const page = this.getPageById(document, pageId);
    const element = page.elements.find(el => el.id === elementId);
    
    if (!element) {
      throw new Error(`Element ${elementId} not found`);
    }

    Object.assign(element, updates);
    element.modified = new Date().toISOString();
    
    await this.saveDocument(document);
    this.emit('element-updated', { documentId, pageId, elementId, element, updates });
    
    return element;
  }

  async deleteElement(documentId, pageId, elementId) {
    const document = await this.loadDocument(documentId);
    const page = this.getPageById(document, pageId);
    const elementIndex = page.elements.findIndex(el => el.id === elementId);
    
    if (elementIndex === -1) {
      throw new Error(`Element ${elementId} not found`);
    }

    page.elements.splice(elementIndex, 1);
    await this.saveDocument(document);
    
    this.emit('element-deleted', { documentId, pageId, elementId });
  }

  /**
   * Font Management
   */

  async loadSystemFonts() {
    try {
      const systemFonts = [
        'Helvetica',
        'Times-Roman',
        'Courier',
        'Symbol',
        'ZapfDingbats'
      ];

      systemFonts.forEach(fontName => {
        this.fontCache.set(fontName, {
          name: fontName,
          type: 'system',
          loaded: true,
          variants: ['regular']
        });
      });

      console.log(`Loaded ${systemFonts.length} system fonts`);
    } catch (error) {
      console.error('Error loading system fonts:', error);
    }
  }

  async loadWebFont(fontFamily, variants = ['regular']) {
    if (this.fontCache.has(fontFamily)) {
      return this.fontCache.get(fontFamily);
    }

    try {
      // Google Fonts API integration would go here
      const fontData = {
        name: fontFamily,
        type: 'web',
        loaded: true,
        variants: variants,
        url: `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, '+')}`
      };

      this.fontCache.set(fontFamily, fontData);
      return fontData;
    } catch (error) {
      throw new Error(`Failed to load web font ${fontFamily}: ${error.message}`);
    }
  }

  async embedCustomFont(fontBuffer, fontName) {
    try {
      const font = fontkit.create(fontBuffer);
      const fontData = {
        name: fontName,
        type: 'custom',
        loaded: true,
        buffer: fontBuffer,
        metrics: {
          unitsPerEm: font.unitsPerEm,
          ascent: font.ascent,
          descent: font.descent,
          lineGap: font.lineGap
        }
      };

      this.fontCache.set(fontName, fontData);
      
      // Save font to storage
      const fontPath = path.join(this.fontStorage, `${fontName}.ttf`);
      await fs.writeFile(fontPath, fontBuffer);
      
      return fontData;
    } catch (error) {
      throw new Error(`Failed to embed custom font: ${error.message}`);
    }
  }

  getAvailableFonts() {
    return Array.from(this.fontCache.values());
  }

  /**
   * Real-time Editing Operations
   */

  async applyEdit(documentId, operation) {
    const document = await this.loadDocument(documentId);
    
    switch (operation.type) {
      case 'add-element':
        return await this.addElement(documentId, operation.pageId, operation.data);
      
      case 'update-element':
        return await this.updateElement(documentId, operation.pageId, operation.elementId, operation.updates);
      
      case 'delete-element':
        return await this.deleteElement(documentId, operation.pageId, operation.elementId);
      
      case 'add-page':
        return await this.addPage(documentId, operation.data);
      
      case 'delete-page':
        return await this.deletePage(documentId, operation.pageId);
      
      case 'update-document':
        Object.assign(document, operation.updates);
        return await this.saveDocument(document);
      
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  /**
   * PDF Generation and Export
   */

  async generatePDF(documentId, options = {}) {
    const document = await this.loadDocument(documentId);
    
    const pdfDoc = new PDFDocument({
      size: document.settings.size,
      margins: document.settings.margins,
      info: {
        Title: document.metadata.title,
        Author: document.metadata.author,
        Subject: document.metadata.subject,
        Keywords: document.metadata.keywords.join(', '),
        Creator: 'Archive Browser Enhanced PDF Editor',
        Producer: 'Enhanced PDF Service'
      }
    });

    // Render each page
    for (let i = 0; i < document.pages.length; i++) {
      if (i > 0) pdfDoc.addPage();
      await this.renderPage(pdfDoc, document.pages[i], document);
    }

    return pdfDoc;
  }

  async renderPage(pdfDoc, page, document) {
    // Set page background
    if (page.background && page.background.color !== '#ffffff') {
      pdfDoc.rect(0, 0, pdfDoc.page.width, pdfDoc.page.height)
             .fill(page.background.color);
    }

    // Sort elements by z-index
    const sortedElements = [...page.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    // Render each element
    for (const element of sortedElements) {
      if (!element.visible) continue;
      
      try {
        await this.renderElement(pdfDoc, element, document);
      } catch (error) {
        console.error(`Error rendering element ${element.id}:`, error);
      }
    }
  }

  async renderElement(pdfDoc, element, document) {
    const { bounds, style } = element;

    switch (element.type) {
      case 'text':
        await this.renderTextElement(pdfDoc, element);
        break;
      
      case 'shape':
        await this.renderShapeElement(pdfDoc, element);
        break;
      
      case 'image':
        await this.renderImageElement(pdfDoc, element);
        break;
      
      case 'line':
        await this.renderLineElement(pdfDoc, element);
        break;
      
      default:
        console.warn(`Unknown element type: ${element.type}`);
    }
  }

  async renderTextElement(pdfDoc, element) {
    const { bounds, style, content } = element;
    
    // Apply font
    if (style.fontFamily) {
      const fontData = this.fontCache.get(style.fontFamily);
      if (fontData && fontData.type === 'custom') {
        pdfDoc.registerFont(style.fontFamily, fontData.buffer);
      }
      pdfDoc.font(style.fontFamily);
    }

    // Apply text properties
    if (style.fontSize) pdfDoc.fontSize(style.fontSize);
    if (style.color) pdfDoc.fillColor(style.color);

    // Render text
    const textOptions = {
      width: bounds.width,
      height: bounds.height,
      align: style.textAlign || 'left',
      lineGap: style.lineHeight ? (style.lineHeight - 1) * style.fontSize : undefined
    };

    pdfDoc.text(content, bounds.x, bounds.y, textOptions);
  }

  async renderShapeElement(pdfDoc, element) {
    const { bounds, style } = element;
    
    switch (element.content.shape) {
      case 'rectangle':
        pdfDoc.rect(bounds.x, bounds.y, bounds.width, bounds.height);
        break;
      
      case 'circle':
        const centerX = bounds.x + bounds.width / 2;
        const centerY = bounds.y + bounds.height / 2;
        const radius = Math.min(bounds.width, bounds.height) / 2;
        pdfDoc.circle(centerX, centerY, radius);
        break;
      
      case 'ellipse':
        const ellipseCenterX = bounds.x + bounds.width / 2;
        const ellipseCenterY = bounds.y + bounds.height / 2;
        pdfDoc.ellipse(ellipseCenterX, ellipseCenterY, bounds.width / 2, bounds.height / 2);
        break;
    }

    // Apply styling
    if (style.fill) {
      pdfDoc.fillColor(style.fill);
      if (style.stroke) {
        pdfDoc.fillAndStroke();
      } else {
        pdfDoc.fill();
      }
    } else if (style.stroke) {
      pdfDoc.strokeColor(style.stroke);
      if (style.strokeWidth) pdfDoc.lineWidth(style.strokeWidth);
      pdfDoc.stroke();
    }
  }

  async renderImageElement(pdfDoc, element) {
    const { bounds, content } = element;
    
    try {
      if (content.buffer) {
        pdfDoc.image(content.buffer, bounds.x, bounds.y, {
          width: bounds.width,
          height: bounds.height
        });
      } else if (content.path) {
        pdfDoc.image(content.path, bounds.x, bounds.y, {
          width: bounds.width,
          height: bounds.height
        });
      }
    } catch (error) {
      console.error('Error rendering image:', error);
    }
  }

  async renderLineElement(pdfDoc, element) {
    const { bounds, style, content } = element;
    
    pdfDoc.moveTo(bounds.x, bounds.y);
    
    if (content.points && content.points.length > 1) {
      content.points.forEach(point => {
        pdfDoc.lineTo(point.x, point.y);
      });
    } else {
      pdfDoc.lineTo(bounds.x + bounds.width, bounds.y + bounds.height);
    }

    if (style.stroke) pdfDoc.strokeColor(style.stroke);
    if (style.strokeWidth) pdfDoc.lineWidth(style.strokeWidth);
    
    pdfDoc.stroke();
  }

  /**
   * Template System
   */

  async createTemplate(name, templateData) {
    const template = {
      id: this.generateId(),
      name,
      created: new Date().toISOString(),
      ...templateData
    };

    this.templateCache.set(name, template);
    
    const templatePath = path.join(this.documentStorage, 'templates', `${template.id}.json`);
    await fs.ensureDir(path.dirname(templatePath));
    await fs.writeJSON(templatePath, template, { spaces: 2 });
    
    return template;
  }

  async applyTemplate(documentId, templateName, data = {}) {
    const document = await this.loadDocument(documentId);
    const template = this.templateCache.get(templateName);
    
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }

    // Apply template logic here
    // This would involve replacing placeholders with actual data
    // and applying template styles to the document
    
    await this.saveDocument(document);
    this.emit('template-applied', { documentId, templateName, data });
    
    return document;
  }

  /**
   * Utility Methods
   */

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  getPageById(document, pageId) {
    const page = document.pages.find(p => p.id === pageId);
    if (!page) {
      throw new Error(`Page ${pageId} not found`);
    }
    return page;
  }

  async getDocumentState(documentId) {
    const document = await this.loadDocument(documentId);
    return {
      id: document.id,
      metadata: document.metadata,
      settings: document.settings,
      pageCount: document.pages.length,
      elementCount: document.pages.reduce((total, page) => total + page.elements.length, 0),
      lastModified: document.modified
    };
  }

  /**
   * Export Methods
   */

  async exportToBuffer(documentId, format = 'pdf') {
    switch (format) {
      case 'pdf':
        const pdfDoc = await this.generatePDF(documentId);
        return new Promise((resolve, reject) => {
          const chunks = [];
          pdfDoc.on('data', chunk => chunks.push(chunk));
          pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
          pdfDoc.on('error', reject);
          pdfDoc.end();
        });
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  async exportToFile(documentId, filePath, format = 'pdf') {
    const buffer = await this.exportToBuffer(documentId, format);
    await fs.writeFile(filePath, buffer);
    return filePath;
  }
}

module.exports = EnhancedPdfService;