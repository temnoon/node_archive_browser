import React from 'react';
import { Box, Typography } from '@mui/material';

/**
 * Simple MediaRenderer Component
 * A lightweight version that minimizes dependencies and re-renders
 */
function SimpleMediaRenderer({ 
  media, 
  conversationFolder, 
  onClick
}) {
  // Guard against null/undefined media
  if (!media || !media.filename) {
    console.error('SimpleMediaRenderer received invalid media object');
    return null;
  }

  // Create a direct media path - no dependencies on external functions
  const mediaSrc = `/api/media/${conversationFolder}/${media.filename}`;
  
  const handleMediaClick = (e) => {
    // If this is an audio or video player, prevent modal opening when clicking controls
    if (
      e.target.tagName === 'AUDIO' || 
      e.target.tagName === 'VIDEO' || 
      e.target.closest('audio') || 
      e.target.closest('video')
    ) {
      e.stopPropagation();
      return;
    }
    
    // Otherwise, call the onClick handler if provided
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <Box 
      sx={{ 
        maxWidth: '100%', 
        maxHeight: '300px',
        cursor: onClick ? 'pointer' : 'default', 
        '&:hover': onClick ? {
          opacity: 0.9,
          boxShadow: '0 0 5px rgba(0,0,0,0.2)'
        } : {},
        position: 'relative'
      }}
      onClick={handleMediaClick}
    >
      {/* Render based on media type */}
      {media.type === 'image' ? (
        <img 
          src={mediaSrc} 
          alt={media.originalName || "Image attachment"} 
          style={{ maxWidth: '100%', maxHeight: '300px' }}
          onError={(e) => {
            console.log('Image load error, using fallback');
            // Try a fallback if the image fails to load
            e.target.src = `/api/media/${conversationFolder}/${media.filename}`;
          }}
        />
      ) : media.type === 'audio' ? (
        <Box sx={{ p: 2, textAlign: 'center', bgcolor: '#f0f7ff', borderRadius: 1, minWidth: 250 }}>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            Audio File
          </Typography>
          <audio 
            controls 
            src={mediaSrc} 
            style={{ width: '100%' }} 
            onError={(e) => {
              console.log('Audio load error, using fallback');
              // Try a fallback if the audio fails to load
              e.target.src = `/api/media/${conversationFolder}/${media.filename}`;
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {media.originalName || media.filename}
          </Typography>
        </Box>
      ) : media.type === 'video' ? (
        <Box sx={{ p: 2, textAlign: 'center', bgcolor: '#fdf7ff', borderRadius: 1, minWidth: 250 }}>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            Video File
          </Typography>
          <video 
            controls 
            src={mediaSrc}
            style={{ maxWidth: '100%', maxHeight: '200px' }} 
            onError={(e) => {
              console.log('Video load error, using fallback');
              // Try a fallback if the video fails to load
              e.target.src = `/api/media/${conversationFolder}/${media.filename}`;
            }}
          />
        </Box>
      ) : (
        <Box sx={{ p: 1, border: '1px solid #eee', borderRadius: 1 }}>
          <Typography variant="caption">
            {media.originalName || media.filename}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// Using React.memo to prevent unnecessary re-renders
export default React.memo(SimpleMediaRenderer);
