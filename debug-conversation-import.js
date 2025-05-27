const fetch = require('node-fetch');

async function debugConversationImport() {
  console.log('=== Conversation Import Debug Script ===\n');
  
  const baseUrl = 'http://localhost:3001';
  const conversationId = '682c898a-2cd4-8005-b752-f5e4dd16d0a6';
  
  try {
    // Step 1: Test server health
    console.log('1. Testing server health...');
    const healthResponse = await fetch(`${baseUrl}/api/enhanced-pdf/health`);
    const health = await healthResponse.json();
    console.log('Health:', health.success ? 'OK' : 'FAILED');
    console.log('Services:', health.services);
    console.log('');
    
    // Step 2: Fetch conversation data
    console.log('2. Fetching conversation data...');
    const convResponse = await fetch(`${baseUrl}/api/conversations/${conversationId}`);
    const convData = await convResponse.json();
    console.log('Conversation title:', convData.title);
    console.log('Message count:', convData.messages?.length || 0);
    
    // Check message structure
    if (convData.messages && convData.messages.length > 0) {
      const firstMessage = convData.messages[0];
      console.log('First message structure:', Object.keys(firstMessage));
      console.log('Has message.message:', !!firstMessage.message);
      console.log('Has message.message.content:', !!firstMessage.message?.content);
      console.log('Has message.message.content.parts:', !!firstMessage.message?.content?.parts);
      
      // Find first non-empty message
      const nonEmptyMessage = convData.messages.find(msg => 
        msg.message?.content?.parts?.[0] && 
        typeof msg.message.content.parts[0] === 'string' && 
        msg.message.content.parts[0].trim().length > 0
      );
      
      if (nonEmptyMessage) {
        console.log('Found non-empty message:');
        console.log('  Author role:', nonEmptyMessage.message.author?.role);
        console.log('  Content length:', nonEmptyMessage.message.content.parts[0].length);
        console.log('  Content preview:', nonEmptyMessage.message.content.parts[0].substring(0, 100) + '...');
      } else {
        console.log('No non-empty messages found!');
      }
    }
    console.log('');
    
    // Step 3: Test conversation import
    console.log('3. Testing conversation import...');
    const importResponse = await fetch(`${baseUrl}/api/enhanced-pdf/from-conversation/${conversationId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template: 'academic',
        title: 'Debug Test Import'
      })
    });
    
    const importResult = await importResponse.json();
    console.log('Import success:', importResult.success);
    console.log('Document ID:', importResult.document?.id);
    console.log('Document title:', importResult.document?.metadata?.title);
    console.log('Page count:', importResult.document?.pages?.length || 0);
    console.log('');
    
    if (importResult.success && importResult.document) {
      // Step 4: Check document elements
      console.log('4. Checking document elements...');
      const docResponse = await fetch(`${baseUrl}/api/enhanced-pdf/documents/${importResult.document.id}`);
      const docData = await docResponse.json();
      
      if (docData.success) {
        const elements = docData.document.pages[0]?.elements || [];
        console.log('Elements count:', elements.length);
        
        if (elements.length > 0) {
          console.log('First element:', {
            id: elements[0].id,
            type: elements[0].type,
            content: elements[0].content?.substring(0, 50) + '...',
            bounds: elements[0].bounds
          });
        } else {
          console.log('No elements found in document!');
        }
      } else {
        console.log('Failed to fetch document:', docData.error);
      }
      console.log('');
      
      // Step 5: Test manual element addition
      console.log('5. Testing manual element addition...');
      const testElementResponse = await fetch(`${baseUrl}/api/enhanced-pdf/documents/${importResult.document.id}/pages/${importResult.document.pages[0].id}/elements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'text',
          content: 'Test manual element addition',
          bounds: { x: 100, y: 100, width: 300, height: 50 },
          style: {
            fontSize: 12,
            fontFamily: 'Helvetica',
            color: '#000000'
          }
        })
      });
      
      const elementResult = await testElementResponse.json();
      console.log('Manual element addition success:', elementResult.success);
      if (elementResult.success) {
        console.log('Element ID:', elementResult.element.id);
      } else {
        console.log('Error:', elementResult.error);
      }
      console.log('');
      
      // Step 6: Test export
      console.log('6. Testing PDF export...');
      const exportResponse = await fetch(`${baseUrl}/api/enhanced-pdf/documents/${importResult.document.id}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'pdf', quality: 'high' })
      });
      
      if (exportResponse.ok) {
        console.log('Export successful - PDF size:', exportResponse.headers.get('content-length'), 'bytes');
      } else {
        console.log('Export failed:', exportResponse.statusText);
      }
    }
    
  } catch (error) {
    console.error('Debug script error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the debug script
debugConversationImport().then(() => {
  console.log('\n=== Debug Complete ===');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});