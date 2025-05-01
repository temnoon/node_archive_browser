// Media Controller - Handles media-related API endpoints
const path = require('path');
const fs = require('fs-extra');
const archiveService = require('../services/archiveService');

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
 * List all media files in a conversation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function listMediaFiles(req, res) {
  try {
    const { conv } = req.params;
    const mediaFolder = path.join(ARCHIVE_ROOT, conv, 'media');
    
    if (!await fs.pathExists(mediaFolder)) {
      return res.json([]);
    }
    
    const files = await fs.readdir(mediaFolder);
    res.json(files);
  } catch (err) {
    console.error('Error listing media files:', err);
    res.status(500).json({ error: 'Failed to list media files' });
  }
}

/**
 * Serve a media file with proper MIME type
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function serveMediaFile(req, res) {
  const { conv, filename } = req.params;
  const filePath = path.join(ARCHIVE_ROOT, conv, 'media', filename);
  
  fs.pathExists(filePath).then(exists => {
    if (!exists) {
      res.status(404).send('Media file not found');
    } else {
      // Determine content type based on file extension
      const ext = path.extname(filename).toLowerCase();
      let contentType = 'application/octet-stream'; // Default
      
      // Map common extensions to MIME types
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm'
      };
      
      if (mimeTypes[ext]) {
        contentType = mimeTypes[ext];
      }
      
      res.setHeader('Content-Type', contentType);
      res.sendFile(filePath);
    }
  }).catch(e => {
    console.error('Error serving media file:', e);
    res.status(500).send('Error accessing media file');
  });
}

/**
 * Get a gallery of all media files across conversations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getMediaGallery(req, res) {
  try {
    // Get current archive index
    const archiveIndex = archiveService.getArchiveIndex();
    
    // Get conversations with media
    const conversationsWithMedia = archiveIndex.filter(conv => conv.has_media);
    
    // Get media files from these conversations
    const mediaFiles = [];
    
    // Limit to max 500 files to prevent performance issues
    const maxFilesToProcess = 500;
    let processedCount = 0;
    
    for (const conv of conversationsWithMedia) {
      // Skip if we've reached the limit
      if (processedCount >= maxFilesToProcess) break;
      
      const mediaFolder = path.join(ARCHIVE_ROOT, conv.folder, 'media');
      if (!await fs.pathExists(mediaFolder)) continue;
      
      const files = await fs.readdir(mediaFolder);
      
      for (const file of files) {
        // Skip if we've reached the limit
        if (processedCount >= maxFilesToProcess) break;
        processedCount++;
        
        try {
          // Get file info
          const filePath = path.join(mediaFolder, file);
          const stats = await fs.stat(filePath);
          const fileExtension = path.extname(file).toLowerCase();
          
          // Extract the file ID by removing the extension
          let fileId = path.basename(file, fileExtension);
          let fileType = 'unknown';
          
          // Determine file type based on extension
          if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(fileExtension)) {
            fileType = 'image';
          } else if (['.mp3', '.wav', '.ogg'].includes(fileExtension)) {
            fileType = 'audio';
          } else if (['.mp4', '.webm'].includes(fileExtension)) {
            fileType = 'video';
          }
          
          mediaFiles.push({
            id: fileId,
            originalFilename: file,
            conversationId: conv.id,
            conversationTitle: conv.title || 'Untitled',
            folder: conv.folder,
            path: `/api/media/${conv.folder}/${file}`,
            size: stats.size,
            type: fileType
          });
        } catch (fileErr) {
          console.error(`Error processing file ${file}:`, fileErr);
          // Continue with next file
        }
      }
    }
    
    res.json({ 
      mediaFiles,
      total: mediaFiles.length,
      limited: processedCount >= maxFilesToProcess,
      maxFiles: maxFilesToProcess
    });
  } catch (err) {
    console.error('Error fetching media gallery:', err);
    res.status(500).json({ error: 'Failed to fetch media gallery' });
  }
}

/**
 * Search for media files by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function searchMediaFiles(req, res) {
  try {
    const searchId = req.params.id;
    if (!searchId) {
      return res.status(400).json({ error: 'No search ID provided' });
    }
    
    // Get current archive index
    const archiveIndex = archiveService.getArchiveIndex();
    
    // Get conversations with media
    const conversationsWithMedia = archiveIndex.filter(conv => conv.has_media);
    const matchingFiles = [];
    
    for (const conv of conversationsWithMedia) {
      const mediaFolder = path.join(ARCHIVE_ROOT, conv.folder, 'media');
      if (!await fs.pathExists(mediaFolder)) continue;
      
      const files = await fs.readdir(mediaFolder);
      
      // Look for files that match the search ID
      const matches = files.filter(file => {
        const fileExtension = path.extname(file).toLowerCase();
        const fileId = path.basename(file, fileExtension);
        return fileId === searchId || file.includes(searchId);
      });
      
      if (matches.length > 0) {
        for (const match of matches) {
          const filePath = path.join(mediaFolder, match);
          const stats = await fs.stat(filePath);
          const fileExtension = path.extname(match).toLowerCase();
          
          // Extract the file ID
          const fileId = path.basename(match, fileExtension);
          let fileType = 'unknown';
          
          // Determine file type based on extension
          if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(fileExtension)) {
            fileType = 'image';
          } else if (['.mp3', '.wav', '.ogg'].includes(fileExtension)) {
            fileType = 'audio';
          } else if (['.mp4', '.webm'].includes(fileExtension)) {
            fileType = 'video';
          }
          
          matchingFiles.push({
            id: fileId,
            originalFilename: match,
            conversationId: conv.id,
            conversationTitle: conv.title || 'Untitled',
            folder: conv.folder,
            path: `/api/media/${conv.folder}/${match}`,
            size: stats.size,
            type: fileType
          });
        }
      }
    }
    
    res.json({ 
      matches: matchingFiles,
      total: matchingFiles.length
    });
  } catch (err) {
    console.error(`Error searching for media ID ${req.params.id}:`, err);
    res.status(500).json({ error: 'Failed to search for media' });
  }
}

/**
 * Find a specific media file by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function findMediaFileById(req, res) {
  try {
    const fileId = req.params.id;
    if (!fileId) {
      return res.status(400).json({ error: 'No file ID provided' });
    }
    
    console.log(`Searching for media file with ID: ${fileId}`);
    
    // Get current archive index
    const archiveIndex = archiveService.getArchiveIndex();
    
    // Get conversations with media
    const conversationsWithMedia = archiveIndex.filter(conv => conv.has_media);
    const matchingFiles = [];
    
    for (const conv of conversationsWithMedia) {
      const mediaFolder = path.join(ARCHIVE_ROOT, conv.folder, 'media');
      if (!await fs.pathExists(mediaFolder)) continue;
      
      const files = await fs.readdir(mediaFolder);
      
      // Look for exact file ID match or files that contain the ID
      const matches = files.filter(file => {
        const fileExtension = path.extname(file).toLowerCase();
        const fileBase = path.basename(file, fileExtension);
        
        // For exact match
        if (fileBase === fileId) return true;
        
        // For partial match (file ID is contained in the filename)
        if (fileBase.includes(fileId)) return true;
        
        return false;
      });
      
      if (matches.length > 0) {
        for (const match of matches) {
          const filePath = path.join(mediaFolder, match);
          const stats = await fs.stat(filePath);
          const fileExtension = path.extname(match).toLowerCase();
          
          // Determine file type based on extension
          let fileType = 'unknown';
          if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(fileExtension)) {
            fileType = 'image';
          } else if (['.mp3', '.wav', '.ogg'].includes(fileExtension)) {
            fileType = 'audio';
          } else if (['.mp4', '.webm'].includes(fileExtension)) {
            fileType = 'video';
          }
          
          matchingFiles.push({
            id: path.basename(match, fileExtension),
            originalFilename: match,
            conversationId: conv.id,
            conversationTitle: conv.title || 'Untitled',
            folder: conv.folder,
            path: `/api/media/${conv.folder}/${match}`,
            size: stats.size,
            type: fileType
          });
        }
      }
    }
    
    if (matchingFiles.length === 0) {
      return res.status(404).json({ 
        message: `No media files found matching ID: ${fileId}`, 
        matches: []
      });
    }
    
    res.json({ 
      matches: matchingFiles,
      total: matchingFiles.length
    });
  } catch (err) {
    console.error(`Error searching for media file ${req.params.id}:`, err);
    res.status(500).json({ error: 'Failed to search for media file' });
  }
}

module.exports = {
  setArchiveRoot,
  listMediaFiles,
  serveMediaFile,
  getMediaGallery,
  searchMediaFiles,
  findMediaFileById
};
