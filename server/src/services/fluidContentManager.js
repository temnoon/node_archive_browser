const PDFDocument = require('pdfkit');
const fontkit = require('fontkit');
const fs = require('fs-extra');

/**
 * FluidContentManager - Advanced content measurement and rendering system
 * Provides dynamic content sizing, intelligent pagination, and rendering feedback loops
 */
class FluidContentManager {
  constructor(options = {}) {
    this.options = {
      // Page dimensions
      pageWidth: options.pageWidth || 595,
      pageHeight: options.pageHeight || 842,
      margins: options.margins || { top: 72, right: 72, bottom: 72, left: 72 },
      
      // Content measurement
      measurementAccuracy: options.measurementAccuracy || 'high', // high, medium, fast
      dynamicSizing: options.dynamicSizing || true,
      contentAwarePagination: options.contentAwarePagination || true,
      
      // Typography
      defaultFont: options.defaultFont || 'Helvetica',
      defaultFontSize: options.defaultFontSize || 11,
      defaultLineHeight: options.defaultLineHeight || 1.4,
      
      // Layout behavior
      orphanControl: options.orphanControl || 2,
      widowControl: options.widowControl || 2,
      elementSpacing: options.elementSpacing || 15,
      
      // Performance
      cacheRendering: options.cacheRendering || true,
      batchProcessing: options.batchProcessing || true,
      
      debug: options.debug || false
    };
    
    this.contentWidth = this.options.pageWidth - this.options.margins.left - this.options.margins.right;
    this.contentHeight = this.options.pageHeight - this.options.margins.top - this.options.margins.bottom;
    
    // Caches
    this.renderCache = new Map();
    this.measurementCache = new Map();
    this.fontMetrics = new Map();
    
    // Virtual measurement context
    this.measurementContext = null;
    this.initializeMeasurementContext();
  }

  /**
   * Initialize virtual measurement context for accurate content sizing
   */
  initializeMeasurementContext() {
    try {
      // Create a virtual PDFKit document for measurements
      this.measurementContext = new PDFDocument({
        size: [this.options.pageWidth, this.options.pageHeight],
        margin: 0
      });
      
      // Prevent actual output
      this.measurementContext.pipe({ write: () => {}, end: () => {} });
      
      this.log('Measurement context initialized');
    } catch (error) {
      console.warn('FluidContentManager: Could not initialize measurement context:', error);
      this.measurementContext = null;
    }
  }

  /**
   * Process content with intelligent layout and pagination
   */
  async processContent(elements, startPage = 0, startY = null) {
    this.log('Processing content', { elementCount: elements.length, startPage, startY });
    
    const result = {
      pages: [],
      processedElements: [],
      measurements: [],
      warnings: [],
      statistics: {
        totalElements: elements.length,
        totalPages: 0,
        avgElementsPerPage: 0,
        contentUtilization: 0
      }
    };

    let currentPage = startPage;
    let currentY = startY || this.options.margins.top;
    
    // Ensure first page exists
    if (!result.pages[currentPage]) {
      result.pages[currentPage] = this.createPageStructure(currentPage);
    }

    // Process elements with intelligent batching
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      
      try {
        // Measure content accurately
        const measurement = await this.measureElement(element);
        result.measurements.push(measurement);
        
        // Check if content fits on current page
        const fitsOnPage = this.checkElementFit(measurement, currentY, currentPage);
        
        if (fitsOnPage.fits) {
          // Place element on current page
          const placedElement = this.placeElement(element, measurement, currentPage, currentY);
          result.processedElements.push(placedElement);
          
          if (!result.pages[currentPage].elements) {
            result.pages[currentPage].elements = [];
          }
          result.pages[currentPage].elements.push(placedElement);
          
          currentY += measurement.height + this.options.elementSpacing;
          
        } else {
          // Handle page overflow
          const overflowResult = await this.handleOverflow(
            element, 
            measurement, 
            currentPage, 
            currentY, 
            result
          );
          
          // Update current position
          currentPage = overflowResult.newPage;
          currentY = overflowResult.newY;
          
          // Add processed elements
          result.processedElements.push(...overflowResult.elements);
          
          // Ensure pages exist
          while (result.pages.length <= currentPage) {
            result.pages.push(this.createPageStructure(result.pages.length));
          }
          
          // Add elements to appropriate pages
          overflowResult.elements.forEach(elem => {
            if (!result.pages[elem.pageIndex].elements) {
              result.pages[elem.pageIndex].elements = [];
            }
            result.pages[elem.pageIndex].elements.push(elem);
          });
        }
        
      } catch (error) {
        this.log('Error processing element', { elementIndex: i, error: error.message });
        result.warnings.push({
          elementIndex: i,
          type: 'processing_error',
          message: error.message
        });
      }
    }
    
