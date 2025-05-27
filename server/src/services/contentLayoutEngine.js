const PDFDocument = require('pdfkit');
const fontkit = require('fontkit');

/**
 * ContentLayoutEngine - Intelligent PDF content layout and pagination system
 * Handles content-based sizing, intelligent page flow, and content-aware pagination
 */
class ContentLayoutEngine {
  constructor(options = {}) {
    this.options = {
      // Page settings
      pageWidth: options.pageWidth || 595, // A4 width in points
      pageHeight: options.pageHeight || 842, // A4 height in points
      margins: options.margins || { top: 72, right: 72, bottom: 72, left: 72 },
      
      // Typography settings
      defaultFontSize: options.defaultFontSize || 11,
      defaultLineHeight: options.defaultLineHeight || 1.4,
      defaultFontFamily: options.defaultFontFamily || 'Helvetica',
      
      // Layout settings
      defaultElementMargin: options.defaultElementMargin || 15,
      paragraphSpacing: options.paragraphSpacing || 10,
      sectionSpacing: options.sectionSpacing || 20,
      
      // Content-specific settings
      codeBlockPadding: options.codeBlockPadding || 12,
      tableCellPadding: options.tableCellPadding || 8,
      imageMaxWidth: options.imageMaxWidth || null, // null = use content width
      
      // Pagination settings
      orphanLines: options.orphanLines || 2, // Min lines to keep together
      widowLines: options.widowLines || 2, // Min lines on new page
      tableHeaderRepeat: options.tableHeaderRepeat || true,
      avoidPageBreakInside: options.avoidPageBreakInside || ['image', 'latex', 'table-row'],
      
      // Debug settings
      debug: options.debug || false
    };
    
    this.fontMetrics = new Map();
    this.contentWidth = this.options.pageWidth - this.options.margins.left - this.options.margins.right;
    this.contentHeight = this.options.pageHeight - this.options.margins.top - this.options.margins.bottom;
  }

  /**
   * Calculate element dimensions based on content type and actual content
   */
  calculateElementDimensions(content, type, style = {}) {
    const fontSize = style.fontSize || this.options.defaultFontSize;
    const fontFamily = style.fontFamily || this.options.defaultFontFamily;
    const lineHeight = style.lineHeight || this.options.defaultLineHeight;
    const width = style.width || this.contentWidth;
    
    switch (type) {
      case 'text':
        return this.calculateTextDimensions(content, fontSize, fontFamily, lineHeight, width, style);
      
      case 'heading':
        const headingSize = style.fontSize || (fontSize * 1.5);
        return this.calculateTextDimensions(content, headingSize, fontFamily, lineHeight, width, {
          ...style,
          fontWeight: 'bold',
          marginBottom: this.options.sectionSpacing
        });
      
      case 'code':
        return this.calculateCodeDimensions(content, fontSize, width, style);
      
      case 'table':
        return this.calculateTableDimensions(content, fontSize, width, style);
      
      case 'image':
        return this.calculateImageDimensions(content, width, style);
      
      case 'latex':
        return this.calculateLatexDimensions({ content, latexSegments: style.latexSegments }, fontSize, width, style);
      
      case 'list':
        return this.calculateListDimensions(content, fontSize, fontFamily, lineHeight, width, style);
      
      default:
        return this.calculateTextDimensions(content, fontSize, fontFamily, lineHeight, width, style);
    }
  }

  /**
   * Calculate text element dimensions with proper line wrapping
   */
  calculateTextDimensions(text, fontSize, fontFamily, lineHeight, maxWidth, style = {}) {
    if (!text || text.trim().length === 0) {
      return { width: maxWidth, height: fontSize * lineHeight, lines: 0 };
    }

    // Check if this text has LaTeX segments
    const latexSegments = style.latexSegments || [];
    if (latexSegments.length > 0) {
      // Use LaTeX calculation for text with math
      return this.calculateLatexDimensions({ content: text, latexSegments }, fontSize, maxWidth, style);
    }

    // Get character width for font (approximation)
    const avgCharWidth = this.getAverageCharacterWidth(fontFamily, fontSize);
    const charsPerLine = Math.floor(maxWidth / avgCharWidth);
    
    // Split text into paragraphs
    const paragraphs = text.split(/\n\s*\n/);
    let totalHeight = 0;
    let totalLines = 0;
    
    paragraphs.forEach((paragraph, index) => {
      if (paragraph.trim().length === 0) {
        totalHeight += fontSize * lineHeight * 0.5; // Empty paragraph spacing
        return;
      }

      // Handle markdown formatting
      const cleanText = this.stripMarkdownForMeasurement(paragraph.trim());
      
      // Calculate lines needed for this paragraph
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
            // Word is longer than line, break it
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
      
      // Add paragraph spacing (except for last paragraph)
      if (index < paragraphs.length - 1) {
        totalHeight += this.options.paragraphSpacing;
      }
    });

    // Add element margin
    const marginBottom = style.marginBottom || this.options.defaultElementMargin;
    totalHeight += marginBottom;

    return {
      width: maxWidth,
      height: Math.max(totalHeight, fontSize * lineHeight), // Minimum one line height
      lines: totalLines,
      paragraphs: paragraphs.length,
      canSplit: totalLines > this.options.orphanLines,
      preferredSplitPoints: this.findPreferredSplitPoints(text, fontSize, lineHeight, charsPerLine)
    };
  }

