// Claude Archive Import Processor
const fs = require('fs-extra');
const path = require('path');
const { Transform, pipeline } = require('stream');
const JSONStream = require('JSONStream');

// Helper: Create a folder name from a pattern and Claude conversation object
function formatClaudeFolderName(pattern, conversationObj) {
  const result = pattern.replace(/\{([^}]+)\}/g, (match, key) => {
    let replacement = '';
    
    if (key === 'uuid' && conversationObj.uuid) {
      replacement = conversationObj.uuid;
    } else if (key === 'title' && conversationObj.title) {
      replacement = conversationObj.title
        .replace(/[\\/:*?"<>|]/g, '_') // Replace invalid characters
        .replace(/\s+/g, '_')         // Replace spaces with underscores
        .substring(0, 50);            // Limit length
    } else if (key === 'date' && conversationObj.date) {
      try {
        const date = new Date(conversationObj.date);
        replacement = date.toISOString().slice(0, 19).replace(/:/g, '-').replace('T', '_');
      } catch (e) {
        console.error('Error formatting date:', conversationObj.date, e);
        replacement = 'unknown-date';
      }
    } else {
      // Return empty string for missing fields instead of debug text
      replacement = '';
    }
    
    return replacement;
  });
  
  return result;
}

// Extract media references from Claude conversation
function extractClaudeMediaReferences(conversation) {
  const mediaRefs = new Set();
  
  if (!conversation.messages || !Array.isArray(conversation.messages)) {
    return Array.from(mediaRefs);
  }
  
  for (const message of conversation.messages) {
    // Check for attachments in message
    if (message.attachments && Array.isArray(message.attachments)) {
      for (const attachment of message.attachments) {
        if (attachment.file_id || attachment.id) {
          mediaRefs.add(attachment.file_id || attachment.id);
        }
      }
    }
    
    // Check for embedded file references in content
    if (message.content && Array.isArray(message.content)) {
      for (const contentItem of message.content) {
        // Look for image, document, or file content types
        if (contentItem.type === 'image' && contentItem.source) {
          // Claude may store images differently
          if (contentItem.source.media_type && contentItem.source.data) {
            // Base64 encoded data - we'd need to extract this
            mediaRefs.add(`inline_${message.id}_${contentItem.type}`);
          }
        }
        if (contentItem.type === 'document' && contentItem.source) {
          if (contentItem.source.file_id) {
            mediaRefs.add(contentItem.source.file_id);
          }
        }
      }
    }
    
    // Check for tool use results that might contain media
    if (message.content && typeof message.content === 'string') {
      // Look for file references in text content
      const fileMatches = message.content.match(/file-[a-zA-Z0-9-]+/g);
      if (fileMatches) {
        fileMatches.forEach(match => mediaRefs.add(match));
      }
    }
  }
  
  return Array.from(mediaRefs);
}

// Process a single Claude conversation
async function processClaudeConversation(conversation, config, outputBasePath) {
  return new Promise(async (resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timeout processing Claude conversation ${conversation.id || 'unknown'}`));
    }, 60000); // 60-second timeout per conversation
    
    try {
      // Debug: Log the conversation structure (reduced logging)
      console.log('Processing Claude conversation:', conversation.id || 'no-id', '-', conversation.name || 'no-name');
      
      // Format conversation folder name
      const conversationObj = {
        uuid: conversation.id || `claude-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: conversation.name || 'Untitled',
        date: conversation.created_at || conversation.updated_at || new Date().toISOString()
      };
      
      const convFolderName = formatClaudeFolderName(config.conversationPattern, conversationObj);
      const convFolderPath = path.join(outputBasePath, convFolderName);
      
      // Create conversation folder
      await fs.ensureDir(convFolderPath);
      
      // Create media folder for the conversation
      const mediaFolderPath = path.join(convFolderPath, config.mediaFolder);
      await fs.ensureDir(mediaFolderPath);
      
      // Clone conversation to avoid modifying the original
      const conversationJson = JSON.parse(JSON.stringify(conversation));
      
      // Process media for Claude conversation
      console.log(`Processing media for Claude conversation: ${conversationObj.uuid}`);
      const mediaFiles = await processClaudeConversationMedia(
        config.sourceDir,
        mediaFolderPath,
        conversationJson
      );
      
      console.log(`Processed ${mediaFiles.size} media files for ${conversationObj.uuid}`);
      
      // Update asset pointers in the conversation JSON if needed
      // (Claude format may be different from ChatGPT)
      
      // Create messages directory
      const messagesDirPath = path.join(convFolderPath, 'messages');
      await fs.ensureDir(messagesDirPath);
      
      // Handle Claude format: convert chat_messages to messages
      const claudeMessages = conversationJson.chat_messages || conversationJson.messages || [];
      
      if (claudeMessages && Array.isArray(claudeMessages)) {
        console.log(`Processing ${claudeMessages.length} messages for conversation ${conversationObj.uuid}`);
        
        // Convert to standardized format and create individual files
        const standardizedMessages = [];
        
        for (let i = 0; i < claudeMessages.length; i++) {
          const claudeMessage = claudeMessages[i];
          
          // Convert Claude message to ChatGPT-compatible format
          const standardizedMessage = {
            id: claudeMessage.uuid || claudeMessage.id || `msg_${i}`,
            author: {
              role: convertClaudeRole(claudeMessage.sender)
            },
            content: {
              content_type: 'text',
              parts: [extractClaudeMessageText(claudeMessage)]
            },
            create_time: convertClaudeTimestamp(claudeMessage.created_at),
            update_time: convertClaudeTimestamp(claudeMessage.updated_at),
            metadata: {
              source_format: 'claude',
              original_sender: claudeMessage.sender
            }
          };
          
          // Extract and handle base64 images if present
          const extractedMedia = await extractBase64Media(claudeMessage, mediaFolderPath, i);
          if (extractedMedia.length > 0) {
            // Add media references to content
            standardizedMessage.content.content_type = 'multimodal_text';
            standardizedMessage.content.parts = [
              extractClaudeMessageText(claudeMessage),
              ...extractedMedia.map(media => ({
                content_type: 'image_asset_pointer',
                asset_pointer: `file-service://${media.filename}`,
                width: media.width,
                height: media.height
              }))
            ];
          }
          
          const messageId = standardizedMessage.id;
          
          // Create message directory
          const msgFolderPath = path.join(messagesDirPath, messageId);
          await fs.ensureDir(msgFolderPath);
          
          if (config.useMessageReferences) {
            // Save the standardized message to a separate file
            await fs.writeJson(
              path.join(msgFolderPath, 'message.json'),
              standardizedMessage,
              { spaces: 2 }
            );
            
            // Create reference for conversation JSON
            standardizedMessages.push({
              _reference: `messages/${messageId}/message.json`,
              _summary: {
                role: standardizedMessage.author.role,
                content_type: standardizedMessage.content.content_type,
                timestamp: standardizedMessage.create_time
              }
            });
          } else {
            // Traditional approach - save complete message
            await fs.writeJson(
              path.join(msgFolderPath, 'message.json'),
              standardizedMessage,
              { spaces: 2 }
            );
            
            standardizedMessages.push(standardizedMessage);
          }
        }
        
        // Update conversation JSON with standardized messages format
        conversationJson.mapping = {};
        standardizedMessages.forEach((msg, index) => {
          const msgId = msg._reference ? claudeMessages[index].uuid || `msg_${index}` : msg.id;
          conversationJson.mapping[msgId] = {
            id: msgId,
            message: msg._reference ? msg : msg,
            parent: index > 0 ? (claudeMessages[index-1].uuid || `msg_${index-1}`) : null,
            children: index < standardizedMessages.length - 1 ? [claudeMessages[index+1].uuid || `msg_${index+1}`] : []
          };
        });
        
        // Remove the original chat_messages array
        delete conversationJson.chat_messages;
        
        console.log(`Created ${standardizedMessages.length} individual message files`);
      } else {
        console.log('No messages found in Claude conversation');
      }
      
      // Write the final conversation JSON with proper ID field for indexing
      const finalConversation = {
        ...conversationJson,
        // Ensure we have an ID field for the archive service
        id: conversationJson.id || conversationObj.uuid,
        // Also ensure we have a conversation_id for compatibility
        conversation_id: conversationJson.conversation_id || conversationJson.id || conversationObj.uuid,
        // Add title field for compatibility
        title: conversationJson.title || conversationJson.name || conversationObj.title,
        // Add create_time field for compatibility (convert from ISO string to timestamp)
        create_time: conversationJson.create_time || 
                    (conversationJson.created_at ? new Date(conversationJson.created_at).getTime() / 1000 : null)
      };
      
      await fs.writeJson(
        path.join(convFolderPath, 'conversation.json'),
        finalConversation,
        { spaces: 2 }
      );
      
      clearTimeout(timeoutId);
      resolve(convFolderPath);
    } catch (err) {
      console.error(`Error processing Claude conversation ${conversation.id || 'unknown'}:`, err);
      clearTimeout(timeoutId);
      reject(err);
    }
  });
}

