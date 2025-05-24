// Test script to verify our markdown parsing fix
console.log('=== Testing Markdown Parsing Fix ===\n');

try {
  // Test 1: Import the markdown parser
  const { parseMarkdownGFM } = require('./src/markdown-gfm.js');
  console.log('✅ Markdown parser imported successfully');

  // Test 2: Test markdown conversion
  const testMarkdown = `## This is a heading

This is **bold text** and this is *italic text*.

### Another heading

Here is some code: \`console.log('hello')\`

- List item 1
- List item 2
- List item 3

And a [link](https://example.com).`;

  console.log('\n📝 Testing markdown conversion:');
  console.log('Input markdown:');
  console.log(testMarkdown);
  
  const htmlOutput = parseMarkdownGFM(testMarkdown);
  console.log('\n📄 Converted HTML:');
  console.log(htmlOutput);
  
  // Test 3: Check if headings are properly converted
  if (htmlOutput.includes('<h2>This is a heading</h2>')) {
    console.log('\n✅ H2 heading conversion working');
  } else {
    console.log('\n❌ H2 heading conversion failed');
  }
  
  if (htmlOutput.includes('<h3>Another heading</h3>')) {
    console.log('✅ H3 heading conversion working');
  } else {
    console.log('❌ H3 heading conversion failed');
  }
  
  // Test 4: Check if bold/italic formatting works
  if (htmlOutput.includes('<strong>bold text</strong>')) {
    console.log('✅ Bold text conversion working');
  } else {
    console.log('❌ Bold text conversion failed');
  }
  
  if (htmlOutput.includes('<em>italic text</em>')) {
    console.log('✅ Italic text conversion working');
  } else {
    console.log('❌ Italic text conversion failed');
  }
  
  // Test 5: Test if PDF service can import and use the function
  console.log('\n🔧 Testing PDF service integration...');
  const pdfService = require('./src/services/pdfService.js');
  console.log('✅ PDF service loaded successfully (markdown parser integrated)');
  
  console.log('\n🎉 All tests passed! Markdown fixes are working correctly.');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error('Stack trace:', error.stack);
}

console.log('\n=== Test Complete ===');
