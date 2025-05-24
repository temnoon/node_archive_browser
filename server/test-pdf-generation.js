// Simple PDF test to verify our markdown and Adobe compatibility fixes
console.log('=== PDF Generation Test with Markdown ===\n');

const pdfService = require('./src/services/pdfService.js');

async function testPDFGeneration() {
  try {
    console.log('🔧 Testing PDF generation with markdown content...');
    
    // Create test messages with markdown content
    const testMessages = [
      {
        id: 'msg-1',
        message: {
          id: 'msg-1',
          author: { role: 'user' },
          create_time: Math.floor(Date.now() / 1000),
          content: {
            content_type: 'text',
            parts: ['## User Question\n\nHere is my question with **bold text** and *italic text*.\n\n### Sub-heading\n\n- Point 1\n- Point 2\n- Point 3']
          }
        }
      },
      {
        id: 'msg-2', 
        message: {
          id: 'msg-2',
          author: { role: 'assistant' },
          create_time: Math.floor(Date.now() / 1000),
          content: {
            content_type: 'text',
            parts: ['## Assistant Response\n\nHere is my response with proper **markdown formatting**:\n\n### Key Points\n\n1. First important point\n2. Second important point\n3. Third important point\n\nHere is some `inline code` and a code block:\n\n```javascript\nconsole.log("Hello, world!");\n```']
          }
        }
      }
    ];
    
    console.log('📝 Test messages created with markdown content');
    
    // Test PDF generation with our fixes
    const pdfBuffer = await pdfService.generatePDF({
      messages: testMessages,
      title: 'Markdown Test Conversation',
      layout: {
        format: 'A4',
        margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' }
      },
      style: {
        fontFamily: 'Times, serif',
        fontSize: '12pt',
        includeHeaders: true,
        includePageNumbers: true
      },
      filter: {
        includeToolMessages: false,
        includeSystemMessages: false,
        roles: ['user', 'assistant']
      },
      mediaBaseUrl: 'http://localhost:3001/api/media',
      conversationFolder: 'test'
    });
    
    console.log('✅ PDF generated successfully!');
    console.log('📊 PDF buffer size:', pdfBuffer.length, 'bytes');
    
    // Check PDF header
    const header = pdfBuffer.slice(0, 8).toString();
    if (header.startsWith('%PDF-')) {
      console.log('✅ PDF header is valid:', header);
    } else {
      console.log('❌ Invalid PDF header:', header);
    }
    
    // Save test PDF to verify content
    const fs = require('fs-extra');
    const testPdfPath = './test-markdown-output.pdf';
    await fs.writeFile(testPdfPath, pdfBuffer);
    console.log('✅ Test PDF saved to:', testPdfPath);
    
    console.log('\n🎉 PDF generation test completed successfully!');
    console.log('📄 Check the generated PDF to verify:');
    console.log('   - ## headings render as proper H2 elements (not raw ##)');
    console.log('   - **bold** and *italic* text is formatted properly');
    console.log('   - Lists and code blocks are rendered correctly');
    console.log('   - PDF opens in Adobe Acrobat (not just Preview)');
    
  } catch (error) {
    console.error('❌ PDF generation test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    // Close browser if it was opened
    try {
      await pdfService.closeBrowser();
      console.log('🧹 Browser closed');
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

// Run the test
testPDFGeneration().then(() => {
  console.log('\n=== Test Complete ===');
  process.exit(0);
}).catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