// Process media files for Claude conversation
async function processClaudeConversationMedia(sourceDir, mediaFolderPath, conversation) {
  const mediaFiles = new Map();
  
  try {
    // Extract media references from the conversation
    const mediaRefs = extractClaudeMediaReferences(conversation);
    
    if (mediaRefs.length === 0) {
      return mediaFiles;
    }
    
    // Look for media files in the Claude archive
    // Claude might store files differently than ChatGPT
    // Common locations might include a 'files' folder or embedded in the JSON
    
    for (const mediaRef of mediaRefs) {
      try {
        // Handle different types of media references
        if (mediaRef.startsWith('inline_')) {
          // Handle inline/embedded media (base64 data)
          await processInlineMedia(mediaRef, conversation, mediaFolderPath, mediaFiles);
        } else {
          // Handle file references
          await processClaudeFileReference(mediaRef, sourceDir, mediaFolderPath, mediaFiles);
        }
      } catch (error) {
        console.warn(`Failed to process media reference ${mediaRef}:`, error.message);
      }
    }
    
    return mediaFiles;
  } catch (error) {
    console.error('Error processing Claude conversation media:', error);
    return mediaFiles;
  }
}

// Process inline media (base64 embedded images, etc.)
async function processInlineMedia(mediaRef, conversation, mediaFolderPath, mediaFiles) {
  // Extract base64 data from conversation content
  for (const message of conversation.messages || []) {
    if (message.content && Array.isArray(message.content)) {
      for (const contentItem of message.content) {
        if (contentItem.type === 'image' && contentItem.source && contentItem.source.data) {
          const { media_type, data } = contentItem.source;
          
          // Determine file extension from media type
          const extension = media_type.split('/')[1] || 'bin';
          const filename = `${mediaRef}.${extension}`;
          const filePath = path.join(mediaFolderPath, filename);
          
          // Decode base64 and save file
          const buffer = Buffer.from(data, 'base64');
          await fs.writeFile(filePath, buffer);
          
          // Add to media files map
          mediaFiles.set(mediaRef, filename);
          break;
        }
      }
    }
  }
}

