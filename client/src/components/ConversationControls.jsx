import React from 'react';
import { Box, Button, Typography, ButtonGroup, Chip } from '@mui/material';
import { 
  PictureAsPdf as PdfIcon, 
  CheckBox as SelectIcon,
  CheckBoxOutlineBlank as UnselectIcon,
  Clear as ClearIcon,
  Edit as EditIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useMessageSelection } from '../context/MessageSelectionContext';
import { useDocumentBuilder } from '../context/DocumentBuilderContext';

/**
 * ConversationControls Component
 * Provides controls for the conversation view (media button, tool message toggle, PDF export)
 */
export default function ConversationControls({ 
  conversationId, 
  hasMedia, 
  hideToolMessages, 
  setHideToolMessages,
  onPdfExport, // Function to handle PDF export
  messages = [], // Messages array for selection functions
  conversationData = {} // Full conversation data including title
}) {
  const navigate = useNavigate();
  
  // Safely get selection context with fallbacks
  let selection;
  try {
    selection = useMessageSelection();
  } catch (error) {
    // Fallback if context is not available
    selection = {
      selectionMode: false,
      selectedCount: 0,
      selectedMessages: [],
      toggleSelectionMode: () => {},
      clearSelection: () => {},
      selectAll: () => {},
      selectUserMessages: () => {},
      selectAssistantMessages: () => {}
    };
  }

  // Document builder context
  const documentBuilder = useDocumentBuilder();
  
  const {
    selectionMode = false,
    selectedCount = 0,
    selectedMessages = [],
    toggleSelectionMode = () => {},
    clearSelection = () => {},
    selectAll = () => {},
    selectUserMessages = () => {},
    selectAssistantMessages = () => {}
  } = selection || {};

  // Helper to get actual message objects from selected IDs
  const getSelectedMessageObjects = () => {
    if (!selectedMessages || selectedMessages.length === 0) return [];
    const selectedIds = new Set(selectedMessages);
    return messages.filter(msg => selectedIds.has(msg.id));
  };

  // Enhanced PDF Editor navigation
  const handleEnhancedPdfEditor = () => {
    if (selectionMode && selectedMessages.length > 0) {
      // Get actual message objects from IDs
      const messageObjects = getSelectedMessageObjects();
      if (messageObjects.length > 0) {
        // Add selected messages to document builder and navigate
        documentBuilder.addSelectedMessages(
          conversationId, 
          conversationData.title || `Conversation ${conversationId}`, 
          messageObjects
        );
        documentBuilder.createDocument();
      }
    } else {
      // Navigate to single conversation import
      navigate(`/pdf-editor/${conversationId}`);
    }
  };

  // Add selected messages to collection without navigating
  const handleAddToCollection = () => {
    if (selectionMode && selectedMessages.length > 0) {
      // Get actual message objects from IDs
      const messageObjects = getSelectedMessageObjects();
      if (messageObjects.length > 0) {
        documentBuilder.addSelectedMessages(
          conversationId, 
          conversationData.title || `Conversation ${conversationId}`, 
          messageObjects
        );
        clearSelection();
      }
    }
  };
  
  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
      {/* Media Gallery Button */}
      {hasMedia && (
        <Button 
          variant="outlined" 
          onClick={() => navigate('/media', { state: { conversationId } })}
          size="small"
        >
          View Conversation Media
        </Button>
      )}
      
      {/* PDF Export Controls */}
      {!selectionMode ? (
        <ButtonGroup size="small" variant="outlined">
          <Button
            startIcon={<PdfIcon />}
            onClick={() => onPdfExport && onPdfExport('conversation')}
          >
            Export PDF
          </Button>
          <Button
            startIcon={<EditIcon />}
            onClick={handleEnhancedPdfEditor}
            variant="contained"
            color="primary"
          >
            Enhanced PDF Editor
          </Button>
          <Button
            startIcon={<SelectIcon />}
            onClick={toggleSelectionMode}
          >
            Select Messages
          </Button>
        </ButtonGroup>
      ) : (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip 
            label={`${selectedCount} selected`}
            color="primary"
            size="small"
          />
          
          <ButtonGroup size="small" variant="outlined">
            <Button onClick={() => selectUserMessages && selectUserMessages(messages)}>
              User
            </Button>
            <Button onClick={() => selectAssistantMessages && selectAssistantMessages(messages)}>
              Assistant
            </Button>
            <Button onClick={() => selectAll && selectAll(messages)}>
              All
            </Button>
          </ButtonGroup>
          
          <ButtonGroup size="small">
            <Button
              variant="contained"
              startIcon={<PdfIcon />}
              onClick={() => onPdfExport && onPdfExport('messages')}
              disabled={selectedCount === 0}
            >
              Export Selected
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddToCollection}
              disabled={selectedCount === 0}
            >
              Add to Document
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<EditIcon />}
              onClick={handleEnhancedPdfEditor}
              disabled={selectedCount === 0}
            >
              Enhanced PDF Editor
            </Button>
            <Button
              startIcon={<ClearIcon />}
              onClick={clearSelection}
            >
              Clear
            </Button>
            <Button
              startIcon={<UnselectIcon />}
              onClick={toggleSelectionMode}
            >
              Exit
            </Button>
          </ButtonGroup>
        </Box>
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
