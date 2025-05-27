import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * Context for managing message selection state across the application
 * Used for PDF export and other multi-message operations
 */
const MessageSelectionContext = createContext();

export const useMessageSelection = () => {
  const context = useContext(MessageSelectionContext);
  if (!context) {
    throw new Error('useMessageSelection must be used within a MessageSelectionProvider');
  }
  return context;
};

export const MessageSelectionProvider = ({ children }) => {
  const [selectedMessages, setSelectedMessages] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);

  // Toggle selection mode on/off
  const toggleSelectionMode = useCallback(() => {
    setSelectionMode(prev => {
      if (prev) {
        // Exiting selection mode - clear selections
        setSelectedMessages(new Set());
        setLastSelectedIndex(null);
      }
      return !prev;
    });
  }, []);

  // Exit selection mode and clear selections
  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedMessages(new Set());
    setLastSelectedIndex(null);
  }, []);

  // Toggle a single message selection
  const toggleMessageSelection = useCallback((messageId, messageIndex) => {
    setSelectedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
    setLastSelectedIndex(messageIndex);
  }, []);

  // Select a range of messages (for shift+click)
  const selectMessageRange = useCallback((startIndex, endIndex, messages) => {
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);
    
    setSelectedMessages(prev => {
      const newSet = new Set(prev);
      for (let i = start; i <= end; i++) {
        if (messages[i]) {
          newSet.add(messages[i].id);
        }
      }
      return newSet;
    });
    setLastSelectedIndex(endIndex);
  }, []);

  // Handle message click with support for shift+click range selection
  const handleMessageClick = useCallback((messageId, messageIndex, messages, event) => {
    if (!selectionMode) return;
    
    if (event.shiftKey && lastSelectedIndex !== null) {
      selectMessageRange(lastSelectedIndex, messageIndex, messages);
    } else {
      toggleMessageSelection(messageId, messageIndex);
    }
  }, [selectionMode, lastSelectedIndex, selectMessageRange, toggleMessageSelection]);

  // Select all messages
  const selectAll = useCallback((messages) => {
    const allIds = new Set(messages.map(msg => msg.id));
    setSelectedMessages(allIds);
  }, []);

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedMessages(new Set());
    setLastSelectedIndex(null);
  }, []);

  // Select messages by filter criteria
  const selectByFilter = useCallback((messages, filterFn) => {
    const filteredIds = messages
      .filter(filterFn)
      .map(msg => msg.id);
    
    setSelectedMessages(prev => {
      const newSet = new Set(prev);
      filteredIds.forEach(id => newSet.add(id));
      return newSet;
    });
  }, []);

  // Quick selection helpers
  const selectUserMessages = useCallback((messages) => {
    selectByFilter(messages, msg => msg.message?.author?.role === 'user');
  }, [selectByFilter]);

  const selectAssistantMessages = useCallback((messages) => {
    selectByFilter(messages, msg => msg.message?.author?.role === 'assistant');
  }, [selectByFilter]);

  const selectMessagesWithMedia = useCallback((messages) => {
    selectByFilter(messages, msg => {
      const content = msg.message?.content;
      if (!content) return false;
      
      // Check for media in multimodal content
      if (content.content_type === 'multimodal_text' && Array.isArray(content.parts)) {
        return content.parts.some(part => 
          part && typeof part === 'object' && 
          (part.content_type === 'image_asset_pointer' || part.content_type === 'audio_asset_pointer')
        );
      }
      
      // Check for attachments
      if (msg.message?.metadata?.attachments && Array.isArray(msg.message.metadata.attachments)) {
        return msg.message.metadata.attachments.length > 0;
      }
      
      return false;
    });
  }, [selectByFilter]);

  // Get selection statistics
  const getSelectionStats = useCallback((messages) => {
    const selectedIds = Array.from(selectedMessages);
    const selectedMsgs = messages.filter(msg => selectedMessages.has(msg.id));
    
    const stats = {
      total: selectedIds.length,
      byRole: {},
      hasMedia: 0,
      hasCanvas: 0
    };
    
    selectedMsgs.forEach(msg => {
      const role = msg.message?.author?.role || 'unknown';
      stats.byRole[role] = (stats.byRole[role] || 0) + 1;
      
      // Check for media
      const content = msg.message?.content;
      if (content?.content_type === 'multimodal_text' && Array.isArray(content.parts)) {
        const hasMediaParts = content.parts.some(part => 
          part && typeof part === 'object' && 
          (part.content_type === 'image_asset_pointer' || part.content_type === 'audio_asset_pointer')
        );
        if (hasMediaParts) stats.hasMedia++;
      }
      
      if (msg.message?.metadata?.attachments?.length > 0) {
        stats.hasMedia++;
      }
      
      // Check for canvas
      if (msg.message?.metadata?.canvas_id || content?.canvas_id) {
        stats.hasCanvas++;
      }
    });
    
    return stats;
  }, [selectedMessages]);

  // Check if a message is selected
  const isMessageSelected = useCallback((messageId) => {
    return selectedMessages.has(messageId);
  }, [selectedMessages]);

  const value = {
    // State
    selectedMessages: Array.from(selectedMessages),
    selectionMode,
    selectedCount: selectedMessages.size,
    
    // Actions
    toggleSelectionMode,
    exitSelectionMode,
    toggleMessageSelection,
    handleMessageClick,
    selectAll,
    clearSelection,
    selectUserMessages,
    selectAssistantMessages,
    selectMessagesWithMedia,
    
    // Utilities
    isMessageSelected,
    getSelectionStats
  };

  return (
    <MessageSelectionContext.Provider value={value}>
      {children}
    </MessageSelectionContext.Provider>
  );
};


