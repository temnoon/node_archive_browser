// Express backend for archive-browser (reads from exploded_archive, json-preserved format)
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');

// Simple in-memory rate limiter
const rateLimit = {
  requestCounts: {},
  windowMs: 1000, // 1 second window
  maxRequestsPerWindow: 200, // Increased from 50 to 200 requests per window
  resetTime: Date.now(),
  
  limiter: function(req, res, next) {
    const now = Date.now();
    const ip = req.ip || req.connection.remoteAddress;
    
    // Reset counts if window has passed
    if (now - this.resetTime > this.windowMs) {
      this.requestCounts = {};
      this.resetTime = now;
    }
    
    // Create a more granular key that includes the route
    // This prevents one route from blocking others
    const route = req.path.split('/')[2] || 'default'; // Get the main resource type
    const key = `${ip}_${route}`;
    
    // Initialize or increment count
    this.requestCounts[key] = (this.requestCounts[key] || 0) + 1;
    
    // Check if over limit - use higher limits for static resources
    const isStaticResource = req.path.includes('/media/') || req.path.includes('/static/');
    const limit = isStaticResource ? this.maxRequestsPerWindow * 2 : this.maxRequestsPerWindow;
    
    if (this.requestCounts[key] > limit) {
      // Set retry-after header
      const retryAfter = Math.ceil((this.resetTime + this.windowMs - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ 
        error: 'Too many requests, please try again later',
        retryAfter: retryAfter
      });
    }
    
    next();
  }
};

// Import controllers
const importController = require('./src/import-controller');
const conversationController = require('./src/controllers/conversationController');
const mediaController = require('./src/controllers/mediaController');
const canvasController = require('./src/controllers/canvasController');
const gizmoController = require('./src/controllers/gizmoController');
const parserController = require('./src/controllers/parserController');

// Import services
const archiveService = require('./src/services/archiveService');

// Load environment variables from .env file if it exists
try {
  require('dotenv').config();
} catch (err) {
  console.warn('Could not load dotenv, using default environment');
}

const app = express();
const PORT = process.env.PORT || 3001;

// Get archive root from environment or use default
const ARCHIVE_ROOT = process.env.ARCHIVE_ROOT 
  ? path.resolve(__dirname, process.env.ARCHIVE_ROOT)
  : path.resolve(__dirname, '../../exploded_archive_node');

// Set archive root for all controllers
conversationController.setArchiveRoot(ARCHIVE_ROOT);
mediaController.setArchiveRoot(ARCHIVE_ROOT);
canvasController.setArchiveRoot(ARCHIVE_ROOT);
gizmoController.setArchiveRoot(ARCHIVE_ROOT);
parserController.setArchiveRoot(ARCHIVE_ROOT);

app.use(cors());
app.use(express.json());

// Apply rate limiter to API routes
app.use('/api', rateLimit.limiter.bind(rateLimit));

// Initialize the archive index
archiveService.refreshIndex(ARCHIVE_ROOT);

// Import Wizard API routes
app.get('/api/import/config', importController.getConfig);
app.post('/api/import/config', importController.saveConfig);
app.post('/api/import/preview', importController.generatePreview);
app.post('/api/import/start', importController.startImport);
app.get('/api/import/status', importController.getStatus);

// Conversation API routes
app.get('/api/conversations', conversationController.getConversations);
app.get('/api/conversations/meta', conversationController.getConversationsMeta);
app.get('/api/conversations/:id', conversationController.getConversationById);
app.get('/api/search', conversationController.searchConversations);
app.get('/api/archive-info', conversationController.getArchiveInfo);
app.post('/api/refresh-index', conversationController.refreshArchiveIndex);

// Media API routes
app.get('/api/media/:conv', mediaController.listMediaFiles);
app.get('/api/media/:conv/:filename', mediaController.serveMediaFile);
app.get('/api/media-gallery', mediaController.getMediaGallery);
app.get('/api/media-search/:id', mediaController.searchMediaFiles);
app.get('/api/media-file/:id', mediaController.findMediaFileById);

// Canvas API routes
app.get('/api/canvas/:id', canvasController.getCanvasById);

// Gizmo (Custom GPT) API routes
app.get('/api/gizmos', gizmoController.getGizmoMappings);
app.post('/api/gizmos', gizmoController.saveGizmoMappings);
app.get('/api/gizmos/unknown', gizmoController.getUnknownGizmos);
app.post('/api/gizmos/:id/name', gizmoController.updateGizmoName);

// Parser API routes
app.get('/api/parser/stats', parserController.getParserStats);

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../client/dist')));

// The "catchall" handler for any request not handled by routes above
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Archive browser backend running on port ${PORT} - Using archive at ${ARCHIVE_ROOT}`);
});
