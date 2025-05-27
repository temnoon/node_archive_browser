// Script to examine actual Claude conversation structure
const fs = require('fs-extra');
const path = require('path');

async function examineClaudeConversation() {
  try {
    // Find a Claude conversation folder
    const archiveRoot = '/Users/tem/nab/exploded_archive_node/claude';
    
    if (!await fs.pathExists(archiveRoot)) {
      console.log('Claude archive not found at:', archiveRoot);
      return;
    }
    
    const items = await fs.readdir(archiveRoot);
    const claudeFolder = items.find(item => item.includes('2025-04') || item.includes('missing'));
    
    if (!claudeFolder) {
      console.log('No Claude conversation folders found');
      return;
    }
    
    const conversationPath = path.join(archiveRoot, claudeFolder, 'conversation.json');
    
    if (!await fs.pathExists(conversationPath)) {
      console.log('conversation.json not found in:', claudeFolder);
      return;
    }
    
    console.log('Examining Claude conversation from folder:', claudeFolder);
    
    const conversation = await fs.readJson(conversationPath);
    
    console.log('\\nClaude conversation structure:');
    console.log('Keys:', Object.keys(conversation));
    console.log('\\nTop-level fields:');
    console.log('- id:', conversation.id);
    console.log('- conversation_id:', conversation.conversation_id);
    console.log('- name:', conversation.name);
    console.log('- title:', conversation.title);
    console.log('- created_at:', conversation.created_at);
    console.log('- updated_at:', conversation.updated_at);
    console.log('- create_time:', conversation.create_time);
    console.log('- update_time:', conversation.update_time);
    
    // Check message structure
    if (conversation.messages) {
      console.log('\\nMessages structure:');
      console.log('- messages (array):', conversation.messages.length, 'items');
      if (conversation.messages.length > 0) {
        console.log('- First message keys:', Object.keys(conversation.messages[0]));
        console.log('- First message id:', conversation.messages[0].id);
        console.log('- First message role:', conversation.messages[0].role);
      }
    }
    
    // Check if it has mapping (ChatGPT style)
    if (conversation.mapping) {
      console.log('\\nMapping structure:');
      console.log('- mapping (object):', Object.keys(conversation.mapping).length, 'items');
    }
    
    console.log('\\n=== Comparison with ChatGPT format ===');
    console.log('ChatGPT has: mapping, conversation_id, create_time, title');
    console.log('Claude has:', conversation.mapping ? 'mapping' : 'messages', 
                conversation.conversation_id ? 'conversation_id' : conversation.id ? 'id' : 'no ID', 
                conversation.create_time ? 'create_time' : conversation.created_at ? 'created_at' : 'no time',
                conversation.title ? 'title' : conversation.name ? 'name' : 'no title');
    
  } catch (error) {
    console.error('Error examining Claude conversation:', error);
  }
}

examineClaudeConversation();