  /**
   * Calculate code block dimensions with syntax highlighting consideration
   */
  calculateCodeDimensions(code, fontSize, maxWidth, style = {}) {
    const codeFont = 'Courier'; // Monospace font
    const codeFontSize = fontSize * 0.9; // Slightly smaller for code
    const padding = this.options.codeBlockPadding;
    const availableWidth = maxWidth - (padding * 2);
    
    // Code uses monospace, so character width is consistent
    const charWidth = codeFontSize * 0.6; // Monospace approximation
    const charsPerLine = Math.floor(availableWidth / charWidth);
    
    const lines = code.split('\n');
    let wrappedLines = 0;
    
    lines.forEach(line => {
      if (line.length <= charsPerLine) {
        wrappedLines++;
      } else {
        wrappedLines += Math.ceil(line.length / charsPerLine);
      }
    });

    const lineHeight = style.lineHeight || 1.2; // Tighter for code
    const contentHeight = wrappedLines * codeFontSize * lineHeight;
    const totalHeight = contentHeight + (padding * 2) + this.options.defaultElementMargin;

    return {
      width: maxWidth,
      height: totalHeight,
      lines: wrappedLines,
      canSplit: wrappedLines > this.options.orphanLines,
      contentType: 'code',
      padding: padding
    };
  }

  /**
   * Calculate table dimensions with header repetition support
   */
  calculateTableDimensions(tableData, fontSize, maxWidth, style = {}) {
    if (!tableData || !tableData.headers || !tableData.rows) {
      return { width: maxWidth, height: 50, lines: 1 };
    }

    const cellPadding = this.options.tableCellPadding;
    const borderWidth = 1;
    const headerHeight = (fontSize * 1.2 * 1.4) + (cellPadding * 2); // Bold header
    const rowHeight = (fontSize * 1.4) + (cellPadding * 2);
    
    const numColumns = tableData.headers.length;
    const columnWidth = (maxWidth - (borderWidth * (numColumns + 1))) / numColumns;
    
    // Calculate if any cells need multi-line content
    let maxHeaderLines = 1;
    let maxRowLines = Array(tableData.rows.length).fill(1);
    
    const avgCharWidth = this.getAverageCharacterWidth('Helvetica', fontSize);
    const charsPerCell = Math.floor((columnWidth - cellPadding * 2) / avgCharWidth);
    
    // Check header cell content
    tableData.headers.forEach(header => {
      const lines = Math.ceil(header.length / charsPerCell);
      maxHeaderLines = Math.max(maxHeaderLines, lines);
    });
    
    // Check row cell content
    tableData.rows.forEach((row, rowIndex) => {
      row.forEach(cell => {
        const lines = Math.ceil(cell.length / charsPerCell);
        maxRowLines[rowIndex] = Math.max(maxRowLines[rowIndex], lines);
      });
    });
    
    const adjustedHeaderHeight = headerHeight * maxHeaderLines;
    const totalRowHeight = maxRowLines.reduce((sum, lines) => sum + (rowHeight * lines), 0);
    const totalHeight = adjustedHeaderHeight + totalRowHeight + (borderWidth * (tableData.rows.length + 2)) + this.options.defaultElementMargin;

    return {
      width: maxWidth,
      height: totalHeight,
      lines: tableData.rows.length + 1, // +1 for header
      canSplit: tableData.rows.length > 2, // Can split if more than 2 rows
      contentType: 'table',
      headerHeight: adjustedHeaderHeight,
      rowHeights: maxRowLines.map(lines => rowHeight * lines),
      splitStrategy: 'preserve-header'
    };
  }

  /**
   * Calculate image dimensions with aspect ratio preservation
   */
  calculateImageDimensions(imageData, maxWidth, style = {}) {
    const { width: originalWidth, height: originalHeight, url } = imageData;
    
    let targetWidth = maxWidth;
    let targetHeight = 200; // Default height
    
    if (originalWidth && originalHeight) {
      const aspectRatio = originalWidth / originalHeight;
      
      if (style.width) {
        targetWidth = Math.min(style.width, maxWidth);
        targetHeight = targetWidth / aspectRatio;
      } else if (style.height) {
        targetHeight = style.height;
        targetWidth = Math.min(targetHeight * aspectRatio, maxWidth);
      } else {
        // Auto-size based on content
        if (originalWidth <= maxWidth) {
          targetWidth = originalWidth;
          targetHeight = originalHeight;
        } else {
          targetWidth = maxWidth;
          targetHeight = maxWidth / aspectRatio;
        }
      }
    }

    const totalHeight = targetHeight + this.options.defaultElementMargin;

    return {
      width: targetWidth,
      height: totalHeight,
      lines: 1,
      canSplit: false, // Images should not be split
      contentType: 'image',
      aspectRatio: originalWidth && originalHeight ? originalWidth / originalHeight : null
    };
  }

