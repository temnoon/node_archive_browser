// Updated API Controller for archive import/explode functionality
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { Transform, pipeline } = require('stream');
const JSONStream = require('JSONStream');
const mediaProcessor = require('./media-processor');
const claudeImportProcessor = require('./claude-import-processor');
const archiveController = require('./controllers/archiveController');
const archiveService = require('./services/archiveService');

// Store current import status
let importStatus = {
  status: 'idle', // idle, in_progress, completed, failed
  progress: 0,
  totalConversations: 0,
  processedConversations: 0,
  error: null,
  startTime: null,
  endTime: null,
  failedConversations: [] // Track conversations that fail
};

// Config file path - user's home directory
const CONFIG_PATH = path.join(os.homedir(), '.carchive_config.json');

// Default configuration
const DEFAULT_CONFIG = {
  archiveType: 'auto', // auto-detect, openai, claude
  sourceDir: '',
  outputDir: '',
  archiveName: 'exploded_archive',
  conversationPattern: '{uuid}_{date}_{title}',
  preserveJson: true,
  mediaFolder: 'media',
  useIsoDate: true,
  useMessageReferences: true, // New option for using message references instead of duplication
  skipFailedConversations: true, // Skip conversations that fail to process rather than stopping the import
  organizationStrategy: 'flat' // 'flat' or 'subfolder'
};

// Load config from file
async function loadConfig() {
  try {
    if (await fs.pathExists(CONFIG_PATH)) {
      return await fs.readJson(CONFIG_PATH);
    }
    return DEFAULT_CONFIG;
  } catch (err) {
    console.error('Error loading config:', err);
    return DEFAULT_CONFIG;
  }
}

// Save config to file
async function saveConfig(config) {
  try {
    await fs.writeJson(CONFIG_PATH, config, { spaces: 2 });
    return true;
  } catch (err) {
    console.error('Error saving config:', err);
    throw err;
  }
}

