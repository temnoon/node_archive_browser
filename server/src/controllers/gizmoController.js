// Gizmo Controller - Handles Custom GPT/Gizmo-related API endpoints
const gizmoResolver = require('../models/gizmo-resolver');

// Get archive root from environment or config - will be injected in main server file
let ARCHIVE_ROOT = '';

/**
 * Set the archive root directory
 * @param {string} rootPath - Path to the archive root
 */
function setArchiveRoot(rootPath) {
  ARCHIVE_ROOT = rootPath;
}

/**
 * Get all gizmo mappings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getGizmoMappings(req, res) {
  try {
    const mappings = await gizmoResolver.initGizmoMappings();
    res.json(mappings);
  } catch (err) {
    console.error('Error fetching gizmo mappings:', err);
    res.status(500).json({ error: 'Failed to fetch gizmo mappings' });
  }
}

/**
 * Save gizmo mappings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function saveGizmoMappings(req, res) {
  try {
    const mappings = req.body;
    
    if (!mappings || typeof mappings !== 'object') {
      return res.status(400).json({ error: 'Invalid gizmo mappings format' });
    }
    
    // Use the first default mapping path
    const savePath = gizmoResolver.DEFAULT_MAPPING_PATHS[0];
    const success = await gizmoResolver.saveGizmoMappings(mappings, savePath);
    
    if (success) {
      res.json({ success: true, message: 'Gizmo mappings saved successfully' });
    } else {
      res.status(500).json({ error: 'Failed to save gizmo mappings' });
    }
  } catch (err) {
    console.error('Error saving gizmo mappings:', err);
    res.status(500).json({ error: 'Failed to save gizmo mappings' });
  }
}

/**
 * Get unknown gizmos template
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getUnknownGizmos(req, res) {
  try {
    const unknownGizmos = await gizmoResolver.generateUnknownGizmosTemplate(ARCHIVE_ROOT);
    res.json(unknownGizmos);
  } catch (err) {
    console.error('Error generating unknown gizmos template:', err);
    res.status(500).json({ error: 'Failed to generate unknown gizmos template' });
  }
}

/**
 * Update a gizmo name
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function updateGizmoName(req, res) {
  try {
    const { id } = req.params;
    const { customName } = req.body;
    
    if (!id || !customName) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Save the gizmo name to the global mappings
    const mappings = await gizmoResolver.initGizmoMappings();
    mappings[id] = customName;
    
    // Save updated mappings
    const savePath = gizmoResolver.DEFAULT_MAPPING_PATHS[0];
    const success = await gizmoResolver.saveGizmoMappings(mappings, savePath);
    
    if (success) {
      res.json({ 
        success: true, 
        message: 'Gizmo name updated successfully',
        gizmoId: id,
        customName
      });
    } else {
      res.status(500).json({ error: 'Failed to update gizmo name' });
    }
  } catch (err) {
    console.error('Error updating gizmo name:', err);
    res.status(500).json({ error: 'Failed to update gizmo name' });
  }
}

module.exports = {
  setArchiveRoot,
  getGizmoMappings,
  saveGizmoMappings,
  getUnknownGizmos,
  updateGizmoName
};
