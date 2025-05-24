import React, { createContext, useContext, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const DocumentBuilderContext = createContext();

export const useDocumentBuilder = () => {
  const context = useContext(DocumentBuilderContext);
  if (!context) {
    throw new Error('useDocumentBuilder must be used within a DocumentBuilderProvider');
  }
  return context;
};

export const DocumentBuilderProvider = ({ children }) => {
  const [collectedMessages, setCollectedMessages] = useState([]);
  const [collectedConversations, setCollectedConversations] = useState(new Map());
  const navigate = useNavigate();

  // Add messages from a conversation
  const addMessages = useCallback((conversationId, conversationTitle, messages) => {
    setCollectedMessages(prev => {
      // Remove existing messages from this conversation first
      const filtered = prev.filter(item => item.conversationId !== conversationId);
      
      // Add new messages with metadata
      const newMessages = messages.map(message => ({
        ...message,
        conversationId,
        conversationTitle,
        collectedAt: new Date().toISOString()
      }));
      
      return [...filtered, ...newMessages];
    });

    // Update conversation metadata
    setCollectedConversations(prev => {
      const updated = new Map(prev);
      updated.set(conversationId, {
        id: conversationId,
        title: conversationTitle,
        messageCount: messages.length,
        addedAt: new Date().toISOString()
      });
      return updated;
    });
  }, []);

  // Add specific selected messages
  const addSelectedMessages = useCallback((conversationId, conversationTitle, selectedMessages) => {
    setCollectedMessages(prev => {
      // Create unique IDs for selected messages to avoid conflicts
      const newMessages = selectedMessages.map(message => ({
        ...message,
        conversationId,
        conversationTitle,
        collectedAt: new Date().toISOString(),
        uniqueId: `${conversationId}-${message.id}-${Date.now()}`
      }));
      
      return [...prev, ...newMessages];
    });

    // Update conversation metadata
    setCollectedConversations(prev => {
      const updated = new Map(prev);
      const existing = updated.get(conversationId);
      updated.set(conversationId, {
        id: conversationId,
        title: conversationTitle,
        messageCount: (existing?.messageCount || 0) + selectedMessages.length,
        addedAt: new Date().toISOString()
      });
      return updated;
    });
  }, []);

  // Remove messages from a conversation
  const removeConversation = useCallback((conversationId) => {
    setCollectedMessages(prev => prev.filter(item => item.conversationId !== conversationId));
    setCollectedConversations(prev => {
      const updated = new Map(prev);
      updated.delete(conversationId);
      return updated;
    });
  }, []);

  // Remove specific message
  const removeMessage = useCallback((messageId, conversationId) => {
    setCollectedMessages(prev => prev.filter(item => 
      !(item.id === messageId && item.conversationId === conversationId)
    ));
  }, []);

  // Clear all collected content
  const clearAll = useCallback(() => {
    setCollectedMessages([]);
    setCollectedConversations(new Map());
  }, []);

  // Navigate to Enhanced PDF Editor with collected content
  const createDocument = useCallback(() => {
    if (collectedMessages.length === 0) {
      throw new Error('No messages collected');
    }

    // Store collected content in sessionStorage for PDF editor to access
    sessionStorage.setItem('documentBuilder_messages', JSON.stringify(collectedMessages));
    sessionStorage.setItem('documentBuilder_conversations', JSON.stringify(Array.from(collectedConversations.entries())));
    
    // Navigate to PDF editor with special flag for collected content
    navigate('/pdf-editor?source=collected');
  }, [collectedMessages, collectedConversations, navigate]);

  // Get statistics
  const getStats = useCallback(() => {
    return {
      totalMessages: collectedMessages.length,
      totalConversations: collectedConversations.size,
      conversationBreakdown: Array.from(collectedConversations.values())
    };
  }, [collectedMessages, collectedConversations]);

  // Check if a conversation has collected messages
  const hasCollectedFromConversation = useCallback((conversationId) => {
    return collectedConversations.has(conversationId);
  }, [collectedConversations]);

  // Get collected messages from specific conversation
  const getCollectedFromConversation = useCallback((conversationId) => {
    return collectedMessages.filter(item => item.conversationId === conversationId);
  }, [collectedMessages]);

  const value = {
    // State
    collectedMessages,
    collectedConversations: Array.from(collectedConversations.values()),
    
    // Actions
    addMessages,
    addSelectedMessages,
    removeConversation,
    removeMessage,
    clearAll,
    createDocument,
    
    // Queries
    getStats,
    hasCollectedFromConversation,
    getCollectedFromConversation
  };

  return (
    <DocumentBuilderContext.Provider value={value}>
      {children}
    </DocumentBuilderContext.Provider>
  );
};

export default DocumentBuilderContext;