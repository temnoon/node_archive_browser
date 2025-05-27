// Utility to examine Claude archive structure without loading the full file
const fs = require('fs-extra');
const JSONStream = require('JSONStream');

// Sample a few conversations from Claude's conversations.json to understand structure
async function sampleClaudeConversations(filePath, maxCount = 3) {
  return new Promise((resolve, reject) => {
    const conversations = [];
    
    // Set a timeout to prevent hanging
    const timeout = setTimeout(() => {
      reject(new Error('Timeout while reading Claude conversations.json'));
    }, 10000); // 10 second timeout
    
    try {
      const readStream = fs.createReadStream(filePath, { encoding: 'utf8' });
      const jsonStream = JSONStream.parse('*');
      
      jsonStream.on('data', (data) => {
        if (conversations.length < maxCount) {
          conversations.push(data);
        } else {
          readStream.destroy(); // Stop reading after we have enough conversations
        }
      });
      
      jsonStream.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
      
      jsonStream.on('end', () => {
        clearTimeout(timeout);
        resolve(conversations);
      });
      
      readStream.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
      
      readStream.pipe(jsonStream);
    } catch (err) {
      clearTimeout(timeout);
      reject(err);
    }
  });
}

// Examine the structure of Claude files
async function examineClaudeArchive(archivePath) {
  const results = {
    conversations: null,
    projects: null,
    users: null,
    structure: {}
  };
  
  try {
    // Check conversations.json
    const conversationsPath = `${archivePath}/conversations.json`;
    if (await fs.pathExists(conversationsPath)) {
      console.log('Found conversations.json, sampling...');
      const sampleConversations = await sampleClaudeConversations(conversationsPath, 2);
      results.conversations = {
        count: sampleConversations.length,
        sample: sampleConversations
      };
    }
    
    // Check projects.json
    const projectsPath = `${archivePath}/projects.json`;
    if (await fs.pathExists(projectsPath)) {
      console.log('Found projects.json, reading...');
      const projects = await fs.readJson(projectsPath);
      results.projects = {
        type: Array.isArray(projects) ? 'array' : 'object',
        count: Array.isArray(projects) ? projects.length : Object.keys(projects).length,
        sample: Array.isArray(projects) ? projects.slice(0, 2) : projects
      };
    }
    
    // Check users.json
    const usersPath = `${archivePath}/users.json`;
    if (await fs.pathExists(usersPath)) {
      console.log('Found users.json, reading...');
      const users = await fs.readJson(usersPath);
      results.users = {
        type: Array.isArray(users) ? 'array' : 'object',
        count: Array.isArray(users) ? users.length : Object.keys(users).length,
        sample: users
      };
    }
    
    return results;
  } catch (error) {
    console.error('Error examining Claude archive:', error);
    throw error;
  }
}

module.exports = {
  sampleClaudeConversations,
  examineClaudeArchive
};