  /**
   * Calculate LaTeX/Math expression dimensions
   */
  calculateLatexDimensions(element, fontSize, maxWidth, style = {}) {
    // Handle element with LaTeX segments
    const latexSegments = element.latexSegments || [];
    const content = element.content || '';
    
    // For elements with LaTeX, we need to calculate based on both text and math
    if (latexSegments.length > 0) {
      let totalHeight = 0;
      let hasBlockMath = false;
      
      // Process each LaTeX segment
      latexSegments.forEach(segment => {
        const mathFontSize = fontSize * 1.1;
        const complexity = this.assessLatexComplexity(segment.math);
        
        let segmentHeight = mathFontSize * 1.6; // Base line height for math
        
        // Adjust for complexity
        if (complexity.hasFractions) segmentHeight *= 1.8;
        if (complexity.hasSuperscripts) segmentHeight *= 1.3;
        if (complexity.hasMatrices) segmentHeight *= 2.0;
        if (complexity.hasIntegrals) segmentHeight *= 1.5;
        if (complexity.hasRoots) segmentHeight *= 1.4;
        
        // Block math takes more space
        if (segment.type === 'block') {
          segmentHeight *= 1.5;
          hasBlockMath = true;
        }
        
        totalHeight += segmentHeight;
      });
      
      // Add space for text content (approximate)
      const textLines = this.estimateTextLines(content.replace(/@@MATH\d+@@/g, ''), fontSize, maxWidth);
      totalHeight += textLines * fontSize * (style.lineHeight || this.options.defaultLineHeight);
      
      // Add margins
      totalHeight += this.options.defaultElementMargin;
      if (hasBlockMath) totalHeight += this.options.sectionSpacing;
      
      return {
        width: maxWidth,
        height: Math.max(totalHeight, fontSize * 1.6),
        lines: Math.max(1, textLines + latexSegments.length),
        canSplit: false, // Elements with LaTeX should not be split
        contentType: 'latex',
        hasBlockMath: hasBlockMath,
        segmentCount: latexSegments.length
      };
    }
    
    // Fallback for simple LaTeX content
    const mathFontSize = fontSize * 1.1;
    const lines = content.split(/\\\\/g).length;
    const complexity = this.assessLatexComplexity(content);
    
    let baseHeight = mathFontSize * 1.6;
    if (complexity.hasFractions) baseHeight *= 1.8;
    if (complexity.hasSuperscripts) baseHeight *= 1.3;
    if (complexity.hasMatrices) baseHeight *= 2.0;
    if (complexity.hasIntegrals) baseHeight *= 1.5;
    
    const totalHeight = (baseHeight * lines) + this.options.defaultElementMargin;

    return {
      width: maxWidth,
      height: totalHeight,
      lines: lines,
      canSplit: false,
      contentType: 'latex',
      complexity: complexity
    };
  }



  /**
   * Calculate list dimensions with proper indentation
   */
  calculateListDimensions(listItems, fontSize, fontFamily, lineHeight, maxWidth, style = {}) {
    const indentWidth = fontSize * 2; // 2em indent
    const bulletWidth = fontSize * 0.8;
    const availableWidth = maxWidth - indentWidth - bulletWidth;
    
    let totalHeight = 0;
    let totalLines = 0;
    
    listItems.forEach(item => {
      const itemDimensions = this.calculateTextDimensions(
        item, fontSize, fontFamily, lineHeight, availableWidth
      );
      totalHeight += itemDimensions.height;
      totalLines += itemDimensions.lines;
    });

    return {
      width: maxWidth,
      height: totalHeight + this.options.defaultElementMargin,
      lines: totalLines,
      canSplit: totalLines > this.options.orphanLines,
      contentType: 'list',
      itemCount: listItems.length
    };
  }

