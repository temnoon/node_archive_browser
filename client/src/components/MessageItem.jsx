import React, { memo, useState } from 'react';
import { Box, Paper, Typography, Chip, Button, IconButton, Tooltip, Checkbox } from '@mui/material';
import Markdown from '../Markdown.jsx';
import ToolMessageRenderer from '../ToolMessageRenderer';
import EnhancedToolMessageRenderer from '../EnhancedToolMessageRenderer';
import CanvasRenderer from '../CanvasRenderer';
import SimpleMediaRenderer from './SimpleMediaRenderer';
import { extractMessageContent } from '../utils/messageUtils';
import { useMessageSelection } from '../context/MessageSelectionContext';

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
  isCurrent,
  messageIndex = 0, // Add message index for selection
  allMessages = [] // Add all messages for selection context
}) {
  // Safely get selection context with fallbacks
  let selection;
  try {
    selection = useMessageSelection();
  } catch (error) {
    // Fallback if context is not available
    selection = {
      selectionMode: false,
      isMessageSelected: () => false,
      handleMessageClick: () => {}
    };
  }
  
  const { 
    selectionMode = false, 
    isMessageSelected = () => false, 
    handleMessageClick = () => {} 
  } = selection || {};
  
  // Extract message info with format-specific role detection
  const getMessageRole = (message) => {
    // ChatGPT format: message.author.role
    if (message.author && message.author.role) {
      return message.author.role;
    }
    // Claude format: message.role (direct field)
    if (message.role) {
      return message.role;
    }
    // Fallback: try to detect from content structure
    if (message.content && typeof message.content === 'string') {
      // Claude messages with string content are usually assistant responses
      return 'assistant';
    }
    return 'unknown';
  };
  
  const role = getMessageRole(msg.message);
  const createTime = msg.message?.create_time || msg.message?.created_at || msg.message?.timestamp;
  const isSelected = isMessageSelected(msg.id);
  
  // Handle message click for selection
  const handleClick = (event) => {
    if (selectionMode) {
      handleMessageClick(msg.id, messageIndex, allMessages, event);
    }
  };
  
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
      cursor: selectionMode ? 'pointer' : 'default',
      // Add highlight border when this is the current message
      ...(isCurrent && {
        boxShadow: '0 0 0 2px #1976d2',
        scrollMarginTop: '80px', // Adjusted for header height
      }),
      // Add selection styling
      ...(isSelected && {
        boxShadow: '0 0 0 2px #4caf50',
        backgroundColor: role === 'user' ? '#c8e6c9' : 
                       role === 'assistant' ? '#e1bee7' :
                       role === 'tool' ? '#c8e6c9' :
                       '#fff3c4'
      })
    }}
    onClick={handleClick}
    >
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Selection checkbox */}
          {selectionMode && (
            <Checkbox
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                handleClick(e);
              }}
              size="small"
              color="primary"
            />
          )}
          
          <Typography variant="subtitle2" color="text.secondary">
            {role} {createTime ? `– ${createTime > 1e10 ? new Date(createTime).toISOString().replace('T', ' ').substring(0, 19) : new Date(createTime * 1000).toISOString().replace('T', ' ').substring(0, 19)}` : ''}
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
        </Box>
        
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