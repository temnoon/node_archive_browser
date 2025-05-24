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
router.post('/documents', handleAsyncError(enhancedPdfController.createDocument));
router.get('/documents/:id', validateDocumentId, handleAsyncError(enhancedPdfController.getDocument));
router.put('/documents/:id', validateDocumentId, handleAsyncError(enhancedPdfController.updateDocument));
router.delete('/documents/:id', validateDocumentId, handleAsyncError(enhancedPdfController.deleteDocument));
router.get('/documents/:id/state', validateDocumentId, handleAsyncError(enhancedPdfController.getDocumentState));

/**
 * Page Management Routes
 */
router.post('/documents/:id/pages', validateDocumentId, handleAsyncError(enhancedPdfController.addPage));
router.delete('/documents/:id/pages/:pageId', validateDocumentId, validatePageId, handleAsyncError(enhancedPdfController.deletePage));

/**
 * Element Management Routes
 */
router.post('/documents/:id/pages/:pageId/elements', 
  validateDocumentId, 
  validatePageId, 
  handleAsyncError(enhancedPdfController.addElement)
);

router.put('/documents/:id/pages/:pageId/elements/:elementId',
  validateDocumentId,
  validatePageId,
  validateElementId,
  handleAsyncError(enhancedPdfController.updateElement)
);

router.delete('/documents/:id/pages/:pageId/elements/:elementId',
  validateDocumentId,
  validatePageId,
  validateElementId,
  handleAsyncError(enhancedPdfController.deleteElement)
);

/**
 * Font Management Routes
 */
router.get('/fonts', handleAsyncError(enhancedPdfController.getFonts));
router.get('/fonts/stats', handleAsyncError(enhancedPdfController.getFontStats));
router.get('/fonts/:fontFamily', handleAsyncError(enhancedPdfController.getFontDetails));
router.post('/fonts/web', handleAsyncError(enhancedPdfController.loadWebFont));
router.post('/fonts/custom', handleAsyncError(enhancedPdfController.uploadCustomFont));
router.delete('/fonts/custom/:fontName', handleAsyncError(enhancedPdfController.deleteCustomFont));

/**
 * Typography Routes
 */
router.post('/typography/metrics', handleAsyncError(enhancedPdfController.calculateTextMetrics));
router.post('/typography/features', handleAsyncError(enhancedPdfController.applyOpenTypeFeatures));

/**
 * Export Routes
 */
router.post('/documents/:id/export', validateDocumentId, handleAsyncError(enhancedPdfController.exportDocument));
router.get('/documents/:id/preview', validateDocumentId, handleAsyncError(enhancedPdfController.generatePreview));

/**
 * Template Routes
 */
router.post('/templates', handleAsyncError(enhancedPdfController.createTemplate));
router.post('/documents/:id/apply-template', validateDocumentId, handleAsyncError(enhancedPdfController.applyTemplate));

/**
 * Real-time Editing Routes
 */
router.post('/documents/:id/operations', validateDocumentId, handleAsyncError(enhancedPdfController.applyOperation));

/**
 * Integration Routes
 */
router.post('/from-conversation/:conversationId', handleAsyncError(enhancedPdfController.createFromConversation));

/**
 * Utility Routes
 */
router.get('/health', handleAsyncError(enhancedPdfController.getHealth));
router.get('/capabilities', handleAsyncError(enhancedPdfController.getCapabilities));

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