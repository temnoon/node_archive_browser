// Comprehensive test for enhanced content processing features
const pdfService = require('./src/services/pdfService.js');
const fs = require('fs-extra');

console.log('=== Enhanced Content Processing Test ===\n');

// Test data covering all the new features
const enhancedContentTestData = {
  id: 'enhanced-content-test',
  title: 'Enhanced Content Processing Test',
  create_time: new Date().toISOString(),
  messages: [
    {
      id: 'msg1',
      create_time: new Date().toISOString(),
      content: {
        content_type: 'text',
        parts: [`# Enhanced Content Processing Tests

## 1. Sparse HTML in Markdown Blocks

This is a test of sparse HTML rendering in markdown blocks:

Here is some text with <b>bold formatting</b> and <i>italic text</i>.

We also have <u>underlined text</u> for emphasis.

<hr>

The horizontal rule above should render properly.

More text after the rule with <b>mixed <i>bold and italic</i> formatting</b>.

## 2. Programming Code with Line Numbers

Here's a Python function that should get line numbers:

\`\`\`python
def calculate_fibonacci(n):
    if n <= 1:
        return n
    else:
        return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)

# This is a very long comment that exceeds typical line width and should demonstrate the line wrapping functionality with appropriate indicators
def process_large_dataset(input_file_path, output_file_path, transformation_function, batch_size=1000, enable_logging=True):
    """
    Process a large dataset with batching and optional logging
    This function handles very long parameter lists and should wrap appropriately
    """
    with open(input_file_path, 'r') as input_file:
        with open(output_file_path, 'w') as output_file:
            batch = []
            for line_number, line in enumerate(input_file):
                batch.append(transformation_function(line.strip()))
                if len(batch) >= batch_size:
                    output_file.writelines(batch)
                    batch = []
                    if enable_logging:
                        print(f"Processed batch ending at line {line_number}")
            
            # Write remaining items
            if batch:
                output_file.writelines(batch)

# Dictionary with long keys
configuration = {
    "database_connection_string": "postgresql://username:password@extremely-long-hostname.example.com:5432/database_name",
    "api_endpoint_for_data_processing": "https://api.very-long-domain-name.example.com/v1/data/process",
    "maximum_retry_attempts_for_failed_requests": 3
}
\`\`\`

## 3. JavaScript Code with Complex Logic

\`\`\`javascript
// Complex JavaScript with long lines that should wrap
const processUserDataWithValidationAndTransformation = async (userData, validationRules, transformationOptions) => {
    const validatedData = await validateUserDataAgainstRulesWithCustomErrorHandling(userData, validationRules);
    const transformedData = transformDataAccordingToOptionsWithFallbackHandling(validatedData, transformationOptions);
    return transformedData;
};

// Object with very long property names and values
const applicationConfiguration = {
    "authentication_service_endpoint_with_fallback": "https://auth.extremely-long-domain-name-for-testing.example.com/api/v2/authenticate",
    "database_connection_pool_configuration": {
        "maximum_connections": 50,
        "minimum_connections": 5,
        "connection_timeout_in_milliseconds": 30000
    },
    "logging_configuration_with_multiple_outputs": {
        "console_logging_enabled": true,
        "file_logging_enabled": true,
        "remote_logging_endpoint": "https://logs.very-long-logging-service-domain.example.com/api/ingest"
    }
};
\`\`\`

## 4. Plain Text Block (No Line Numbers)

\`\`\`
This is a plain text block that should NOT get line numbers.
It contains some <b>HTML tags</b> that should be rendered.

<hr>

Here's a horizontal rule in plain text.

This block should use word-boundary breaking rather than character-level breaking.
Very long words like supercalifragilisticexpialidocious should break at appropriate boundaries.

URLs like https://extremely-long-domain-name-for-testing-purposes.example.com should also break appropriately.
\`\`\`

## 5. Markdown Block with HTML

\`\`\`markdown
# This is a markdown block with sparse HTML

Regular **markdown** formatting should work.

But we also have <b>HTML bold</b> and <i>HTML italic</i>.

<hr>

Lists work too:
- Item 1
- Item 2 with <u>underlined text</u>

> This is a blockquote with <b>bold text</b> inside.
\`\`\``]
      },
      author: { role: 'user', name: 'Test User' }
    },
    {
      id: 'msg2',
      create_time: new Date().toISOString(),
      content: {
        content_type: 'text',
        parts: [`## Additional Tests

### 6. SQL Code (Should Get Line Numbers)

\`\`\`sql
SELECT 
    user_id,
    user_name,
    user_email,
    user_registration_date,
    last_login_timestamp,
    account_status
FROM users 
WHERE account_status = 'active' 
    AND user_registration_date >= '2023-01-01'
    AND last_login_timestamp >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY last_login_timestamp DESC, user_registration_date ASC
LIMIT 1000;

-- This is a very long comment that should demonstrate line wrapping with appropriate indicators in SQL code blocks
CREATE TABLE user_activity_logs_with_detailed_information (
    log_id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    activity_type VARCHAR(255) NOT NULL CHECK (activity_type IN ('login', 'logout', 'data_access', 'configuration_change')),
    activity_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    activity_metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

### 7. HTML Code Block (Should Show as Literal)

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Page with Very Long Title That Exceeds Typical Width Limits</title>
    <link rel="stylesheet" href="https://extremely-long-cdn-hostname.example.com/css/main.css">
</head>
<body>
    <header class="main-header-with-very-long-class-name">
        <h1>Welcome to Our Application</h1>
        <nav class="navigation-menu-with-descriptive-class-name">
            <ul>
                <li><a href="/home" data-analytics-label="navigation-home-click">Home</a></li>
                <li><a href="/about" data-analytics-label="navigation-about-click">About</a></li>
                <li><a href="/contact" data-analytics-label="navigation-contact-click">Contact</a></li>
            </ul>
        </nav>
    </header>
    <main class="main-content-area-with-responsive-design">
        <section class="hero-section-with-background-image">
            <h2>Very Long Heading That Demonstrates Text Wrapping in HTML Content</h2>
            <p>This is a paragraph with very long content that should demonstrate how text wrapping works in HTML code blocks within PDF exports.</p>
        </section>
    </main>
</body>
</html>
\`\`\`

### 8. Mixed Content with Multiple Spacing Issues

\`\`\`python
# This block has intentional spacing issues that should be cleaned up



def function_with_spacing_issues():
    print("Line 1")


    print("Line 2 after extra spacing")



    return "Done"




# Another function after multiple blank lines
def another_function():


    pass
\`\`\``]
      },
      author: { role: 'assistant', name: 'Assistant' }
    }
  ]
};

