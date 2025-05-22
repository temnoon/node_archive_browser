import React, { memo, useState } from 'react';
import { Box, Paper, Typography, Chip, Button, IconButton, Tooltip } from '@mui/material';
import Markdown from '../Markdown.jsx';
import ToolMessageRenderer from '../ToolMessageRenderer';
import EnhancedToolMessageRenderer from '../EnhancedToolMessageRenderer';
import CanvasRenderer from '../CanvasRenderer';
import SimpleMediaRenderer from './SimpleMediaRenderer';
import { extractMessageContent } from '../utils/messageUtils';

/**
 * MessageItem Component
 * Renders a single message in the conversation
 */
function MessageItem({ 
  msg, 
  getMediaPath, 
  openGizmoEditor, 
  conversationFolder,
  onMediaClick,
  isCurrent
}) {
  // Extract message info
  const role = msg.message?.author?.role || 'unknown';
  const createTime = msg.message?.create_time;
  
  // Determine background color based on role
  const bgColor = 
    role === 'user' ? '#e3f2fd' : 
    role === 'assistant' ? '#f3e5f5' : 
    role === 'tool' ? '#e8f5e9' : 
    '#eeeeee';
  
  // Extract content from message parts
  const content = extractMessageContent(msg.message);
  
  // Add state for raw JSON view
  const [showRawJson, setShowRawJson] = useState(false);

  // Toggle raw JSON view
  const toggleRawJson = (e) => {
    e.stopPropagation(); // Prevent event bubbling
    setShowRawJson(!showRawJson);
  };

  return (
    <Paper sx={{ 
      p: 2, 
      my: 1, 
      backgroundColor: bgColor, 
      position: 'relative', 
      textAlign: 'left',
      transition: 'box-shadow 0.2s ease-in-out',
      // Add highlight border when this is the current message
      ...(isCurrent && {
        boxShadow: '0 0 0 2px #1976d2',
        scrollMarginTop: '80px', // Adjusted for header height
      })
    }}>
      {/* Add special indicator for parsed messages */}
      {msg.parsed && (
        <Box 
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '10px',
            height: '10px',
            borderRadius: '0 3px 0 3px',
            backgroundColor: '#4caf50',
          }}
          title="Enhanced parsing applied"
        />
      )}
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">
          {role} {createTime ? `– ${new Date(createTime * 1000).toISOString().replace('T', ' ').substring(0, 19)}` : ''}
          {msg.message?.metadata?.model_slug ? ` (${msg.message.metadata.model_slug})` : ''}
          {msg.message?.metadata?.gizmo_id && (
          <Box component="span" sx={{ ml: 1 }}>
            <Chip 
              size="small" 
              label={`Custom GPT: ${msg.gizmo_name || msg.message.metadata.gizmo_id}`}
              color="primary"
              variant="outlined"
              sx={{ maxWidth: '250px', textOverflow: 'ellipsis', overflow: 'hidden' }}
              onClick={() => openGizmoEditor(
                msg.message.metadata.gizmo_id,
                msg.gizmo_name
              )}
            />
          </Box>
        )}
        </Typography>
        
        <Tooltip title={showRawJson ? "Show rendered message" : "View raw JSON"}>
          <Button 
            variant="text" 
            size="small" 
            onClick={toggleRawJson}
            sx={{ minWidth: 'auto', ml: 1, fontSize: '0.75rem' }}
          >
            {showRawJson ? 'Rendered' : 'Raw JSON'}
          </Button>
        </Tooltip>
      </Box>
      
      {/* Render message content based on view mode */}
      {showRawJson ? (
        <Box sx={{ 
          overflow: 'auto', 
          maxHeight: '500px', 
          fontFamily: 'monospace', 
          fontSize: '0.85rem',
          whiteSpace: 'pre-wrap',
          p: 1,
          border: '1px solid #ddd',
          borderRadius: '4px',
          backgroundColor: '#f8f8f8'
        }}>
          {JSON.stringify(msg.message, null, 2)}
        </Box>
      ) : (
        /* Normal rendering */
        role === 'tool' ? (
          msg.parsed ? (
            <EnhancedToolMessageRenderer message={msg.message} parsedData={msg.parsed.data} />
          ) : (
            <ToolMessageRenderer message={msg.message} />
          )
        ) : (
          <>
            <Markdown 
              children={content.text} 
              segments={content.segments} 
            />
            
            {/* Display canvas if available */}
            {content.canvasIds && content.canvasIds.length > 0 && (
              <Box sx={{ mt: 2 }}>
                {content.canvasIds.map(canvasId => (
                  <CanvasRenderer 
                    key={canvasId}
                    canvasId={canvasId}
                    conversationFolder={conversationFolder}
                  />
                ))}
              </Box>
            )}
          </>
        )
      )}
      
      {/* Render media attachments */}
      {(content.mediaRefs.length > 0 || msg.toolMedia) && (
        <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {/* Render regular media refs */}
          {content.mediaRefs.map((media, index) => (
            <SimpleMediaRenderer 
              key={`media-${index}`}
              media={media}
              conversationFolder={conversationFolder}
              onClick={() => onMediaClick(media, content.mediaRefs)}
            />
          ))}
          
          {/* Render tool media if we're hiding tool messages but displaying their media */}
          {msg.toolMedia && msg.toolMedia.map((media, index) => (
            <SimpleMediaRenderer 
              key={`tool-media-${index}`}
              media={media}
              conversationFolder={conversationFolder}
              onClick={() => onMediaClick(media, msg.toolMedia)}
            />
          ))}
        </Box>
      )}
    </Paper>
  );
}

// Memoize the MessageItem component to prevent unnecessary re-renders
export default memo(MessageItem, (prevProps, nextProps) => {
  // Only re-render if the message ID changes or if the folder changes
  return prevProps.msg.id === nextProps.msg.id && 
         prevProps.conversationFolder === nextProps.conversationFolder;
});