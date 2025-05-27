const PDFDocument = require('pdfkit');
const fontkit = require('fontkit');
const fs = require('fs-extra');
const path = require('path');
const { EventEmitter } = require('events');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

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
    this.imageStorage = path.join(__dirname, '../../images');
    this.imageCache = new Map();
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
    await fs.ensureDir(this.imageStorage);
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
    
      console.log(`Generating PDF for document ${documentId} with ${document.pages.length} pages`);
    
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

      // Render each page - respecting the actual page structure from the document
      for (let i = 0; i < document.pages.length; i++) {
        console.log(`Adding page ${i + 1} of ${document.pages.length}`);
        if (i > 0) {
          pdfDoc.addPage({
            size: document.settings.size,
            margins: document.settings.margins
          });
        }
        await this.renderPage(pdfDoc, document.pages[i], document);
      }

    console.log(`PDF generation complete: ${document.pages.length} pages rendered`);
    return pdfDoc;
  }

  async renderPage(pdfDoc, page, document) {
    console.log(`Rendering page ${page.index || 0} with ${page.elements.length} elements`);
    
    // Set page background
    if (page.background && page.background.color !== '#ffffff') {
      pdfDoc.rect(0, 0, pdfDoc.page.width, pdfDoc.page.height)
             .fill(page.background.color);
    }

    // Sort elements by z-index and y-position for proper rendering order
    const sortedElements = [...page.elements].sort((a, b) => {
      const zDiff = (a.zIndex || 0) - (b.zIndex || 0);
      if (zDiff !== 0) return zDiff;
      return (a.bounds?.y || 0) - (b.bounds?.y || 0);
    });

    console.log(`Rendering ${sortedElements.length} elements on page ${page.index || 0}`);

    // Render each element using exact bounds and positioning
    for (const element of sortedElements) {
      if (!element.visible) continue;
      
      try {
        console.log(`Rendering element ${element.id} (${element.type}) at bounds:`, element.bounds);
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
    
    if (!bounds || !content) {
      console.warn('Skipping element with missing bounds or content:', element.id);
      return;
    }
    
    try {
      console.log(`Rendering text element at (${bounds.x}, ${bounds.y}) size ${bounds.width}x${bounds.height}`);
      
      // Detect if this is a header based on content
      const isHeader = this.detectHeaderLevel(content);
      let effectiveStyle = { ...style };
      
      if (isHeader.isHeader) {
        // Apply header styling
        const headerSizes = [20, 18, 16, 14, 12, 11]; // H1 to H6
        effectiveStyle.fontSize = headerSizes[Math.min(isHeader.level - 1, 5)];
        effectiveStyle.fontWeight = 'bold';
        console.log(`Detected header level ${isHeader.level}, using font size ${effectiveStyle.fontSize}`);
      }
      
      // Apply font with header consideration
      let fontName = effectiveStyle.fontFamily || 'Helvetica';
      if (effectiveStyle.fontWeight === 'bold') {
        fontName = fontName.includes('Bold') ? fontName : fontName + '-Bold';
      }
      
      if (effectiveStyle.fontFamily) {
        const fontData = this.fontCache.get(effectiveStyle.fontFamily);
        if (fontData && fontData.type === 'custom') {
          pdfDoc.registerFont(effectiveStyle.fontFamily, fontData.buffer);
        }
      }
      
      try {
        pdfDoc.font(fontName);
      } catch (fontError) {
        console.warn(`Font ${fontName} not found, using Helvetica`);
        pdfDoc.font('Helvetica');
      }

      // Apply text properties
      if (effectiveStyle.fontSize) pdfDoc.fontSize(effectiveStyle.fontSize);
      if (effectiveStyle.color) pdfDoc.fillColor(effectiveStyle.color);

      // Process and render content using exact bounds
      await this.renderFormattedTextContent(pdfDoc, content, bounds, effectiveStyle);
      
    } catch (error) {
      console.error('Error rendering text element:', error);
      // Fallback to basic text rendering with exact bounds
      const textOptions = {
        width: bounds.width,
        height: bounds.height,
        align: style.textAlign || 'left'
      };
      pdfDoc.font('Helvetica').fontSize(style.fontSize || 11);
      pdfDoc.text(content || '', bounds.x, bounds.y, textOptions);
    }
  }

  processContentForPDF(content) {
    if (!content || typeof content !== 'string') {
      return { text: '', hasFormatting: false };
    }

    // Process content while preserving structure for headers
    let processedText = content;
    
    // Handle LaTeX placeholders - convert to readable format
    processedText = processedText.replace(/\$\$([\s\S]*?)\$\$/g, '[MATH: $1]'); // Display math
    processedText = processedText.replace(/\\\[([\s\S]*?)\\\]/g, '[MATH: $1]'); // Display math
    processedText = processedText.replace(/\\\(([^)]+)\\\)/g, '[$1]'); // Inline math
    processedText = processedText.replace(/\$([^$\n]+)\$/g, (match, content) => {
      if (this.isLikelyMath(content)) {
        return `[${content}]`;
      }
      return match;
    });
    
    // DON'T remove headers - they're handled by detectHeaderLevel
    // Remove other markdown formatting but keep content readable
    processedText = processedText.replace(/\*\*([^*]+)\*\*/g, '$1'); // Bold
    processedText = processedText.replace(/__([^_]+)__/g, '$1'); // Bold
    processedText = processedText.replace(/\*([^*]+)\*/g, '$1'); // Italic
    processedText = processedText.replace(/_([^_]+)_/g, '$1'); // Italic
    processedText = processedText.replace(/~~([^~]+)~~/g, '$1'); // Strikethrough
    processedText = processedText.replace(/`([^`]+)`/g, '$1'); // Code
    
    return {
      text: processedText,
      hasFormatting: false
    };
  }

  detectHeaderLevel(content) {
    if (!content || typeof content !== 'string') {
      return { isHeader: false, level: 0 };
    }
    
    // Check for markdown headers
    const headerMatch = content.match(/^(#{1,6})\s+(.+)$/m);
    if (headerMatch) {
      return {
        isHeader: true,
        level: headerMatch[1].length,
        cleanContent: headerMatch[2]
      };
    }
    
    return { isHeader: false, level: 0 };
  }

  extractLatexSegments(text) {
    // Simplified LaTeX extraction - just return the text with LaTeX converted to readable format
    if (!text || typeof text !== 'string') {
      return { text: '', segments: [] };
    }
    
    let processedText = text;
    
    // Convert LaTeX to readable format in brackets
    processedText = processedText.replace(/\$\$([\s\S]*?)\$\$/g, (_, content) => {
      return `[MATH: ${content.trim()}]`;
    });
    
    processedText = processedText.replace(/\\\[([\s\S]*?)\\\]/g, (_, content) => {
      return `[MATH: ${content}]`;
    });
    
    processedText = processedText.replace(/\\\((.+?)\\\)/g, (_, content) => {
      return `[${content}]`;
    });
    
    processedText = processedText.replace(/\$([^$\n]+?)\$/g, (match, content) => {
      if (this.isLikelyMath(content)) {
        return `[${content}]`;
      }
      return match;
    });
    
    return { text: processedText, segments: [] };
  }

  isLikelyMath(content) {
    return content.includes('\\') || 
           content.match(/\\[a-zA-Z]+/) || 
           content.includes('{') || 
           content.includes('^') || 
           content.includes('_') ||
           content.match(/^[a-zA-Z]$/) ||
           content.match(/^[a-zA-Z][0-9]*$/) || 
           (content.match(/^[a-zA-Z]+$/) && content.length <= 3) ||
           content.includes('+') || content.includes('-') || content.includes('*') ||
           content.includes('/') || content.includes('=') || content.includes('<') ||
           content.includes('>');
  }

  processMarkdownForPDF(text) {
    // Simplified markdown processing - just clean the text
    if (!text || typeof text !== 'string') {
      return { text: '', formatting: [] };
    }
    
    let processedText = text;
    
    // Remove markdown syntax but keep content
    processedText = processedText.replace(/^#{1,6}\s+/gm, ''); // Headers
    processedText = processedText.replace(/\*\*([^*]+)\*\*/g, '$1'); // Bold
    processedText = processedText.replace(/__([^_]+)__/g, '$1'); // Bold  
    processedText = processedText.replace(/\*([^*]+)\*/g, '$1'); // Italic
    processedText = processedText.replace(/_([^_]+)_/g, '$1'); // Italic
    processedText = processedText.replace(/~~([^~]+)~~/g, '$1'); // Strikethrough
    processedText = processedText.replace(/`([^`]+)`/g, '$1'); // Code
    
    return { text: processedText, formatting: [] };
  }

  async renderFormattedTextContent(pdfDoc, content, bounds, style) {
    if (!content || typeof content !== 'string') {
      return;
    }
    
    try {
      // Process content to clean up markdown and LaTeX
      const processedContent = this.processContentForPDF(content);
      
      // Use exact bounds for precise positioning and sizing
      const textOptions = {
        width: bounds.width,
        height: bounds.height,
        align: style.textAlign || 'left',
        lineGap: style.lineHeight ? (style.lineHeight - 1) * (style.fontSize || 12) : undefined,
        ellipsis: false, // Don't truncate text
        continued: false
      };
      
      console.log(`Rendering text at (${bounds.x}, ${bounds.y}) with options:`, textOptions);
      console.log(`Text content (first 100 chars): ${(processedContent.text || content).substring(0, 100)}...`);
      
      // Render using exact positioning
      pdfDoc.text(processedContent.text || content, bounds.x, bounds.y, textOptions);
      
    } catch (error) {
      console.error('Error in renderFormattedTextContent:', error);
      // Final fallback - render with basic options using exact bounds
      const fallbackOptions = {
        width: bounds.width,
        height: bounds.height,
        align: style.textAlign || 'left'
      };
      pdfDoc.text(content, bounds.x, bounds.y, fallbackOptions);
    }
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
      } else if (content.url) {
        // Handle URL-based images by downloading and caching them
        const localImagePath = await this.downloadAndCacheImage(content.url);
        if (localImagePath) {
          pdfDoc.image(localImagePath, bounds.x, bounds.y, {
            width: bounds.width,
            height: bounds.height
          });
        } else {
          console.warn('Failed to download image from URL:', content.url);
        }
      }
    } catch (error) {
      console.error('Error rendering image:', error);
    }
  }

  /**
   * Download and cache image from URL
   */
  async downloadAndCacheImage(imageUrl) {
    try {
      console.log('EnhancedPdfService: downloadAndCacheImage called with URL:', imageUrl);
      
      // Create cache key from URL
      const urlHash = crypto.createHash('md5').update(imageUrl).digest('hex');
      const cacheKey = `image_${urlHash}`;
      
      console.log('EnhancedPdfService: Cache key generated:', cacheKey);
      
      // Check if already cached
      if (this.imageCache.has(cacheKey)) {
        const cachedPath = this.imageCache.get(cacheKey);
        console.log('EnhancedPdfService: Found cached entry, checking path:', cachedPath);
        if (await fs.pathExists(cachedPath)) {
          console.log('EnhancedPdfService: Using cached image:', cachedPath);
          return cachedPath;
        } else {
          console.log('EnhancedPdfService: Cached file no longer exists, removing from cache');
          this.imageCache.delete(cacheKey);
        }
      }

      console.log('EnhancedPdfService: Starting fresh download for URL:', imageUrl);
      
      // Determine file extension from URL or default to jpg
      const urlParts = imageUrl.split('.');
      const extension = urlParts.length > 1 ? urlParts[urlParts.length - 1].split('?')[0] : 'jpg';
      const fileName = `${cacheKey}.${extension}`;
      const localPath = path.join(this.imageStorage, fileName);

      // Download the image
      console.log('EnhancedPdfService: Attempting download to path:', localPath);
      const success = await this.downloadImage(imageUrl, localPath);
      
      console.log('EnhancedPdfService: Download result:', success);
      
      if (success) {
        // Verify file was actually created
        const fileExists = await fs.pathExists(localPath);
        const fileStats = fileExists ? await fs.stat(localPath) : null;
        
        console.log('EnhancedPdfService: File verification:', {
          exists: fileExists,
          size: fileStats ? fileStats.size : 0,
          path: localPath
        });
        
        if (fileExists && fileStats && fileStats.size > 0) {
          // Cache the path
          this.imageCache.set(cacheKey, localPath);
          console.log('EnhancedPdfService: Image downloaded and cached successfully:', localPath);
          return localPath;
        } else {
          console.error('EnhancedPdfService: Download succeeded but file is empty or missing');
          return null;
        }
      }
      
      console.error('EnhancedPdfService: Download failed for URL:', imageUrl);
      return null;
    } catch (error) {
      console.error('EnhancedPdfService: Error in downloadAndCacheImage:', {
        error: error.message,
        stack: error.stack,
        url: imageUrl
      });
      return null;
    }
  }

  /**
   * Download image from URL to local file
   */
  downloadImage(url, filePath) {
    return new Promise((resolve) => {
      const protocol = url.startsWith('https:') ? https : http;
      
      const request = protocol.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      }, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          console.log('EnhancedPdfService: Following redirect to:', response.headers.location);
          this.downloadImage(response.headers.location, filePath).then(resolve);
          return;
        }

        if (response.statusCode !== 200) {
          console.error('EnhancedPdfService: Failed to download image, status:', response.statusCode);
          console.error('EnhancedPdfService: Response headers:', response.headers);
          resolve(false);
          return;
        }

        console.log('EnhancedPdfService: Creating write stream to:', filePath);
        const fileStream = fs.createWriteStream(filePath);
        response.pipe(fileStream);

        let bytesWritten = 0;
        response.on('data', (chunk) => {
          bytesWritten += chunk.length;
        });

        fileStream.on('finish', () => {
          fileStream.close();
          console.log('EnhancedPdfService: Image download completed:', {
            filePath: filePath,
            bytesWritten: bytesWritten
          });
          resolve(true);
        });

        fileStream.on('error', (error) => {
          console.error('EnhancedPdfService: Error writing image file:', {
            error: error.message,
            filePath: filePath
          });
          fs.unlink(filePath).catch(() => {}); // Clean up on error
          resolve(false);
        });
      });

      request.on('error', (error) => {
        console.error('EnhancedPdfService: Error downloading image:', error);
        resolve(false);
      });

      // Set timeout for download
      request.setTimeout(30000, () => {
        console.error('EnhancedPdfService: Image download timeout');
        request.destroy();
        resolve(false);
      });
    });
  }

  /**
   * Convert image to base64 for embedding in PDFs
   */
  async imageToBase64(imagePath) {
    try {
      const imageBuffer = await fs.readFile(imagePath);
      const base64 = imageBuffer.toString('base64');
      const extension = path.extname(imagePath).toLowerCase();
      
      let mimeType = 'image/jpeg';
      if (extension === '.png') mimeType = 'image/png';
      else if (extension === '.gif') mimeType = 'image/gif';
      else if (extension === '.webp') mimeType = 'image/webp';
      
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      console.error('Error converting image to base64:', error);
      return null;
    }
  }

  /**
   * Process element for image URL handling
   */
  async processImageElement(element) {
    if (element.type === 'image' && element.content && element.content.url) {
      const localPath = await this.downloadAndCacheImage(element.content.url);
      if (localPath) {
        // Update element to use local path instead of URL
        element.content.path = localPath;
        element.content.cached = true;
        
        // Optionally convert to base64 for embedding
        const base64 = await this.imageToBase64(localPath);
        if (base64) {
          element.content.base64 = base64;
        }
      }
    }
    return element;
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