// Helper: Create a folder name from a pattern and object
function formatFolderName(pattern, obj) {
  return pattern.replace(/\{([^}]+)\}/g, (match, key) => {
    if (obj[key] !== undefined) {
      // Format date in ISO8601 format to ensure sortability
      if (key === 'date' && obj[key]) {
        try {
          const date = new Date(obj[key] * 1000); // Convert from UNIX timestamp if necessary
          if (isNaN(date.getTime())) {
            // Try without multiplication if timestamp is already in milliseconds
            date = new Date(obj[key]);
          }
          return date.toISOString().slice(0, 19).replace(/:/g, '-').replace('T', '_');
        } catch (e) {
          return obj[key] || '';
        }
      }
      // Format title in a file-system friendly way
      if (key === 'title' && obj[key]) {
        return obj[key]
          .replace(/[\\/:*?"<>|]/g, '_') // Replace invalid characters
          .replace(/\s+/g, '_')         // Replace spaces with underscores
          .substring(0, 50);            // Limit length
      }
      // Use UUID directly when requested
      if (key === 'uuid' && obj[key]) {
        return obj[key];
      }
      return obj[key] || '';
    }
    return '';
  });
}

// Safe wrapper for extracting media references
function safeExtractMediaReferences(conversation) {
  try {
    // First check if the conversation has a valid structure
    if (!conversation || typeof conversation !== 'object') {
      return [];
    }
    
    return mediaProcessor.extractMediaReferences(conversation);
  } catch (error) {
    console.error('Error extracting media references:', error);
    return []; // Return empty array in case of failure
  }
}

// Detect archive type based on directory contents
async function detectArchiveType(sourceDir) {
  try {
    const conversationsPath = path.join(sourceDir, 'conversations.json');
    if (!await fs.pathExists(conversationsPath)) {
      throw new Error('conversations.json not found');
    }
    
    // Sample first conversation to determine format
    const sampleConvos = await sampleConversations(conversationsPath, 1);
    if (!sampleConvos || sampleConvos.length === 0) {
      throw new Error('No conversations found');
    }
    
    const conversation = sampleConvos[0];
    
    // Check for OpenAI/ChatGPT specific fields
    if (conversation.mapping && conversation.create_time && conversation.conversation_id) {
      return 'openai';
    }
    
    // Check for Claude specific fields
    if (conversation.id && conversation.name && conversation.created_at && 
        conversation.messages && Array.isArray(conversation.messages)) {
      return 'claude';
    }
    
    // Default to openai if structure is unclear
    return 'openai';
  } catch (error) {
    console.error('Error detecting archive type:', error);
    return 'openai'; // Default fallback
  }
}

// Generate a preview of the folder structure (fixed to avoid hanging)
async function generatePreview(config) {
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
    
    // Detect archive type if set to auto
    let archiveType = config.archiveType;
    if (archiveType === 'auto') {
      archiveType = await detectArchiveType(sourceDir);
      console.log(`Auto-detected archive type: ${archiveType}`);
    }
    
    // Determine output structure based on organization strategy
    let previewStructure = [];
    if (config.organizationStrategy === 'subfolder') {
      const subfolderName = archiveType === 'claude' ? 'claude' : 'chatgpt';
      previewStructure.push(`${archiveName}/`);
      previewStructure.push(`  ${subfolderName}/`);
      // Adjust the archive name for the nested structure
      config = { ...config, archiveName: subfolderName };
    }
    
    // Use Claude preview if it's a Claude archive
    if (archiveType === 'claude') {
      const claudePreview = await claudeImportProcessor.generateClaudePreview(config);
      if (config.organizationStrategy === 'subfolder') {
        // Indent the Claude preview structure
        const indentedStructure = claudePreview.folderStructure
          .split('\n')
          .map(line => line ? `  ${line}` : line)
          .join('\n');
        return {
          folderStructure: previewStructure.join('\n') + '\n' + indentedStructure,
          archiveType: 'claude',
          organizationStrategy: config.organizationStrategy
        };
      }
      return claudePreview;
    }
    
    // Pre-cache DALL-E generations and new format files for faster preview
    await mediaProcessor.initDalleGenerationsCache(sourceDir);
    await mediaProcessor.initAudioFilesCache(sourceDir);
    await mediaProcessor.initUserGenerationsCache(sourceDir);
    
    // Sample up to 5 conversations for a more realistic preview
    let sampleConvos;
    try {
      sampleConvos = await sampleConversations(conversationsPath, 5);
    } catch (err) {
      console.error('Error sampling conversations:', err);
      // Fallback to a simpler preview if there's an error
      return generateSimplePreview(config);
    }
    
    if (!sampleConvos || sampleConvos.length === 0) {
      throw new Error('No conversations found in conversations.json');
    }
    
    // Build preview structure
    const structure = [];
    if (config.organizationStrategy === 'subfolder') {
      // We already have the base structure from earlier, use it
      structure.push(...previewStructure);
    } else {
      structure.push(`${archiveName}/`);
    }
    
    // For each sample conversation, generate a preview structure
    for (let i = 0; i < Math.min(sampleConvos.length, 5); i++) {
      const conversation = sampleConvos[i];
      
      // Format conversation folder name
      const conversationObj = {
        uuid: conversation.id || conversation.conversation_id || `unknown-${i}`,
        title: conversation.title || 'Untitled',
        date: conversation.create_time || new Date().getTime() / 1000
      };
      const convFolderName = formatFolderName(conversationPattern, conversationObj);
      
      // Add conversation folder with proper indentation
      const indent = config.organizationStrategy === 'subfolder' ? '    ' : '  ';
      structure.push(`${indent}${i+1}. ${convFolderName}/`);
      
      if (useMessageReferences) {
        // Add conversation.json file with message references
        structure.push(`${indent}  conversation.json  # Conversation with message references`);
      } else {
        // Add conversation.json file
        structure.push(`${indent}  conversation.json  # Complete original conversation JSON`);
      }
      
      // Add messages directory
      structure.push(`${indent}  messages/`);
      
      // Add sample message folders
      if (conversation.mapping) {
        const messageIds = Object.keys(conversation.mapping).slice(0, 3);
        for (const id of messageIds) {
          const message = conversation.mapping[id];
          if (message && message.message && message.message.author && message.message.author.role) {
            structure.push(`${indent}    ${id}/`);
            structure.push(`${indent}      message.json  # Message content JSON`);
          }
        }
      }
      
      // Add media folder (only if the conversation has media)
      // Use the safe wrapper to prevent errors
      const mediaRefs = safeExtractMediaReferences(conversation);
      if (mediaRefs.length > 0) {
        structure.push(`${indent}  ${mediaFolder}/`);
        // Show a couple of example media files
        for (let m = 0; m < Math.min(mediaRefs.length, 2); m++) {
          const fileId = mediaRefs[m];
          // Skip invalid references
          if (!fileId || fileId === 'file-service:' || fileId === 'sediment:') {
            continue;
          }
          structure.push(`${indent}    ${fileId}  # Media file (original filename preserved)`);
        }
        if (mediaRefs.length > 2) {
          structure.push(`${indent}    ... (${mediaRefs.length - 2} more media files)`);
        }
      }
    }
    
    // Return preview data
    return {
      folderStructure: structure.join('\n'),
      organizationStrategy: config.organizationStrategy
    };
  } catch (err) {
    console.error('Error generating preview:', err);
    
    // Return a simple generic preview
    return generateSimplePreview(config);
  }
}

