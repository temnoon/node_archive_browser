// Comprehensive test for wide content handling in PDF generation
const pdfService = require('./src/services/pdfService.js');
const fs = require('fs-extra');

console.log('=== Wide Content PDF Test ===\n');

// Test content with various wide content scenarios
const wideContentTestData = {
  id: 'wide-content-test',
  title: 'Wide Content Handling Test',
  create_time: new Date().toISOString(),
  messages: [
    {
      id: 'msg1',
      create_time: new Date().toISOString(),
      content: {
        content_type: 'text',
        parts: [`# Wide Content Test Document

This document tests various scenarios where content might be too wide for PDF rendering.

## 1. Very Long Code Lines

Here's a code block with extremely long lines that would typically cause horizontal scrolling:

\`\`\`javascript
const veryLongFunctionNameThatExceedsTypicalLineWidthAndWouldCauseHorizontalScrollingIssuesInPDFGeneration = function(parameterWithVeryLongNameThatAlsoExceedsTypicalWidths, anotherParameterWithEvenLongerNameThatDefinitelyWillCauseIssues) {
  return someVeryLongVariableNameThatExceedsReasonableLimits + anotherVeryLongVariableNameForTesting + yetAnotherLongVariableName;
};

// This is a single line comment that goes on and on and on and exceeds reasonable line length limits and would typically cause horizontal scrolling in most editors and definitely in PDF exports
const sqlQuery = "SELECT user_id, user_name, user_email, user_phone, user_address, user_city, user_state, user_zip, user_country, created_at, updated_at, last_login_at, is_active, is_verified FROM users WHERE user_email LIKE '%example.com' AND created_at BETWEEN '2023-01-01' AND '2023-12-31' ORDER BY created_at DESC";
\`\`\`

## 2. Wide Tables

| Column 1 | Column 2 | Column 3 | Column 4 | Column 5 | Column 6 | Column 7 | Column 8 | Column 9 | Column 10 |
|----------|----------|----------|----------|----------|----------|----------|----------|----------|-----------|
| Very long content that exceeds typical column width | Another column with extremely long content that should wrap | More content that is intentionally very long | Yet another column | And another | More columns | Even more | Still more | Almost done | Final column |
| Data with very long URLs like https://extremely-long-domain-name-that-exceeds-reasonable-limits.example.com/path/to/resource/with/many/segments/that/make/it/very/long | Short | Long content again that exceeds reasonable limits and should wrap properly in the table cell | Data | More | Content | Values | Here | Almost | Done |

## 3. Long URLs and Links

Here's a very long URL that would typically cause horizontal scrolling: https://this-is-an-extremely-long-domain-name-that-exceeds-reasonable-limits-and-would-cause-horizontal-scrolling-issues.example.com/path/to/some/resource/with/many/path/segments/that/make/the/url/extremely/long/and/difficult/to/handle/in/pdf/generation?parameter1=value1&parameter2=value2&parameter3=value3&parameter4=value4

And here's a link with very long text: [This is a link with extremely long anchor text that exceeds reasonable limits and would typically cause horizontal scrolling issues in PDF generation and needs to be handled properly](https://example.com)

## 4. Very Long Words

Here's a paragraph with supercalifragilisticexpialidociousandotherveryverylongwordsthatexceedreasonablelimitsandwouldcausehorizontalscrollingissuesinPDFgenerationandneedtobehandledproperly.

## 5. Mixed Wide Content

\`\`\`python
# Python example with very long lines
def extremely_long_function_name_that_exceeds_typical_line_width_limits(parameter_with_very_long_name, another_parameter_with_even_longer_name_for_testing_purposes):
    very_long_variable_name_that_exceeds_reasonable_limits = parameter_with_very_long_name + another_parameter_with_even_longer_name_for_testing_purposes
    return f"This is a very long f-string that contains {very_long_variable_name_that_exceeds_reasonable_limits} and other content that makes it extremely wide and difficult to handle in PDF generation"

# Dictionary with long keys and values
configuration_dict = {
    "extremely_long_configuration_key_that_exceeds_reasonable_limits": "extremely_long_configuration_value_that_also_exceeds_reasonable_limits_and_would_cause_horizontal_scrolling",
    "another_very_long_key_for_testing_purposes": "another_very_long_value_that_needs_proper_handling_in_pdf_generation_to_avoid_horizontal_scrolling_issues"
}
\`\`\`

This content should all render properly in the PDF without horizontal scrolling.`]
      },
      author: { role: 'user', name: 'Test User' }
    },
    {
      id: 'msg2',
      create_time: new Date().toISOString(),
      content: {
        content_type: 'text',
        parts: [`## Additional Wide Content Tests

### JSON Example with Long Values

\`\`\`json
{
  "very_long_property_name_that_exceeds_typical_limits": "very_long_string_value_that_also_exceeds_typical_limits_and_would_cause_horizontal_scrolling_in_most_contexts",
  "api_endpoints": {
    "get_user_data": "https://api.extremely-long-domain-name-for-testing-purposes.example.com/v1/users/{user_id}/complete-profile-data-with-all-details",
    "update_user_preferences": "https://api.extremely-long-domain-name-for-testing-purposes.example.com/v1/users/{user_id}/preferences/update-all-settings-and-configurations"
  }
}
\`\`\`

### Bash Commands with Long Paths

\`\`\`bash
# Very long file paths that would typically cause issues
cp /Users/username/very/long/path/to/some/directory/structure/that/exceeds/typical/limits/and/would/cause/horizontal/scrolling/issues/file.txt /Users/username/another/very/long/path/to/destination/directory/structure/

# Long command with many parameters
docker run --name extremely-long-container-name-for-testing-purposes --volume /very/long/host/path/that/exceeds/limits:/very/long/container/path/that/also/exceeds/limits --env VERY_LONG_ENVIRONMENT_VARIABLE_NAME=very_long_environment_variable_value_that_exceeds_limits extremely-long-image-name:latest

# Git commands with long URLs
git clone https://github.com/organization-with-very-long-name/repository-with-extremely-long-name-that-exceeds-reasonable-limits-and-would-cause-issues.git
\`\`\`

### CSS with Long Property Values

\`\`\`css
.class-with-very-long-name-that-exceeds-typical-limits {
  background-image: url('https://extremely-long-domain-name-for-testing-purposes.example.com/path/to/image/resource/with/many/segments/that/make/it/very/long/image.jpg');
  font-family: 'Font Name With Very Long Name That Exceeds Typical Limits', 'Another Font Name That Is Also Very Long', sans-serif;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1), 0 8px 16px rgba(0, 0, 0, 0.1), 0 16px 32px rgba(0, 0, 0, 0.1), 0 32px 64px rgba(0, 0, 0, 0.1);
}
\`\`\`

All of this content should render properly without horizontal scrolling in the PDF output.`]
      },
      author: { role: 'assistant', name: 'Assistant' }
    }
  ]
};