  /**
   * Intelligent pagination - determine where to place elements and handle page breaks
   */
  layoutElements(elements, startPage = 0, startY = null) {
    const layout = {
      pages: [],
      elements: [],
      warnings: []
    };

    let currentPageIndex = startPage;
    let currentY = startY || this.options.margins.top;
    let pageElements = [];

    // Ensure we have at least one page
    if (!layout.pages[currentPageIndex]) {
      layout.pages[currentPageIndex] = this.createPageStructure(currentPageIndex);
    }

    elements.forEach((element, elementIndex) => {
      const dimensions = this.calculateElementDimensions(
        element.content, 
        element.type, 
        element.style
      );

      // Check if element fits on current page
      const remainingHeight = this.contentHeight - (currentY - this.options.margins.top);
      
      if (dimensions.height <= remainingHeight) {
        // Element fits on current page
        const placedElement = this.placeElement(
          element, 
          dimensions, 
          currentPageIndex, 
          currentY
        );
        
        pageElements.push(placedElement);
        layout.elements.push(placedElement);
        currentY += dimensions.height;
        
      } else {
        // Element doesn't fit, check if it can be split
        if (dimensions.canSplit && remainingHeight > this.getMinimumElementHeight(element.type)) {
          const splitResult = this.splitElement(
            element, 
            dimensions, 
            remainingHeight, 
            currentPageIndex, 
            currentY
          );
          
          // Add first part to current page
          pageElements.push(splitResult.firstPart);
          layout.elements.push(splitResult.firstPart);
          
          // Finalize current page
          layout.pages[currentPageIndex].elements = pageElements;
          
          // Move to next page
          currentPageIndex++;
          currentY = this.options.margins.top;
          pageElements = [];
          
          if (!layout.pages[currentPageIndex]) {
            layout.pages[currentPageIndex] = this.createPageStructure(currentPageIndex);
          }
          
          // Add remaining parts to subsequent pages
          splitResult.remainingParts.forEach(part => {
            // Check if part fits on current page
            if (part.dimensions.height <= this.contentHeight - (currentY - this.options.margins.top)) {
              const placedPart = this.placeElement(
                part.element,
                part.dimensions,
                currentPageIndex,
                currentY
              );
              
              pageElements.push(placedPart);
              layout.elements.push(placedPart);
              currentY += part.dimensions.height;
            } else {
              // Part still doesn't fit, move to next page
              layout.pages[currentPageIndex].elements = pageElements;
              currentPageIndex++;
              currentY = this.options.margins.top;
              pageElements = [];
              
              if (!layout.pages[currentPageIndex]) {
                layout.pages[currentPageIndex] = this.createPageStructure(currentPageIndex);
              }
              
              const placedPart = this.placeElement(
                part.element,
                part.dimensions,
                currentPageIndex,
                currentY
              );
              
              pageElements.push(placedPart);
              layout.elements.push(placedPart);
              currentY += part.dimensions.height;
            }
          });
          
        } else {
          // Element cannot be split, move to next page
          layout.pages[currentPageIndex].elements = pageElements;
          
          currentPageIndex++;
          currentY = this.options.margins.top;
          pageElements = [];
          
          if (!layout.pages[currentPageIndex]) {
            layout.pages[currentPageIndex] = this.createPageStructure(currentPageIndex);
          }
          
          // Check if element fits on new page
          if (dimensions.height <= this.contentHeight) {
            const placedElement = this.placeElement(
              element, 
              dimensions, 
              currentPageIndex, 
              currentY
            );
            
            pageElements.push(placedElement);
            layout.elements.push(placedElement);
            currentY += dimensions.height;
          } else {
            // Element is too large for any page
            layout.warnings.push({
              element: elementIndex,
              warning: 'Element too large for page',
              elementHeight: dimensions.height,
              availableHeight: this.contentHeight
            });
            
            // Force place with overflow
            const placedElement = this.placeElement(
              element, 
              dimensions, 
              currentPageIndex, 
              currentY
            );
            placedElement.overflow = true;
            
            pageElements.push(placedElement);
            layout.elements.push(placedElement);
            currentY += dimensions.height;
          }
        }
      }
    });

    // Finalize last page
    if (pageElements.length > 0) {
      layout.pages[currentPageIndex].elements = pageElements;
    }

    return layout;
  }

  /**
   * Split an element across pages intelligently
   */
  splitElement(element, dimensions, availableHeight, pageIndex, startY) {
    const elementType = element.type;
    
    switch (elementType) {
      case 'text':
      case 'heading':
        return this.splitTextElement(element, dimensions, availableHeight, pageIndex, startY);
      
      case 'table':
        return this.splitTableElement(element, dimensions, availableHeight, pageIndex, startY);
      
      case 'list':
        return this.splitListElement(element, dimensions, availableHeight, pageIndex, startY);
      
      case 'code':
        return this.splitCodeElement(element, dimensions, availableHeight, pageIndex, startY);
      
      default:
        // For non-splittable elements, just move to next page
        return {
          firstPart: null,
          remainingParts: [{
            element: element,
            dimensions: dimensions
          }]
        };
    }
  }

  /**
   * Split text element preserving paragraphs and avoiding orphans/widows
   */
  splitTextElement(element, dimensions, availableHeight, pageIndex, startY) {
    const fontSize = element.style?.fontSize || this.options.defaultFontSize;
    const lineHeight = element.style?.lineHeight || this.options.defaultLineHeight;
    const actualLineHeight = fontSize * lineHeight;
    
    const availableLines = Math.floor(availableHeight / actualLineHeight);
    const minLines = Math.max(this.options.orphanLines, 2);
    
    if (availableLines < minLines) {
      // Not enough space for minimum lines, move entire element
      return {
        firstPart: null,
        remainingParts: [{ element, dimensions }]
      };
    }
    
    // Split text at appropriate breakpoints
    const paragraphs = element.content.split(/\n\s*\n/);
    let firstPartContent = '';
    let remainingContent = '';
    let usedLines = 0;
    let foundSplit = false;
    
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      const paragraphLines = this.estimateTextLines(paragraph, fontSize, this.contentWidth);
      
      if (usedLines + paragraphLines <= availableLines - this.options.widowLines) {
        firstPartContent += (firstPartContent ? '\n\n' : '') + paragraph;
        usedLines += paragraphLines;
      } else {
        // This paragraph won't fit, split here
        remainingContent = paragraphs.slice(i).join('\n\n');
        foundSplit = true;
        break;
      }
    }
    