async function testEnhancedContentProcessing() {
  try {
    console.log('1. Testing sparse HTML detection...');
    
    // Test sparse HTML vs full HTML
    const sparseHtml = 'This has <b>bold</b> and <i>italic</i> text. <hr> More content.';
    const fullHtml = '<!DOCTYPE html><html><head><title>Test</title></head><body><div class="container"><p>Content</p></div></body></html>';
    
    console.log('Sparse HTML detected:', pdfService.isSparseHtml(sparseHtml));
    console.log('Full HTML detected:', pdfService.isSparseHtml(fullHtml));
    
    console.log('\n2. Testing sparse HTML processing...');
    const processedSparse = pdfService.processSparseHtml(sparseHtml);
    console.log('Processed sparse HTML:', processedSparse);
    
    console.log('\n3. Testing line number addition...');
    const codeContent = `def test():
    print("hello")
    return True`;
    const numberedCode = pdfService.addLineNumbers(codeContent, 'python');
    console.log('Numbered code sample:', numberedCode.substring(0, 200) + '...');
    
    console.log('\n4. Testing smart word breaking...');
    const longText = 'This is a very long word: supercalifragilisticexpialidocious and more text.';
    const longCode = 'const veryLongVariableNameThatExceedsLimits = functionWithVeryLongName();';
    
    console.log('Text word break:', pdfService.smartWordBreak(longText, false));
    console.log('Code word break:', pdfService.smartWordBreak(longCode, true));
    
    console.log('\n5. Generating enhanced content PDF...');
    
    const pdfBuffer = await pdfService.generatePDF(enhancedContentTestData, {
      layout: {
        format: 'A4',
        margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' }
      },
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: '11pt'
      },
      filter: {}
    });
    
    console.log('✅ Enhanced content PDF generated successfully!');
    console.log(`📊 PDF buffer size: ${pdfBuffer.length} bytes`);
    
    // Save test PDF
    await fs.writeFile('./test-enhanced-content-output.pdf', pdfBuffer);
    console.log('✅ Test PDF saved to: ./test-enhanced-content-output.pdf');
    
    console.log('\n🎉 Enhanced content processing test completed!');
    console.log('\n📄 Manual verification checklist:');
    console.log('   ✓ Python/JavaScript/SQL code has line numbers');
    console.log('   ✓ Plain text/markdown blocks do NOT have line numbers');
    console.log('   ✓ Sparse HTML (<b>, <i>, <hr>) renders in markdown blocks');
    console.log('   ✓ Full HTML code blocks show as literal text');
    console.log('   ✓ Word boundaries respected in text content');
    console.log('   ✓ Character-level breaking in code when needed');
    console.log('   ✓ Line wrap indicators (-) shown for wrapped code lines');
    console.log('   ✓ Excessive spacing cleaned up in code blocks');
    console.log('   ✓ Long URLs break appropriately');
    
    // Test specific content extraction
    console.log('\n6. Testing message content extraction...');
    const extractedContent = pdfService.extractMessageContent(enhancedContentTestData.messages[0]);
    console.log('✅ Enhanced message content extracted');
    console.log('Content includes line numbers:', extractedContent.text.includes('line-number'));
    console.log('Content includes code wrappers:', extractedContent.text.includes('code-line-wrapper'));
    console.log('Content includes sparse HTML:', extractedContent.text.includes('<hr>'));
    
  } catch (error) {
    console.error('❌ Enhanced content processing test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

async function runDetailedFeatureTests() {
  console.log('\n=== Detailed Feature Analysis ===\n');
  
  // Test 1: Line number detection for different languages
  console.log('1. Line Number Detection Tests:');
  const pythonCode = 'def hello():\n    print("world")';
  const javascriptCode = 'function hello() {\n    console.log("world");\n}';
  const plainText = 'This is just plain text\nwith multiple lines';
  
  console.log('Python code with numbers:', pdfService.addLineNumbers(pythonCode, 'python').includes('line-number'));
  console.log('JavaScript code with numbers:', pdfService.addLineNumbers(javascriptCode, 'javascript').includes('line-number'));
  console.log('Plain text structure:', pdfService.addLineNumbers(plainText, '').substring(0, 100));
  
  // Test 2: Sparse HTML detection
  console.log('\n2. Sparse HTML Detection Tests:');
  const testCases = [
    'Simple text with <b>bold</b>',
    '<html><body><div>Full HTML document</div></body></html>',
    'Text with <hr> and <i>italic</i> and <u>underline</u>',
    '<!DOCTYPE html><html><head><title>Complete</title></head></html>'
  ];
  
  testCases.forEach((test, index) => {
    console.log(`Case ${index + 1} is sparse HTML:`, pdfService.isSparseHtml(test));
  });
  
  // Test 3: Word breaking differences
  console.log('\n3. Word Breaking Tests:');
  const longWord = 'supercalifragilisticexpialidocious';
  const longCodeLine = 'const veryLongVariableNameThatExceedsReasonableLimits = functionCall();';
  
  console.log('Text breaking (word boundaries):', pdfService.smartWordBreak(longWord, false));
  console.log('Code breaking (character level):', pdfService.smartWordBreak(longCodeLine, true).substring(0, 100));
  
  console.log('\n=== Feature Tests Complete ===\n');
}

// Run all tests
console.log('Starting enhanced content processing tests...\n');

runDetailedFeatureTests()
  .then(() => testEnhancedContentProcessing())
  .catch((error) => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });