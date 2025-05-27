// Test script for Claude import functionality
const path = require('path');
const fs = require('fs-extra');

// Import the processors
const claudeProcessor = require('./src/claude-import-processor');

async function testClaudeImport() {
  try {
    console.log('Testing Claude import functionality...');
    
    const claudeArchivePath = '/Users/tem/nab/claude1';
    
    // Check if Claude archive exists
    if (!await fs.pathExists(claudeArchivePath)) {
      console.error('Claude archive not found at:', claudeArchivePath);
      return;
    }
    
    console.log('✓ Claude archive found');
    
    // Test sampling conversations
    console.log('Testing conversation sampling...');
    const conversationsPath = path.join(claudeArchivePath, 'conversations.json');
    
    try {
      const sampleConvos = await claudeProcessor.sampleClaudeConversations(conversationsPath, 2);
      console.log(`✓ Successfully sampled ${sampleConvos.length} conversations`);
      
      if (sampleConvos.length > 0) {
        const firstConvo = sampleConvos[0];
        console.log('First conversation structure:');
        console.log('- ID:', firstConvo.id);
        console.log('- Name:', firstConvo.name);
        console.log('- Created:', firstConvo.created_at);
        console.log('- Messages count:', firstConvo.messages ? firstConvo.messages.length : 'N/A');
        
        // Test media extraction
        const mediaRefs = claudeProcessor.extractClaudeMediaReferences(firstConvo);
        console.log('- Media references:', mediaRefs.length);
        if (mediaRefs.length > 0) {
          console.log('  Sample media refs:', mediaRefs.slice(0, 3));
        }
      }
    } catch (err) {
      console.error('✗ Error sampling conversations:', err.message);
      return;
    }
    
    // Test preview generation
    console.log('\nTesting preview generation...');
    const testConfig = {
      sourceDir: claudeArchivePath,
      archiveName: 'test_claude_archive',
      conversationPattern: '{uuid}_{date}_{title}',
      mediaFolder: 'media',
      useMessageReferences: true
    };
    
    try {
      const preview = await claudeProcessor.generateClaudePreview(testConfig);
      console.log('✓ Preview generated successfully');
      console.log('Preview structure (first 500 chars):');
      console.log(preview.folderStructure.substring(0, 500) + '...');
    } catch (err) {
      console.error('✗ Error generating preview:', err.message);
    }
    
    console.log('\n✓ Claude import functionality test completed successfully!');
    console.log('\nTo perform a full import:');
    console.log('1. Start the server: cd /Users/tem/nab/server && npm start');
    console.log('2. Start the client: cd /Users/tem/nab/client && npm run dev');
    console.log('3. Navigate to http://localhost:5173/import');
    console.log('4. Select "Auto-detect" or "Anthropic / Claude" as archive type');
    console.log('5. Set source directory to:', claudeArchivePath);
    console.log('6. Set output directory and start import');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testClaudeImport();
