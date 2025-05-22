// Archive controller for handling archive location management
const fs = require('fs-extra');
const path = require('path');
// Try to load Electron, but handle gracefully if not available
let dialog = null;
try {
  const electron = require('electron');
  dialog = (electron.remote || electron).dialog;
} catch (err) {
  console.log('Electron not available, file dialog functionality will be disabled');
}
const dotenv = require('dotenv');

// Path to .env file
const ENV_FILE_PATH = path.resolve(__dirname, '../../.env');

// Function to notify server to update all controllers (will be set by server)
let notifyArchiveRootChanged = null;

// Set the callback function for notifying archive root changes
const setArchiveRootChangeCallback = (callback) => {
  notifyArchiveRootChanged = callback;
};

// Get the current archive root
const getArchiveRoot = () => {
  // Default archive location
  let archiveRoot = path.resolve(__dirname, '../../../exploded_archive_node');
  
  // Try to get from environment variable
  if (process.env.ARCHIVE_ROOT) {
    archiveRoot = path.resolve(__dirname, process.env.ARCHIVE_ROOT);
  }
  
  return archiveRoot;
};

// Check if a directory is a valid exploded archive
const validateArchiveDirectory = async (directoryPath) => {
  try {
    // Check if the directory exists
    if (!await fs.pathExists(directoryPath)) {
      return {
        valid: false,
        reason: 'Directory does not exist'
      };
    }
    
    // Get directory listing
    const items = await fs.readdir(directoryPath);
    
    // Look for conversation folders (they should start with dates like "2024-" or be UUIDs)
    const conversationFolders = items.filter(item => {
      // Match date-based folder names (YYYY-MM-DD format)
      if (/^\d{4}-\d{2}-\d{2}_/.test(item)) {
        return true;
      }
      // Match UUID format folders
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item)) {
        return true;
      }
      return false;
    });
    
    if (conversationFolders.length === 0) {
      return {
        valid: false,
        reason: 'Directory does not contain any conversation folders'
      };
    }
    
    // Check if at least one conversation folder contains conversation.json
    let hasValidConversations = false;
    for (const folder of conversationFolders.slice(0, 5)) { // Check up to 5 folders
      const conversationJsonPath = path.join(directoryPath, folder, 'conversation.json');
      if (await fs.pathExists(conversationJsonPath)) {
        hasValidConversations = true;
        break;
      }
    }
    
    if (!hasValidConversations) {
      return {
        valid: false,
        reason: 'Conversation folders do not contain conversation.json files'
      };
    }
    
    return {
      valid: true,
      reason: `Found ${conversationFolders.length} conversation folders`
    };
  } catch (error) {
    return {
      valid: false,
      reason: `Error validating directory: ${error.message}`
    };
  }
};

// Update the .env file with the new archive root
const updateEnvFile = async (archiveRoot) => {
  try {
    // Read existing .env file if it exists
    let envContent = '';
    if (await fs.pathExists(ENV_FILE_PATH)) {
      envContent = await fs.readFile(ENV_FILE_PATH, 'utf8');
    }
    
    // Parse existing .env content
    const envConfig = dotenv.parse(envContent);
    
    // Update ARCHIVE_ROOT
    envConfig.ARCHIVE_ROOT = archiveRoot;
    
    // Convert back to .env format
    const newEnvContent = Object.entries(envConfig)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    // Write back to .env file
    await fs.writeFile(ENV_FILE_PATH, newEnvContent);
    
    // Update process.env
    process.env.ARCHIVE_ROOT = archiveRoot;
    
    return true;
  } catch (error) {
    console.error('Error updating .env file:', error);
    throw error;
  }
};

module.exports = {
  // Get info about the current archive
  getArchiveInfo: async (req, res) => {
    try {
      const archiveRoot = getArchiveRoot();
      
      // Check if the archive directory exists
      const exists = await fs.pathExists(archiveRoot);
      
      // Validate the directory
      const validation = exists ? await validateArchiveDirectory(archiveRoot) : { valid: false, reason: 'Directory does not exist' };
      
      res.json({
        archiveRoot,
        exists,
        valid: validation.valid,
        reason: validation.reason
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  
  // Set a new archive root
  setArchiveRoot: async (req, res) => {
    try {
      const { archiveRoot } = req.body;
      
      if (!archiveRoot) {
        return res.status(400).json({ error: 'Archive root is required' });
      }
      
      // Check if the directory exists
      const exists = await fs.pathExists(archiveRoot);
      if (!exists) {
        return res.status(400).json({ error: 'Directory does not exist. Please check the path and try again.' });
      }
      
      // Validate the directory
      const validation = await validateArchiveDirectory(archiveRoot);
      if (!validation.valid) {
        return res.status(400).json({ error: `Invalid archive directory: ${validation.reason}` });
      }
      
      // Update the .env file
      await updateEnvFile(archiveRoot);
      
      // Notify the server to update all controllers
      if (notifyArchiveRootChanged) {
        notifyArchiveRootChanged(archiveRoot);
      }
      
      res.json({ success: true, archiveRoot });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  
  // Open a folder dialog
  openFolderDialog: async (req, res) => {
    try {
      // Check if we're in an Electron environment
      if (!dialog) {
        return res.status(400).json({ 
          error: 'Folder browser not available in web browser. Please enter the path manually.' 
        });
      }
      
      // Open folder dialog
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
      });
      
      // Return the selected path or null if canceled
      res.json({
        canceled: result.canceled,
        folderPath: result.canceled ? null : result.filePaths[0]
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  
  // Export the callback setter for the server to use
  setArchiveRootChangeCallback
};
