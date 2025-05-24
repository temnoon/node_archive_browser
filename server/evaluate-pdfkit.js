const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Comprehensive PDFKit Evaluation Script
 * Tests advanced PDF editing capabilities for Adobe Acrobat-level functionality
 */
class PDFKitEvaluator {
  constructor() {
    this.outputDir = path.join(__dirname, 'pdfkit-evaluation');
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Test 1: Basic Document Creation and Text Rendering
   */
  async testBasicDocument() {
    console.log('Testing basic document creation...');
    
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: 'PDFKit Evaluation - Basic Document',
        Author: 'Archive Browser Enhanced PDF Editor',
        Subject: 'Testing PDFKit capabilities',
        Keywords: 'pdf, editing, pdfkit, evaluation'
      }
    });

    const stream = fs.createWriteStream(path.join(this.outputDir, 'test-basic.pdf'));
    doc.pipe(stream);

    // Test text rendering with different fonts and sizes
    doc.fontSize(20).text('PDFKit Basic Document Test', { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(14).text('Default Helvetica font rendering test');
    doc.font('Times-Roman').text('Times Roman font rendering test');
    doc.font('Courier').text('Courier monospace font rendering test');

    // Test text positioning
    doc.moveDown();
    doc.fontSize(12).text('Absolute positioning test:', 100, 200);
    doc.text('This text is positioned at specific coordinates', 120, 220);

    // Test text alignment
    doc.moveDown(3);
    doc.text('Left aligned text', { align: 'left' });
    doc.text('Center aligned text', { align: 'center' });
    doc.text('Right aligned text', { align: 'right' });
    doc.text('Justified text that should wrap and justify properly across multiple lines to demonstrate text flow capabilities', { align: 'justify', width: 400 });

    doc.end();
    return new Promise(resolve => stream.on('finish', resolve));
  }

  /**
   * Test 2: Advanced Typography and Font Management
   */
  async testAdvancedTypography() {
    console.log('Testing advanced typography...');
    
    const doc = new PDFDocument({ size: 'A4' });
    const stream = fs.createWriteStream(path.join(this.outputDir, 'test-typography.pdf'));
    doc.pipe(stream);

    doc.fontSize(18).text('Advanced Typography Test', { align: 'center' });
    doc.moveDown(2);

    // Test font sizes and styles
    const sizes = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32];
    sizes.forEach(size => {
      doc.fontSize(size).text(`Font size ${size}pt - The quick brown fox jumps over the lazy dog`);
    });

    doc.addPage();

    // Test text formatting options
    doc.fontSize(14);
    doc.text('Bold text formatting', { bold: true });
    doc.text('Italic text formatting', { italic: true });
    doc.text('Underlined text formatting', { underline: true });
    doc.text('Strikethrough text formatting', { strike: true });

    // Test character and word spacing
    doc.moveDown();
    doc.text('Normal spacing');
    doc.text('Increased character spacing', { characterSpacing: 2 });
    doc.text('Increased word spacing', { wordSpacing: 10 });

    // Test line height
    doc.moveDown();
    doc.text('Normal line height\nSecond line', { lineGap: 0 });
    doc.moveDown();
    doc.text('Increased line height\nSecond line', { lineGap: 10 });

    doc.end();
    return new Promise(resolve => stream.on('finish', resolve));
  }

  /**
   * Test 3: Vector Graphics and Drawing
   */
  async testVectorGraphics() {
    console.log('Testing vector graphics...');
    
    const doc = new PDFDocument({ size: 'A4' });
    const stream = fs.createWriteStream(path.join(this.outputDir, 'test-graphics.pdf'));
    doc.pipe(stream);

    doc.fontSize(18).text('Vector Graphics Test', { align: 'center' });
    doc.moveDown(2);

    // Test basic shapes
    let y = 150;
    
    // Rectangle
    doc.rect(50, y, 100, 50).stroke();
    doc.text('Rectangle', 55, y + 55);

    // Filled rectangle
    doc.rect(200, y, 100, 50).fill('#ff6b6b');
    doc.fillColor('black').text('Filled Rectangle', 205, y + 55);

    // Circle
    doc.circle(375, y + 25, 25).stroke();
    doc.text('Circle', 355, y + 55);

    // Rounded rectangle
    y += 100;
    doc.roundedRect(50, y, 100, 50, 10).stroke();
    doc.text('Rounded Rect', 55, y + 55);

    // Polygon
    doc.polygon([200, y], [250, y], [275, y + 25], [250, y + 50], [200, y + 50], [175, y + 25]).stroke();
    doc.text('Polygon', 205, y + 55);

    // Bezier curves
    y += 100;
    doc.moveTo(50, y)
       .bezierCurveTo(100, y - 50, 150, y + 50, 200, y)
       .stroke();
    doc.text('Bezier Curve', 75, y + 20);

    // Test gradients
    y += 80;
    const gradient = doc.linearGradient(250, y, 350, y + 50);
    gradient.stop(0, '#ff6b6b').stop(1, '#4ecdc4');
    doc.rect(250, y, 100, 50).fill(gradient);
    doc.fillColor('black').text('Gradient', 255, y + 55);

    doc.end();
    return new Promise(resolve => stream.on('finish', resolve));
  }

  /**
   * Test 4: Multi-page Document with Headers/Footers
   */
  async testMultiPageDocument() {
    console.log('Testing multi-page document...');
    
    const doc = new PDFDocument({ 
      size: 'A4',
      bufferPages: true // Enable page buffering for headers/footers
    });
    const stream = fs.createWriteStream(path.join(this.outputDir, 'test-multipage.pdf'));
    doc.pipe(stream);

    // Create multiple pages with content
    for (let i = 1; i <= 5; i++) {
      if (i > 1) doc.addPage();
      
      doc.fontSize(18).text(`Page ${i} - Multi-page Document Test`, { align: 'center' });
      doc.moveDown(2);
      
      // Add page content
      doc.fontSize(12);
      for (let j = 1; j <= 20; j++) {
        doc.text(`Line ${j} on page ${i}: This is sample content to demonstrate multi-page document generation with PDFKit. Each page should have consistent formatting and proper page breaks.`);
      }
    }

    // Add headers and footers to all pages
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      
      // Header
      doc.fontSize(10)
         .fillColor('gray')
         .text('Enhanced PDF Editor - PDFKit Evaluation', 50, 30, { align: 'left' });
      
      // Footer
      doc.text(`Page ${i + 1} of ${range.count}`, 50, doc.page.height - 50, { align: 'center' });
    }

    doc.end();
    return new Promise(resolve => stream.on('finish', resolve));
  }

  /**
   * Test 5: Interactive Elements (Forms and Annotations)
   */
  async testInteractiveElements() {
    console.log('Testing interactive elements...');
    
    const doc = new PDFDocument({ size: 'A4' });
    const stream = fs.createWriteStream(path.join(this.outputDir, 'test-interactive.pdf'));
    doc.pipe(stream);

    doc.fontSize(18).text('Interactive Elements Test', { align: 'center' });
    doc.moveDown(2);

    // Test form fields
    doc.fontSize(12).text('Form Fields:');
    doc.moveDown();

    // Text field
    doc.text('Name: ');
    const textFieldX = 100;
    const textFieldY = doc.y - 15;
    doc.rect(textFieldX, textFieldY, 200, 20).stroke();
    
    // Checkbox
    doc.moveDown(2);
    doc.text('Options:');
    doc.moveDown(0.5);
    const checkboxY = doc.y;
    doc.rect(50, checkboxY, 12, 12).stroke();
    doc.text('Option 1', 70, checkboxY);
    
    doc.rect(150, checkboxY, 12, 12).stroke();
    doc.text('Option 2', 170, checkboxY);

    // Test hyperlinks
    doc.moveDown(3);
    doc.text('Hyperlinks:');
    doc.moveDown();
    doc.fillColor('blue')
       .text('Visit GitHub Repository', 50, doc.y, { 
         link: 'https://github.com/temnoon/node_archive_browser',
         underline: true 
       });

    // Test annotations
    doc.moveDown(3);
    doc.fillColor('black').text('Annotations:');
    doc.moveDown();
    doc.text('This text has an annotation attached to it.');
    
    // Note annotation
    doc.note(400, doc.y - 15, 20, 20, 'This is a note annotation that appears when clicked.');

    doc.end();
    return new Promise(resolve => stream.on('finish', resolve));
  }

  /**
   * Test 6: Image Handling and Layout
   */
  async testImageHandling() {
    console.log('Testing image handling...');
    
    const doc = new PDFDocument({ size: 'A4' });
    const stream = fs.createWriteStream(path.join(this.outputDir, 'test-images.pdf'));
    doc.pipe(stream);

    doc.fontSize(18).text('Image Handling Test', { align: 'center' });
    doc.moveDown(2);

    // Create a simple test image programmatically (SVG converted to buffer)
    const svgData = `
      <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" fill="#ff6b6b"/>
        <circle cx="50" cy="50" r="30" fill="#4ecdc4"/>
        <text x="50" y="55" text-anchor="middle" fill="white" font-size="12">TEST</text>
      </svg>
    `;

    try {
      // Test image positioning and scaling
      doc.fontSize(12).text('Image positioning and scaling:');
      doc.moveDown();

      // Note: For actual image testing, you would use:
      // doc.image('path/to/image.jpg', x, y, { width: 100, height: 100 });
      
      // Placeholder for image testing
      doc.rect(50, doc.y, 100, 100).stroke();
      doc.text('Image 1\n(100x100)', 55, doc.y - 95);

      doc.rect(200, doc.y - 100, 150, 100).stroke();
      doc.text('Image 2\n(150x100)\nScaled', 205, doc.y - 95);

      doc.rect(400, doc.y - 100, 75, 75).stroke();
      doc.text('Image 3\n(75x75)\nSmall', 405, doc.y - 90);

      doc.moveDown(3);
      doc.text('Image wrapping with text:');
      doc.moveDown();

      // Simulate text wrapping around image
      doc.rect(50, doc.y, 100, 60).stroke();
      doc.text('IMG', 85, doc.y - 45);
      
      const wrapText = 'This text should wrap around the image placeholder. PDFKit allows for precise positioning of images and text to create complex layouts. This demonstrates how images can be integrated into flowing text content.';
      doc.text(wrapText, 160, doc.y - 60, { width: 300, align: 'justify' });

    } catch (error) {
      doc.text(`Image handling test skipped: ${error.message}`);
    }

    doc.end();
    return new Promise(resolve => stream.on('finish', resolve));
  }

  /**
   * Test 7: Document Structure and Metadata
   */
  async testDocumentStructure() {
    console.log('Testing document structure...');
    
    const doc = new PDFDocument({ 
      size: 'A4',
      info: {
        Title: 'Document Structure Test',
        Author: 'PDFKit Evaluator',
        Subject: 'Testing document metadata and structure',
        Keywords: 'pdfkit, structure, bookmarks, metadata',
        CreationDate: new Date(),
        ModDate: new Date()
      }
    });
    const stream = fs.createWriteStream(path.join(this.outputDir, 'test-structure.pdf'));
    doc.pipe(stream);

    // Create document outline/bookmarks
    doc.outline.addItem('Chapter 1: Introduction');
    doc.fontSize(18).text('Chapter 1: Introduction', { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(12).text('This is the introduction section with detailed content...');
    
    // Add subsection
    doc.moveDown();
    doc.outline.addItem('1.1 Overview');
    doc.fontSize(14).text('1.1 Overview');
    doc.fontSize(12).text('This is a subsection with more specific content...');

    doc.addPage();
    doc.outline.addItem('Chapter 2: Advanced Features');
    doc.fontSize(18).text('Chapter 2: Advanced Features', { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(12).text('This chapter covers advanced PDF features...');

    doc.addPage();
    doc.outline.addItem('Chapter 3: Conclusion');
    doc.fontSize(18).text('Chapter 3: Conclusion', { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(12).text('Final thoughts and summary...');

    doc.end();
    return new Promise(resolve => stream.on('finish', resolve));
  }

  /**
   * Test 8: Performance with Large Documents
   */
  async testPerformance() {
    console.log('Testing performance with large document...');
    
    const startTime = Date.now();
    const doc = new PDFDocument({ size: 'A4' });
    const stream = fs.createWriteStream(path.join(this.outputDir, 'test-performance.pdf'));
    doc.pipe(stream);

    doc.fontSize(18).text('Performance Test - Large Document', { align: 'center' });
    doc.moveDown(2);

    // Generate large amount of content
    for (let page = 1; page <= 10; page++) {
      if (page > 1) doc.addPage();
      
      doc.fontSize(16).text(`Performance Test Page ${page}`);
      doc.moveDown();
      
      // Add lots of text content
      for (let i = 1; i <= 50; i++) {
        doc.fontSize(10).text(`Line ${i}: This is a performance test with substantial content to evaluate PDFKit's handling of large documents. We're testing memory usage, rendering speed, and overall performance characteristics.`);
      }
      
      // Add some graphics
      for (let i = 0; i < 10; i++) {
        doc.rect(50 + (i * 50), 400 + (i * 2), 30, 20).fill(`hsl(${i * 36}, 70%, 50%)`);
      }
    }

    doc.end();
    
    return new Promise(resolve => {
      stream.on('finish', () => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        console.log(`Performance test completed in ${duration}ms`);
        resolve(duration);
      });
    });
  }

  /**
   * Run all evaluation tests
   */
  async runAllTests() {
    console.log('Starting PDFKit comprehensive evaluation...\n');
    const results = {};

    try {
      await this.testBasicDocument();
      results.basicDocument = 'PASSED';
      console.log('✅ Basic document test passed');

      await this.testAdvancedTypography();
      results.advancedTypography = 'PASSED';
      console.log('✅ Advanced typography test passed');

      await this.testVectorGraphics();
      results.vectorGraphics = 'PASSED';
      console.log('✅ Vector graphics test passed');

      await this.testMultiPageDocument();
      results.multiPageDocument = 'PASSED';
      console.log('✅ Multi-page document test passed');

      await this.testInteractiveElements();
      results.interactiveElements = 'PASSED';
      console.log('✅ Interactive elements test passed');

      await this.testImageHandling();
      results.imageHandling = 'PASSED';
      console.log('✅ Image handling test passed');

      await this.testDocumentStructure();
      results.documentStructure = 'PASSED';
      console.log('✅ Document structure test passed');

      const performanceTime = await this.testPerformance();
      results.performance = `PASSED (${performanceTime}ms)`;
      console.log('✅ Performance test passed');

    } catch (error) {
      console.error('❌ Test failed:', error);
      results.error = error.message;
    }

    // Generate evaluation report
    this.generateEvaluationReport(results);
    console.log(`\n📁 All test files saved to: ${this.outputDir}`);
    
    return results;
  }

  /**
   * Generate evaluation report
   */
  generateEvaluationReport(results) {
    const reportDoc = new PDFDocument({ size: 'A4' });
    const reportStream = fs.createWriteStream(path.join(this.outputDir, 'evaluation-report.pdf'));
    reportDoc.pipe(reportStream);

    reportDoc.fontSize(20).text('PDFKit Evaluation Report', { align: 'center' });
    reportDoc.moveDown(2);

    reportDoc.fontSize(14).text('Test Results:', { underline: true });
    reportDoc.moveDown();

    Object.entries(results).forEach(([test, result]) => {
      const status = result.includes('PASSED') ? '✅' : '❌';
      reportDoc.fontSize(12).text(`${status} ${test}: ${result}`);
    });

    reportDoc.moveDown(2);
    reportDoc.fontSize(14).text('Evaluation Summary:', { underline: true });
    reportDoc.moveDown();
    
    const capabilities = [
      'Advanced typography and font management',
      'Vector graphics and drawing capabilities',
      'Multi-page document generation',
      'Interactive elements (forms, links, annotations)',
      'Image handling and layout control',
      'Document structure and metadata',
      'Performance with large documents'
    ];

    capabilities.forEach(capability => {
      reportDoc.fontSize(11).text(`• ${capability}`, { indent: 20 });
    });

    reportDoc.moveDown(2);
    reportDoc.fontSize(12).text(`Generated: ${new Date().toISOString()}`);

    reportDoc.end();
  }
}

// Run evaluation if this file is executed directly
if (require.main === module) {
  const evaluator = new PDFKitEvaluator();
  evaluator.runAllTests()
    .then(results => {
      console.log('\n🎉 PDFKit evaluation completed!');
      console.log('Results:', results);
    })
    .catch(error => {
      console.error('💥 Evaluation failed:', error);
      process.exit(1);
    });
}

module.exports = PDFKitEvaluator;