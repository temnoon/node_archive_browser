// Comprehensive test for LaTeX preservation and PDF generation
const { parseMarkdownGFM } = require('./src/markdown-gfm.js');
const pdfService = require('./src/services/pdfService.js');

console.log('=== Comprehensive LaTeX + Markdown PDF Test ===\n');

// Test content with both markdown and LaTeX
const testContent = `# LaTeX and Markdown Integration Test

This document tests both **markdown** and LaTeX rendering together.

## Mathematical Expressions

### Display Math
The Schrödinger equation in position representation:
\\[
i\\hbar\\frac{\\partial}{\\partial t}\\Psi(\\mathbf{r},t) = \\hat{H}\\Psi(\\mathbf{r},t)
\\]

### Inline Math
The energy eigenvalue equation \\(\\hat{H}|\\psi\\rangle = E|\\psi\\rangle\\) is fundamental.

### Dollar Notation
Consider the wavefunction $\\psi(x) = A e^{ikx}$ and its normalization condition.

### Display Dollars
$$
\\langle\\psi|\\psi\\rangle = \\int_{-\\infty}^{\\infty} |\\psi(x)|^2 dx = 1
$$

## Markdown Features

### Text Formatting
- **Bold text** for emphasis
- *Italic text* for variables
- ~~Strikethrough~~ for corrections
- \`inline code\` for functions

### Lists
1. First ordered item
2. Second ordered item with $E = mc^2$
3. Third item

Unordered list:
- Bullet point with \\(\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}\\)
- Another bullet
- Final bullet

### Code Block
\`\`\`python
def schrodinger_equation(psi, t):
    return 1j * hbar * dpsi_dt(psi, t)
\`\`\`

### Mixed Content
The **expectation value** of an operator \\(\\hat{A}\\) is given by:
$$
\\langle A \\rangle = \\langle\\psi|\\hat{A}|\\psi\\rangle
$$

This can be computed using *numerical integration* or **analytical methods**.

## Conclusion
This document demonstrates both markdown and LaTeX working together seamlessly.`;

async function testCompleteIntegration() {
    console.log('1. Testing Markdown Parser with LaTeX...\n');
    
    // Test markdown parsing
    const htmlOutput = parseMarkdownGFM(testContent);
    
    console.log('✓ Markdown parsing completed');
    console.log('✓ Checking LaTeX preservation...');
    
    // Check LaTeX preservation
    const hasDisplayLatex = htmlOutput.includes('\\[') && htmlOutput.includes('\\]');
    const hasInlineLatex = htmlOutput.includes('\\(') && htmlOutput.includes('\\)');
    const hasDollarLatex = htmlOutput.includes('$');
    const hasMarkdown = htmlOutput.includes('<h1>') && htmlOutput.includes('<strong>');
    
    console.log(hasDisplayLatex ? '✅ Display LaTeX (\\[...\\]) preserved' : '❌ Display LaTeX missing');
    console.log(hasInlineLatex ? '✅ Inline LaTeX (\\(...\\)) preserved' : '❌ Inline LaTeX missing');
    console.log(hasDollarLatex ? '✅ Dollar LaTeX ($...$) preserved' : '❌ Dollar LaTeX missing');
    console.log(hasMarkdown ? '✅ Markdown formatting applied' : '❌ Markdown formatting missing');
    
    console.log('\n2. Testing PDF Generation...\n');
    
    // Create mock conversation data
    const mockConversation = {
        id: 'test-latex-conversation',
        title: 'LaTeX and Markdown Test',
        create_time: new Date().toISOString(),
        messages: [
            {
                id: 'msg1',
                create_time: new Date().toISOString(),
                content: {
                    content_type: 'text',
                    parts: [testContent]
                },
                author: { role: 'user', name: 'Test User' }
            },
            {
                id: 'msg2',
                create_time: new Date().toISOString(),
                content: {
                    content_type: 'text',
                    parts: ['Thank you for the comprehensive mathematical overview! The equations are clearly presented.']
                },
                author: { role: 'assistant', name: 'Assistant' }
            }
        ]
    };
    
    // PDF service is already initialized as singleton
    
    try {
        console.log('🔧 Initializing PDF generation...');
        
        // Generate PDF
        const pdfBuffer = await pdfService.generatePDF(mockConversation, {
            layout: {
                format: 'A4',
                margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' }
            },
            style: {},
            filter: {}
        });
        
        console.log('✅ PDF generated successfully!');
        console.log(`📊 PDF buffer size: ${pdfBuffer.length} bytes`);
        
        // Save test PDF
        const fs = require('fs-extra');
        await fs.writeFile('./test-complete-latex-output.pdf', pdfBuffer);
        console.log('✅ Test PDF saved to: ./test-complete-latex-output.pdf');
        
        console.log('\n🎉 Complete integration test PASSED!');
        console.log('\n📄 Manual verification needed:');
        console.log('   1. Open test-complete-latex-output.pdf');
        console.log('   2. Verify LaTeX equations are rendered (not showing as raw TeX)');
        console.log('   3. Verify markdown formatting is applied (headings, bold, italic, lists)');
        console.log('   4. Verify no @@LATEX_DISPLAY_##@@ placeholders are visible');
        console.log('   5. Verify PDF opens in Adobe Acrobat/Reader');
        
    } catch (error) {
        console.error('❌ PDF generation failed:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        // Cleanup
        await pdfService.cleanup();
        console.log('🧹 Browser cleanup completed');
    }
}

// Run the test
testCompleteIntegration().catch(console.error);