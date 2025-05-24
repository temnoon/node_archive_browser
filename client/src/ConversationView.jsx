import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Box, Alert, Button, LinearProgress, Typography, CircularProgress } from '@mui/material';
import { useParams } from 'react-router-dom';
import GizmoNameEditor from './GizmoNameEditor';

// Import utility functions
import { fetchAPI } from './utils/fetchUtils';
import { loadMediaFilenames, clearMediaFilenameCache } from './utils/mediaUtils';
import { extractMessageContent, createHiddenMediaMap, filterMessages } from './utils/messageUtils';

// Import components
import ConversationHeader from './components/ConversationHeader';
import ConversationControls from './components/ConversationControls';
import MessageItem from './components/MessageItem';
import SimpleMediaModal from './components/SimpleMediaModal';
import MessageNavigationBar from './components/MessageNavigationBar';
import PDFExportDialog from './components/PDFExportDialog';

// Import context
import { MessageSelectionProvider, useMessageSelection } from './context/MessageSelectionContext';

// Create a wrapper component that uses the selection context
function ConversationViewContent() {
  const { id } = useParams();
  const selection = useMessageSelection();
  
  // Conversation state
  const [data, setData] = useState({ 
    messages: [], 
    total_messages: 0, 
    title: '', 
    create_time: '', 
    folder: '',
    canvas_ids: [] 
  });
  const [mediaFilenames, setMediaFilenames] = useState({});
  const [expandedCanvasId, setExpandedCanvasId] = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [hideToolMessages, setHideToolMessages] = useState(false);
  
  // Loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Infinite scroll states
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const BATCH_SIZE = 25; // Number of messages to load per batch
  
  // Message navigation states
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [visibleMessageIndices, setVisibleMessageIndices] = useState([]);
  const messageRefs = useRef({});
  const [isNavigating, setIsNavigating] = useState(false);
  
  // Gizmo editor state
  const [gizmoEditorOpen, setGizmoEditorOpen] = useState(false);
  const [currentGizmo, setCurrentGizmo] = useState({ id: '', name: '' });
  
  // Media modal state
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  
  // PDF export state
  const [pdfExportDialogOpen, setPdfExportDialogOpen] = useState(false);
  const [pdfExportType, setPdfExportType] = useState('conversation'); // 'conversation', 'messages'
  
  // Refs for scrolling and positioning
  const scrollRef = useRef();
  const topRef = useRef();

  // Simple function to get media path
  const getMediaPath = (filename) => {
    if (!data.folder || !filename) return '';
    return `/api/media/${data.folder}/${filename}`;
  };
  
  // Handler for updating gizmo names
  const handleGizmoNameChange = (gizmoId, newName) => {
    // Update the display immediately without requiring a reload
    setData(prevData => {
      // Create a copy of the messages array
      const updatedMessages = prevData.messages.map(msg => {
        // If this message has the gizmo ID we're updating
        if (msg.message?.metadata?.gizmo_id === gizmoId) {
          // Create a copy of the message and add/update the gizmo_name
          return {
            ...msg,
            gizmo_name: newName
          };
        }
        return msg;
      });
      
      return {
        ...prevData,
        messages: updatedMessages
      };
    });
  };
  
  // Function to open the gizmo editor for a specific gizmo
  const openGizmoEditor = (gizmoId, currentName) => {
    setCurrentGizmo({
      id: gizmoId,
      name: currentName || gizmoId
    });
    setGizmoEditorOpen(true);
  };

  // Create map of hidden message media to display in assistant messages
  const mediaByAssistantMsg = useMemo(() => {
    if (hideToolMessages && data.messages) {
      return createHiddenMediaMap(data.messages);
    }
    return {};
  }, [hideToolMessages, data.messages]);
  
  // Filter messages based on hideToolMessages setting
  const filteredMessages = useMemo(() => {
    if (!data.messages) return [];
    return filterMessages(data.messages, hideToolMessages, mediaByAssistantMsg);
  }, [data.messages, hideToolMessages, mediaByAssistantMsg]);

  // Function to open media modal - simplified
  const handleOpenMediaModal = (media) => {
    setSelectedMedia(media);
    setMediaModalOpen(true);
  };

  // Close the media modal
  const handleCloseMediaModal = () => {
    setMediaModalOpen(false);
    setSelectedMedia(null);
  };
  
  // Handle PDF export dialog
  const handleOpenPdfExport = useCallback((exportType = 'conversation') => {
    setPdfExportType(exportType);
    setPdfExportDialogOpen(true);
  }, []);
  
  const handleClosePdfExport = useCallback(() => {
    setPdfExportDialogOpen(false);
  }, []);
  
  // Handle loading media filenames with optimized caching
  const handleLoadMediaFilenames = useCallback(async (folder) => {
    try {
      // Only load if folder is valid
      if (folder) {
        console.log('Loading media filenames for folder:', folder);
        const filenameMap = await loadMediaFilenames(folder, fetchAPI);
        setMediaFilenames(filenameMap);
      }
    } catch (err) {
      console.error('Error loading media filenames:', err);
      // Non-critical error, just log it and continue
    }
  }, []); // No dependencies to avoid update loops
  
  // Set the current conversation ID in a global variable for markdown processing
  useEffect(() => {
    // Make conversation ID available for markdown parser
    window.currentConversationId = id;
    window.currentConversationFolder = data.folder;
    
    return () => {
      // Clean up when component unmounts
      window.currentConversationId = undefined;
      window.currentConversationFolder = undefined;
    };
  }, [id, data.folder]);
  
  // We'll use a simple variable outside the component state to track folder changes
  const folderRef = useRef('');
  
  // Initialize folder ref with current data
  useEffect(() => {
    folderRef.current = data.folder || '';
  }, [data.folder]);

  // Fetch initial conversation data
  const fetchInitialData = useCallback(() => {
    setIsLoading(true);
    setError(null);
    setOffset(0);
    
    // Initial fetch to get metadata and first batch of messages
    fetch(`/api/conversations/${id}?offset=0&limit=${BATCH_SIZE}`)
      .then(res => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then(res => {
        // Update data state
        setData(res);
        
        // Update has more state
        setHasMore(res.messages.length < res.total_messages);
        
        // Only load media filenames if folder exists
        if (res.folder && res.folder !== folderRef.current) {
          folderRef.current = res.folder;
          handleLoadMediaFilenames(res.folder);
        }
        
        // Update loading state
        setIsLoading(false);
        setInitialLoad(false);
        setOffset(res.messages.length);
      })
      .catch(err => {
        console.error('Error fetching conversation:', err);
        setError(err.message || 'Failed to load conversation');
        setIsLoading(false);
      });
  }, [id, BATCH_SIZE]);
  
  // Load more messages function for infinite scrolling
  const loadMoreMessages = useCallback((loadAll = false) => {
    if ((!hasMore && !loadAll) || loadingMore || isLoading) return;
    
    setLoadingMore(true);
    
    // Calculate how many batches to load - either one batch or all remaining
    const batchesToLoad = loadAll ? 
      Math.ceil((data.total_messages - offset) / BATCH_SIZE) : 1;
    
    // Chain promises to load multiple batches in sequence if loadAll is true
    let currentOffset = offset;
    let promiseChain = Promise.resolve();
    
    for (let i = 0; i < batchesToLoad; i++) {
      promiseChain = promiseChain.then(() => {
        return fetch(`/api/conversations/${id}?offset=${currentOffset}&limit=${BATCH_SIZE}`)
          .then(res => {
            if (!res.ok) throw new Error(`API error: ${res.status}`);
            return res.json();
          })
          .then(res => {
            // Append new messages to existing ones
            setData(prevData => ({
              ...prevData,
              messages: [...prevData.messages, ...res.messages]
            }));
            
            // Update offset for next batch
            currentOffset += res.messages.length;
            setOffset(currentOffset);
            
            // Update has more state for the last batch
            if (i === batchesToLoad - 1) {
              setHasMore(currentOffset < data.total_messages);
              setLoadingMore(false);
            }
          });
      });
    }
    
    // Handle any errors in the promise chain
    promiseChain.catch(err => {
      console.error('Error loading more messages:', err);
      setLoadingMore(false);
    });
    
  }, [id, offset, hasMore, loadingMore, isLoading, BATCH_SIZE, data.total_messages]);
  
  // Navigation handler for moving between messages
  const handleNavigate = useCallback((direction) => {
    // Set navigating state to prevent interference from Intersection Observer
    setIsNavigating(true);
    
    let targetIndex;
    
    switch(direction) {
      case 'prev':
        targetIndex = Math.max(0, currentMessageIndex - 1);
        break;
      case 'next':
        targetIndex = Math.min(filteredMessages.length - 1, currentMessageIndex + 1);
        break;
      case 'first':
        targetIndex = 0;
        break;
      case 'last':
        targetIndex = filteredMessages.length - 1;
        // If we need to load more messages to reach the end
        if (hasMore) {
          // Load all remaining messages (up to a reasonable limit)
          loadMoreMessages(true); // true = load all remaining messages
        }
        break;
      default:
        setIsNavigating(false);
        return;
    }
    
    // Update current message index
    setCurrentMessageIndex(targetIndex);
    
    // Scroll to the target message if it's already in the DOM
    if (messageRefs.current[targetIndex]) {
      messageRefs.current[targetIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
      
      // Reset navigating state after animation completes
      setTimeout(() => setIsNavigating(false), 500);
    } else {
      // If message is not loaded yet, this is a fallback
      console.log('Target message not found in DOM, index:', targetIndex);
      setIsNavigating(false);
    }
  }, [currentMessageIndex, filteredMessages.length, hasMore, loadMoreMessages]);
  
  // Handle scroll events to detect when to load more
  const handleScroll = useCallback((e) => {
    // Only check for scroll if we have more messages to load
    if (!hasMore || loadingMore) return;
    
    const scrollElement = e.target;
    
    // Check if we're near the bottom (within 200px)
    const scrollThreshold = 200;
    const bottomPosition = scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;
    
    if (bottomPosition < scrollThreshold) {
      loadMoreMessages();
    }
  }, [hasMore, loadingMore, loadMoreMessages]);

  // Restart the component when conversation changes
  useEffect(() => {
    // This is a key component reset effect that runs when the ID changes
    console.log('Conversation ID changed to:', id);
    
    // Reset state directly
    setData({ 
      messages: [], 
      total_messages: 0, 
      title: '', 
      create_time: '', 
      folder: '',
      canvas_ids: [] 
    });
    setIsLoading(true);
    setError(null);
    setMediaFilenames({});
    setExpandedCanvasId(null);
    setHasMore(true);
    setOffset(0);
    
    // Reset navigation states
    setCurrentMessageIndex(0);
    setVisibleMessageIndices([]);
    setIsNavigating(false);
    messageRefs.current = {};
    
    // Fetch initial data
    fetchInitialData();
    
  }, [id, fetchInitialData]); // Depend on conversation ID and fetch function
  
  // Set up scroll handling for infinite scroll and touch/mouse events
  useEffect(() => {
    const currentScrollRef = scrollRef.current;
    if (currentScrollRef) {
      // Create a proper scroll handler to stop propagation and fix chattering
      const preventDefault = (e) => {
        // Prevent any default handling that might cause issues
        if (e.target === currentScrollRef) {
          e.stopPropagation();
        }
      };

      // Handle touch events separately to prevent chattering
      const handleTouchStart = (e) => {
        currentScrollRef.dataset.scrolling = 'true';
      };

      const handleTouchEnd = (e) => {
        delete currentScrollRef.dataset.scrolling;
      };
      
      // Force scroll initialization on mount
      currentScrollRef.scrollTop = 0;
      
      // Add all event listeners
      currentScrollRef.addEventListener('mousedown', preventDefault, { passive: false });
      currentScrollRef.addEventListener('touchstart', handleTouchStart, { passive: true });
      currentScrollRef.addEventListener('touchend', handleTouchEnd, { passive: true });
      currentScrollRef.addEventListener('scroll', handleScroll, { passive: true }); // Add infinite scroll handler
      
      // Set pointer events to fix any touch/mouse interaction issues
      currentScrollRef.style.touchAction = 'pan-y';
      currentScrollRef.style.WebkitOverflowScrolling = 'touch'; // Add momentum scrolling for iOS
      
      return () => {
        // Use the captured reference in cleanup to avoid accessing a possibly null ref
        currentScrollRef.removeEventListener('mousedown', preventDefault);
        currentScrollRef.removeEventListener('touchstart', handleTouchStart);
        currentScrollRef.removeEventListener('touchend', handleTouchEnd);
        currentScrollRef.removeEventListener('scroll', handleScroll);
      };
    }
  }, [handleScroll]); // Add scroll handler as dependency

  // Track which messages are currently visible
  useEffect(() => {
    // Skip during navigation to avoid interference
    if (isNavigating) return;
    
    const options = { 
      threshold: 0.3,  // Consider message visible when 30% is in viewport 
      rootMargin: '-50px 0px' // Adjust for header/navigation bar
    };
    
    const observer = new IntersectionObserver((entries) => {
      // Process all intersection events in batch
      const newIndices = [...visibleMessageIndices];
      
      entries.forEach(entry => {
        const index = parseInt(entry.target.dataset.messageIndex, 10);
        
        if (entry.isIntersecting) {
          // Add to visible indices if not already present
          if (!newIndices.includes(index)) {
            newIndices.push(index);
          }
        } else {
          // Remove from visible indices
          const indexPosition = newIndices.indexOf(index);
          if (indexPosition !== -1) {
            newIndices.splice(indexPosition, 1);
          }
        }
      });
      
      // Update state with sorted indices
      if (JSON.stringify(newIndices.sort((a, b) => a - b)) !== 
          JSON.stringify(visibleMessageIndices.sort((a, b) => a - b))) {
        setVisibleMessageIndices(newIndices.sort((a, b) => a - b));
      }
    }, options);
    
    // Observe all message elements
    Object.entries(messageRefs.current).forEach(([index, element]) => {
      if (element) {
        observer.observe(element);
      }
    });
    
    return () => observer.disconnect();
  }, [filteredMessages, isNavigating, visibleMessageIndices]);
  
  // Update current message index when visible messages change
  useEffect(() => {
    // Skip during active navigation
    if (isNavigating) return;
    
    if (visibleMessageIndices.length > 0) {
      // Use the message closest to the top of the viewport
      setCurrentMessageIndex(Math.min(...visibleMessageIndices));
    }
  }, [visibleMessageIndices, isNavigating]);
  
  // Fixed MathJax rendering to avoid infinite loops
  useEffect(() => {
    // Use a stable reference to the message length to avoid unnecessary renders
    const messagesLength = data.messages?.length || 0;
    const messagesRendered = !!messagesLength;
    
    if (window.MathJax && messagesRendered) {
      // Create a stable timeout that won't cause re-renders
      let timeoutId = null;
      
      const renderMathJax = () => {
        try {
          if (window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise()
              .catch(err => console.error('MathJax typesetting error:', err));
          }
        } catch (e) {
          console.error('MathJax error:', e);
        }
      };
      
      // Wait for DOM to settle before rendering
      timeoutId = setTimeout(renderMathJax, 500);
      
      return () => {
        if (timeoutId) clearTimeout(timeoutId);
      };
    }
  }, [data.messages ? data.messages.length : 0]); // Only depend on length, not the entire messages array

  // Display warnings about unknown message types (only in console)
  const logUnknownTypesWarning = () => {
    if (data.unknown_types) {
      // Log to console instead of displaying in UI
      console.info('Archive Parser Notice: This conversation contains message types that may have new or extended formats:', data.unknown_types);
    }
  };

  // Error state handling
  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={() => fetchPage(data.page || 1)}>
          Retry
        </Button>
      </Box>
    );
  }

  // Loading state handling - show when initialLoad or isLoading is true and no data is loaded yet
  if ((initialLoad || isLoading) && (!data.title || data.messages.length === 0)) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <LinearProgress sx={{ mb: 2 }} />
        <Box sx={{ mt: 2 }}>
          <Typography variant="body1">Loading conversation...</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontSize: '0.875rem' }}>
            If loading takes too long, try refreshing the page.
            The server may be rate-limited due to high traffic.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      overflow: 'hidden'
    }}>
      {/* Conversation Header */}
      <ConversationHeader 
        data={data} 
        expandedCanvasId={expandedCanvasId}
        setExpandedCanvasId={setExpandedCanvasId}
        logUnknownTypesWarning={logUnknownTypesWarning}
      />
      
      {/* Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', mb: 1 }}>
        <ConversationControls 
          conversationId={id}
          hasMedia={data.has_media}
          hideToolMessages={hideToolMessages}
          setHideToolMessages={setHideToolMessages}
          onPdfExport={handleOpenPdfExport}
          messages={filteredMessages}
        />
        
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {data.total_messages} total messages
          </Typography>
        </Box>
      </Box>
      
      {/* Gizmo Name Editor Dialog */}
      <GizmoNameEditor
        open={gizmoEditorOpen}
        onClose={() => setGizmoEditorOpen(false)}
        gizmoId={currentGizmo.id}
        currentName={currentGizmo.name}
        onNameChange={handleGizmoNameChange}
      />
      
      {/* Message list in scrollable container */}
      <div
        ref={scrollRef}
        className="scroll-container"
        style={{
          flex: 1,
          minHeight: 0,
          height: 'calc(100vh - 260px)', // Make container slightly smaller to ensure all content is visible
          maxHeight: 'calc(100vh - 260px)',
          overflow: 'auto',
          overscrollBehavior: 'contain',
          paddingRight: '16px',
          paddingLeft: '16px',
          paddingTop: '0', // Reduced top padding to fit navigation bar
          paddingBottom: '24px', // Extra bottom padding to ensure last item is fully visible
          marginBottom: '8px', // Reduced margin
          backgroundColor: '#f9f9f9',
          borderRadius: '4px',
          border: '1px solid #e0e0e0',
          WebkitOverflowScrolling: 'touch',
          position: 'relative', // For absolute positioning of loading indicator
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Message Navigation Bar */}
        <MessageNavigationBar 
          currentMessageIndex={currentMessageIndex}
          totalMessages={filteredMessages.length}
          onNavigate={handleNavigate}
          disabled={isLoading || loadingMore}
          sx={{ mb: 1 }}
        />

        {/* Loading indicator for initial load */}
        {isLoading && initialLoad && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <LinearProgress sx={{ mb: 2 }} />
            <Typography variant="body1">Loading conversation...</Typography>
          </Box>
        )}
        
        {/* Empty state */}
        {filteredMessages.length === 0 && !isLoading && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1">
              This conversation is empty or contains no messages.
            </Typography>
          </Box>
        )}
        
        {/* Message Items */}
        {filteredMessages.map((msg, index) => (
          <div 
            key={msg.id}
            ref={el => messageRefs.current[index] = el}
            data-message-index={index}
          >
            <MessageItem 
              msg={msg}
              getMediaPath={getMediaPath}
              openGizmoEditor={openGizmoEditor}
              conversationFolder={data.folder}
              onMediaClick={handleOpenMediaModal}
              isCurrent={index === currentMessageIndex}
              messageIndex={index}
              allMessages={filteredMessages}
            />
          </div>
        ))}
        
        {/* Load more indicator */}
        {hasMore && (
          <Box sx={{ textAlign: 'center', p: 2 }}>
            {loadingMore ? (
              <CircularProgress size={24} sx={{ mt: 1 }} />
            ) : (
              <Typography variant="body2" color="text.secondary">
                Scroll down to load more messages
              </Typography>
            )}
          </Box>
        )}
        
        {/* End of messages indicator */}
        {!hasMore && filteredMessages.length > 0 && (
          <Box sx={{ textAlign: 'center', p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              End of conversation
            </Typography>
          </Box>
        )}
      </div>
      
      {/* Media Modal */}
      <SimpleMediaModal 
        open={mediaModalOpen}
        onClose={handleCloseMediaModal}
        selectedMedia={selectedMedia}
        conversationFolder={data.folder}
      />
      
      {/* PDF Export Dialog */}
      <PDFExportDialog
        open={pdfExportDialogOpen}
        onClose={handleClosePdfExport}
        conversationData={{ ...data, id }}
        selectedMessages={selection.selectedMessages}
        exportType={pdfExportType}
      />
    </Box>
  );
}

// Main component wrapped with MessageSelectionProvider
export default function ConversationView() {
  return (
    <MessageSelectionProvider>
      <ConversationViewContent />
    </MessageSelectionProvider>
  );
}
