const EnhancedPdfService = require('./server/src/services/enhancedPdfService');
const fs = require('fs-extra');
const path = require('path');

// Test the Enhanced PDF Service image proxy functionality
async function testImageProxy() {
  console.log('🧪 Testing Enhanced PDF Service Image Proxy...\n');
  
  try {
    // Initialize the service
    console.log('1. Initializing Enhanced PDF Service...');
    const pdfService = new EnhancedPdfService();
    await pdfService.init();
    console.log('✅ Service initialized successfully\n');
    
    // Test image URLs
    const testUrls = [
      'https://httpbin.org/image/png',
      'https://httpbin.org/image/jpeg',
      'https://via.placeholder.com/300x200.png'
    ];
    
    console.log('2. Testing image download and caching...');
    
    for (const url of testUrls) {
      console.log(`\n   Testing URL: ${url}`);
      
      try {
        const localPath = await pdfService.downloadAndCacheImage(url);
        
        if (localPath) {
          const exists = await fs.pathExists(localPath);
          const stats = exists ? await fs.stat(localPath) : null;
          
          console.log(`   ✅ Downloaded: ${localPath}`);
          console.log(`   📁 File exists: ${exists}`);
          console.log(`   📏 File size: ${stats ? stats.size : 0} bytes`);
          
          // Test base64 conversion
          const base64 = await pdfService.imageToBase64(localPath);
          console.log(`   🔤 Base64 length: ${base64 ? base64.length : 0} chars`);
        } else {
          console.log(`   ❌ Download failed`);
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }
    
    console.log('\n3. Testing image cache...');
    console.log(`   Cache size: ${pdfService.imageCache.size} items`);
    console.log(`   Cache keys: [${Array.from(pdfService.imageCache.keys()).join(', ')}]`);
    
    console.log('\n4. Testing processImageElement...');
    const testElement = {
      id: 'test-image-1',
      type: 'image',
      content: {
        url: 'https://httpbin.org/image/png',
        originalWidth: 300,
        originalHeight: 200
      },
      bounds: { x: 50, y: 50, width: 300, height: 200 }
    };
    
    const processedElement = await pdfService.processImageElement(testElement);
    console.log(`   ✅ Element processed successfully`);
    console.log(`   📄 Has local path: ${!!processedElement.content.path}`);
    console.log(`   📄 Has base64: ${!!processedElement.content.base64}`);
    console.log(`   📄 Cached: ${!!processedElement.content.cached}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests
async function runAllTests() {
  console.log('🚀 Enhanced PDF Image Proxy Test Suite\n');
  console.log('=' .repeat(50));
  
  await testImageProxy();
  
  console.log('\n' + '='.repeat(50));
  console.log('🎯 Test suite completed!');
}

// Run tests
async function runAllTests() {
  console.log('🚀 Enhanced PDF Image Proxy Test Suite\n');
  console.log('=' .repeat(50));
  
  await testImageProxy();
  await testHttpEndpoints();
  
  console.log('\n' + '='.repeat(50));
  console.log('🎯 Test suite completed!');
}

// Handle command line arguments
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { testImageProxy };