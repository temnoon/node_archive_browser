const fetch = require('node-fetch');
const fs = require('fs');

async function testPDFExport() {
  console.log('Testing PDF export functionality...');
  
  // Use the conversation ID from the original error message
  const conversationId = '682ca632-f780-8005-886b-c5113b714e4f';
  
  const exportRequest = {
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
    title: "Noether's Theorem Overview Test"
  };

  try {
    console.log(`Making POST request to export conversation ${conversationId}...`);
    const startTime = Date.now();
    
    const response = await fetch(`http://localhost:3001/api/pdf/conversation/${conversationId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(exportRequest)
    });

    const endTime = Date.now();
    console.log(`Request completed in ${endTime - startTime}ms`);
    console.log(`Response status: ${response.status}`);
    console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      const pdfBuffer = await response.buffer();
      console.log(`✅ PDF export successful!`);
      console.log(`PDF size: ${pdfBuffer.length} bytes`);
      
      // Save the PDF for verification
      const filename = `test-export-${Date.now()}.pdf`;
      fs.writeFileSync(filename, pdfBuffer);
      console.log(`PDF saved as: ${filename}`);
      
      return { success: true, size: pdfBuffer.length, filename };
    } else {
      const errorText = await response.text();
      console.log(`❌ PDF export failed:`);
      console.log(`Error response:`, errorText);
      
      try {
        const errorJson = JSON.parse(errorText);
        console.log(`Error details:`, errorJson);
        return { success: false, error: errorJson };
      } catch (e) {
        return { success: false, error: errorText };
      }
    }

  } catch (error) {
    console.log(`❌ Request failed:`, error.message);
    return { success: false, error: error.message };
  }
}

// Run the test
testPDFExport().then(result => {
  console.log('\n=== TEST RESULT ===');
  console.log(JSON.stringify(result, null, 2));
  
  if (result.success) {
    console.log('\n🎉 PDF export is now working! MathJax timeout issue appears to be fixed.');
  } else {
    console.log('\n🔧 PDF export still has issues. More debugging needed.');
  }
}).catch(error => {
  console.error('Test script error:', error);
});
