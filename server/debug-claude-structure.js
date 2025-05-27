// Debug script to examine Claude conversation structure
const fs = require('fs-extra');
const path = require('path');

async function examineClaudeStructure() {
  try {
    const claudeArchivePath = '/Users/tem/nab/claude1';
    const conversationsPath = path.join(claudeArchivePath, 'conversations.json');
    
    console.log('Reading first few conversations from:', conversationsPath);
    
    // Read the file as text first to see the structure
    const fileContent = await fs.readFile(conversationsPath, 'utf8');
    
    // Check if it's an array or object at the root
    const firstChar = fileContent.trim()[0];
    console.log('File starts with:', firstChar);
    
    // Try to parse and examine first few conversations
    const parsed = JSON.parse(fileContent);
    
    if (Array.isArray(parsed)) {
      console.log(`Found ${parsed.length} conversations in array format`);
      
      // Examine first few conversations
      for (let i = 0; i < Math.min(3, parsed.length); i++) {
        const conv = parsed[i];
        console.log(`\\nConversation ${i + 1}:`);
        console.log('- Keys:', Object.keys(conv));
        console.log('- id:', conv.id);
        console.log('- name:', conv.name);
        console.log('- created_at:', conv.created_at);
        console.log('- updated_at:', conv.updated_at);
        console.log('- messages count:', conv.messages ? conv.messages.length : 'N/A');
        
        if (conv.messages && conv.messages.length > 0) {
          console.log('- First message keys:', Object.keys(conv.messages[0]));
        }
      }
    } else {
      console.log('Conversations in object format');
      console.log('Root keys:', Object.keys(parsed));
    }
    
  } catch (error) {
    console.error('Error examining Claude structure:', error);
  }
}

examineClaudeStructure();
