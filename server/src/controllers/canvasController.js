// Canvas Controller - Handles canvas-related API endpoints
const canvasProcessor = require('../models/canvas-processor');

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
 * Retrieve canvas data by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getCanvasById(req, res) {
  try {
    const canvasId = req.params.id;
    if (!canvasId) {
      return res.status(400).json({ error: 'No canvas ID provided' });
    }
    
    const canvasData = await canvasProcessor.findCanvasData(canvasId, ARCHIVE_ROOT);
    
    if (!canvasData) {
      return res.status(404).json({ error: 'Canvas not found' });
    }
    
    res.json(canvasData);
  } catch (err) {
    console.error(`Error retrieving canvas ${req.params.id}:`, err);
    res.status(500).json({ error: 'Failed to retrieve canvas data' });
  }
}

module.exports = {
  setArchiveRoot,
  getCanvasById
};