async function testWideContentHandling() {
  try {
    console.log('1. Testing wide content detection...');
    
    // Test wide content detection on a sample
    const sampleHtml = `
      <pre><code>const veryLongLineOfCodeThatExceedsTypicalLimitsAndWouldCauseHorizontalScrollingIssuesInPDFGeneration = "test";</code></pre>
      <table><tr><td>Col1</td><td>Col2</td><td>Col3</td><td>Col4</td><td>Col5</td><td>Col6</td><td>Col7</td><td>Col8</td></tr></table>
      <a href="https://extremely-long-domain-name-that-exceeds-reasonable-limits.example.com/very/long/path">Link</a>
    `;
    
    const wideContentIssues = pdfService.detectWideContent(sampleHtml);
    console.log('Wide content issues detected:', wideContentIssues);
    
    console.log('\n2. Testing wide content preprocessing...');
    
    const preprocessedContent = pdfService.preprocessWideContent(sampleHtml);
    console.log('Sample preprocessed content (first 200 chars):', preprocessedContent.substring(0, 200) + '...');
    
    console.log('\n3. Generating PDF with wide content...');
    
    const pdfBuffer = await pdfService.generatePDF(wideContentTestData, {
      layout: {
        format: 'A4',
        margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' }
      },
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12pt'
      },
      filter: {}
    });
    
    console.log('✅ PDF generated successfully!');
    console.log(`📊 PDF buffer size: ${pdfBuffer.length} bytes`);
    
    // Save test PDF
    await fs.writeFile('./test-wide-content-output.pdf', pdfBuffer);
    console.log('✅ Test PDF saved to: ./test-wide-content-output.pdf');
    
    console.log('\n🎉 Wide content handling test completed successfully!');
    console.log('\n📄 Manual verification needed:');
    console.log('   1. Open test-wide-content-output.pdf');
    console.log('   2. Verify no horizontal scrolling is needed');
    console.log('   3. Verify long code lines wrap appropriately');
    console.log('   4. Verify wide tables fit within page margins');
    console.log('   5. Verify long URLs break properly');
    console.log('   6. Verify very long words break at reasonable points');
    console.log('   7. Verify all content is readable and well-formatted');
    
    // Test specific content extraction to verify preprocessing
    console.log('\n4. Testing message content extraction...');
    const extractedContent = pdfService.extractMessageContent(wideContentTestData.messages[0]);
    console.log('✅ Message content extracted');
    console.log('Text content length:', extractedContent.text.length);
    console.log('Contains <wbr> tags:', extractedContent.text.includes('<wbr>'));
    console.log('Contains wide-code-block class:', extractedContent.text.includes('wide-code-block'));
    
  } catch (error) {
    console.error('❌ Wide content handling test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    // Cleanup
    await pdfService.cleanup();
    console.log('🧹 Browser cleanup completed');
  }
}

