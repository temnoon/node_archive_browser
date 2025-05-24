// Simple inline test of LaTeX preservation
try {
  const { parseMarkdownGFM } = require('./src/markdown-gfm.js');
  
  const testLatex = 'Here is some math: \\\\[ E = mc^2 \\\\] and inline \\\\( x = 5 \\\\)';
  console.log('Input:', testLatex);
  
  const result = parseMarkdownGFM(testLatex);
  console.log('Output:', result);
  
  if (result.includes('\\\\[') && result.includes('\\\\]')) {
    console.log('✅ LaTeX preservation working!');
  } else {
    console.log('❌ LaTeX preservation failed');
  }
  
} catch (error) {
  console.error('Test error:', error.message);
}
