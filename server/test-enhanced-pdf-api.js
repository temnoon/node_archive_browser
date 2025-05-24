const fetch = require('node-fetch');

/**
 * Enhanced PDF Editor API Test Script
 * Tests all major API endpoints to verify functionality
 */
class EnhancedPdfApiTester {
  constructor() {
    this.baseUrl = 'http://localhost:3001/api/enhanced-pdf';
    this.testDocument = null;
    this.testResults = {};
  }

  async runAllTests() {
    console.log('🚀 Starting Enhanced PDF Editor API Tests...\n');
    
    const tests = [
      { name: 'Health Check', fn: this.testHealth },
      { name: 'Capabilities Check', fn: this.testCapabilities },
      { name: 'Font System', fn: this.testFontSystem },
      { name: 'Document Creation', fn: this.testDocumentCreation },
      { name: 'Page Management', fn: this.testPageManagement },
      { name: 'Element Operations', fn: this.testElementOperations },
      { name: 'Typography Services', fn: this.testTypographyServices },
      { name: 'Document Export', fn: this.testDocumentExport },
      { name: 'Conversation Integration', fn: this.testConversationIntegration }
    ];

    for (const test of tests) {
      try {
        console.log(`📋 Testing: ${test.name}`);
        await test.fn.call(this);
        this.testResults[test.name] = '✅ PASSED';
        console.log(`✅ ${test.name} - PASSED\n`);
      } catch (error) {
        this.testResults[test.name] = `❌ FAILED: ${error.message}`;
        console.log(`❌ ${test.name} - FAILED: ${error.message}\n`);
      }
    }

    this.printSummary();
  }