    if (!foundSplit) {
      // All content fits
      return {
        firstPart: {
          ...element,
          bounds: {
            x: this.options.margins.left,
            y: startY,
            width: this.contentWidth,
            height: usedLines * actualLineHeight
          }
        },
        remainingParts: []
      };
    }
    
    const firstPartHeight = usedLines * actualLineHeight;
    const remainingDimensions = this.calculateElementDimensions(
      remainingContent, 
      element.type, 
      element.style
    );
    
    return {
      firstPart: {
        ...element,
        content: firstPartContent,
        bounds: {
          x: this.options.margins.left,
          y: startY,
          width: this.contentWidth,
          height: firstPartHeight
        },
        splitInfo: { part: 1, total: 2, continued: true }
      },
      remainingParts: [{
        element: {
          ...element,
          content: remainingContent,
          splitInfo: { part: 2, total: 2, continuation: true }
        },
        dimensions: remainingDimensions
      }]
    };
  }

  /**
   * Split table element with header repetition
   */
  splitTableElement(element, dimensions, availableHeight, pageIndex, startY) {
    const tableData = element.content;
    const headerHeight = dimensions.headerHeight;
    const rowHeights = dimensions.rowHeights;
    
    // Always need space for header + at least 2 rows
    const minRequiredHeight = headerHeight + (rowHeights[0] || 40) + (rowHeights[1] || 40);
    
    if (availableHeight < minRequiredHeight) {
      // Move entire table to next page
      return {
        firstPart: null,
        remainingParts: [{ element, dimensions }]
      };
    }
    
    // Determine how many rows fit on current page
    let currentHeight = headerHeight;
    let fitRows = 0;
    
    for (let i = 0; i < rowHeights.length; i++) {
      if (currentHeight + rowHeights[i] <= availableHeight) {
        currentHeight += rowHeights[i];
        fitRows++;
      } else {
        break;
      }
    }
    
    if (fitRows === rowHeights.length) {
      // Entire table fits
      return {
        firstPart: {
          ...element,
          bounds: {
            x: this.options.margins.left,
            y: startY,
            width: this.contentWidth,
            height: currentHeight
          }
        },
        remainingParts: []
      };
    }
    
    // Split table
    const firstPartRows = tableData.rows.slice(0, fitRows);
    const remainingRows = tableData.rows.slice(fitRows);
    
    const firstPartTable = {
      headers: tableData.headers,
      rows: firstPartRows
    };
    
    const remainingPartTable = {
      headers: tableData.headers, // Repeat headers
      rows: remainingRows
    };
    
    const remainingDimensions = this.calculateTableDimensions(
      remainingPartTable,
      element.style?.fontSize || this.options.defaultFontSize,
      this.contentWidth,
      element.style
    );
    
    return {
      firstPart: {
        ...element,
        content: firstPartTable,
        bounds: {
          x: this.options.margins.left,
          y: startY,
          width: this.contentWidth,
          height: currentHeight
        },
        splitInfo: { part: 1, total: 2, continued: true, type: 'table' }
      },
      remainingParts: [{
        element: {
          ...element,
          content: remainingPartTable,
          splitInfo: { part: 2, total: 2, continuation: true, type: 'table' }
        },
        dimensions: remainingDimensions
      }]
    };
  }

  // Helper methods
  
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

  placeElement(element, dimensions, pageIndex, y) {
    return {
      ...element,
      id: element.id || this.generateId(),
      bounds: {
        x: this.options.margins.left,
        y: y,
        width: dimensions.width,
        height: dimensions.height
      },
      pageIndex: pageIndex,
      dimensions: dimensions,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      zIndex: 0,
      locked: false,
      visible: true
    };
  }

  getAverageCharacterWidth(fontFamily, fontSize) {
    const key = `${fontFamily}-${fontSize}`;
    if (this.fontMetrics.has(key)) {
      return this.fontMetrics.get(key);
    }
    
    // Approximation based on font family
    let multiplier = 0.6; // Default for proportional fonts
    
    if (fontFamily.toLowerCase().includes('courier') || 
        fontFamily.toLowerCase().includes('mono')) {
      multiplier = 0.6; // Monospace
    } else if (fontFamily.toLowerCase().includes('times')) {
      multiplier = 0.55; // Times family
    } else if (fontFamily.toLowerCase().includes('helvetica') || 
               fontFamily.toLowerCase().includes('arial')) {
      multiplier = 0.58; // Sans-serif
    }
    
    const width = fontSize * multiplier;
    this.fontMetrics.set(key, width);
    return width;
  }

  stripMarkdownForMeasurement(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
      .replace(/\*(.*?)\*/g, '$1') // Italic
      .replace(/`(.*?)`/g, '$1') // Code
      .replace(/~~(.*?)~~/g, '$1') // Strikethrough
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Links
  }

  findPreferredSplitPoints(text, fontSize, lineHeight, charsPerLine) {
    const lines = text.split('\n');
    const splitPoints = [];
    let currentPosition = 0;
    
    lines.forEach((line, index) => {
      // End of paragraph is a good split point
      if (index < lines.length - 1 && line.trim() === '') {
        splitPoints.push(currentPosition);
      }
      currentPosition += Math.ceil(line.length / charsPerLine);
    });
    
    return splitPoints;
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

  estimateTextLines(text, fontSize, width) {
    const avgCharWidth = this.getAverageCharacterWidth('Helvetica', fontSize);
    const charsPerLine = Math.floor(width / avgCharWidth);
    const words = text.split(/\s+/);
    
    let lines = 0;
    let currentLineLength = 0;
    
    words.forEach(word => {
      if (currentLineLength + word.length + 1 <= charsPerLine) {
        currentLineLength += word.length + 1;
      } else {
        lines++;
        currentLineLength = word.length;
      }
    });
    
    if (currentLineLength > 0) lines++;
    return Math.max(lines, 1);
  }

  getMinimumElementHeight(type) {
    switch (type) {
      case 'heading': return this.options.defaultFontSize * 2;
      case 'image': return 100;
      case 'table': return this.options.defaultFontSize * 3;
      case 'latex': return this.options.defaultFontSize * 2;
      default: return this.options.defaultFontSize * this.options.defaultLineHeight;
    }
  }

  splitCodeElement(element, dimensions, availableHeight, pageIndex, startY) {
    // Simple line-based splitting for code
    const lines = element.content.split('\n');
    const fontSize = (element.style?.fontSize || this.options.defaultFontSize) * 0.9;
    const lineHeight = 1.2;
    const actualLineHeight = fontSize * lineHeight;
    const padding = this.options.codeBlockPadding;
    
    const availableContentHeight = availableHeight - (padding * 2);
    const availableLines = Math.floor(availableContentHeight / actualLineHeight);
    
    if (availableLines < this.options.orphanLines) {
      return {
        firstPart: null,
        remainingParts: [{ element, dimensions }]
      };
    }
    
    const firstPartLines = lines.slice(0, availableLines);
    const remainingLines = lines.slice(availableLines);
    
    const firstPartContent = firstPartLines.join('\n');
    const remainingContent = remainingLines.join('\n');
    
    const firstPartHeight = (firstPartLines.length * actualLineHeight) + (padding * 2);
    const remainingDimensions = this.calculateCodeDimensions(
      remainingContent,
      element.style?.fontSize || this.options.defaultFontSize,
      this.contentWidth,
      element.style
    );
    
    return {
      firstPart: {
        ...element,
        content: firstPartContent,
        bounds: {
          x: this.options.margins.left,
          y: startY,
          width: this.contentWidth,
          height: firstPartHeight
        },
        splitInfo: { part: 1, total: 2, continued: true, type: 'code' }
      },
      remainingParts: [{
        element: {
          ...element,
          content: remainingContent,
          splitInfo: { part: 2, total: 2, continuation: true, type: 'code' }
        },
        dimensions: remainingDimensions
      }]
    };
  }

  /**
   * Split list element preserving list structure
   */
  splitListElement(element, dimensions, availableHeight, pageIndex, startY) {
    const listItems = Array.isArray(element.content) ? element.content : element.content.split('\n');
    const fontSize = element.style?.fontSize || this.options.defaultFontSize;
    const lineHeight = element.style?.lineHeight || this.options.defaultLineHeight;
    
    let currentHeight = 0;
    let fitItems = 0;
    
    for (let i = 0; i < listItems.length; i++) {
      const itemDimensions = this.calculateTextDimensions(
        listItems[i], fontSize, 'Helvetica', lineHeight, this.contentWidth - (fontSize * 2)
      );
      
      if (currentHeight + itemDimensions.height <= availableHeight) {
        currentHeight += itemDimensions.height;
        fitItems++;
      } else {
        break;
      }
    }
    
    if (fitItems === 0) {
      return {
        firstPart: null,
        remainingParts: [{ element, dimensions }]
      };
    }
    
    if (fitItems === listItems.length) {
      return {
        firstPart: {
          ...element,
          bounds: {
            x: this.options.margins.left,
            y: startY,
            width: this.contentWidth,
            height: currentHeight
          }
        },
        remainingParts: []
      };
    }
    
    const firstPartItems = listItems.slice(0, fitItems);
    const remainingItems = listItems.slice(fitItems);
    
    const remainingDimensions = this.calculateListDimensions(
      remainingItems,
      fontSize,
      'Helvetica',
      lineHeight,
      this.contentWidth,
      element.style
    );
    
    return {
      firstPart: {
        ...element,
        content: firstPartItems,
        bounds: {
          x: this.options.margins.left,
          y: startY,
          width: this.contentWidth,
          height: currentHeight
        },
        splitInfo: { part: 1, total: 2, continued: true, type: 'list' }
      },
      remainingParts: [{
        element: {
          ...element,
          content: remainingItems,
          splitInfo: { part: 2, total: 2, continuation: true, type: 'list' }
        },
        dimensions: remainingDimensions
      }]
    };
  }

  /**
   * Generate unique ID for elements
   */
  generateId() {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  /**
   * Parse conversation content into structured elements
   */
  parseConversationToElements(conversationData) {
    const elements = [];
    
    // Add title element
    if (conversationData.title) {
      elements.push({
        type: 'heading',
        content: conversationData.title,
        style: {
          fontSize: 18,
          fontWeight: 'bold',
          color: '#1976D2',
          marginBottom: 30
        }
      });
    }
    
    // Process messages
    if (conversationData.messages) {
      conversationData.messages.forEach(message => {
        if (message.message?.content?.parts) {
          message.message.content.parts.forEach(part => {
            if (typeof part === 'string' && part.trim()) {
              // Skip system messages with empty content
              if (message.message.author?.role === 'system' && part.trim().length === 0) {
                return;
              }
              
              // Add role header
              const roleText = message.message.author?.role === 'user' ? 'User:' : 'Assistant:';
              elements.push({
                type: 'text',
                content: roleText,
                style: {
                  fontSize: 14,
                  fontWeight: 'bold',
                  color: message.message.author?.role === 'user' ? '#2E7D32' : '#1976D2',
                  marginBottom: 5
                }
              });
              
              // Parse content for different types (code, LaTeX, etc.)
              const contentElements = this.parseContentTypes(part.trim());
              elements.push(...contentElements);
            }
          });
        }
      });
    }
    
    return elements;
  }

  /**
   * Parse content to identify different types (LaTeX, markdown, code blocks, etc.)
   * Process in order: LaTeX first, then markdown, then restore LaTeX
   */
  parseContentTypes(content) {
    const elements = [];
    
    // Step 1: Extract LaTeX segments first
    const { text: textWithPlaceholders, segments: latexSegments } = this.extractLatexSegments(content);
    
    // Step 2: Parse markdown on text with LaTeX placeholders
    const markdownParsed = this.parseMarkdownContent(textWithPlaceholders);
    
    // Step 3: Split into content blocks and restore LaTeX
    const parts = this.splitContentByType(markdownParsed, latexSegments);
    
    parts.forEach(part => {
      elements.push({
        type: part.type,
        content: part.content,
        style: {
          ...this.getDefaultStyleForType(part.type, part.level),
          latexSegments: part.latexSegments || []
        },
        latexSegments: part.latexSegments || []
      });
    });
    
    return elements;
  }

  /**
   * Split content into different types (text, code, LaTeX, etc.)
   */
  splitContentByType(content, latexSegments = []) {
    const parts = [];
    
    // Extract code blocks first
    const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        const textContent = content.substring(lastIndex, match.index).trim();
        if (textContent) {
          parts.push(...this.parseTextContent(textContent, latexSegments));
        }
      }
      
      // Add code block
      parts.push({
        type: 'code',
        content: match[2].trim(),
        language: match[1] || 'text'
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < content.length) {
      const remainingContent = content.substring(lastIndex).trim();
      if (remainingContent) {
        parts.push(...this.parseTextContent(remainingContent, latexSegments));
      }
    }
    
    return parts.length > 0 ? parts : [{ 
      type: 'text', 
      content: content,
      latexSegments: latexSegments 
    }];
  }

  /**
   * Parse text content that may contain LaTeX placeholders
   */
  parseTextContent(text, latexSegments = []) {
    // Check for headers and other markdown structures
    const lines = text.split('\n');
    const parts = [];
    let currentParagraph = '';
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      
      // Check for headers
      if (trimmedLine.match(/^#{1,6}\s+/)) {
        // Finish current paragraph if any
        if (currentParagraph.trim()) {
          parts.push({ 
            type: 'text', 
            content: currentParagraph.trim(),
            latexSegments: this.getRelevantLatexSegments(currentParagraph, latexSegments)
          });
          currentParagraph = '';
        }
        
        // Add header
        const headerMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
        if (headerMatch) {
          const level = headerMatch[1].length;
          const headerText = headerMatch[2];
          parts.push({
            type: 'heading',
            content: headerText,
            level: level,
            latexSegments: this.getRelevantLatexSegments(headerText, latexSegments)
          });
        }
      } else if (trimmedLine === '') {
        // Empty line - end of paragraph
        if (currentParagraph.trim()) {
          parts.push({ 
            type: 'text', 
            content: currentParagraph.trim(),
            latexSegments: this.getRelevantLatexSegments(currentParagraph, latexSegments)
          });
          currentParagraph = '';
        }
      } else {
        // Regular text line
        currentParagraph += (currentParagraph ? '\n' : '') + line;
      }
    });
    
    // Add remaining paragraph
    if (currentParagraph.trim()) {
      parts.push({ 
        type: 'text', 
        content: currentParagraph.trim(),
        latexSegments: this.getRelevantLatexSegments(currentParagraph, latexSegments)
      });
    }
    
    return parts.length > 0 ? parts : [{ 
      type: 'text', 
      content: text,
      latexSegments: latexSegments 
    }];
  }

  /**
   * Extract LaTeX segments from text content (matches latexUtils.js approach)
   */
  extractLatexSegments(text) {
    if (!text || typeof text !== 'string') {
      return { text: '', segments: [] };
    }
    
    const segments = [];
    let idx = 0;
    
    // Process display LaTeX with double dollar signs: $$ ... $$ (should come first)
    let processedText = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, content) => {
      const key = `@@MATH${idx}@@`;
      segments.push({ key, math: content.trim(), type: 'block' });
      idx++;
      return key;
    });
    
    // Process block LaTeX: \[ ... \]
    processedText = processedText.replace(/\\\[((?:.|\n)+?)\\\]/g, (_, content) => {
      const key = `@@MATH${idx}@@`;
      segments.push({ key, math: content, type: 'block' });
      idx++;
      return key;
    });
    
    // Process inline LaTeX: \( ... \)
    processedText = processedText.replace(/\\\((.+?)\\\)/g, (_, content) => {
      const key = `@@MATH${idx}@@`;
      segments.push({ key, math: content, type: 'inline' });
      idx++;
      return key;
    });
    
    // Process inline LaTeX with single dollar signs: $ ... $
    processedText = processedText.replace(/\$([^$\n]+?)\$/g, (match, content) => {
      // Validation: Check if content looks like mathematics
      if (content.includes('\\') || 
          content.match(/\\[a-zA-Z]+/) || 
          content.includes('{') || 
          content.includes('^') || 
          content.includes('_') ||
          content.match(/^[a-zA-Z]$/) ||
          content.match(/^[a-zA-Z][0-9]*$/) || 
          (content.match(/^[a-zA-Z]+$/) && content.length <= 3) ||
          content.includes('+') || content.includes('-') || content.includes('*') ||
          content.includes('/') || content.includes('=') || content.includes('<') ||
          content.includes('>')) {
        
        // Exclude obvious non-mathematical content (currency patterns)
        if (!content.match(/^[0-9]+\.?[0-9]*$/) && 
            !content.match(/^[0-9]+$/) && 
            !(content.includes('.') && content.match(/[0-9]/) && !content.match(/[a-zA-Z]/))) {
          const key = `@@MATH${idx}@@`;
          segments.push({ key, math: content, type: 'inline' });
          idx++;
          return key;
        }
      }
      
      return match; // Leave as is if not mathematical
    });
    
    return { text: processedText, segments };
  }

  /**
   * Parse markdown content (headers, bold, italic, etc.)
   */
  parseMarkdownContent(text) {
    // Basic markdown parsing (similar to markdown-gfm.js but simpler)
    let processed = text;
    
    // Escape HTML entities first
    processed = processed.replace(/&(?![a-zA-Z]+;|#\d+;)/g, '&amp;')
                      .replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;');
    
    // Process headers (will be handled in parseTextContent)
    // Process bold/italic
    processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    processed = processed.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    processed = processed.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    processed = processed.replace(/_([^_]+)_/g, '<em>$1</em>');
    processed = processed.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    processed = processed.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    return processed;
  }

  /**
   * Get LaTeX segments relevant to a specific text portion
   */
  getRelevantLatexSegments(text, allSegments) {
    if (!allSegments || allSegments.length === 0) return [];
    
    return allSegments.filter(segment => text.includes(segment.key));
  }

  /**
   * Get default style for element type
   */
  getDefaultStyleForType(type, level = null) {
    switch (type) {
      case 'heading':
        const headingSizes = [20, 18, 16, 14, 12, 11]; // H1 to H6
        const fontSize = headingSizes[Math.min((level || 1) - 1, 5)];
        return {
          fontSize: fontSize,
          fontWeight: 'bold',
          marginBottom: Math.max(20 - ((level || 1) - 1) * 2, 10),
          color: '#1976D2'
        };
      case 'code':
        return {
          fontSize: 10,
          fontFamily: 'Courier',
          backgroundColor: '#f5f5f5',
          padding: 12,
          marginBottom: 15
        };
      case 'latex':
        return {
          fontSize: 12,
          marginBottom: 15,
          textAlign: 'center'
        };
      case 'text':
      default:
        return {
          fontSize: 11,
          fontFamily: 'Helvetica',
          marginBottom: 15,
          color: '#000000'
        };
    }
  }
}

module.exports = ContentLayoutEngine;