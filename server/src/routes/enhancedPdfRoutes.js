const express = require('express');
const router = express.Router();
const enhancedPdfController = require('../controllers/enhancedPdfController');

/**
 * Enhanced PDF Editor Routes
 * Provides comprehensive REST API for Adobe Acrobat-level PDF editing
 */

// Middleware for request validation
const validateDocumentId = (req, res, next) => {
  const { id } = req.params;
  if (!id || id.length < 3) {
    return res.status(400).json({
      success: false,
      error: 'Invalid document ID'
    });
  }
  next();
};

const validatePageId = (req, res, next) => {
  const { pageId } = req.params;
  if (!pageId || pageId.length < 3) {
    return res.status(400).json({
      success: false,
      error: 'Invalid page ID'
    });
  }
  next();
};

const validateElementId = (req, res, next) => {
  const { elementId } = req.params;
  if (!elementId || elementId.length < 3) {
    return res.status(400).json({
      success: false,
      error: 'Invalid element ID'
    });
  }
  next();
};

// Error handling middleware
const handleAsyncError = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Document Management Routes
 */
router.post('/documents', handleAsyncError((req, res) => enhancedPdfController.createDocument(req, res)));
router.get('/documents/:id', validateDocumentId, handleAsyncError((req, res) => enhancedPdfController.getDocument(req, res)));
router.put('/documents/:id', validateDocumentId, handleAsyncError((req, res) => enhancedPdfController.updateDocument(req, res)));
router.delete('/documents/:id', validateDocumentId, handleAsyncError((req, res) => enhancedPdfController.deleteDocument(req, res)));
router.get('/documents/:id/state', validateDocumentId, handleAsyncError((req, res) => enhancedPdfController.getDocumentState(req, res)));

/**
 * Page Management Routes
 */
router.post('/documents/:id/pages', validateDocumentId, handleAsyncError((req, res) => enhancedPdfController.addPage(req, res)));
router.delete('/documents/:id/pages/:pageId', validateDocumentId, validatePageId, handleAsyncError((req, res) => enhancedPdfController.deletePage(req, res)));

/**
 * Element Management Routes
 */
router.post('/documents/:id/pages/:pageId/elements', 
  validateDocumentId, 
  validatePageId, 
  handleAsyncError((req, res) => enhancedPdfController.addElement(req, res))
);

router.put('/documents/:id/pages/:pageId/elements/:elementId',
  validateDocumentId,
  validatePageId,
  validateElementId,
  handleAsyncError((req, res) => enhancedPdfController.updateElement(req, res))
);

router.delete('/documents/:id/pages/:pageId/elements/:elementId',
  validateDocumentId,
  validatePageId,
  validateElementId,
  handleAsyncError((req, res) => enhancedPdfController.deleteElement(req, res))
);

/**
 * Image Management Routes
 */
router.post('/images/proxy', handleAsyncError((req, res) => enhancedPdfController.proxyImage(req, res)));
router.get('/images/:imageId', handleAsyncError((req, res) => enhancedPdfController.serveImage(req, res)));
router.post('/images/process', handleAsyncError((req, res) => enhancedPdfController.processImageElement(req, res)));
router.get('/images/:imageId/base64', handleAsyncError((req, res) => enhancedPdfController.getImageAsBase64(req, res)));

/**
 * Font Management Routes
 */
router.get('/fonts', handleAsyncError((req, res) => enhancedPdfController.getFonts(req, res)));
router.get('/fonts/stats', handleAsyncError((req, res) => enhancedPdfController.getFontStats(req, res)));
router.get('/fonts/:fontFamily', handleAsyncError((req, res) => enhancedPdfController.getFontDetails(req, res)));
router.post('/fonts/web', handleAsyncError((req, res) => enhancedPdfController.loadWebFont(req, res)));
router.post('/fonts/custom', handleAsyncError((req, res) => enhancedPdfController.uploadCustomFont(req, res)));
router.delete('/fonts/custom/:fontName', handleAsyncError((req, res) => enhancedPdfController.deleteCustomFont(req, res)));

/**
 * Typography Routes
 */
router.post('/typography/metrics', handleAsyncError((req, res) => enhancedPdfController.calculateTextMetrics(req, res)));
router.post('/typography/features', handleAsyncError((req, res) => enhancedPdfController.applyOpenTypeFeatures(req, res)));

/**
 * Export Routes
 */
router.post('/documents/:id/export', validateDocumentId, handleAsyncError((req, res) => enhancedPdfController.exportDocument(req, res)));
router.get('/documents/:id/preview', validateDocumentId, handleAsyncError((req, res) => enhancedPdfController.generatePreview(req, res)));

/**
 * Template Routes
 */
router.post('/templates', handleAsyncError((req, res) => enhancedPdfController.createTemplate(req, res)));
router.post('/documents/:id/apply-template', validateDocumentId, handleAsyncError((req, res) => enhancedPdfController.applyTemplate(req, res)));

/**
 * Real-time Editing Routes
 */
router.post('/documents/:id/operations', validateDocumentId, handleAsyncError((req, res) => enhancedPdfController.applyOperation(req, res)));

/**
 * Integration Routes
 */
router.post('/from-conversation/:conversationId', handleAsyncError((req, res) => enhancedPdfController.createFromConversation(req, res)));

/**
 * Utility Routes
 */
router.get('/health', handleAsyncError((req, res) => enhancedPdfController.getHealth(req, res)));
router.get('/capabilities', handleAsyncError((req, res) => enhancedPdfController.getCapabilities(req, res)));

/**
 * Error handling middleware
 */
router.use((error, req, res, next) => {
  console.error('Enhanced PDF API Error:', error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: error.message,
      type: 'validation_error'
    });
  }
  
  if (error.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      error: error.message,
      type: 'file_upload_error'
    });
  }
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    type: 'server_error'
  });
});

module.exports = router;