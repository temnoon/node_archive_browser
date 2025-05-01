// Custom GPT (Gizmo) resolution module
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

/**
 * Default locations to look for gizmo mapping files
 */
const DEFAULT_MAPPING_PATHS = [
  // User home directory
  path.join(os.homedir(), '.carchive', 'custom_gpts.json'),
  // App config directory
  path.join(os.homedir(), '.config', 'carchive', 'custom_gpts.json'),
  // Current directory
  path.join(process.cwd(), 'custom_gpts.json')
];

// Cache for loaded gizmo mappings
let gizmoCache = null;

/**
 * Load custom GPT (gizmo) mappings from a file
 * @param {string} filePath - Path to the mapping file
 * @returns {Object} Mapping of gizmo IDs to names/titles
 */
async function loadGizmoMappings(filePath) {
  try {
    if (!await fs.pathExists(filePath)) {
      console.log(`No gizmo mappings found at: ${filePath}`);
      return {};
    }
    
    const mappings = await fs.readJson(filePath);
    console.log(`Loaded ${Object.keys(mappings).length} gizmo mappings from ${filePath}`);
    return mappings;
  } catch (err) {
    console.error(`Error loading gizmo mappings from ${filePath}:`, err);
    return {};
  }
}

/**
 * Initialize gizmo mappings by checking default locations
 * @returns {Object} Combined mapping of gizmo IDs to names
 */
async function initGizmoMappings() {
  if (gizmoCache !== null) {
    return gizmoCache;
  }
  
  const mappings = {};
  
  // Try each default location
  for (const mappingPath of DEFAULT_MAPPING_PATHS) {
    if (await fs.pathExists(mappingPath)) {
      try {
        const loadedMappings = await loadGizmoMappings(mappingPath);
        // Merge with existing mappings (newer locations take precedence)
        Object.assign(mappings, loadedMappings);
      } catch (err) {
        console.error(`Error loading gizmo mappings from ${mappingPath}:`, err);
      }
    }
  }
  
  gizmoCache = mappings;
  return mappings;
}

/**
 * Save gizmo mappings to a file
 * @param {Object} mappings - Mapping of gizmo IDs to names
 * @param {string} filePath - Path to save the mappings
 * @returns {boolean} Success status
 */
async function saveGizmoMappings(mappings, filePath) {
  try {
    // Ensure the directory exists
    await fs.ensureDir(path.dirname(filePath));
    
    // Save the mappings
    await fs.writeJson(filePath, mappings, { spaces: 2 });
    
    // Update cache
    gizmoCache = { ...gizmoCache, ...mappings };
    
    console.log(`Saved ${Object.keys(mappings).length} gizmo mappings to ${filePath}`);
    return true;
  } catch (err) {
    console.error(`Error saving gizmo mappings to ${filePath}:`, err);
    return false;
  }
}

/**
 * Resolve a gizmo ID to its name
 * @param {string} gizmoId - Gizmo ID to resolve
 * @returns {string} Gizmo name or ID if not found
 */
async function resolveGizmoName(gizmoId) {
  if (!gizmoId) return null;
  
  const mappings = await initGizmoMappings();
  return mappings[gizmoId] || gizmoId;
}

/**
 * Extract unknown gizmo IDs from a conversation
 * @param {Object} conversation - Conversation object
 * @returns {Object} Map of unknown gizmo IDs to null
 */
async function extractUnknownGizmos(conversation) {
  const mappings = await initGizmoMappings();
  const unknownGizmos = {};
  
  // Helper function to process messages
  function processMessage(message) {
    if (!message) return;
    
    // Check for gizmo_id in metadata
    if (message.metadata && message.metadata.gizmo_id) {
      const gizmoId = message.metadata.gizmo_id;
      if (!mappings[gizmoId]) {
        unknownGizmos[gizmoId] = null;
      }
    }
  }
  
  // Process all messages in the conversation
  if (conversation && conversation.mapping) {
    for (const msgObj of Object.values(conversation.mapping)) {
      if (msgObj && msgObj.message) {
        processMessage(msgObj.message);
      }
    }
  }
  
  return unknownGizmos;
}

/**
 * Generate a template for unknown gizmos
 * @param {string} archiveRoot - Archive root directory
 * @returns {Object} Template with unknown gizmos
 */
async function generateUnknownGizmosTemplate(archiveRoot) {
  try {
    const mappings = await initGizmoMappings();
    const unknownGizmos = {};
    
    // Helper function to process a single conversation
    async function processConversation(convPath) {
      try {
        const conversation = await fs.readJson(convPath);
        const extracted = await extractUnknownGizmos(conversation);
        Object.assign(unknownGizmos, extracted);
      } catch (err) {
        console.error(`Error processing conversation at ${convPath}:`, err);
      }
    }
    
    // Get all conversation directories
    const allDirs = await fs.readdir(archiveRoot);
    
    // Filter for conversation directories
    const convDirs = allDirs.filter(dir => {
      const jsonPath = path.join(archiveRoot, dir, 'conversation.json');
      return fs.existsSync(jsonPath);
    });
    
    // Process each conversation
    for (const convDir of convDirs) {
      const jsonPath = path.join(archiveRoot, convDir, 'conversation.json');
      await processConversation(jsonPath);
    }
    
    // Remove known gizmos
    for (const gizmoId in unknownGizmos) {
      if (mappings[gizmoId]) {
        delete unknownGizmos[gizmoId];
      }
    }
    
    console.log(`Found ${Object.keys(unknownGizmos).length} unknown gizmos`);
    return unknownGizmos;
  } catch (err) {
    console.error('Error generating unknown gizmos template:', err);
    return {};
  }
}

module.exports = {
  initGizmoMappings,
  loadGizmoMappings,
  saveGizmoMappings,
  resolveGizmoName,
  extractUnknownGizmos,
  generateUnknownGizmosTemplate,
  DEFAULT_MAPPING_PATHS
};
