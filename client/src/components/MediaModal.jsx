import React from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  Typography, 
  Box, 
  Button, 
  IconButton 
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

/**
 * MediaModal Component
 * Displays a modal with detailed view of media
 */
export default function MediaModal({ 
  open, 
  onClose, 
  selectedMedia, 
  allMedia = [], 
  currentIndex = 0,
  onNext, 
  onPrev,
  conversationFolder
}) {
  const navigate = useNavigate();

  // Guard against no selected media
  if (!selectedMedia) {
    return null;
  }

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
        {/* Navigation Arrows */}
        {allMedia.length > 1 && (
          <>
            <IconButton 
              onClick={onPrev}
              sx={{ 
                position: 'absolute', 
                left: 10, 
                top: '50%', 
                transform: 'translateY(-50%)',
                backgroundColor: 'rgba(255,255,255,0.5)',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.8)'
                },
                zIndex: 10
              }}
            >
              &lt;
            </IconButton>
            <IconButton 
              onClick={onNext}
              sx={{ 
                position: 'absolute', 
                right: 10, 
                top: '50%', 
                transform: 'translateY(-50%)',
                backgroundColor: 'rgba(255,255,255,0.5)',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.8)'
                },
                zIndex: 10 
              }}
            >
              &gt;
            </IconButton>
          </>
        )}
        
        {/* Media Content */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 2 }}>
          {selectedMedia.type === 'image' ? (
            <img 
              src={selectedMedia.path} 
              alt={selectedMedia.filename} 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '70vh',
                objectFit: 'contain'
              }}
              onError={(e) => {
                console.log('Modal image error, trying direct path:', selectedMedia.filename);
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
                src={selectedMedia.path} 
                style={{ width: '100%' }}
                onError={(e) => {
                  console.log('Modal audio error, trying direct path:', selectedMedia.filename);
                  // Try a fallback if the audio fails to load
                  e.target.src = `/api/media/${conversationFolder}/${selectedMedia.filename}`;
                }}
              />
            </Box>
          ) : selectedMedia.type === 'video' ? (
            <Box sx={{ textAlign: 'center', p: 3, width: '100%' }}>
              <video 
                controls 
                src={selectedMedia.path}
                style={{ maxWidth: '100%', maxHeight: '70vh' }}
                onError={(e) => {
                  console.log('Modal video error, trying direct path:', selectedMedia.filename);
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
        
        {/* Details Panel */}
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
          
          <Box sx={{ minWidth: '200px', flex: 2 }}>
            <Typography variant="subtitle2">From Conversation</Typography>
            <Box 
              component={Button}
              onClick={() => {
                onClose();
                navigate(`/conversations/${selectedMedia.conversationId}`);
              }}
              sx={{ 
                textAlign: 'left',
                p: 0,
                textTransform: 'none',
                justifyContent: 'flex-start',
                fontWeight: 'normal',
                textDecoration: 'underline',
                color: 'primary.main'
              }}>
              {selectedMedia.conversationTitle || 'Untitled'}
            </Box>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