  async apiCall(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  async testHealth() {
    const response = await this.apiCall('/health');
    if (!response.success || response.health !== 'OK') {
      throw new Error('Health check failed');
    }
    console.log(`   📊 Services: ${Object.keys(response.services).join(', ')}`);
  }

  async testCapabilities() {
    const response = await this.apiCall('/capabilities');
    if (!response.success || !response.capabilities) {
      throw new Error('Capabilities check failed');
    }
    const caps = response.capabilities;
    console.log(`   ✨ Document: ${caps.document.create ? '✓' : '✗'} Create, ${caps.document.edit ? '✓' : '✗'} Edit`);
    console.log(`   ✨ Text: ${caps.text.richFormatting ? '✓' : '✗'} Rich Formatting, ${caps.text.customFonts ? '✓' : '✗'} Custom Fonts`);
    console.log(`   ✨ Graphics: ${caps.graphics.vectorShapes ? '✓' : '✗'} Vector Shapes, ${caps.graphics.images ? '✓' : '✗'} Images`);
  }

  async testFontSystem() {
    // Test font listing
    const fontsResponse = await this.apiCall('/fonts');
    if (!fontsResponse.success || !Array.isArray(fontsResponse.fonts)) {
      throw new Error('Font listing failed');
    }
    console.log(`   🔤 Available fonts: ${fontsResponse.fonts.length}`);
    
    // Test font stats
    const statsResponse = await this.apiCall('/fonts/stats');
    if (!statsResponse.success || !statsResponse.stats) {
      throw new Error('Font stats failed');
    }
    console.log(`   📈 Font stats: ${statsResponse.stats.total} total, ${statsResponse.stats.system} system, ${statsResponse.stats.web} web`);
    
    // Test specific font details
    if (fontsResponse.fonts.length > 0) {
      const firstFont = fontsResponse.fonts[0];
      const fontResponse = await this.apiCall(`/fonts/${encodeURIComponent(firstFont.familyName)}`);
      if (!fontResponse.success || !fontResponse.font) {
        throw new Error('Font details failed');
      }
      console.log(`   🔍 Font details for ${firstFont.familyName}: ${fontResponse.font.type} type`);
    }
  }

  async testDocumentCreation() {
    // Create new document
    const createResponse = await this.apiCall('/documents', {
      method: 'POST',
      body: JSON.stringify({
        title: 'API Test Document',
        size: 'A4',
        orientation: 'portrait',
        author: 'API Tester'
      })
    });
    
    if (!createResponse.success || !createResponse.document) {
      throw new Error('Document creation failed');
    }
    
    this.testDocument = createResponse.document;
    console.log(`   📄 Created document: ${this.testDocument.id}`);
    console.log(`   📏 Pages: ${this.testDocument.pages.length}, Size: ${this.testDocument.settings.size}`);
    
    // Test document retrieval
    const getResponse = await this.apiCall(`/documents/${this.testDocument.id}`);
    if (!getResponse.success || !getResponse.document) {
      throw new Error('Document retrieval failed');
    }
    
    // Test document state
    const stateResponse = await this.apiCall(`/documents/${this.testDocument.id}/state`);
    if (!stateResponse.success || !stateResponse.state) {
      throw new Error('Document state failed');
    }
    console.log(`   📊 Document state: ${stateResponse.state.pageCount} pages, ${stateResponse.state.elementCount} elements`);
  }

  async testPageManagement() {
    if (!this.testDocument) {
      throw new Error('No test document available');
    }
    
    // Add a new page
    const addPageResponse = await this.apiCall(`/documents/${this.testDocument.id}/pages`, {
      method: 'POST',
      body: JSON.stringify({
        size: 'A4',
        orientation: 'portrait'
      })
    });
    
    if (!addPageResponse.success || !addPageResponse.page) {
      throw new Error('Page addition failed');
    }
    
    console.log(`   📑 Added page: ${addPageResponse.page.id}`);
    
    // Update local document reference
    this.testDocument.pages.push(addPageResponse.page);
  }

  async testElementOperations() {
    if (!this.testDocument || this.testDocument.pages.length === 0) {
      throw new Error('No test document or pages available');
    }
    
    const pageId = this.testDocument.pages[0].id;
    
    // Add text element
    const textElementResponse = await this.apiCall(`/documents/${this.testDocument.id}/pages/${pageId}/elements`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'text',
        bounds: { x: 100, y: 100, width: 200, height: 40 },
        content: 'API Test Text Element',
        style: {
          fontFamily: 'Helvetica',
          fontSize: 14,
          color: '#000000',
          textAlign: 'left'
        }
      })
    });
    
    if (!textElementResponse.success || !textElementResponse.element) {
      throw new Error('Text element creation failed');
    }
    
    const textElement = textElementResponse.element;
    console.log(`   📝 Added text element: ${textElement.id}`);
    
    // Add shape element
    const shapeElementResponse = await this.apiCall(`/documents/${this.testDocument.id}/pages/${pageId}/elements`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'shape',
        bounds: { x: 200, y: 200, width: 100, height: 100 },
        content: { shape: 'rectangle' },
        style: {
          fill: '#e3f2fd',
          stroke: '#2196f3',
          strokeWidth: 2
        }
      })
    });
    
    if (!shapeElementResponse.success || !shapeElementResponse.element) {
      throw new Error('Shape element creation failed');
    }
    
    const shapeElement = shapeElementResponse.element;
    console.log(`   🔷 Added shape element: ${shapeElement.id}`);
    
    // Update text element
    const updateResponse = await this.apiCall(`/documents/${this.testDocument.id}/pages/${pageId}/elements/${textElement.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        content: 'Updated API Test Text',
        style: {
          ...textElement.style,
          fontSize: 16,
          color: '#2196f3'
        }
      })
    });
    
    if (!updateResponse.success || !updateResponse.element) {
      throw new Error('Element update failed');
    }
    
    console.log(`   ✏️ Updated text element with new content and style`);
    
    // Store elements for export test
    this.testDocument.testElements = [textElement, shapeElement];
  }

  async testTypographyServices() {
    // Test text metrics calculation
    const metricsResponse = await this.apiCall('/typography/metrics', {
      method: 'POST',
      body: JSON.stringify({
        text: 'Sample text for metrics calculation',
        fontFamily: 'Helvetica',
        fontSize: 14,
        options: { lineHeight: 1.2 }
      })
    });
    
    if (!metricsResponse.success || !metricsResponse.metrics) {
      throw new Error('Text metrics calculation failed');
    }
    
    const metrics = metricsResponse.metrics;
    console.log(`   📏 Text metrics: ${Math.round(metrics.width)}x${Math.round(metrics.height)} px`);
    
    // Test OpenType features
    const featuresResponse = await this.apiCall('/typography/features', {
      method: 'POST',
      body: JSON.stringify({
        text: 'Sample text with ligatures: fi fl ff',
        fontFamily: 'Helvetica',
        features: { liga: true }
      })
    });
    
    if (!featuresResponse.success) {
      throw new Error('OpenType features failed');
    }
    
    console.log(`   ✨ OpenType features applied: ${featuresResponse.originalText} → ${featuresResponse.processedText}`);
  }

  async testDocumentExport() {
    if (!this.testDocument) {
      throw new Error('No test document available');
    }
    
    // Test PDF export
    const exportResponse = await fetch(`${this.baseUrl}/documents/${this.testDocument.id}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'pdf' })
    });
    
    if (!exportResponse.ok) {
      throw new Error(`PDF export failed: ${exportResponse.statusText}`);
    }
    
    const pdfBuffer = await exportResponse.buffer();
    console.log(`   📄 PDF exported: ${pdfBuffer.length} bytes`);
    
    // Test preview generation
    const previewResponse = await this.apiCall(`/documents/${this.testDocument.id}/preview?pageIndex=0&resolution=150`);
    if (!previewResponse.success || !previewResponse.preview) {
      throw new Error('Preview generation failed');
    }
    
    console.log(`   🖼️ Preview generated for page ${previewResponse.preview.pageIndex}`);
  }

  async testConversationIntegration() {
    // Test creating document from conversation
    const convResponse = await this.apiCall('/from-conversation/test-conversation-id', {
      method: 'POST',
      body: JSON.stringify({
        template: 'academic',
        options: { includeMetadata: true }
      })
    });
    
    if (!convResponse.success || !convResponse.document) {
      throw new Error('Conversation integration failed');
    }
    
    console.log(`   🗨️ Created document from conversation: ${convResponse.document.id}`);
    console.log(`   📝 Title: ${convResponse.document.metadata.title}`);
    
    // Clean up test conversation document
    try {
      await this.apiCall(`/documents/${convResponse.document.id}`, { method: 'DELETE' });
    } catch (error) {
      console.log(`   ⚠️ Cleanup warning: ${error.message}`);
    }
  }

  printSummary() {
    console.log('📊 TEST SUMMARY');
    console.log('================');
    
    let passed = 0;
    let failed = 0;
    
    Object.entries(this.testResults).forEach(([test, result]) => {
      console.log(`${result.startsWith('✅') ? '✅' : '❌'} ${test}: ${result}`);
      if (result.startsWith('✅')) passed++;
      else failed++;
    });
    
    console.log(`\n📈 Results: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
      console.log('🎉 All tests passed! Enhanced PDF Editor API is working correctly.');
    } else {
      console.log('⚠️ Some tests failed. Check the API implementation.');
    }
    
    // Cleanup
    if (this.testDocument) {
      this.cleanup();
    }
  }

  async cleanup() {
    try {
      await this.apiCall(`/documents/${this.testDocument.id}`, { method: 'DELETE' });
      console.log(`\n🧹 Cleaned up test document: ${this.testDocument.id}`);
    } catch (error) {
      console.log(`\n⚠️ Cleanup failed: ${error.message}`);
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new EnhancedPdfApiTester();
  tester.runAllTests()
    .then(() => {
      console.log('\n✨ Enhanced PDF Editor API testing complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Test runner failed:', error);
      process.exit(1);
    });
}

module.exports = EnhancedPdfApiTester;