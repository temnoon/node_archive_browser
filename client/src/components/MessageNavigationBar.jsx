import React from 'react';
import { Box, Typography, Button, Tooltip } from '@mui/material';

/**
 * Message Navigation Bar Component
 * Provides controls for navigating through messages in the conversation
 */
const MessageNavigationBar = ({ 
  currentMessageIndex, 
  totalMessages,
  onNavigate,
  disabled,
  sx = {}
}) => {
  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      py: 1,
      borderBottom: '1px solid #e0e0e0',
      backgroundColor: '#f9f9f9',
      position: 'sticky',
      top: 0,
      zIndex: 10,
      borderRadius: '4px 4px 0 0',
      minHeight: '48px',
      ...sx
    }}>
      <Tooltip title="Jump to first message">
        <span> {/* Wrapper needed for disabled tooltip */}
          <Button 
            size="small" 
            onClick={() => onNavigate('first')}
            disabled={disabled || currentMessageIndex <= 0}
            variant="outlined"
            aria-label="First message"
            sx={{ minWidth: '36px', p: '4px 8px', mx: 0.5 }}
          >
            ⟪
          </Button>
        </span>
      </Tooltip>
      
      <Tooltip title="Previous message">
        <span>
          <Button 
            size="small" 
            onClick={() => onNavigate('prev')}
            disabled={disabled || currentMessageIndex <= 0}
            variant="outlined"
            aria-label="Previous message"
            sx={{ minWidth: '36px', p: '4px 8px', mx: 0.5 }}
          >
            ◀
          </Button>
        </span>
      </Tooltip>
      
      <Typography variant="body2" sx={{ mx: 2, userSelect: 'none' }}>
        Message {totalMessages > 0 ? currentMessageIndex + 1 : 0} of {totalMessages}
      </Typography>
      
      <Tooltip title="Next message">
        <span>
          <Button 
            size="small" 
            onClick={() => onNavigate('next')}
            disabled={disabled || currentMessageIndex >= totalMessages - 1}
            variant="outlined"
            aria-label="Next message"
            sx={{ minWidth: '36px', p: '4px 8px', mx: 0.5 }}
          >
            ▶
          </Button>
        </span>
      </Tooltip>
      
      <Tooltip title="Jump to last message">
        <span>
          <Button 
            size="small" 
            onClick={() => onNavigate('last')}
            disabled={disabled || currentMessageIndex >= totalMessages - 1}
            variant="outlined"
            aria-label="Last message"
            sx={{ minWidth: '36px', p: '4px 8px', mx: 0.5 }}
          >
            ⟫
          </Button>
        </span>
      </Tooltip>
    </Box>
  );
};

export default MessageNavigationBar;