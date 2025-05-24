// Quick test of our LaTeX preservation fix
const { parseMarkdownGFM } = require('./src/markdown-gfm.js');

console.log('=== Testing LaTeX Preservation in Markdown Parser ===\n');

const testContent = `# Noether's Theorem Test

This is regular **bold** text and *italic* text.

Here is some LaTeX that should be preserved:

The action is defined as:
\\[
S = \\int_{t1}^{t2} L(qi, \\dot{q}i, t) \\, dt
\\]

And inline math like \\( E = mc^2 \\) should also work.

Also test dollar notation: $x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$

And display dollars:
$$
\\nabla \\cdot \\vec{E} = \\frac{\\rho}{\\varepsilon_0}
$$

## More headings

- List item 1
- List item 2

Back to regular text.`;

console.log('Input content:');
console.log(testContent);
console.log('\n' + '='.repeat(60) + '\n');

const htmlOutput = parseMarkdownGFM(testContent);

console.log('Output HTML:');
console.log(htmlOutput);

console.log('\n' + '='.repeat(60) + '\n');

// Check specific LaTeX preservation
if (htmlOutput.includes('\\[') && htmlOutput.includes('\\]')) {
  console.log('✅ Display LaTeX blocks (\\[...\\]) preserved');
} else {
  console.log('❌ Display LaTeX blocks (\\[...\\]) NOT preserved');
}

if (htmlOutput.includes('\\(') && htmlOutput.includes('\\)')) {
  console.log('✅ Inline LaTeX blocks (\\(...\\)) preserved');
} else {
  console.log('❌ Inline LaTeX blocks (\\(...\\)) NOT preserved');
}

if (htmlOutput.includes('<h1>Noether\'s Theorem Test</h1>')) {
  console.log('✅ Markdown headings working');
} else {
  console.log('❌ Markdown headings NOT working');
}

if (htmlOutput.includes('<strong>bold</strong>')) {
  console.log('✅ Markdown bold formatting working');
} else {
  console.log('❌ Markdown bold formatting NOT working');
}

console.log('\n=== Test Complete ===');
