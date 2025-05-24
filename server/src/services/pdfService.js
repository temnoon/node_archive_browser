const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs-extra');
const handlebars = require('handlebars');

// Import markdown parser for converting markdown to HTML
const { parseMarkdownGFM } = require('../markdown-gfm');

/**
 * PDF Service for generating PDFs from conversation data
 * Uses Puppeteer to render HTML templates with MathJax support
 */
class PDFService {
  constructor() {
    this.templateCache = new Map();
    this.browser = null;
  }

  /**
   * Initialize Puppeteer browser instance
   */
  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--allow-running-insecure-content',
          '--disable-features=VizDisplayCompositor', // Help with rendering issues
          '--disable-background-timer-throttling',   // Prevent timer throttling
          '--disable-renderer-backgrounding',        // Keep renderer active
          '--disable-backgrounding-occluded-windows', // Keep windows active
          // Enhanced PDF generation flags for better Adobe compatibility
          '--enable-print-browser',                   // Enable print mode
          '--disable-gpu',                           // Disable GPU for consistent rendering
          '--run-all-compositor-stages-before-draw', // Ensure complete rendering
          '--disable-background-media-suspend',      // Keep media active
          '--disable-extensions'                     // Disable extensions for cleaner output
        ],
        timeout: 30000 // Increase browser launch timeout
      });
    }
    return this.browser;
  }

  /**
   * Close browser instance
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Wait for MathJax to finish rendering with robust error handling
   */
  async waitForMathJax(page) {
    try {
      console.log('Waiting for MathJax to load and render...');
      
      // Wait for the page's own MathJax ready flag (set by template script)
      const mathJaxStartTime = Date.now();
      await page.waitForFunction(() => {
        return window.mathjaxReady === true;
      }, { timeout: 15000 }); // Increased timeout to 15 seconds
      console.log(`MathJax ready flag detected in ${Date.now() - mathJaxStartTime}ms`);
      
      console.log('Page reports MathJax is ready');
      
      // Additional check to ensure MathJax actually rendered if it's available
      const mathJaxStatus = await page.evaluate(() => {
        if (window.MathJax && window.MathJax.typesetPromise) {
          return { available: true, hasError: window.mathJaxLoadError || false };
        }
        return { available: false, hasError: false };
      });
      
      if (mathJaxStatus.available && !mathJaxStatus.hasError) {
        console.log('MathJax is available and loaded successfully');
      } else if (mathJaxStatus.hasError) {
        console.warn('MathJax CDN load error detected, but page is ready');
      } else {
        console.log('MathJax not available, continuing without LaTeX rendering');
      }
      
    } catch (mathJaxError) {
      console.warn('MathJax ready timeout, proceeding without LaTeX rendering:', mathJaxError.message);
      
      // Try to check if any LaTeX content exists that might need rendering
      try {
        const hasLatex = await page.evaluate(() => {
          const latexElements = document.querySelectorAll('.MathJax, [class*="math"], script[type="math/tex"], [data-latex]');
          return latexElements.length > 0;
        });
        
        if (hasLatex) {
          console.warn('LaTeX content detected but MathJax failed to render properly');
        } else {
          console.log('No LaTeX content detected, proceeding normally');
        }
      } catch (e) {
        console.warn('Could not check for LaTeX content:', e.message);
      }
      
      // Continue without MathJax - the PDF will still be generated but without LaTeX rendering
    }
  }

  /**
   * Load and compile Handlebars template
   */
  async loadTemplate(templateName) {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName);
    }

    // Register Handlebars helpers if not already registered
    if (!handlebars.helpers.eq) {
      handlebars.registerHelper('eq', function(a, b) {
        return a === b;
      });
      console.log('Registered Handlebars "eq" helper');
    }

    const templatePath = path.join(__dirname, '../templates', `${templateName}.hbs`);
    const templateContent = await fs.readFile(templatePath, 'utf8');
    const compiledTemplate = handlebars.compile(templateContent);
    
    this.templateCache.set(templateName, compiledTemplate);
    return compiledTemplate;
  }

  /**
   * Process message content for PDF rendering
   */
  processMessageContent(message, mediaBaseUrl) {
    // Extract content similar to frontend messageUtils
    const content = this.extractMessageContent(message);
    
    // Process media URLs to be absolute
    if (content.mediaRefs) {
      content.mediaRefs = content.mediaRefs.map(media => ({
        ...media,
        url: `${mediaBaseUrl}/${media.filename}`
      }));
    }

    return content;
  }

  /**
   * Check if a string is a file ID that should be filtered out
   * Handles both individual and grouped file IDs
   */
  isFileIdString(str) {
    if (!str || typeof str !== 'string') return false;
    
    const trimmed = str.trim();
    
    // Pattern 1: Single file ID
    if (/^file-[a-zA-Z0-9]+$/.test(trimmed)) {
      return true;
    }
    
    // Pattern 2: Multiple file IDs separated by spaces or newlines
    // e.g., "file-ABC file-DEF file-GHI file-JKL"
    if (/^(file-[a-zA-Z0-9]+[\s\n]*)+$/.test(trimmed)) {
      return true;
    }
    
    // Pattern 3: File IDs with various separators
    // Split by whitespace and check if all parts are file IDs
    const parts = trimmed.split(/\s+/).filter(part => part.length > 0);
    if (parts.length > 0 && parts.every(part => /^file-[a-zA-Z0-9]+$/.test(part))) {
      return true;
    }
    
    return false;
  }

  /**
   * Clean file IDs from text content comprehensively
   * Handles multiple file IDs grouped together, standalone file IDs, and inline file IDs
   */
  cleanFileIds(text) {
    if (!text || typeof text !== 'string') return text;
    
    // Pattern 1: Remove lines that contain only file IDs (possibly multiple, space-separated)
    // Matches: "file-ABC123 file-DEF456 file-GHI789"
    const multipleFileIdPattern = /^\s*(file-[a-zA-Z0-9]+\s*)+$/gm;
    let cleanedText = text.replace(multipleFileIdPattern, '');
    
    // Pattern 2: Remove individual file IDs that appear as standalone lines
    const standaloneFileIdPattern = /^\s*file-[a-zA-Z0-9]+\s*$/gm;
    cleanedText = cleanedText.replace(standaloneFileIdPattern, '');
    
    // Pattern 3: Remove file IDs that appear inline within text (more aggressive)
    const inlineFileIdPattern = /\bfile-[a-zA-Z0-9]+\b/g;
    cleanedText = cleanedText.replace(inlineFileIdPattern, '');
    
    // Pattern 4: Clean up lines that became empty or contain only whitespace after file ID removal
    cleanedText = cleanedText.replace(/^\s*$/gm, '');
    
    // Pattern 5: Clean up multiple consecutive newlines (but preserve paragraph breaks)
    cleanedText = cleanedText.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    // Pattern 6: Remove leading/trailing whitespace
    return cleanedText.trim();
  }

  /**
   * Extract message content (server-side version of extractMessageContent)
   */
  extractMessageContent(message) {
    if (!message || !message.content) {
      return { text: '', mediaRefs: [], segments: [], canvasIds: [] };
    }
    
    const content = message.content;
    const mediaRefs = [];
    let textContent = '';
    
    // Check for canvas IDs
    const canvasIds = [];
    if (message.metadata && message.metadata.canvas_id) {
      canvasIds.push(message.metadata.canvas_id);
    }
    
    if (content.content_type === 'canvas' && content.canvas_id) {
      canvasIds.push(content.canvas_id);
    }

    // Process content based on type
    if (content.content_type === 'text') {
      // Filter out file ID strings before joining
      const filteredParts = Array.isArray(content.parts) 
        ? content.parts.filter(part => {
            if (typeof part === 'string') {
              return !this.isFileIdString(part);
            }
            return true;
          })
        : [];
      
      let rawText = filteredParts.join('\n\n');
      
      // Apply additional cleaning as a safety net
      rawText = this.cleanFileIds(rawText);
      
      textContent = parseMarkdownGFM(rawText); // Convert markdown to HTML
    } 
    else if (content.content_type === 'multimodal_text') {
      let combinedText = '';
      
      if (Array.isArray(content.parts)) {
        content.parts.forEach(part => {
          if (typeof part === 'string') {
            // Filter out file ID strings before adding to combined text
            if (!this.isFileIdString(part)) {
              combinedText += part + '\n\n';
            }
          } else if (part && typeof part === 'object') {
            // Handle text transcriptions
            if (part.content_type === 'audio_transcription' && part.text) {
              combinedText += part.text + '\n\n';
            }
            
            // Handle media assets
            if (part.content_type === 'image_asset_pointer' && part.asset_pointer) {
              const fileMatch = part.asset_pointer.match(/([^/\\]+)$/);
              if (fileMatch) {
                const fileId = fileMatch[1];
                mediaRefs.push({
                  type: 'image',
                  filename: fileId,
                  width: part.width,
                  height: part.height
                });
              }
            }
            
            // Handle audio assets
            if ((part.content_type === 'audio_asset_pointer' || 
                 (part.audio_asset_pointer && part.audio_asset_pointer.asset_pointer))) {
              
              const assetPointer = part.asset_pointer || 
                                  (part.audio_asset_pointer && part.audio_asset_pointer.asset_pointer);
              
              if (assetPointer) {
                const fileMatch = assetPointer.match(/([^/\\]+)$/);
                if (fileMatch) {
                  const fileId = fileMatch[1];
                  mediaRefs.push({
                    type: 'audio',
                    filename: fileId,
                    duration: part.metadata?.end || 
                             (part.audio_asset_pointer && part.audio_asset_pointer.metadata?.end) || 0
                  });
                }
              }
            }
          }
        });
      }
      
      // Apply comprehensive file ID cleaning to combined text
      combinedText = this.cleanFileIds(combinedText);
      
      textContent = parseMarkdownGFM(combinedText.trim()); // Convert markdown to HTML
    }
    else if (content.content_type === 'code') {
      const language = content.language || '';
      const codeText = content.text || '';
      textContent = '```' + language + '\n' + codeText + '\n```';
    }

    // Handle attachments in metadata
    if (message.metadata && message.metadata.attachments && Array.isArray(message.metadata.attachments)) {
      message.metadata.attachments.forEach(attachment => {
        if (!attachment.id) return;
        
        let type = 'unknown';
        if (attachment.mime_type) {
          if (attachment.mime_type.startsWith('image/')) type = 'image';
          else if (attachment.mime_type.startsWith('audio/')) type = 'audio';
          else if (attachment.mime_type.startsWith('video/')) type = 'video';
        }
        
        mediaRefs.push({
          type,
          filename: attachment.id,
          originalName: attachment.name,
          width: attachment.width,
          height: attachment.height
        });
      });
    }

    return { 
      text: this.cleanFileIds(textContent.trim()), // Final cleaning pass
      mediaRefs,
      segments: [], // LaTeX processing will be handled by MathJax in the template
      canvasIds
    };
  }

  /**
   * Generate PDF from conversation data
   */
  async generatePDF(options) {
    const {
      messages,
      title,
      layout = {
        format: 'A4',
        margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' }
      },
      style = {
        fontFamily: 'Times, serif',
        fontSize: '12pt',
        includeHeaders: true,
        includePageNumbers: true
      },
      filter = {
        includeToolMessages: false,
        includeSystemMessages: false,
        roles: ['user', 'assistant']
      },
      mediaBaseUrl = 'http://localhost:3001/api/media',
      conversationFolder = ''
    } = options;

    console.log('=== PDF Generation Started ===');
    console.log('Title:', title);
    console.log('Messages count:', messages?.length || 0);
    
    let browser, page;
    try {
      console.log('Initializing browser...');
      browser = await this.initBrowser();
      console.log('Browser initialized, creating new page...');
      page = await browser.newPage();
      console.log('Page created successfully');
      // Process messages according to filter
      const filteredMessages = this.filterMessages(messages, filter);
      
      // Process message content for rendering
      const processedMessages = filteredMessages.map(msg => ({
        ...msg,
        content: this.processMessageContent(msg.message, `${mediaBaseUrl}/${conversationFolder}`),
        role: msg.message?.author?.role || 'unknown',
        timestamp: msg.message?.create_time ? new Date(msg.message.create_time * 1000) : null,
        model: msg.message?.metadata?.model_slug || null
      }));

      // Load and render template
      const template = await this.loadTemplate('conversation');
      const html = template({
        title,
        messages: processedMessages,
        style,
        layout,
        generated: new Date(),
        totalMessages: processedMessages.length
      });

      // Set content and wait for LaTeX to render
      console.log('Setting page content and waiting for network idle...');
      const contentStartTime = Date.now();
      await page.setContent(html, { 
        waitUntil: 'networkidle0',
        timeout: 45000 // Increased timeout to 45 seconds for content loading
      });
      console.log(`Page content loaded, network idle detected in ${Date.now() - contentStartTime}ms`);
      
      // Wait for MathJax to finish rendering with better error handling
      await this.waitForMathJax(page);
      
      // Additional wait to ensure all content is rendered
      await new Promise(resolve => setTimeout(resolve, 500)); // Use standard setTimeout instead

      // Generate PDF
      console.log('Generating PDF with options:', {
        format: layout.format,
        margin: layout.margin,
        printBackground: true,
        preferCSSPageSize: false,
        displayHeaderFooter: style.includeHeaders || style.includePageNumbers
      });
      
      const pdfBuffer = await page.pdf({
        format: layout.format,
        margin: layout.margin,
        printBackground: true,
        preferCSSPageSize: false,
        displayHeaderFooter: style.includeHeaders || style.includePageNumbers,
        headerTemplate: style.includeHeaders ? this.getHeaderTemplate(title) : '',
        footerTemplate: style.includePageNumbers ? this.getFooterTemplate() : '',
        // Enhanced options for Adobe Acrobat compatibility
        tagged: true,             // Enable tagged PDF for accessibility
        outline: false,           // Disable outline for better compatibility
        width: undefined,         // Let format define width
        height: undefined,        // Let format define height
        landscape: false,         // Ensure portrait orientation
        pageRanges: '',          // Generate all pages
        timeout: 30000           // 30 second timeout for PDF generation
      });

      console.log('PDF generated successfully. Buffer size:', pdfBuffer.length, 'bytes');
      console.log('PDF buffer type:', typeof pdfBuffer);
      console.log('PDF buffer is Buffer?', Buffer.isBuffer(pdfBuffer));
      
      // Validate PDF buffer
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('Generated PDF buffer is empty');
      }
      
      // Check PDF header
      const header = pdfBuffer.slice(0, 8).toString();
      console.log('PDF header:', header);
      if (!header.startsWith('%PDF-')) {
        console.warn('Warning: PDF buffer does not start with %PDF- header');
        console.log('First 50 bytes:', pdfBuffer.slice(0, 50).toString());
      }
      
      return pdfBuffer;

    } catch (error) {
      console.error('=== PDF Generation Error ===');
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      throw error; // Re-throw with original error info
    } finally {
      console.log('Cleaning up page...');
      if (page) {
        await page.close();
      }
      console.log('=== PDF Generation Ended ===');
    }
  }

  /**
   * Filter messages based on criteria
   */
  filterMessages(messages, filter) {
    if (!Array.isArray(messages)) return [];

    return messages.filter(msg => {
      const role = msg.message?.author?.role;
      
      // Filter by role
      if (filter.roles && !filter.roles.includes(role)) {
        return false;
      }
      
      // Filter tool messages
      if (!filter.includeToolMessages && role === 'tool') {
        return false;
      }
      
      // Filter system messages
      if (!filter.includeSystemMessages && role === 'system') {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Get header template for PDF
   */
  getHeaderTemplate(title) {
    return `
      <div style="font-size: 10px; width: 100%; text-align: center; margin: 0 1in;">
        <span>${title || 'Conversation Export'}</span>
      </div>
    `;
  }

  /**
   * Get footer template for PDF
   */
  getFooterTemplate() {
    return `
      <div style="font-size: 10px; width: 100%; text-align: center; margin: 0 1in;">
        <span class="pageNumber"></span> of <span class="totalPages"></span>
      </div>
    `;
  }

  /**
   * Generate PDF with no media template (for debugging)
   */
  async generateDebugPDF(options) {
    console.log('=== DEBUG PDF Generation Started (No Media) ===');
    
    let browser, page;
    try {
      browser = await this.initBrowser();
      page = await browser.newPage();
      
      // Process messages according to filter
      const filteredMessages = this.filterMessages(options.messages, options.filter);
      
      // Process message content for rendering
      const processedMessages = filteredMessages.map(msg => ({
        ...msg,
        content: this.processMessageContent(msg.message, options.mediaBaseUrl || ''),
        role: msg.message?.author?.role || 'unknown',
        timestamp: msg.message?.create_time ? new Date(msg.message.create_time * 1000) : null,
        model: msg.message?.metadata?.model_slug || null
      }));

      // Load debug template (no media)
      const template = await this.loadTemplate('debug-no-media');
      const html = template({
        title: options.title || 'Debug Conversation',
        messages: processedMessages,
        style: options.style || { fontFamily: 'Times, serif', fontSize: '12pt' },
        layout: options.layout || {},
        generated: new Date(),
        totalMessages: processedMessages.length
      });

      console.log('Setting debug page content...');
      await page.setContent(html, { 
        waitUntil: 'networkidle0',
        timeout: 45000
      });
      console.log('Debug page content loaded');
      
      // Wait for MathJax
      await this.waitForMathJax(page);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Generate PDF with enhanced options
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' },
        printBackground: true,
        // Enhanced options for Adobe Acrobat compatibility
        tagged: true,
        outline: false,
        landscape: false,
        timeout: 30000
      });

      console.log('Debug PDF generated successfully. Buffer size:', pdfBuffer.length, 'bytes');
      return pdfBuffer;
      
    } catch (error) {
      console.error('Debug PDF generation error:', error.message);
      throw error;
    } finally {
      if (page) await page.close();
      console.log('=== DEBUG PDF Generation Ended ===');
    }
  }

  /**
   * Generate PDF with simplified template (for debugging)
   */
  async generateSimplePDF(options) {
    console.log('=== Simple PDF Generation Started ===');
    
    let browser, page;
    try {
      browser = await this.initBrowser();
      page = await browser.newPage();
      
      // Process messages with minimal processing
      const filteredMessages = this.filterMessages(options.messages, options.filter);
      const processedMessages = filteredMessages.map(msg => ({
        ...msg,
        content: { text: msg.message?.content?.parts?.[0] || 'No content' },
        role: msg.message?.author?.role || 'unknown',
        timestamp: msg.message?.create_time ? new Date(msg.message.create_time * 1000) : null
      }));

      // Load simple template
      const template = await this.loadTemplate('simple-conversation');
      const html = template({
        title: options.title || 'Test Conversation',
        messages: processedMessages,
        style: options.style || { fontFamily: 'Arial, sans-serif', fontSize: '12pt' },
        generated: new Date(),
        totalMessages: processedMessages.length
      });

      console.log('Setting simple page content...');
      await page.setContent(html, { 
        waitUntil: 'networkidle0',
        timeout: 45000
      });
      console.log('Simple page content loaded');
      
      // Wait for simple ready flag
      await page.waitForFunction(() => {
        return window.mathjaxReady === true;
      }, { timeout: 5000 });
      console.log('Simple template ready');
      
      // Generate PDF with enhanced options
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' },
        printBackground: true,
        // Enhanced options for Adobe Acrobat compatibility
        tagged: true,
        outline: false,
        landscape: false,
        timeout: 30000
      });

      console.log('Simple PDF generated successfully');
      return pdfBuffer;
      
    } catch (error) {
      console.error('Simple PDF generation error:', error.message);
      throw error;
    } finally {
      if (page) await page.close();
      console.log('=== Simple PDF Generation Ended ===');
    }
  }

  /**
   * Generate multiple conversation PDFs in a single document
   */
  async generateMultiConversationPDF(conversations, options = {}) {
    const browser = await this.initBrowser();
    const page = await browser.newPage();

    try {
      // Load template for multiple conversations
      const template = await this.loadTemplate('multi-conversation');
      
      // Process each conversation
      const processedConversations = conversations.map(conv => ({
        ...conv,
        messages: conv.messages.map(msg => ({
          ...msg,
          content: this.processMessageContent(msg.message, `${options.mediaBaseUrl}/${conv.folder || ''}`),
          role: msg.message?.author?.role || 'unknown',
          timestamp: msg.message?.create_time ? new Date(msg.message.create_time * 1000) : null
        }))
      }));

      const html = template({
        conversations: processedConversations,
        style: options.style || {},
        layout: options.layout || {},
        generated: new Date()
      });

      console.log('Setting multi-conversation page content...');
      const contentStartTime = Date.now();
      await page.setContent(html, { 
        waitUntil: 'networkidle0',
        timeout: 45000 // Increased timeout to 45 seconds
      });
      console.log(`Multi-conversation page content loaded in ${Date.now() - contentStartTime}ms`);
      
      // Wait for MathJax to finish rendering
      await this.waitForMathJax(page);

      await new Promise(resolve => setTimeout(resolve, 1000)); // Use standard setTimeout instead

      const pdfBuffer = await page.pdf({
        format: options.layout?.format || 'A4',
        margin: options.layout?.margin || { top: '1in', right: '1in', bottom: '1in', left: '1in' },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: this.getHeaderTemplate('Multiple Conversations Export'),
        footerTemplate: this.getFooterTemplate(),
        // Enhanced options for Adobe Acrobat compatibility
        tagged: true,
        outline: false,
        landscape: false,
        timeout: 30000
      });

      return pdfBuffer;

    } finally {
      await page.close();
    }
  }
}

module.exports = new PDFService();
