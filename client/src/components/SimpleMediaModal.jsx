import React from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  Typography, 
  Box, 
  Button
} from '@mui/material';

/**
 * Simple MediaModal Component
 * A minimal version with fewer dependencies and state changes
 */
function SimpleMediaModal({ 
  open, 
  onClose, 
  selectedMedia,
  conversationFolder
}) {
  // Guard against null media
  if (!selectedMedia) {
    return null;
  }

  // Directly construct media path to avoid dependencies
  const mediaSrc = `/api/media/${conversationFolder}/${selectedMedia.filename}`;

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
        <Box sx={{ maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selectedMedia.originalName || selectedMedia.filename}
        </Box>
        <Box>
          <Button onClick={onClose}>Close</Button>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ position: 'relative', pb: 0 }}>
        {/* Media Content */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 2 }}>
          {selectedMedia.type === 'image' ? (
            <img 
              src={mediaSrc} 
              alt={selectedMedia.filename} 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '70vh',
                objectFit: 'contain'
              }}
              onError={(e) => {
                console.log('Modal image error, trying direct path');
                // Try a fallback if the image fails to load
                e.target.src = `/api/media/${conversationFolder}/${selectedMedia.filename}`;
              }}
            />
          ) : selectedMedia.type === 'audio' ? (
            <Box sx={{ textAlign: 'center', p: 3, bgcolor: '#f0f7ff', borderRadius: 2, width: '100%' }}>
              <Typography variant="h6" color="primary" gutterBottom>
                Audio File
              </Typography>
              <audio 
                controls 
                src={mediaSrc} 
                style={{ width: '100%' }}
                onError={(e) => {
                  console.log('Modal audio error, trying direct path');
                  // Try a fallback if the audio fails to load
                  e.target.src = `/api/media/${conversationFolder}/${selectedMedia.filename}`;
                }}
              />
            </Box>
          ) : selectedMedia.type === 'video' ? (
            <Box sx={{ textAlign: 'center', p: 3, width: '100%' }}>
              <video 
                controls 
                src={mediaSrc}
                style={{ maxWidth: '100%', maxHeight: '70vh' }}
                onError={(e) => {
                  console.log('Modal video error, trying direct path');
                  // Try a fallback if the video fails to load
                  e.target.src = `/api/media/${conversationFolder}/${selectedMedia.filename}`;
                }}
              />
            </Box>
          ) : (
            <Typography variant="body1">
              {selectedMedia.type || 'Unknown'} File
            </Typography>
          )}
        </Box>
        
        {/* File Info Panel */}
        <Box sx={{ 
          mt: 2, 
          p: 2, 
          backgroundColor: '#f5f5f5',
          borderTop: '1px solid #e0e0e0',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          fontSize: '0.875rem'
        }}>
          <Box sx={{ minWidth: '200px', flex: 1 }}>
            <Typography variant="subtitle2">File ID</Typography>
            <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
              {selectedMedia.filename}
            </Typography>
          </Box>
          
          {selectedMedia.originalName && (
            <Box sx={{ minWidth: '200px', flex: 1 }}>
              <Typography variant="subtitle2">Original Filename</Typography>
              <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                {selectedMedia.originalName}
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}

export default React.memo(SimpleMediaModal);