    // Calculate statistics
    result.statistics.totalPages = result.pages.length;
    result.statistics.avgElementsPerPage = result.processedElements.length / result.pages.length;
    result.statistics.contentUtilization = this.calculateContentUtilization(result);
    
    this.log('Content processing complete', result.statistics);
    return result;
  }

  /**
   * Measure element content with high accuracy
   */
  async measureElement(element) {
    const cacheKey = this.generateCacheKey(element);
    
    if (this.options.cacheRendering && this.measurementCache.has(cacheKey)) {
      return this.measurementCache.get(cacheKey);
    }

    let measurement;
    
    switch (element.type) {
      case 'text':
        measurement = await this.measureTextElement(element);
        break;
      case 'markdown':
        measurement = await this.measureMarkdownElement(element);
        break;
      case 'latex':
        measurement = await this.measureLatexElement(element);
        break;
      case 'code':
        measurement = await this.measureCodeElement(element);
        break;
      case 'table':
        measurement = await this.measureTableElement(element);
        break;
      case 'image':
        measurement = await this.measureImageElement(element);
        break;
      default:
        measurement = await this.measureGenericElement(element);
    }
    
    // Add metadata
    measurement.element = element;
    measurement.timestamp = Date.now();
    measurement.cacheKey = cacheKey;
    
    if (this.options.cacheRendering) {
      this.measurementCache.set(cacheKey, measurement);
    }
    
    return measurement;
  }

  /**
   * Measure text element with markdown and LaTeX support
   */
  async measureTextElement(element) {
    const content = element.content || '';
    const style = element.style || {};
    
    // Extract LaTeX segments first
    const { text: processedText, segments: latexSegments } = this.extractLatexSegments(content);
    
    // Process markdown
    const renderedContent = this.processMarkdownContent(processedText);
    
    // Measure text dimensions
    const textMeasurement = this.measureTextDimensions(
      renderedContent,
      style.fontSize || this.options.defaultFontSize,
      style.fontFamily || this.options.defaultFont,
      style.lineHeight || this.options.defaultLineHeight,
      this.contentWidth
    );
    
    // Add LaTeX height if present
    let latexHeight = 0;
    if (latexSegments.length > 0) {
      latexHeight = this.calculateLatexHeight(latexSegments, style.fontSize || this.options.defaultFontSize);
    }
    
    return {
      type: 'text',
      width: this.contentWidth,
      height: textMeasurement.height + latexHeight,
      lines: textMeasurement.lines,
      canSplit: textMeasurement.lines > this.options.orphanControl,
      splittable: true,
      splitStrategy: 'paragraph-aware',
      contentStructure: {
        paragraphs: textMeasurement.paragraphs,
        latexSegments: latexSegments,
        hasMarkdown: this.hasMarkdownElements(content),
        renderingComplexity: this.assessRenderingComplexity(content)
      }
    };
  }

  /**
   * Measure markdown element with proper rendering
   */
  async measureMarkdownElement(element) {
    const content = element.content || '';
    
    // Parse markdown structure
    const markdownStructure = this.parseMarkdownStructure(content);
    
    let totalHeight = 0;
    let totalLines = 0;
    let canSplit = false;
    
    // Measure each markdown component
    for (const component of markdownStructure) {
      const componentMeasurement = await this.measureMarkdownComponent(component);
      totalHeight += componentMeasurement.height;
      totalLines += componentMeasurement.lines;
      
      if (componentMeasurement.canSplit) {
        canSplit = true;
      }
    }
    
    return {
      type: 'markdown',
      width: this.contentWidth,
      height: totalHeight,
      lines: totalLines,
      canSplit: canSplit,
      splittable: true,
      splitStrategy: 'component-aware',
      contentStructure: {
        components: markdownStructure,
        hasHeaders: markdownStructure.some(c => c.type === 'header'),
        hasCodeBlocks: markdownStructure.some(c => c.type === 'code'),
        hasTables: markdownStructure.some(c => c.type === 'table'),
        hasLists: markdownStructure.some(c => c.type === 'list')
      }
    };
  }

  /**
   * Measure code element with syntax highlighting consideration
   */
  async measureCodeElement(element) {
    const content = element.content || '';
    const language = element.language || 'text';
    const style = element.style || {};
    
    const fontSize = (style.fontSize || this.options.defaultFontSize) * 0.9;
    const lineHeight = 1.2;
    const padding = 12;
    
    // Code uses monospace font
    const lines = content.split('\n');
    const maxLineLength = Math.max(...lines.map(line => line.length));
    
    // Calculate dimensions
    const charWidth = fontSize * 0.6; // Monospace character width
    const contentWidth = this.contentWidth - (padding * 2);
    const wrappedLines = this.calculateCodeWrapping(lines, contentWidth / charWidth);
    
    const height = (wrappedLines * fontSize * lineHeight) + (padding * 2);
    
    return {
      type: 'code',
      width: this.contentWidth,
      height: height,
      lines: wrappedLines,
      canSplit: wrappedLines > this.options.orphanControl,
      splittable: true,
      splitStrategy: 'line-aware',
      contentStructure: {
        language: language,
        originalLines: lines.length,
        wrappedLines: wrappedLines,
        maxLineLength: maxLineLength,
        syntaxHighlighting: language !== 'text'
      }
    };
  }

  /**
   * Handle content overflow with intelligent pagination
   */
  async handleOverflow(element, measurement, currentPage, currentY, result) {
    this.log('Handling overflow', { 
      element: element.type, 
      height: measurement.height, 
      currentY, 
      availableHeight: this.contentHeight - (currentY - this.options.margins.top)
    });

    const availableHeight = this.contentHeight - (currentY - this.options.margins.top);
    
    // Check if element can be split
    if (measurement.splittable && availableHeight > this.getMinimumElementHeight(element.type)) {
      return await this.splitElement(element, measurement, currentPage, currentY, availableHeight);
    } else {
      // Move entire element to next page
      const newPage = currentPage + 1;
      const newY = this.options.margins.top;
      
      const placedElement = this.placeElement(element, measurement, newPage, newY);
      
      return {
        newPage: newPage,
        newY: newY + measurement.height + this.options.elementSpacing,
        elements: [placedElement]
      };
    }
  }

  /**
   * Split element intelligently based on content type
   */
  async splitElement(element, measurement, currentPage, currentY, availableHeight) {
    this.log('Splitting element', { 
      type: element.type, 
      strategy: measurement.splitStrategy,
      availableHeight 
    });

    switch (measurement.splitStrategy) {
      case 'paragraph-aware':
        return await this.splitTextByParagraphs(element, measurement, currentPage, currentY, availableHeight);
      case 'line-aware':
        return await this.splitByLines(element, measurement, currentPage, currentY, availableHeight);
      case 'component-aware':
        return await this.splitMarkdownByComponents(element, measurement, currentPage, currentY, availableHeight);
      default:
        return await this.splitByHeight(element, measurement, currentPage, currentY, availableHeight);
    }
  }

  /**
   * Split text content by paragraphs with orphan/widow control
   */
  async splitTextByParagraphs(element, measurement, currentPage, currentY, availableHeight) {
    const content = element.content || '';
    const paragraphs = content.split(/\n\s*\n/);
    const style = element.style || {};
    
    const fontSize = style.fontSize || this.options.defaultFontSize;
    const lineHeight = style.lineHeight || this.options.defaultLineHeight;
    const actualLineHeight = fontSize * lineHeight;
    
    let firstPartContent = '';
    let remainingContent = '';
    let usedHeight = 0;
    let foundSplit = false;
    
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      const paragraphMeasurement = this.measureTextDimensions(
        paragraph, fontSize, style.fontFamily || this.options.defaultFont, lineHeight, this.contentWidth
      );
      
      if (usedHeight + paragraphMeasurement.height <= availableHeight - (this.options.widowControl * actualLineHeight)) {
        firstPartContent += (firstPartContent ? '\n\n' : '') + paragraph;
        usedHeight += paragraphMeasurement.height;
      } else {
        remainingContent = paragraphs.slice(i).join('\n\n');
        foundSplit = true;
        break;
      }
    }
    
    if (!foundSplit) {
      // All content fits
      const placedElement = this.placeElement(element, measurement, currentPage, currentY);
      return {
        newPage: currentPage,
        newY: currentY + measurement.height + this.options.elementSpacing,
        elements: [placedElement]
      };
    }
    
    // Create split elements
    const firstPart = {
      ...element,
      content: firstPartContent,
      splitInfo: { part: 1, totalParts: 2, continued: true }
    };
    
    const remainingPart = {
      ...element,
      content: remainingContent,
      splitInfo: { part: 2, totalParts: 2, continuation: true }
    };
    
    // Measure remaining part
    const remainingMeasurement = await this.measureElement(remainingPart);
    
    // Place elements
    const firstElement = this.placeElement(firstPart, { ...measurement, height: usedHeight }, currentPage, currentY);
    const secondElement = this.placeElement(remainingPart, remainingMeasurement, currentPage + 1, this.options.margins.top);
    
    return {
      newPage: currentPage + 1,
      newY: this.options.margins.top + remainingMeasurement.height + this.options.elementSpacing,
      elements: [firstElement, secondElement]
    };
  }

  /**
   * Utility methods for content processing
   */
  
  extractLatexSegments(text) {
    if (!text || typeof text !== 'string') {
      return { text: '', segments: [] };
    }
    
    const segments = [];
    let idx = 0;
    
    // Process display LaTeX: $$...$$
    let processedText = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, content) => {
      const key = `@@MATH${idx}@@`;
      segments.push({ key, math: content.trim(), type: 'block' });
      idx++;
      return key;
    });
    
    // Process block LaTeX: \[...\]
    processedText = processedText.replace(/\\\[((?:.|\n)+?)\\\]/g, (_, content) => {
      const key = `@@MATH${idx}@@`;
      segments.push({ key, math: content, type: 'block' });
      idx++;
      return key;
    });
    
    // Process inline LaTeX: \(...\)
    processedText = processedText.replace(/\\\((.+?)\\\)/g, (_, content) => {
      const key = `@@MATH${idx}@@`;
      segments.push({ key, math: content, type: 'inline' });
      idx++;
      return key;
    });
    
    // Process inline LaTeX: $...$
    processedText = processedText.replace(/\$([^$\n]+?)\$/g, (match, content) => {
      if (this.isLikelyMath(content)) {
        const key = `@@MATH${idx}@@`;
        segments.push({ key, math: content, type: 'inline' });
        idx++;
        return key;
      }
      return match;
    });
    
    return { text: processedText, segments };
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

  processMarkdownContent(text) {
    let processed = text;
    
    // Basic markdown processing
    processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    processed = processed.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    processed = processed.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    processed = processed.replace(/_([^_]+)_/g, '<em>$1</em>');
    processed = processed.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    processed = processed.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    return processed;
  }

  measureTextDimensions(text, fontSize, fontFamily, lineHeight, maxWidth) {
    if (!text || text.trim().length === 0) {
      return { width: maxWidth, height: fontSize * lineHeight, lines: 0, paragraphs: 0 };
    }

    const avgCharWidth = this.getAverageCharacterWidth(fontFamily, fontSize);
    const charsPerLine = Math.floor(maxWidth / avgCharWidth);
    
    const paragraphs = text.split(/\n\s*\n/);
    let totalHeight = 0;
    let totalLines = 0;
    
    paragraphs.forEach((paragraph, index) => {
      if (paragraph.trim().length === 0) {
        totalHeight += fontSize * lineHeight * 0.5;
        return;
      }

      const cleanText = this.stripHtmlTags(paragraph.trim());
      const words = cleanText.split(/\s+/);
      let currentLine = '';
      let paragraphLines = 0;
      
      words.forEach(word => {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        if (testLine.length <= charsPerLine) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            paragraphLines++;
            currentLine = word;
          } else {
            const chunks = Math.ceil(word.length / charsPerLine);
            paragraphLines += chunks;
            currentLine = '';
          }
        }
      });
      
      if (currentLine) {
        paragraphLines++;
      }
      
      totalLines += paragraphLines;
      totalHeight += paragraphLines * fontSize * lineHeight;
      
      if (index < paragraphs.length - 1) {
        totalHeight += this.options.elementSpacing * 0.5;
      }
    });

    return {
      width: maxWidth,
      height: Math.max(totalHeight, fontSize * lineHeight),
      lines: totalLines,
      paragraphs: paragraphs.length
    };
  }

  calculateLatexHeight(segments, fontSize) {
    let totalHeight = 0;
    
    segments.forEach(segment => {
      const mathFontSize = fontSize * 1.1;
      const complexity = this.assessLatexComplexity(segment.math);
      
      let segmentHeight = mathFontSize * 1.6;
      
      if (complexity.hasFractions) segmentHeight *= 1.8;
      if (complexity.hasSuperscripts) segmentHeight *= 1.3;
      if (complexity.hasMatrices) segmentHeight *= 2.0;
      if (complexity.hasIntegrals) segmentHeight *= 1.5;
      
      if (segment.type === 'block') {
        segmentHeight *= 1.5;
      }
      
      totalHeight += segmentHeight;
    });
    
    return totalHeight;
  }

  assessLatexComplexity(latex) {
    return {
      hasFractions: /\\frac\{/.test(latex),
      hasSuperscripts: /\^/.test(latex),
      hasSubscripts: /_/.test(latex),
      hasMatrices: /\\begin\{(matrix|pmatrix|bmatrix)\}/.test(latex),
      hasIntegrals: /\\int/.test(latex),
      hasSums: /\\sum/.test(latex),
      hasRoots: /\\sqrt/.test(latex)
    };
  }

  parseMarkdownStructure(content) {
    const components = [];
    const lines = content.split('\n');
    let currentComponent = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.match(/^#{1,6}\s+/)) {
        // Header
        if (currentComponent) components.push(currentComponent);
        const level = trimmed.match(/^(#{1,6})/)[1].length;
        currentComponent = {
          type: 'header',
          level: level,
          content: trimmed.replace(/^#{1,6}\s+/, ''),
          lines: [line]
        };
      } else if (trimmed.startsWith('```')) {
        // Code block
        if (currentComponent && currentComponent.type === 'code') {
          currentComponent.lines.push(line);
          components.push(currentComponent);
          currentComponent = null;
        } else {
          if (currentComponent) components.push(currentComponent);
          const language = trimmed.replace('```', '');
          currentComponent = {
            type: 'code',
            language: language,
            content: '',
            lines: [line]
          };
        }
      } else if (currentComponent && currentComponent.type === 'code') {
        // Inside code block
        currentComponent.lines.push(line);
        currentComponent.content += (currentComponent.content ? '\n' : '') + line;
      } else {
        // Regular text
        if (!currentComponent || currentComponent.type !== 'text') {
          if (currentComponent) components.push(currentComponent);
          currentComponent = {
            type: 'text',
            content: '',
            lines: []
          };
        }
        currentComponent.lines.push(line);
        currentComponent.content += (currentComponent.content ? '\n' : '') + line;
      }
    }
    
    if (currentComponent) components.push(currentComponent);
    
    return components;
  }

  async measureMarkdownComponent(component) {
    const style = { fontSize: this.options.defaultFontSize, fontFamily: this.options.defaultFont };
    
    switch (component.type) {
      case 'header':
        const headerSizes = [20, 18, 16, 14, 12, 11];
        const headerSize = headerSizes[Math.min(component.level - 1, 5)];
        return this.measureTextDimensions(component.content, headerSize, style.fontFamily, 1.2, this.contentWidth);
      
      case 'code':
        const element = { content: component.content, type: 'code', language: component.language };
        return await this.measureCodeElement(element);
      
      case 'text':
      default:
        return this.measureTextDimensions(component.content, style.fontSize, style.fontFamily, this.options.defaultLineHeight, this.contentWidth);
    }
  }

  calculateCodeWrapping(lines, maxCharsPerLine) {
    let totalLines = 0;
    
    lines.forEach(line => {
      if (line.length <= maxCharsPerLine) {
        totalLines++;
      } else {
        totalLines += Math.ceil(line.length / maxCharsPerLine);
      }
    });
    
    return totalLines;
  }

  checkElementFit(measurement, currentY, currentPage) {
    const availableHeight = this.contentHeight - (currentY - this.options.margins.top);
    const requiredHeight = measurement.height + this.options.elementSpacing;
    
    return {
      fits: requiredHeight <= availableHeight,
      availableHeight: availableHeight,
      requiredHeight: requiredHeight,
      overflow: Math.max(0, requiredHeight - availableHeight)
    };
  }

  placeElement(element, measurement, pageIndex, y) {
    return {
      ...element,
      id: element.id || this.generateId(),
      bounds: {
        x: this.options.margins.left,
        y: y,
        width: measurement.width,
        height: measurement.height
      },
      pageIndex: pageIndex,
      measurement: measurement,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      zIndex: 0,
      locked: false,
      visible: true
    };
  }

  createPageStructure(pageIndex) {
    return {
      id: `page_${pageIndex}`,
      index: pageIndex,
      size: 'A4',
      orientation: 'portrait',
      margins: this.options.margins,
      background: { color: '#ffffff' },
      elements: [],
      grid: { enabled: false, size: 12, color: '#e0e0e0', snap: true },
      guides: []
    };
  }

  calculateContentUtilization(result) {
    let totalUsedHeight = 0;
    let totalAvailableHeight = result.pages.length * this.contentHeight;
    
    result.processedElements.forEach(element => {
      totalUsedHeight += element.bounds.height;
    });
    
    return totalUsedHeight / totalAvailableHeight;
  }

  getAverageCharacterWidth(fontFamily, fontSize) {
    const key = `${fontFamily}-${fontSize}`;
    if (this.fontMetrics.has(key)) {
      return this.fontMetrics.get(key);
    }
    
    let multiplier = 0.6;
    
    if (fontFamily.toLowerCase().includes('courier') || 
        fontFamily.toLowerCase().includes('mono')) {
      multiplier = 0.6;
    } else if (fontFamily.toLowerCase().includes('times')) {
      multiplier = 0.55;
    } else if (fontFamily.toLowerCase().includes('helvetica') || 
               fontFamily.toLowerCase().includes('arial')) {
      multiplier = 0.58;
    }
    
    const width = fontSize * multiplier;
    this.fontMetrics.set(key, width);
    return width;
  }

  stripHtmlTags(text) {
    return text.replace(/<[^>]*>/g, '');
  }

  hasMarkdownElements(content) {
    return /\*\*|__|\*|_|`|~~|#/.test(content);
  }

  assessRenderingComplexity(content) {
    let complexity = 'simple';
    
    if (this.hasMarkdownElements(content)) complexity = 'medium';
    if (/\$\$|\\\[|\\\(|\$/.test(content)) complexity = 'high';
    if (content.length > 5000) complexity = 'high';
    
    return complexity;
  }

  getMinimumElementHeight(type) {
    switch (type) {
      case 'header': return this.options.defaultFontSize * 2;
      case 'image': return 100;
      case 'table': return this.options.defaultFontSize * 3;
      case 'latex': return this.options.defaultFontSize * 2;
      default: return this.options.defaultFontSize * this.options.defaultLineHeight;
    }
  }

  generateCacheKey(element) {
    const content = typeof element.content === 'string' ? element.content : JSON.stringify(element.content);
    const style = JSON.stringify(element.style || {});
    return `${element.type}-${Buffer.from(content + style).toString('base64').slice(0, 16)}`;
  }

  /**
   * Measure LaTeX element
   */
  async measureLatexElement(element) {
    const content = element.content || '';
    const style = element.style || {};
    const fontSize = style.fontSize || this.options.defaultFontSize;
    
    const complexity = this.assessLatexComplexity(content);
    const mathFontSize = fontSize * 1.1;
    
    let baseHeight = mathFontSize * 1.6;
    if (complexity.hasFractions) baseHeight *= 1.8;
    if (complexity.hasSuperscripts) baseHeight *= 1.3;
    if (complexity.hasMatrices) baseHeight *= 2.0;
    if (complexity.hasIntegrals) baseHeight *= 1.5;
    
    const lines = content.split(/\\\\/g).length;
    const totalHeight = baseHeight * lines;
    
    return {
      type: 'latex',
      width: this.contentWidth,
      height: totalHeight,
      lines: lines,
      canSplit: false,
      splittable: false,
      splitStrategy: 'none',
      contentStructure: {
        complexity: complexity,
        isDisplayMode: style.display || false
      }
    };
  }

  /**
   * Measure table element
   */
  async measureTableElement(element) {
    const tableData = element.content || { headers: [], rows: [] };
    const style = element.style || {};
    const fontSize = style.fontSize || this.options.defaultFontSize;
    
    const cellPadding = 8;
    const borderWidth = 1;
    const headerHeight = (fontSize * 1.2 * 1.4) + (cellPadding * 2);
    const rowHeight = (fontSize * 1.4) + (cellPadding * 2);
    
    const numColumns = tableData.headers?.length || 1;
    const totalHeight = headerHeight + (rowHeight * (tableData.rows?.length || 0)) + 
                       (borderWidth * ((tableData.rows?.length || 0) + 2));
    
    return {
      type: 'table',
      width: this.contentWidth,
      height: totalHeight,
      lines: (tableData.rows?.length || 0) + 1,
      canSplit: (tableData.rows?.length || 0) > 2,
      splittable: true,
      splitStrategy: 'row-aware',
      contentStructure: {
        headers: tableData.headers || [],
        rows: tableData.rows || [],
        columns: numColumns
      }
    };
  }

  /**
   * Measure image element
   */
  async measureImageElement(element) {
    const imageData = element.content || {};
    const style = element.style || {};
    
    let width = this.contentWidth;
    let height = 200; // Default height
    
    if (imageData.width && imageData.height) {
      const aspectRatio = imageData.width / imageData.height;
      if (imageData.width <= this.contentWidth) {
        width = imageData.width;
        height = imageData.height;
      } else {
        width = this.contentWidth;
        height = this.contentWidth / aspectRatio;
      }
    }
    
    return {
      type: 'image',
      width: width,
      height: height,
      lines: 1,
      canSplit: false,
      splittable: false,
      splitStrategy: 'none',
      contentStructure: {
        hasSource: !!imageData.url,
        aspectRatio: imageData.width && imageData.height ? imageData.width / imageData.height : null
      }
    };
  }

  /**
   * Measure generic element
   */
  async measureGenericElement(element) {
    const style = element.style || {};
    const fontSize = style.fontSize || this.options.defaultFontSize;
    const lineHeight = style.lineHeight || this.options.defaultLineHeight;
    
    return {
      type: element.type || 'unknown',
      width: this.contentWidth,
      height: fontSize * lineHeight,
      lines: 1,
      canSplit: false,
      splittable: false,
      splitStrategy: 'none',
      contentStructure: {}
    };
  }

  /**
   * Split element by lines
   */
  async splitByLines(element, measurement, currentPage, currentY, availableHeight) {
    const content = element.content || '';
    const lines = content.split('\n');
    const style = element.style || {};
    
    const fontSize = style.fontSize || this.options.defaultFontSize;
    const lineHeight = style.lineHeight || this.options.defaultLineHeight;
    const actualLineHeight = fontSize * lineHeight;
    
    const availableLines = Math.floor(availableHeight / actualLineHeight);
    const minLines = Math.max(this.options.orphanControl, 1);
    
    if (availableLines < minLines) {
      // Move to next page
      const placedElement = this.placeElement(element, measurement, currentPage + 1, this.options.margins.top);
      return {
        newPage: currentPage + 1,
        newY: this.options.margins.top + measurement.height + this.options.elementSpacing,
        elements: [placedElement]
      };
    }
    
    const firstPartLines = lines.slice(0, availableLines);
    const remainingLines = lines.slice(availableLines);
    
    const firstPart = {
      ...element,
      content: firstPartLines.join('\n'),
      splitInfo: { part: 1, totalParts: 2, continued: true }
    };
    
    const remainingPart = {
      ...element,
      content: remainingLines.join('\n'),
      splitInfo: { part: 2, totalParts: 2, continuation: true }
    };
    
    const firstHeight = firstPartLines.length * actualLineHeight;
    const remainingMeasurement = await this.measureElement(remainingPart);
    
    const firstElement = this.placeElement(firstPart, { ...measurement, height: firstHeight }, currentPage, currentY);
    const secondElement = this.placeElement(remainingPart, remainingMeasurement, currentPage + 1, this.options.margins.top);
    
    return {
      newPage: currentPage + 1,
      newY: this.options.margins.top + remainingMeasurement.height + this.options.elementSpacing,
      elements: [firstElement, secondElement]
    };
  }

  /**
   * Split markdown by components
   */
  async splitMarkdownByComponents(element, measurement, currentPage, currentY, availableHeight) {
    const components = measurement.contentStructure.components || [];
    
    let usedHeight = 0;
    let firstPartComponents = [];
    let remainingComponents = [];
    let foundSplit = false;
    
    for (let i = 0; i < components.length; i++) {
      const component = components[i];
      const componentMeasurement = await this.measureMarkdownComponent(component);
      
      if (usedHeight + componentMeasurement.height <= availableHeight) {
        firstPartComponents.push(component);
        usedHeight += componentMeasurement.height;
      } else {
        remainingComponents = components.slice(i);
        foundSplit = true;
        break;
      }
    }
    
    if (!foundSplit) {
      const placedElement = this.placeElement(element, measurement, currentPage, currentY);
      return {
        newPage: currentPage,
        newY: currentY + measurement.height + this.options.elementSpacing,
        elements: [placedElement]
      };
    }
    
    const firstPartContent = firstPartComponents.map(c => c.lines.join('\n')).join('\n');
    const remainingContent = remainingComponents.map(c => c.lines.join('\n')).join('\n');
    
    const firstPart = {
      ...element,
      content: firstPartContent,
      splitInfo: { part: 1, totalParts: 2, continued: true }
    };
    
    const remainingPart = {
      ...element,
      content: remainingContent,
      splitInfo: { part: 2, totalParts: 2, continuation: true }
    };
    
    const remainingMeasurement = await this.measureElement(remainingPart);
    
    const firstElement = this.placeElement(firstPart, { ...measurement, height: usedHeight }, currentPage, currentY);
    const secondElement = this.placeElement(remainingPart, remainingMeasurement, currentPage + 1, this.options.margins.top);
    
    return {
      newPage: currentPage + 1,
      newY: this.options.margins.top + remainingMeasurement.height + this.options.elementSpacing,
      elements: [firstElement, secondElement]
    };
  }

  /**
   * Split by height (basic splitting)
   */
  async splitByHeight(element, measurement, currentPage, currentY, availableHeight) {
    // Simple height-based split - just move to next page
    const placedElement = this.placeElement(element, measurement, currentPage + 1, this.options.margins.top);
    
    return {
      newPage: currentPage + 1,
      newY: this.options.margins.top + measurement.height + this.options.elementSpacing,
      elements: [placedElement]
    };
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  /**
   * Logging utility
   */
  log(message, data = null) {
    if (this.options.debug) {
      if (data) {
        console.log(`FluidContentManager: ${message}`, data);
      } else {
        console.log(`FluidContentManager: ${message}`);
      }
    }
  }
}

module.exports = FluidContentManager;