async function runDetailedTests() {
  console.log('\n=== Detailed Wide Content Analysis ===\n');
  
  // Test 1: Code block analysis
  const codeBlockHtml = '<pre><code>const veryLongVariableNameThatExceedsTypicalLimitsAndWouldCauseHorizontalScrollingIssues = "test";</code></pre>';
  console.log('Code block analysis:');
  console.log('Issues found:', pdfService.detectWideContent(codeBlockHtml));
  console.log('Preprocessed:', pdfService.preprocessWideContent(codeBlockHtml).substring(0, 100) + '...\n');
  
  // Test 2: Table analysis
  const tableHtml = '<table><tr><td>C1</td><td>C2</td><td>C3</td><td>C4</td><td>C5</td><td>C6</td><td>C7</td><td>C8</td></tr></table>';
  console.log('Table analysis:');
  console.log('Issues found:', pdfService.detectWideContent(tableHtml));
  console.log('Preprocessed:', pdfService.preprocessWideContent(tableHtml) + '\n');
  
  // Test 3: URL analysis
  const urlHtml = '<a href="https://extremely-long-domain-name-that-exceeds-reasonable-limits-for-testing-purposes.example.com/path">Very long link text that also exceeds reasonable limits</a>';
  console.log('URL analysis:');
  console.log('Issues found:', pdfService.detectWideContent(urlHtml));
  console.log('Preprocessed:', pdfService.preprocessWideContent(urlHtml) + '\n');
  
  // Test 4: Long word analysis
  const longWordHtml = '<p>This paragraph contains supercalifragilisticexpialidociousandotherveryverylongwordsthatexceedreasonablelimits.</p>';
  console.log('Long word analysis:');
  console.log('Issues found:', pdfService.detectWideContent(longWordHtml));
  console.log('Preprocessed:', pdfService.preprocessWideContent(longWordHtml) + '\n');
}

// Run the tests
console.log('Starting wide content handling tests...\n');

runDetailedTests()
  .then(() => testWideContentHandling())
  .catch((error) => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });