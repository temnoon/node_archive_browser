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
    console.log('DocumentBuilder: addSelectedMessages called', {
      conversationId,
      conversationTitle,
      selectedMessagesCount: selectedMessages.length,
      selectedMessages: selectedMessages.map(m => ({ id: m.id, author: m.message?.author?.role }))
    });
    
    setCollectedMessages(prev => {
      // Create unique IDs for selected messages to avoid conflicts
      const newMessages = selectedMessages.map(message => ({
        ...message,
        conversationId,
        conversationTitle,
        collectedAt: new Date().toISOString(),
        uniqueId: `${conversationId}-${message.id}-${Date.now()}`
      }));
      
      console.log('DocumentBuilder: Adding messages to collection', {
        previousCount: prev.length,
        newMessagesCount: newMessages.length,
        totalAfter: prev.length + newMessages.length
      });
      
      const updatedMessages = [...prev, ...newMessages];
      
      // Immediately store in sessionStorage for debugging
      console.log('DocumentBuilder: Storing updated messages in sessionStorage', {
        totalMessages: updatedMessages.length,
        sessionStorageBefore: sessionStorage.getItem('documentBuilder_messages')?.length || 0
      });
      sessionStorage.setItem('documentBuilder_messages', JSON.stringify(updatedMessages));
      
      // Verify storage
      const storedCheck = JSON.parse(sessionStorage.getItem('documentBuilder_messages') || '[]');
      console.log('DocumentBuilder: SessionStorage verification after addSelectedMessages', {
        storedCount: storedCheck.length,
        expectedCount: updatedMessages.length,
        sessionStorageSize: sessionStorage.getItem('documentBuilder_messages')?.length || 0
      });
      
      return updatedMessages;
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
    // Check both state and sessionStorage
    const sessionMessages = JSON.parse(sessionStorage.getItem('documentBuilder_messages') || '[]');
    
    console.log('DocumentBuilder: createDocument called', {
      collectedMessagesCount: collectedMessages.length,
      collectedConversationsCount: collectedConversations.size,
      sessionStorageMessagesCount: sessionMessages.length,
      sessionStorageKeys: Object.keys(sessionStorage).filter(k => k.startsWith('documentBuilder')),
      sessionStorageContent: sessionStorage.getItem('documentBuilder_messages')?.substring(0, 200) + '...'
    });
    
    // Use sessionStorage if state is empty but sessionStorage has content
    const messagesToUse = collectedMessages.length > 0 ? collectedMessages : sessionMessages;
    
    if (messagesToUse.length === 0) {
      console.error('DocumentBuilder: No messages collected when trying to create document', {
        stateEmpty: collectedMessages.length === 0,
        sessionStorageEmpty: sessionMessages.length === 0,
        allSessionStorageKeys: Object.keys(sessionStorage)
      });
      throw new Error('No messages collected');
    }

    // Store collected content in sessionStorage for PDF editor to access
    sessionStorage.setItem('documentBuilder_messages', JSON.stringify(messagesToUse));
    sessionStorage.setItem('documentBuilder_conversations', JSON.stringify(Array.from(collectedConversations.entries())));
    
    console.log('DocumentBuilder: Stored messages in sessionStorage', {
      messagesStored: messagesToUse.length,
      conversationsStored: Array.from(collectedConversations.entries()).length,
      finalSessionStorageSize: sessionStorage.getItem('documentBuilder_messages')?.length || 0
    });
    
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

