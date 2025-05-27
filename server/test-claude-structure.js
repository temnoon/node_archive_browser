// Test script to examine Claude archive structure
const fs = require('fs-extra');
const path = require('path');

// Simple function to read a portion of the JSON file to understand structure
async function examineClaudeStructure() {
  const claudeArchivePath = '/Users/tem/nab/claude1';
  
  try {
    console.log('Examining Claude archive structure...');
    
    // Read a small portion of conversations.json to understand the structure
    const conversationsPath = path.join(claudeArchivePath, 'conversations.json');
    
    if (await fs.pathExists(conversationsPath)) {
      // Read first 5000 characters to get structure
      const fd = await fs.open(conversationsPath, 'r');
      const buffer = Buffer.alloc(5000);
      await fs.read(fd, buffer, 0, 5000, 0);
      await fs.close(fd);
      
      const content = buffer.toString('utf8');
      console.log('First 5000 characters of conversations.json:');
      console.log(content);
      
      // Try to understand if it's an array or object
      const trimmed = content.trim();
      if (trimmed.startsWith('[')) {
        console.log('\nConversations format: Array of conversations');
      } else if (trimmed.startsWith('{')) {
        console.log('\nConversations format: Object containing conversations');
      }
    }
    
    // Check other files
    const projectsPath = path.join(claudeArchivePath, 'projects.json');
    if (await fs.pathExists(projectsPath)) {
      const projects = await fs.readJson(projectsPath);
      console.log('\nProjects.json structure:');
      console.log('Type:', Array.isArray(projects) ? 'Array' : 'Object');
      if (Array.isArray(projects)) {
        console.log('Count:', projects.length);
        if (projects.length > 0) {
          console.log('First project keys:', Object.keys(projects[0]));
        }
      } else {
        console.log('Keys:', Object.keys(projects));
      }
    }
    
    const usersPath = path.join(claudeArchivePath, 'users.json');
    if (await fs.pathExists(usersPath)) {
      const users = await fs.readJson(usersPath);
      console.log('\nUsers.json structure:');
      console.log('Type:', Array.isArray(users) ? 'Array' : 'Object');
      console.log('Content:', users);
    }
    
  } catch (error) {
    console.error('Error examining Claude archive:', error);
  }
}

examineClaudeStructure();