// Fallback preview generator that doesn't require conversation data
function generateSimplePreview(config) {
  const { archiveName, conversationPattern, mediaFolder, useMessageReferences } = config;
  
  const structure = [];
  structure.push(`${archiveName}/`);
  structure.push(`  example_123abc_2023-04-30T12-00-00_Sample_Conversation/`);
  structure.push(`    conversation.json  # ${useMessageReferences ? 'Conversation with message references' : 'Complete original conversation JSON'}`);
  structure.push(`    messages/`);
  structure.push(`      message-id-123/`);
  structure.push(`        message.json  # Message content JSON`);
  structure.push(`      message-id-456/`);
  structure.push(`        message.json  # Message content JSON`);
  structure.push(`    ${mediaFolder}/`);
  structure.push(`      file-XYZ-ABC123.webp  # DALL-E generation (original filename)`);
  structure.push(`      file-YYYY-something.jpg  # Uploaded image (original filename)`);
  
  return {
    folderStructure: structure.join('\n'),
    isGeneric: true // Flag to indicate this is a fallback preview
  };
}

// Helper: Sample a specific number of conversations from a large JSON file
async function sampleConversations(filePath, maxCount = 5) {
  return new Promise((resolve, reject) => {
    const conversations = [];
    
    // Set a timeout to prevent hanging
    const timeout = setTimeout(() => {
      reject(new Error('Timeout while reading conversations.json'));
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

// Helper: Sample just the first conversation from a large JSON file without loading it all
async function sampleFirstConversation(filePath) {
  try {
    const conversations = await sampleConversations(filePath, 1);
    return conversations[0] || null;
  } catch (err) {
    console.error('Error sampling first conversation:', err);
    return null;
  }
}

// Process a single OpenAI conversation with timeout protection
async function processOpenAIConversation(conversation, config, outputBasePath) {
  return new Promise(async (resolve, reject) => {
    // Create a timeout promise to prevent hanging
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timeout processing conversation ${conversation.id || conversation.conversation_id || 'unknown'}`));
    }, 60000); // 60-second timeout per conversation
    
    try {
      // Format conversation folder name using UUID
      const conversationObj = {
        uuid: conversation.id || conversation.conversation_id,
        title: conversation.title || 'Untitled',
        date: conversation.create_time
      };
      const convFolderName = formatFolderName(config.conversationPattern, conversationObj);
      const convFolderPath = path.join(outputBasePath, convFolderName);
      
      // Create conversation folder
      await fs.ensureDir(convFolderPath);
      
      // Create media folder for the conversation
      const mediaFolderPath = path.join(convFolderPath, config.mediaFolder);
      await fs.ensureDir(mediaFolderPath);
      
      // Clone conversation to avoid modifying the original
      const conversationJson = JSON.parse(JSON.stringify(conversation));
      
      // Use the media processor to handle all media for this conversation
      // This is more efficient than processing message by message
      console.log(`Processing media for conversation: ${conversationObj.uuid}`);
      const mediaFiles = await mediaProcessor.processConversationMedia(
        config.sourceDir,
        mediaFolderPath,
        conversationJson
      );
      
      console.log(`Processed ${mediaFiles.size} media files for ${conversationObj.uuid}`);
      
      // Update asset pointers in the conversation JSON
      const updatedConversation = mediaProcessor.updateAssetPointers(conversationJson, mediaFiles);
      
      if (updatedConversation.mapping) {
        // Create messages directory
        const messagesDirPath = path.join(convFolderPath, 'messages');
        await fs.ensureDir(messagesDirPath);
        
        const messageIds = Object.keys(updatedConversation.mapping);
        
        // If we're using message references (to avoid JSON duplication)
        if (config.useMessageReferences) {
          for (const id of messageIds) {
            const message = updatedConversation.mapping[id];
            
            // Skip if not a proper message
            if (!message.message) {
              continue;
            }
            
            // Create message directory using UUID
            const msgFolderPath = path.join(messagesDirPath, id);
            await fs.ensureDir(msgFolderPath);
            
            // Save the message to a separate file
            await fs.writeJson(
              path.join(msgFolderPath, 'message.json'),
              message.message,
              { spaces: 2 }
            );
            
            // Replace message content with a reference in the conversation JSON
            // Store the path relative to the conversation.json
            message.message = {
              _reference: `messages/${id}/message.json`,
              _summary: {
                role: message.message.author?.role || 'unknown',
                content_type: message.message.content?.content_type || 'text'
              }
            };
          }
        } else {
          // Traditional approach - duplicate message JSON
          for (const id of messageIds) {
            const message = updatedConversation.mapping[id];
            
            // Skip if not a proper message
            if (!message.message) {
              continue;
            }
            
            // Create message directory using UUID
            const msgFolderPath = path.join(messagesDirPath, id);
            await fs.ensureDir(msgFolderPath);
            
            // Write complete message JSON
            await fs.writeJson(
              path.join(msgFolderPath, 'message.json'),
              message,
              { spaces: 2 }
            );
          }
        }
      }
      
      // Write the final conversation JSON
      await fs.writeJson(
        path.join(convFolderPath, 'conversation.json'),
        updatedConversation,
        { spaces: 2 }
      );
      
      clearTimeout(timeoutId);
      resolve(convFolderPath);
    } catch (err) {
      console.error(`Error processing conversation ${conversation.id || conversation.conversation_id || 'unknown'}:`, err);
      clearTimeout(timeoutId);
      reject(err);
    }
  });
}

// Run the full archive import/explode process (supports both OpenAI and Claude)
async function importArchive(config) {
  try {
    const { sourceDir, outputDir, archiveName, skipFailedConversations, organizationStrategy } = config;
    
    // Detect archive type if set to auto
    let archiveType = config.archiveType;
    if (archiveType === 'auto') {
      archiveType = await detectArchiveType(sourceDir);
      console.log(`Auto-detected archive type: ${archiveType}`);
    }
    
    // Determine output path based on organization strategy
    let outputBasePath = path.join(outputDir, archiveName);
    if (organizationStrategy === 'subfolder') {
      const subfolderName = archiveType === 'claude' ? 'claude' : 'chatgpt';
      outputBasePath = path.join(outputDir, archiveName, subfolderName);
      console.log(`Using subfolder organization: ${subfolderName}`);
    }
    
    // Use appropriate importer based on archive type
    if (archiveType === 'claude') {
      return await importClaudeArchive({ ...config, outputBasePath });
    } else {
      return await importOpenAIArchive({ ...config, outputBasePath });
    }
  } catch (err) {
    throw err;
  }
}

// Import Claude archive
async function importClaudeArchive(config) {
  try {
    const { sourceDir, outputBasePath, skipFailedConversations } = config;
    
    // Use provided outputBasePath or fall back to original logic
    const finalOutputPath = outputBasePath || path.join(config.outputDir, config.archiveName);
    
    // Update status to in_progress
    importStatus = {
      status: 'in_progress',
      progress: 0,
      totalConversations: 0,
      processedConversations: 0,
      error: null,
      startTime: new Date().toISOString(),
      endTime: null,
      failedConversations: []
    };
    
    console.log('Starting Claude archive import...');
    
    // Use the Claude import processor with the final output path
    const result = await claudeImportProcessor.importClaudeArchive({ ...config, outputDir: path.dirname(finalOutputPath), archiveName: path.basename(finalOutputPath) });
    
    // Update final status
    const hasFailures = result.failedConversations > 0;
    importStatus = {
      ...importStatus,
      status: hasFailures ? 'completed_with_errors' : 'completed',
      progress: 100,
      totalConversations: result.totalConversations,
      processedConversations: result.processedConversations,
      endTime: new Date().toISOString()
    };
    
    // Update archive root and refresh index - use the top-level archive directory
    const archiveRootForIndexing = config.organizationStrategy === 'subfolder' ? 
      path.join(config.outputDir, config.archiveName) : finalOutputPath;
    
    try {
      console.log(`Updating archive root to: ${archiveRootForIndexing}`);
      
      const dotenv = require('dotenv');
      const envFilePath = path.resolve(__dirname, '../.env');
      
      let envContent = '';
      if (await fs.pathExists(envFilePath)) {
        envContent = await fs.readFile(envFilePath, 'utf8');
      }
      
      const envConfig = dotenv.parse(envContent);
      envConfig.ARCHIVE_ROOT = archiveRootForIndexing;
      
      const newEnvContent = Object.entries(envConfig)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
      
      await fs.writeFile(envFilePath, newEnvContent);
      process.env.ARCHIVE_ROOT = archiveRootForIndexing;
      
      console.log('Refreshing archive index with new location...');
      await archiveService.refreshIndex(archiveRootForIndexing);
      
      console.log('Successfully updated archive root and refreshed index');
    } catch (archiveUpdateError) {
      console.error('Failed to update archive root automatically:', archiveUpdateError);
    }
    
    return finalOutputPath;
  } catch (err) {
    importStatus = {
      ...importStatus,
      status: 'failed',
      error: err.message,
      endTime: new Date().toISOString()
    };
    throw err;
  }
}

// Run the full OpenAI archive import/explode process
async function importOpenAIArchive(config) {
  try {
    const { sourceDir, outputBasePath, skipFailedConversations } = config;
    
    // Use provided outputBasePath or fall back to original logic
    const finalOutputPath = outputBasePath || path.join(config.outputDir, config.archiveName);
    
    // Validate inputs
    if (!sourceDir) {
      throw new Error('Source directory must be specified');
    }
    
    // Check if source directory exists
    if (!await fs.pathExists(sourceDir)) {
      throw new Error('Source directory does not exist');
    }
    
    // Check for conversations.json in source directory
    const conversationsPath = path.join(sourceDir, 'conversations.json');
    if (!await fs.pathExists(conversationsPath)) {
      throw new Error('conversations.json not found in source directory');
    }
    
    // Create output directory and exploded archive folder
    await fs.ensureDir(finalOutputPath);
    
    // Initialize DALL-E generation cache for better performance
    await mediaProcessor.initDalleGenerationsCache(sourceDir);
    await mediaProcessor.initAudioFilesCache(sourceDir);
    await mediaProcessor.initUserGenerationsCache(sourceDir);
    
    // Update status to in_progress
    importStatus = {
      status: 'in_progress',
      progress: 0,
      totalConversations: 0,
      processedConversations: 0,
      error: null,
      startTime: new Date().toISOString(),
      endTime: null,
      failedConversations: []
    };
    
    // Process the conversations file using streaming to handle large files
    return new Promise((resolve, reject) => {
      // Create read stream for the conversations.json file
      const readStream = fs.createReadStream(conversationsPath, { encoding: 'utf8' });
      
      // Count total conversations for progress reporting
      let totalConversations = 0;
      let processedConversations = 0;
      let failedConversations = [];
      
      // Create pipeline to process the JSON
      const countStream = new Transform({
        objectMode: true,
        transform(chunk, encoding, callback) {
          totalConversations++;
          this.push(chunk);
          callback();
        }
      });
      
      // Create pipeline to process each conversation
      const processStream = new Transform({
        objectMode: true,
        async transform(conversation, encoding, callback) {
          try {
            // Update the total count immediately for more accurate progress reporting
            importStatus.totalConversations = totalConversations;
            
            // Process the conversation with timeout protection
            await processOpenAIConversation(conversation, config, finalOutputPath)
              .then(() => {
                // Update progress
                processedConversations++;
                const progress = Math.round((processedConversations / totalConversations) * 100);
                
                // Update status
                importStatus = {
                  ...importStatus,
                  totalConversations,
                  processedConversations,
                  progress: Math.min(progress, 99), // Don't show 100% until fully complete
                  failedConversations
                };
                
                callback();
              })
              .catch(err => {
                if (skipFailedConversations) {
                  console.warn(`Skipping failed conversation: ${conversation.id || conversation.conversation_id}`, err);
                  
                  // Add to failed conversations list
                  failedConversations.push({
                    id: conversation.id || conversation.conversation_id,
                    title: conversation.title || 'Untitled',
                    error: err.message
                  });
                  
                  // Still count this conversation as processed for progress reporting
                  processedConversations++;
                  const progress = Math.round((processedConversations / totalConversations) * 100);
                  
                  // Update status
                  importStatus = {
                    ...importStatus,
                    totalConversations,
                    processedConversations,
                    progress: Math.min(progress, 99),
                    failedConversations
                  };
                  
                  callback(); // Continue to next conversation
                } else {
                  // Don't skip, propagate the error
                  callback(err);
                }
              });
          } catch (err) {
            // For any uncaught errors, decide whether to skip or abort
            if (skipFailedConversations) {
              console.warn(`Skipping failed conversation (uncaught): ${conversation.id || conversation.conversation_id}`, err);
              
              // Add to failed conversations list
              failedConversations.push({
                id: conversation.id || conversation.conversation_id,
                title: conversation.title || 'Untitled',
                error: err.message
              });
              
              // Still count this conversation as processed for progress reporting
              processedConversations++;
              const progress = Math.round((processedConversations / totalConversations) * 100);
              
              // Update status
              importStatus = {
                ...importStatus,
                totalConversations,
                processedConversations,
                progress: Math.min(progress, 99),
                failedConversations
              };
              
              callback(); // Continue to next conversation
            } else {
              callback(err);
            }
          }
        }
      });
      
      // Set up stream pipeline with better error handling
      pipeline(
        readStream,
        JSONStream.parse('*'),
        countStream,
        processStream,
        async (err) => {
          if (err) {
            console.error('Pipeline error:', err);
            importStatus = {
              ...importStatus,
              status: 'failed',
              error: err.message,
              endTime: new Date().toISOString(),
              failedConversations
            };
            return reject(err);
          }
          
          try {
            const hasFailures = failedConversations.length > 0;
            
            // Mark as completed
            importStatus = {
              ...importStatus,
              status: hasFailures ? 'completed_with_errors' : 'completed',
              progress: 100,
              endTime: new Date().toISOString(),
              failedConversations
            };
            
            // Write a report of failed conversations if any
            if (hasFailures) {
              await fs.writeJson(
                path.join(finalOutputPath, 'import_errors.json'),
                {
                  totalConversations,
                  successfulConversations: processedConversations - failedConversations.length,
                  failedConversations
                },
                { spaces: 2 }
              );
              
              console.warn(`Import completed with ${failedConversations.length} failed conversations. See import_errors.json for details.`);
            }
            
            // Automatically update the archive root to point to the newly imported archive
            // Use the top-level archive directory for indexing if using subfolder organization
            const archiveRootForIndexing = config.organizationStrategy === 'subfolder' ? 
              path.join(config.outputDir, config.archiveName) : finalOutputPath;
            
            try {
              console.log(`Updating archive root to: ${archiveRootForIndexing}`);
              
              // Update the environment variable and .env file
              const dotenv = require('dotenv');
              const envFilePath = path.resolve(__dirname, '../.env');
              
              // Read existing .env file if it exists
              let envContent = '';
              if (await fs.pathExists(envFilePath)) {
                envContent = await fs.readFile(envFilePath, 'utf8');
              }
              
              // Parse existing .env content
              const envConfig = dotenv.parse(envContent);
              
              // Update ARCHIVE_ROOT
              envConfig.ARCHIVE_ROOT = archiveRootForIndexing;
              
              // Convert back to .env format
              const newEnvContent = Object.entries(envConfig)
                .map(([key, value]) => `${key}=${value}`)
                .join('\n');
              
              // Write back to .env file
              await fs.writeFile(envFilePath, newEnvContent);
              
              // Update process.env
              process.env.ARCHIVE_ROOT = archiveRootForIndexing;
              
              // Refresh the archive index with the new location
              console.log('Refreshing archive index with new location...');
              await archiveService.refreshIndex(archiveRootForIndexing);
              
              console.log('Successfully updated archive root and refreshed index');
            } catch (archiveUpdateError) {
              console.error('Failed to update archive root automatically:', archiveUpdateError);
              // Don't fail the import because of this
            }
            
            resolve(finalOutputPath);
          } catch (finalError) {
            console.error('Error finalizing import:', finalError);
            importStatus = {
              ...importStatus,
              status: 'failed',
              error: finalError.message,
              endTime: new Date().toISOString(),
              failedConversations
            };
            reject(finalError);
          }
        }
      );
    });
  } catch (err) {
    // Update status on error
    importStatus = {
      ...importStatus,
      status: 'failed',
      error: err.message,
      endTime: new Date().toISOString()
    };
    throw err;
  }
}

// Express route handlers
module.exports = {
  // Get saved configuration
  getConfig: async (req, res) => {
    try {
      const config = await loadConfig();
      res.json(config);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
  
  // Save configuration
  saveConfig: async (req, res) => {
    try {
      const config = { ...DEFAULT_CONFIG, ...req.body };
      await saveConfig(config);
      res.json({ success: true, config });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
  
  // Generate preview of folder structure
  generatePreview: async (req, res) => {
    try {
      const config = { ...DEFAULT_CONFIG, ...req.body };
      
      // Safety check: warn if output path will overwrite existing archive
      const outputBasePath = path.join(config.outputDir, config.archiveName);
      let safetyWarning = null;
      
      if (await fs.pathExists(outputBasePath)) {
        // Check if it looks like an existing archive
        const items = await fs.readdir(outputBasePath).catch(() => []);
        const hasConversationFolders = items.some(item => {
          return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(item) ||
                 /^\d{4}-\d{2}-\d{2}_/.test(item);
        });
        
        if (hasConversationFolders) {
          safetyWarning = {
            type: 'existing_archive',
            message: `Warning: The output path '${outputBasePath}' contains an existing archive. New conversations will be added, but any conversations with matching UUIDs will be overwritten. Consider using a different archive name for safety.`,
            suggestion: `Try archive name: '${config.archiveName}_${new Date().getFullYear()}'`
          };
        }
      }
      
      const preview = await generatePreview(config);
      
      // Add safety warning to preview if needed
      if (safetyWarning) {
        preview.safetyWarning = safetyWarning;
      }
      
      res.json(preview);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
  
  // Start import process
  startImport: async (req, res) => {
    try {
      // Check if import is already in progress
      if (importStatus.status === 'in_progress') {
        return res.status(409).json({ 
          error: 'Import already in progress', 
          status: importStatus 
        });
      }
      
      const config = { ...DEFAULT_CONFIG, ...req.body };
      
      // Start the import process asynchronously
      importArchive(config).catch(err => {
        console.error('Import failed:', err);
        // Status is already updated in the function
      });
      
      // Return immediate response
      res.json({ 
        message: 'Import started', 
        status: importStatus 
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
  
  // Get current import status
  getStatus: (req, res) => {
    try {
      // Create a safe copy of the status to prevent any potential circular reference issues
      const safeStatus = {
        status: importStatus.status || 'idle',
        progress: importStatus.progress || 0,
        totalConversations: importStatus.totalConversations || 0,
        processedConversations: importStatus.processedConversations || 0,
        error: importStatus.error || null,
        startTime: importStatus.startTime || null,
        endTime: importStatus.endTime || null,
        failedConversations: importStatus.failedConversations || []
      };
      
      // If there are too many failed conversations, limit the number returned to the client
      if (safeStatus.failedConversations.length > 50) {
        safeStatus.failedConversations = safeStatus.failedConversations.slice(0, 50);
        safeStatus.failedConversationsTruncated = true;
      }
      
      res.json(safeStatus);
    } catch (err) {
      console.error('Error getting import status:', err);
      res.status(500).json({ 
        error: 'Internal server error getting import status',
        status: 'unknown' 
      });
    }
  }
};