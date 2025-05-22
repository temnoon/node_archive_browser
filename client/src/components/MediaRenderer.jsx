import React, { memo } from 'react';
import { Box, Typography } from '@mui/material';

/**
 * MediaRenderer Component
 * Renders different types of media (image, audio, video)
 */
function MediaRenderer({ 
  media, 
  getMediaPath, 
  conversationFolder, 
  onClick, 
  isFromHiddenMessage = false
}) {
  // Create a stable direct path for fallback
  const getDirectPath = () => {
    if (!conversationFolder || !media?.filename) return '';
    return `/api/media/${conversationFolder}/${media.filename}`;
  };
  
  // Use a safe version of getMediaPath that handles errors
  const getSafePath = () => {
    try {
      if (typeof getMediaPath !== 'function') {
        console.error('getMediaPath is not a function, falling back to direct path');
        return getDirectPath();
      }
      return getMediaPath(media.filename);
    } catch (error) {
      console.error('Error in getMediaPath:', error);
      return getDirectPath();
    }
  };
  
  // Get the path to render
  const mediaSrc = getSafePath();

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
      onClick(media);
    }
  };

  if (!media) {
    console.error('MediaRenderer received null/undefined media object');
    return null;
  }

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
      {/* Indicator for media from hidden messages */}
      {isFromHiddenMessage && (
        <Box 
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            bgcolor: 'rgba(76, 175, 80, 0.9)',
            color: 'white',
            fontSize: '10px',
            padding: '2px 4px',
            borderRadius: '0 0 0 4px',
            zIndex: 5
          }}
        >
          From Hidden Message
        </Box>
      )}
      
      {/* Render based on media type */}
      {media.type === 'image' ? (
        <img 
          src={mediaSrc} 
          alt={media.originalName || "Image attachment"} 
          style={{ maxWidth: '100%', maxHeight: '300px' }}
          onError={(e) => {
            console.log('Image error, trying direct path:', media.filename);
            // Try a fallback if the image fails to load
            e.target.src = getDirectPath();
          }}
        />
      ) : media.type === 'audio' ? (
        <Box sx={{ p: 2, textAlign: 'center', bgcolor: '#f0f7ff', borderRadius: 1, minWidth: 250 }}>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            Audio File{isFromHiddenMessage ? ' (from Hidden Message)' : ''}
          </Typography>
          <audio 
            controls 
            src={mediaSrc} 
            style={{ width: '100%' }} 
            onError={(e) => {
              console.log('Audio error, trying direct path:', media.filename);
              // Try a fallback if the audio fails to load
              e.target.src = getDirectPath();
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {media.originalName || media.filename}
          </Typography>
        </Box>
      ) : media.type === 'video' ? (
        <Box sx={{ p: 2, textAlign: 'center', bgcolor: '#fdf7ff', borderRadius: 1, minWidth: 250 }}>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            Video File{isFromHiddenMessage ? ' (from Hidden Message)' : ''}
          </Typography>
          <video 
            controls 
            src={mediaSrc}
            style={{ maxWidth: '100%', maxHeight: '200px' }} 
            onError={(e) => {
              console.log('Video error, trying direct path:', media.filename);
              // Try a fallback if the video fails to load
              e.target.src = getDirectPath();
            }}
          />
        </Box>
      ) : (
        <Box sx={{ p: 1, border: '1px solid #eee', borderRadius: 1 }}>
          <Typography variant="caption">
            {media.originalName || media.filename}{isFromHiddenMessage ? ' (from Hidden Message)' : ''}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// Memoize the MediaRenderer to prevent unnecessary re-renders
export default memo(MediaRenderer, (prevProps, nextProps) => {
  // Only re-render if the media or conversation folder changes
  return prevProps.media?.filename === nextProps.media?.filename && 
         prevProps.conversationFolder === nextProps.conversationFolder;
});