// Process Claude file reference
async function processClaudeFileReference(fileRef, sourceDir, mediaFolderPath, mediaFiles) {
  // Look for the file in common Claude archive locations
  const possiblePaths = [
    path.join(sourceDir, 'files', fileRef),
    path.join(sourceDir, 'attachments', fileRef),
    path.join(sourceDir, fileRef)
  ];
  
  for (const sourcePath of possiblePaths) {
    if (await fs.pathExists(sourcePath)) {
      const filename = path.basename(sourcePath);
      const destPath = path.join(mediaFolderPath, filename);
      await fs.copy(sourcePath, destPath);
      mediaFiles.set(fileRef, filename);
      return;
    }
  }
  
  // If not found, log it but don't fail
  console.warn(`Media file not found: ${fileRef}`);
}

// Sample Claude conversations for preview
async function sampleClaudeConversations(filePath, maxCount = 5) {
  return new Promise((resolve, reject) => {
    const conversations = [];
    
    const timeout = setTimeout(() => {
      reject(new Error('Timeout while reading Claude conversations.json'));
    }, 10000);
    
    try {
      const readStream = fs.createReadStream(filePath, { encoding: 'utf8' });
      const jsonStream = JSONStream.parse('*');
      
      jsonStream.on('data', (data) => {
        if (conversations.length < maxCount) {
          conversations.push(data);
        } else {
          readStream.destroy();
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

// Generate preview for Claude archive
async function generateClaudePreview(config) {
  try {
    const { sourceDir, archiveName, conversationPattern, preserveJson, mediaFolder, useMessageReferences } = config;
    
    // Check if source directory exists
    if (!await fs.pathExists(sourceDir)) {
      throw new Error('Source directory does not exist');
    }
    
    // Check for conversations.json in source directory
    const conversationsPath = path.join(sourceDir, 'conversations.json');
    if (!await fs.pathExists(conversationsPath)) {
      throw new Error('conversations.json not found in source directory');
    }
    
    // Sample conversations
    const sampleConvos = await sampleClaudeConversations(conversationsPath, 3);
    
    if (!sampleConvos || sampleConvos.length === 0) {
      throw new Error('No conversations found in conversations.json');
    }
    
    // Build preview structure
    const structure = [];
    structure.push(`${archiveName}/`);
    
    for (let i = 0; i < sampleConvos.length; i++) {
      const conversation = sampleConvos[i];
      
      const conversationObj = {
        uuid: conversation.id || `claude-${i}`,
        title: conversation.name || 'Untitled',
        date: conversation.created_at || new Date().toISOString()
      };
      const convFolderName = formatClaudeFolderName(conversationPattern, conversationObj);
      
      structure.push(`  ${i+1}. ${convFolderName}/`);
      structure.push(`    conversation.json  # Claude conversation with ${useMessageReferences ? 'message references' : 'full content'}`);
      structure.push(`    messages/`);
      
      // Show sample message folders
      const messageCount = conversation.messages ? conversation.messages.length : 0;
      if (messageCount > 0) {
        const sampleMsgCount = Math.min(messageCount, 3);
        for (let m = 0; m < sampleMsgCount; m++) {
          const message = conversation.messages[m];
          const msgId = message.id || `msg_${m}`;
          structure.push(`      ${msgId}/`);
          structure.push(`        message.json  # ${message.role || 'unknown'} message`);
        }
        if (messageCount > 3) {
          structure.push(`      ... (${messageCount - 3} more messages)`);
        }
      }
      
      // Check for media
      const mediaRefs = extractClaudeMediaReferences(conversation);
      if (mediaRefs.length > 0) {
        structure.push(`    ${mediaFolder}/`);
        structure.push(`      # ${mediaRefs.length} media files (attachments, images, etc.)`);
      }
    }
    
    return {
      folderStructure: structure.join('\n'),
      archiveType: 'claude'
    };
  } catch (err) {
    console.error('Error generating Claude preview:', err);
    throw err;
  }
}

// Main Claude archive import function
async function importClaudeArchive(config) {
  try {
    const { sourceDir, outputDir, archiveName, skipFailedConversations } = config;
    
    // Validate inputs
    if (!sourceDir || !outputDir) {
      throw new Error('Source and output directories must be specified');
    }
    
    if (!await fs.pathExists(sourceDir)) {
      throw new Error('Source directory does not exist');
    }
    
    const conversationsPath = path.join(sourceDir, 'conversations.json');
    if (!await fs.pathExists(conversationsPath)) {
      throw new Error('conversations.json not found in source directory');
    }
    
    // Create output directory
    const outputBasePath = path.join(outputDir, archiveName);
    await fs.ensureDir(outputBasePath);
    
    // Process conversations using streaming
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(conversationsPath, { encoding: 'utf8' });
      
      let totalConversations = 0;
      let processedConversations = 0;
      let failedConversations = [];
      
      console.log('Starting Claude conversation streaming...');
      
      const countStream = new Transform({
        objectMode: true,
        transform(chunk, encoding, callback) {
          totalConversations++;
          if (totalConversations % 10 === 0) {
            console.log(`Found ${totalConversations} conversations so far...`);
          }
          this.push(chunk);
          callback();
        }
      });
      
      const processStream = new Transform({
        objectMode: true,
        async transform(conversation, encoding, callback) {
          try {
            await processClaudeConversation(conversation, config, outputBasePath);
            processedConversations++;
            if (processedConversations % 25 === 0) {
              console.log(`Processed ${processedConversations}/${totalConversations} conversations...`);
            }
            callback();
          } catch (err) {
            console.error(`Error processing conversation ${conversation.id}:`, err);
            if (skipFailedConversations) {
              console.warn(`Skipping failed Claude conversation: ${conversation.id}`);
              failedConversations.push({
                id: conversation.id,
                name: conversation.name || 'Untitled',
                error: err.message
              });
              processedConversations++;
              callback();
            } else {
              callback(err);
            }
          }
        }
      });
      
      pipeline(
        readStream,
        JSONStream.parse('*'),
        countStream,
        processStream,
        async (err) => {
          console.log('Pipeline completed. Error:', err, 'Processed:', processedConversations, 'Total:', totalConversations);
          
          if (err) {
            console.error('Claude import pipeline error:', err);
            return reject(err);
          }
          
          try {
            console.log(`Claude import completed: ${processedConversations} conversations processed, ${failedConversations.length} failed`);
            
            // Write failed conversations report
            if (failedConversations.length > 0) {
              await fs.writeJson(
                path.join(outputBasePath, 'claude_import_errors.json'),
                {
                  totalConversations,
                  successfulConversations: processedConversations - failedConversations.length,
                  failedConversations
                },
                { spaces: 2 }
              );
            }
            
            resolve({
              outputBasePath,
              totalConversations,
              processedConversations,
              failedConversations: failedConversations.length
            });
          } catch (finalError) {
            console.error('Error in final Claude import steps:', finalError);
            reject(finalError);
          }
        }
      );
    });
  } catch (err) {
    throw err;
  }
}

// Helper functions for Claude format conversion
function convertClaudeRole(sender) {
  switch(sender) {
    case 'human': return 'user';
    case 'assistant': return 'assistant';
    default: return sender || 'unknown';
  }
}

function convertClaudeTimestamp(timestamp) {
  if (!timestamp) return Math.floor(Date.now() / 1000);
  
  try {
    // Claude timestamps are ISO strings, convert to Unix timestamp
    return Math.floor(new Date(timestamp).getTime() / 1000);
  } catch (e) {
    return Math.floor(Date.now() / 1000);
  }
}

function extractClaudeMessageText(claudeMessage) {
  // Handle Claude's complex content structure
  if (typeof claudeMessage.text === 'string') {
    return claudeMessage.text;
  }
  
  if (Array.isArray(claudeMessage.content)) {
    return claudeMessage.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n');
  }
  
  if (claudeMessage.content && typeof claudeMessage.content === 'string') {
    return claudeMessage.content;
  }
  
  return JSON.stringify(claudeMessage.content || claudeMessage.text || '');
}

async function extractBase64Media(claudeMessage, mediaFolderPath, messageIndex) {
  const extractedMedia = [];
  
  if (!claudeMessage.content || !Array.isArray(claudeMessage.content)) {
    return extractedMedia;
  }
  
  for (let i = 0; i < claudeMessage.content.length; i++) {
    const contentItem = claudeMessage.content[i];
    
    if (contentItem.type === 'image' && contentItem.source && contentItem.source.data) {
      try {
        const { media_type, data } = contentItem.source;
        
        // Determine file extension from media type
        const extension = media_type.split('/')[1] || 'png';
        const filename = `claude_msg_${messageIndex}_img_${i}.${extension}`;
        const filePath = path.join(mediaFolderPath, filename);
        
        // Decode base64 and save file
        const buffer = Buffer.from(data, 'base64');
        await fs.writeFile(filePath, buffer);
        
        console.log(`Extracted base64 image: ${filename}`);
        
        extractedMedia.push({
          filename,
          width: contentItem.width || 512,
          height: contentItem.height || 512,
          type: 'image'
        });
      } catch (error) {
        console.warn(`Failed to extract base64 image from message ${messageIndex}:`, error.message);
      }
    }
  }
  
  return extractedMedia;
}

module.exports = {
  processClaudeConversation,
  generateClaudePreview,
  importClaudeArchive,
  sampleClaudeConversations,
  extractClaudeMediaReferences,
  convertClaudeRole,
  convertClaudeTimestamp,
  extractClaudeMessageText
};
