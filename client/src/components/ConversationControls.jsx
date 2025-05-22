import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

/**
 * ConversationControls Component
 * Provides controls for the conversation view (media button, tool message toggle)
 */
export default function ConversationControls({ 
  conversationId, 
  hasMedia, 
  hideToolMessages, 
  setHideToolMessages 
}) {
  const navigate = useNavigate();
  
  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      {hasMedia && (
        <Button 
          variant="outlined" 
          onClick={() => navigate('/media', { state: { conversationId } })}
          size="small"
        >
          View Conversation Media
        </Button>
      )}
      
      {/* Tool and system message toggle */}
      <Box 
        sx={{ display: 'flex', alignItems: 'center' }} 
        title="Hides technical tool output and system messages while preserving any media they contain"
      >
        <Typography variant="body2" sx={{ mr: 1 }}>Hide tool & system messages</Typography>
        <label style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
          <input 
            type="checkbox" 
            checked={hideToolMessages} 
            onChange={() => setHideToolMessages(!hideToolMessages)}
            style={{ 
              width: '36px', 
              height: '18px', 
              appearance: 'none',
              backgroundColor: hideToolMessages ? '#1976d2' : '#e0e0e0',
              borderRadius: '9px',
              transition: 'background-color 0.3s',
              position: 'relative',
              cursor: 'pointer'
            }}
          />
          <span style={{
            position: 'absolute',
            left: hideToolMessages ? '22px' : '4px',
            width: '14px',
            height: '14px',
            backgroundColor: 'white',
            borderRadius: '50%',
            transition: 'left 0.3s',
            pointerEvents: 'none'
          }} />
        </label>
      </Box>
    </Box>
  );
}
