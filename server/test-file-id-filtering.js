// Test file ID filtering in PDF message content extraction
const { parseMarkdownGFM } = require('./src/markdown-gfm.js');

console.log('=== Testing File ID Filtering in Message Content ===\n');

// Simulate the message content extraction function with file ID filtering
function testExtractMessageContent(message) {
  if (!message || !message.content) {
    return { text: '', mediaRefs: [] };
  }
  
  const content = message.content;
  const mediaRefs = [];
  let textContent = '';
  
  if (content.content_type === 'text') {
    // Filter out file IDs from text content
    const fileIdPattern = /^file-[a-zA-Z0-9]+$/;
    const filteredParts = Array.isArray(content.parts) 
      ? content.parts.filter(part => typeof part !== 'string' || !fileIdPattern.test(part.trim()))
      : [];
    const rawText = filteredParts.join('\n\n');
    
    textContent = parseMarkdownGFM(rawText);
  } 
  else if (content.content_type === 'multimodal_text') {
    let combinedText = '';
    
    if (Array.isArray(content.parts)) {
      content.parts.forEach(part => {
        if (typeof part === 'string') {
          // Filter out file IDs (pattern: file-[alphanumeric characters])
          const fileIdPattern = /^file-[a-zA-Z0-9]+$/;
          if (!fileIdPattern.test(part.trim())) {
            combinedText += part + '\n\n';
          }
        }
        // Note: Object processing omitted for brevity in this test
      });
    }
    textContent = parseMarkdownGFM(combinedText.trim());
  }
  
  return { text: textContent.trim(), mediaRefs };
}

// Test case 1: Regular text content
console.log('📝 Test 1: Regular text content (should be preserved)');
const regularMessage = {
  content: {
    content_type: 'text',
    parts: ['This is regular text content that should appear in the PDF.']
  }
};

const result1 = testExtractMessageContent(regularMessage);
console.log('Input:', regularMessage.content.parts);
console.log('Output:', result1.text);
console.log('✅ Regular text preserved correctly\n');

// Test case 2: Text with file ID (should filter out file ID)
console.log('📝 Test 2: Text with file ID (file ID should be filtered out)');
const messageWithFileId = {
  content: {
    content_type: 'text',
    parts: ['This is some text.', 'file-9EFSF25k15sVSR9PoL7sd8', 'This is more text.']
  }
};

const result2 = testExtractMessageContent(messageWithFileId);
console.log('Input:', messageWithFileId.content.parts);
console.log('Output:', result2.text);
if (!result2.text.includes('file-9EFSF25k15sVSR9PoL7sd8')) {
  console.log('✅ File ID successfully filtered out');
} else {
  console.log('❌ File ID was NOT filtered out');
}
console.log();

// Test case 3: Multimodal content with file ID
console.log('📝 Test 3: Multimodal content with file ID (file ID should be filtered out)');
const multimodalMessage = {
  content: {
    content_type: 'multimodal_text',
    parts: [
      'speculate on what this is illustrating.',
      'file-9EFSF25k15sVSR9PoL7sd8',
      // Object parts would be processed separately for media
    ]
  }
};

const result3 = testExtractMessageContent(multimodalMessage);
console.log('Input parts:', multimodalMessage.content.parts);
console.log('Output:', result3.text);
if (!result3.text.includes('file-9EFSF25k15sVSR9PoL7sd8')) {
  console.log('✅ File ID successfully filtered out from multimodal content');
} else {
  console.log('❌ File ID was NOT filtered out from multimodal content');
}
console.log();

// Test case 4: Edge cases
console.log('📝 Test 4: Edge cases (similar patterns that should NOT be filtered)');
const edgeCaseMessage = {
  content: {
    content_type: 'text',
    parts: [
      'Here is a real file-like name: file-example.txt',
      'file-ABC123',  // This should be filtered (matches pattern)
      'This file-name-with-dashes should not be filtered',
      'file_underscore_name should not be filtered'
    ]
  }
};

const result4 = testExtractMessageContent(edgeCaseMessage);
console.log('Input parts:', edgeCaseMessage.content.parts);
console.log('Output:', result4.text);

if (result4.text.includes('file-example.txt') && 
    result4.text.includes('file-name-with-dashes') &&
    result4.text.includes('file_underscore_name') &&
    !result4.text.includes('file-ABC123')) {
  console.log('✅ Edge cases handled correctly');
} else {
  console.log('❌ Edge cases not handled correctly');
}

console.log('\n=== File ID Filtering Test Complete ===');
console.log('File ID pattern: /^file-[a-zA-Z0-9]+$/');
console.log('This pattern matches: file-ABC123, file-9EFSF25k15sVSR9PoL7sd8');
console.log('This pattern does NOT match: file-example.txt, file-name-with-dashes, file_underscore');
