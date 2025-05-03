import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Box, Typography, Paper, Button, LinearProgress, Chip, Collapse, Pagination, FormControl, InputLabel, Select, MenuItem, Dialog, DialogContent, DialogTitle, IconButton, Alert } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import Markdown from './Markdown.jsx';
import ToolMessageRenderer from './ToolMessageRenderer';
import EnhancedToolMessageRenderer from './EnhancedToolMessageRenderer';
import CanvasRenderer from './CanvasRenderer';
import GizmoNameEditor from './GizmoNameEditor';
import { processLatexInText } from './latexUtils';

// Enhanced fetch API with proper error handling, timeouts, and auto-retry for 429 errors
function fetchAPI(url, options = {}) {
  // Apply default timeout of 30 seconds
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  
  // Default retry options
  const retryOptions = {
    maxRetries: options.maxRetries || 3,
    retryDelay: options.retryDelay || 1000,
    retryOn: options.retryOn || [429], // Retry on 429 Too Many Requests by default
    currentRetry: options.currentRetry || 0
  };
  
  // Merge provided options with defaults
  const fetchOptions = {
    ...options,
    signal: controller.signal,
    headers: {
      ...options.headers,
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  };
  
  return fetch(url, fetchOptions)
    .then(res => {
      clearTimeout(timeoutId);
      
      // Handle 429 Too Many Requests with exponential backoff
      if (retryOptions.retryOn.includes(res.status) && retryOptions.currentRetry < retryOptions.maxRetries) {
        // Get retry delay from header or use exponential backoff
        const retryAfter = res.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : 
                    retryOptions.retryDelay * Math.pow(2, retryOptions.currentRetry);
        
        console.log(`Rate limited (${res.status}). Retrying in ${delay}ms (attempt ${retryOptions.currentRetry + 1}/${retryOptions.maxRetries})`);
        
        // Retry with incremented retry count after delay
        return new Promise(resolve => setTimeout(resolve, delay))
          .then(() => fetchAPI(url, {
            ...options,
            maxRetries: retryOptions.maxRetries,
            retryDelay: retryOptions.retryDelay,
            retryOn: retryOptions.retryOn,
            currentRetry: retryOptions.currentRetry + 1
          }));
      }
      
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    })
    .catch(err => {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Request timed out or was aborted');
      }
      throw err;
    });
}

// Helper function to determine media type based on filename/extension
function determineMediaType(filename) {
  if (!filename) return 'unknown';
  
  const lowerExt = filename.toLowerCase();
  
  // Image formats
  if (lowerExt.endsWith('.jpg') || lowerExt.endsWith('.jpeg') || 
      lowerExt.endsWith('.png') || lowerExt.endsWith('.gif') || 
      lowerExt.endsWith('.webp') || lowerExt.endsWith('.svg')) {
    return 'image';
  }
  
  // Audio formats
  if (lowerExt.endsWith('.mp3') || lowerExt.endsWith('.wav') || 
      lowerExt.endsWith('.ogg') || lowerExt.endsWith('.m4a')) {
    return 'audio';
  }
  
  // Video formats
  if (lowerExt.endsWith('.mp4') || lowerExt.endsWith('.webm') || 
      lowerExt.endsWith('.mov')) {
    return 'video';
  }
  
  return 'unknown';
}

// Helper function to find the full filename in the media folder that contains a given file ID
async function findFullFilename(folder, fileId) {
  try {
    // This would be implemented on the server side in a real app
    // For now, we'll simulate by trying to fetch the media file directly
    const response = await fetch(`/api/media-file/${fileId}`);
    if (response.ok) {
      const data = await response.json();
      if (data.matches && data.matches.length > 0) {
        // Find the match for this conversation
        const match = data.matches.find(m => m.folder === folder);
        if (match) {
          return match.originalFilename;
        } else if (data.matches[0].originalFilename) {
          // Just use the first match if no specific conversation match
          return data.matches[0].originalFilename;
        }
      }
    }
    // Fallback - just use the file ID
    return fileId;
  } catch (error) {
    console.error('Error finding full filename:', error);
    return fileId;
  }
}

// Extract text content and media references from a message
function extractMessageContent(message) {
  if (!message || !message.content) {
    return { text: '', mediaRefs: [], segments: [], canvasIds: [] };
  }
  
  const content = message.content;
  const mediaRefs = [];
  let textContent = '';
  let segments = [];
  
  // Check for canvas IDs in metadata
  const canvasIds = [];
  if (message.metadata && message.metadata.canvas_id) {
    canvasIds.push(message.metadata.canvas_id);
  }
  
  // Check for canvas content
  if (content.content_type === 'canvas' && content.canvas_id) {
    canvasIds.push(content.canvas_id);
  }

  if (content.content_type === 'text') {
    // Simple text content
    const joinedText = Array.isArray(content.parts) ? content.parts.join('\n\n') : '';
    // Process LaTeX in the text content
    const processedContent = processLatexInText(joinedText);
    textContent = processedContent.text;
    segments = processedContent.segments;
  } 
  else if (content.content_type === 'multimodal_text') {
    // Mixed text and media
    let combinedText = '';
    if (Array.isArray(content.parts)) {
      content.parts.forEach(part => {
        if (typeof part === 'string') {
          combinedText += part + '\n\n';
        } else if (part && typeof part === 'object') {
          // Check for image asset pointers
          if (part.content_type === 'image_asset_pointer' && part.asset_pointer) {
            // Extract file ID from asset pointer
            const fileMatch = part.asset_pointer.match(/([^/\\]+)$/); // Get last part of path/URL
            if (fileMatch) {
              const fileId = fileMatch[1];
              // Extract the core file ID by removing any prefix/extension
              const coreFileId = fileId.match(/file[-_][A-Za-z0-9]+/) ? fileId.match(/file[-_][A-Za-z0-9]+/)[0] : fileId;
              
              // Check if we already have this file to avoid duplicates
              if (!mediaRefs.some(ref => {
                const refCoreId = ref.filename.match(/file[-_][A-Za-z0-9]+/) ? 
                  ref.filename.match(/file[-_][A-Za-z0-9]+/)[0] : ref.filename;
                return refCoreId === coreFileId;
              })) {
                const type = determineMediaType(fileId);
                mediaRefs.push({
                  type,
                  filename: fileId,
                  fileId: coreFileId, // Store the core ID for better comparison
                  width: part.width,
                  height: part.height
                });
              }
            }
          }
        }
      });
    }
    // Process LaTeX in the combined text
    const processedContent = processLatexInText(combinedText);
    textContent = processedContent.text;
    segments = processedContent.segments;
  }
  else if (content.content_type === 'code') {
    // Code block
    const language = content.language || '';
    const codeText = content.text || '';
    textContent = '```' + language + '\n' + codeText + '\n```';
  }

  // Check for attachments in metadata
  if (message.metadata && message.metadata.attachments && Array.isArray(message.metadata.attachments)) {
    message.metadata.attachments.forEach(attachment => {
      // Extract the core file ID for better comparison
      const coreAttachmentId = attachment.id && attachment.id.match(/file[-_][A-Za-z0-9]+/) ? 
        attachment.id.match(/file[-_][A-Za-z0-9]+/)[0] : attachment.id;
        
      // Check if this file is already in our mediaRefs array
      if (attachment.id && !mediaRefs.some(ref => {
        // Extract core ID from existing refs for comparison
        const refCoreId = ref.filename.match(/file[-_][A-Za-z0-9]+/) ? 
          ref.filename.match(/file[-_][A-Za-z0-9]+/)[0] : ref.filename;
        
        // Either the exact filename matches or the core ID matches
        return ref.filename === attachment.id || (refCoreId && refCoreId === coreAttachmentId);
      })) {
        // Determine media type based on mime_type or filename
        let type = 'unknown';
        
        if (attachment.mime_type) {
          // Determine from MIME type
          if (attachment.mime_type.startsWith('image/')) {
            type = 'image';
          } else if (attachment.mime_type.startsWith('audio/')) {
            type = 'audio';
          } else if (attachment.mime_type.startsWith('video/')) {
            type = 'video';
          }
        } else if (attachment.name) {
          // Try to determine from filename
          type = determineMediaType(attachment.name);
        }
        
        mediaRefs.push({
          type,
          filename: attachment.id,
          originalName: attachment.name,
          width: attachment.width,
          height: attachment.height
        });
      }
    });
  }

  return { 
    text: textContent.trim(),
    mediaRefs,
    segments,
    canvasIds
  };
}

function isLikelyToolJson(content) {
  if (typeof content !== 'string') return false;
  const trimmed = content.trim();
  return trimmed.startsWith('{') && (trimmed.length > 120 || trimmed.includes('\"') || trimmed.includes('\n'));
}

export default function ConversationView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState({ 
    messages: [], 
    total_messages: 0, 
    page: 1, 
    per_page: 10, 
    title: '', 
    create_time: '', 
    folder: '',
    canvas_ids: [] 
  });
  const [mediaFilenames, setMediaFilenames] = useState({});
  const [expandedCanvasId, setExpandedCanvasId] = useState(null);
  const [gizmoEditorOpen, setGizmoEditorOpen] = useState(false);
  const [currentGizmo, setCurrentGizmo] = useState({ id: '', name: '' });
  const [initialLoad, setInitialLoad] = useState(true);
  const [userPerPage, setUserPerPage] = useState(10); // User-controlled page size
  const [hideToolMessages, setHideToolMessages] = useState(false); // Toggle for tool and system messages
  
  // State for media modal
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [allMediaInConversation, setAllMediaInConversation] = useState([]);
  
  const scrollRef = useRef();
  const topRef = useRef();

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

  // Function to open media modal
  const handleOpenMediaModal = (media, mediaRefs) => {
    // Find all media in this conversation if not already loaded
    const allMedia = [];
    filteredMessages.forEach(msg => {
      const content = extractMessageContent(msg.message);
      if (content.mediaRefs && content.mediaRefs.length > 0) {
        content.mediaRefs.forEach(ref => {
          allMedia.push({
            ...ref,
            path: getMediaPath(ref.filename),
            conversationId: id,
            conversationTitle: data.title || 'Untitled'
          });
        });
      }
    });
    setAllMediaInConversation(allMedia);

    // Find the index of the selected media
    const index = mediaRefs.findIndex(ref => ref.filename === media.filename);
    setSelectedMedia({
      ...media,
      path: getMediaPath(media.filename),
      conversationId: id,
      conversationTitle: data.title || 'Untitled'
    });
    setCurrentMediaIndex(index);
    setMediaModalOpen(true);
  };

  // Navigate to next media in modal
  const handleNextMedia = () => {
    if (allMediaInConversation.length <= 1) return;
    
    const newIndex = (currentMediaIndex + 1) % allMediaInConversation.length;
    setCurrentMediaIndex(newIndex);
    setSelectedMedia(allMediaInConversation[newIndex]);
  };
  
  // Navigate to previous media in modal
  const handlePrevMedia = () => {
    if (allMediaInConversation.length <= 1) return;
    
    const newIndex = currentMediaIndex > 0 ? currentMediaIndex - 1 : allMediaInConversation.length - 1;
    setCurrentMediaIndex(newIndex);
    setSelectedMedia(allMediaInConversation[newIndex]);
  };

  // Close the media modal
  const handleCloseMediaModal = () => {
    setMediaModalOpen(false);
    setSelectedMedia(null);
  };

  // Load all media files in the conversation to map file IDs to full filenames
  // Function definition moved to useCallback above
  
  // Function to get the complete media path with fallbacks
  const getMediaPath = useCallback((filename) => {
    if (!data.folder) return '';
    
    // Try the mapped filename first, then fallback to the original
    const mappedFilename = mediaFilenames[filename] || filename;
    return `/api/media/${data.folder}/${mappedFilename}`;
  }, [data.folder, mediaFilenames]);
  
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
  
  // Ensure we don't trigger unnecessary re-renders when the folder changes
  const stableFolder = useMemo(() => data.folder, [data.folder]);

  // Optimized fetch with caching, error handling, and retry
  const fetchPage = useCallback((page) => {
    // Create an AbortController to cancel requests if component unmounts or new fetch starts
    const controller = new AbortController();
    const signal = controller.signal;
    
    // Store the controller so we can abort it if needed
    const prevController = fetchPage.controller;
    if (prevController) {
      prevController.abort(); // Cancel any in-flight request
    }
    fetchPage.controller = controller;
    
    // Show loading indicator if not initial load
    if (!initialLoad) {
      setData(prev => ({ ...prev, isLoading: true }));
    }
    
    // Use our enhanced fetchAPI with auto-retry
    fetchAPI(`/api/conversations/${id}?page=${page}&limit=${userPerPage}`, {
      signal,
      maxRetries: 3,
      retryDelay: 1000 // Start with 1 second, will increase exponentially
    })
    .then(res => {
      console.log('Received conversation data:', {
        title: res.title,
        folder: res.folder,
        hasMedia: res.has_media,
        messageCount: res.messages?.length || 0,
        initialLoad
      });
      
      // Always reset and use the data from the server directly
      // Never preserve metadata between conversations
      setData({ ...res, isLoading: false });
      window.currentConversationId = id;
      window.currentConversationFolder = res.folder;
      
      // After data is set, load media filenames
      if (res.folder) {
        console.log('Loading media for folder:', res.folder);
        // Use setTimeout to avoid state updates during rendering
        setMediaFilenames({}); // Clear existing filenames first
        setTimeout(() => loadMediaFilenames(res.folder), 100);
      }
      
      // Scroll to top of messages on page change, but not on initial load
      if (!initialLoad && scrollRef.current) {
        scrollRef.current.scrollTop = 0;
        // Also scroll the page to the top pagination controls
        if (topRef.current) {
          topRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }
      setInitialLoad(false);
    })
    .catch(err => {
      // Only show error if not aborted
      if (err.name !== 'AbortError') {
        console.error('Error fetching conversation:', err);
        setData(prev => ({ ...prev, isLoading: false, error: err.message }));
      }
    });
    
    // Cleanup function to cancel request if component unmounts
    return () => {
      controller.abort();
    };
  }, [id, userPerPage, initialLoad]);
  
  // Use stable folder to prevent unnecessary re-renders and infinite loops
  const loadMediaFilenames = useCallback(async (folder) => {
    // Use stableFolder from the component state if no folder is provided
    const folderToUse = folder || stableFolder;
    if (!folderToUse) return; // Guard against empty folder
    
    try {
      console.log('Loading media filenames for folder:', folderToUse);
      const data = await fetchAPI(`/api/media/${folderToUse}`, {
        maxRetries: 2, // Fewer retries for media filenames
        retryDelay: 500 // Start with half a second
      });
      
      if (data && Array.isArray(data)) {
        // Create a map of partial file IDs to full filenames
        const filenameMap = {};
        data.forEach(file => {
          // Extract the file ID from the filename
          const fileIdMatch = file.match(/file[-_][\w\d]+/);
          if (fileIdMatch) {
            const fileId = fileIdMatch[0];
            filenameMap[fileId] = file;
          }
          // Also add the full filename as a key
          filenameMap[file] = file;
        });
        setMediaFilenames(filenameMap);
        console.log('Media filenames loaded:', Object.keys(filenameMap).length);
      }
    } catch (error) {
      console.error('Error loading media filenames:', error);
      // Non-critical error, just log it
    }
  }, [stableFolder]);
  
  // Handle page size change with improved error handling and retry
  const handlePerPageChange = useCallback((event) => {
    const newPerPage = parseInt(event.target.value);
    setUserPerPage(newPerPage);
    
    // Show loading indicator
    setData(prev => ({ ...prev, isLoading: true }));
    
    // Create an AbortController to cancel requests if component unmounts or new fetch starts
    const controller = new AbortController();
    const signal = controller.signal;
    
    // Store the controller so we can abort it if needed
    const prevController = handlePerPageChange.controller;
    if (prevController) {
      prevController.abort(); // Cancel any in-flight request
    }
    handlePerPageChange.controller = controller;
    
    // Reset to page 1 when changing page size
    fetchAPI(`/api/conversations/${id}?page=1&limit=${newPerPage}`, {
      signal,
      maxRetries: 3,
      retryDelay: 1000 // Start with 1 second, will increase exponentially
    })
    .then(res => {
      // Always use the data from the response directly when changing page size
      setData({ ...res, isLoading: false });
      window.currentConversationId = id;
      window.currentConversationFolder = res.folder;
      
      if (res.folder) {
        // Use setTimeout to avoid state updates during rendering
        setMediaFilenames({}); // Clear existing filenames first
        setTimeout(() => loadMediaFilenames(res.folder), 100);
      }
      // Ensure we reset the scroll position
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
    })
    .catch(err => {
      // Only show error if not aborted
      if (err.name !== 'AbortError') {
        console.error('Error changing page size:', err);
        setData(prev => ({ ...prev, isLoading: false, error: err.message }));
      }
    });
    
    return () => {
      controller.abort();
    };
  }, [id]);

  // Restart the component when conversation changes
  useEffect(() => {
    // This is a key component reset effect that runs when the ID changes
    console.log('Conversation ID changed to:', id);
    
    // Reset all state completely
    setInitialLoad(true);
    setData({
      messages: [], 
      total_messages: 0, 
      page: 1, 
      per_page: 10, 
      title: null,
      create_time: null, 
      folder: null,
      canvas_ids: [],
      isLoading: true,
      error: null
    });
    setMediaFilenames({});
    setAllMediaInConversation([]);
    setExpandedCanvasId(null);
    
    // Fetch the first page of the new conversation
    // Wait a short moment to ensure all state is reset
    const timeoutId = setTimeout(() => {
      fetchPage(1);
    }, 50);
    
    return () => clearTimeout(timeoutId);
  }, [id]); // Only depend on conversation ID
  
  // Add stability and handle scroll initialization issues
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
      
      // Set pointer events to fix any touch/mouse interaction issues
      currentScrollRef.style.touchAction = 'pan-y';
      currentScrollRef.style.WebkitOverflowScrolling = 'touch'; // Add momentum scrolling for iOS
      
      return () => {
        // Use the captured reference in cleanup to avoid accessing a possibly null ref
        currentScrollRef.removeEventListener('mousedown', preventDefault);
        currentScrollRef.removeEventListener('touchstart', handleTouchStart);
        currentScrollRef.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, []);

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
  // This is now handled in fetchPage

  // Filter out empty system messages and optionally tool messages
  let filteredMessages = [];
  if (Array.isArray(data.messages)) {
    let firstUserIdx = data.messages.findIndex(msg => 
      msg.message && msg.message.author && msg.message.author.role === 'user'
    );
    if (firstUserIdx !== -1) {
      filteredMessages = data.messages.slice(firstUserIdx);
      
      // Always filter out empty system messages
      filteredMessages = [filteredMessages[0]].concat(
        filteredMessages.slice(1).filter(msg => {
          // Skip empty system messages
          if (msg.message?.author?.role === 'system' && 
              (!msg.message.content || !msg.message.content.parts || msg.message.content.parts.length === 0)) {
            return false;
          }
          
          // Hide tool or system messages if enabled
          if (hideToolMessages) {
            if (msg.message?.author?.role === 'tool' || msg.message?.author?.role === 'system') {
              return false;
            }
          }
          
          return true;
        })
      );
    } else {
      // If no user message found, just use all messages
      filteredMessages = data.messages;
      
      // If hiding tool/system messages, filter those out
      if (hideToolMessages) {
        filteredMessages = filteredMessages.filter(msg => 
          msg.message?.author?.role !== 'tool' && msg.message?.author?.role !== 'system'
        );
      }
    }
  }
  
  // If hiding tool/system messages, we need to check for references in assistant messages
  // and ensure their media gets displayed in the assistant message
  if (hideToolMessages) {
    // Create a map of media references from hidden messages
    const mediaByAssistantMsg = {};
    
    // First pass: find all tool messages with media and map them to the preceding assistant message
    let lastAssistantId = null;
    data.messages?.forEach(msg => {
      if (msg.message?.author?.role === 'assistant') {
        lastAssistantId = msg.id;
      } else if ((msg.message?.author?.role === 'tool' || msg.message?.author?.role === 'system') && lastAssistantId) {
        // Extract any media from tool messages
        const content = extractMessageContent(msg.message);
        if (content.mediaRefs && content.mediaRefs.length > 0) {
          if (!mediaByAssistantMsg[lastAssistantId]) {
            mediaByAssistantMsg[lastAssistantId] = [];
          }
          mediaByAssistantMsg[lastAssistantId].push(...content.mediaRefs);
        }
      }
    });
    
    // Second pass: add tool media to assistant messages
    filteredMessages = filteredMessages.map(msg => {
      if (msg.message?.author?.role === 'assistant' && mediaByAssistantMsg[msg.id]) {
        // Clone the message to avoid mutating the original
        const msgClone = {...msg};
        
        // Get the current content with media refs
        const content = extractMessageContent(msgClone.message);
        
        // Add the media from hidden messages to the assistant message
        msgClone.toolMedia = mediaByAssistantMsg[msg.id];
        
        return msgClone;
      }
      return msg;
    });
  }

  // Display warnings about unknown message types (only in console)
  const logUnknownTypesWarning = () => {
    if (data.unknown_types) {
      // Log to console instead of displaying in UI
      console.info('Archive Parser Notice: This conversation contains message types that may have new or extended formats:', data.unknown_types);
    }
  };
  
  // Display conversation canvas IDs at the top level
  const renderCanvasSummary = () => {
    if (!data.canvas_ids || data.canvas_ids.length === 0) return null;
    
    return (
      <Box sx={{ mb: 2, p: 1, bgcolor: '#f0f7ff', borderRadius: 1 }}>
        <Typography variant="subtitle2">Canvas Content:</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
          {data.canvas_ids.map(canvasId => (
            <Chip 
              key={canvasId}
              label={`Canvas: ${canvasId.substring(0, 8)}...`}
              onClick={() => setExpandedCanvasId(expandedCanvasId === canvasId ? null : canvasId)}
              color={expandedCanvasId === canvasId ? "primary" : "default"}
              variant="outlined"
            />
          ))}
        </Box>
        
        {expandedCanvasId && (
          <Collapse in={!!expandedCanvasId}>
            <Box sx={{ mt: 2 }}>
              <CanvasRenderer 
                canvasId={expandedCanvasId}
                conversationFolder={data.folder}
              />
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };

  if (!data.title && data.error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {data.error}
        </Alert>
        <Button variant="contained" onClick={() => fetchPage(1)}>
          Retry
        </Button>
      </Box>
    );
  }

  if (!data.title) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <LinearProgress sx={{ mb: 2 }} />
        <Typography sx={{ mt: 2 }} variant="body1">
          Loading conversation...
        </Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>
          If loading takes too long, try refreshing the page.
          The server may be rate-limited due to high traffic.
        </Typography>
      </Box>
    );
  }

  // Extract unique gizmo IDs and models from messages
  const gizmoIds = Array.from(new Set((data.messages || []).map(m => 
    m.message?.metadata?.gizmo_id).filter(Boolean)));
  const modelNames = Array.from(new Set((data.messages || []).map(m => 
    m.message?.metadata?.model_slug).filter(Boolean)));

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      overflow: 'hidden'
    }}>
      <Box sx={{ 
        position: 'sticky', 
        top: 0, 
        bgcolor: 'background.paper', 
        zIndex: 6, /* Higher than pagination */
        pb: 1,
        mb: 1, 
        borderBottom: '1px solid #eee'
      }}>
        <Typography variant="h5">{data.title || id}</Typography>
        <Typography variant="subtitle2" color="text.secondary">
          {data.create_time ? new Date(data.create_time * 1000).toISOString().split('T')[0] : ''}
          <span style={{ color: '#777', marginLeft: '10px' }}>
            ID: {id}
          </span>
        </Typography>
        {/* Gizmo IDs and Models */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {gizmoIds.length > 0 && (
            <Typography variant="subtitle2" color="text.secondary">Gizmo ID(s): {gizmoIds.join(', ')}</Typography>
          )}
          {modelNames.length > 0 && (
            <Typography variant="subtitle2" color="text.secondary">Model(s): {modelNames.join(', ')}</Typography>
          )}
        </Box>
        
        {/* Log unknown types to console instead of showing in UI */}
        {data.unknown_types && logUnknownTypesWarning()}
        
        {/* Display canvas summary */}
        {renderCanvasSummary()}
      </Box>
      
      {/* Controls and View Media button */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        flexWrap: 'wrap', 
        mb: 1, 
        gap: 1,
        mt: 0
      }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {data.has_media && (
            <Button 
              variant="outlined" 
              onClick={() => navigate('/media', { state: { conversationId: id } })}
              size="small"
            >
              View Conversation Media
            </Button>
          )}
          
          {/* Tool and system message toggle */}
          <Box sx={{ display: 'flex', alignItems: 'center' }} title="Hides technical tool output and system messages while preserving any media they contain">
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
        
        {/* Page size control */}
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, zIndex: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="body2" sx={{ mb: 0.5 }}>Messages per page</Typography>
            <Select
              size="small" 
              value={userPerPage}
              onChange={handlePerPageChange}
              sx={{ minWidth: 100 }}
            >
              <MenuItem value={5}>5</MenuItem>
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={25}>25</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
            </Select>
          </Box>
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
      
      {/* Top pagination controls */}
      {data.total_messages > userPerPage && (
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            mb: 1,
            overflow: 'hidden',
            position: 'sticky',
            top: '0',
            zIndex: 5,
            backgroundColor: 'white',
            borderBottom: '1px solid #eee',
            pb: 1,
            '& .MuiPagination-ul': {
              display: 'flex',
              width: '100%',
              justifyContent: 'center',
              '& .MuiPaginationItem-root': {
                margin: '0 2px' // Reduce margins between pagination items
              }
            }
          }}
          ref={topRef}
        >
          <Pagination 
            count={Math.ceil(data.total_messages / userPerPage)} 
            page={data.page} 
            onChange={(e, page) => fetchPage(page)}
            size="small"
            siblingCount={1}           // Reduce sibling count to save space
            boundaryCount={1}          // Reduce boundary count to save space
            showFirstButton
            showLastButton
          />
        </Box>
      )}
      
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
          overflowY: 'scroll', // Always show scrollbar for consistency
          overscrollBehavior: 'contain',
          paddingRight: '16px',
          paddingLeft: '16px',
          paddingTop: '8px',
          paddingBottom: '24px', // Extra bottom padding to ensure last item is fully visible
          marginBottom: '8px', // Reduced margin
          backgroundColor: '#f9f9f9',
          borderRadius: '4px',
          border: '1px solid #e0e0e0',
          WebkitOverflowScrolling: 'touch',
          position: 'relative' // For absolute positioning of loading indicator
        }}
        onTouchStart={() => {
          if (scrollRef.current) {
            scrollRef.current.classList.add('no-select-during-scroll');
          }
        }}
        onTouchEnd={() => {
          if (scrollRef.current) {
            scrollRef.current.classList.remove('no-select-during-scroll');
          }
        }}
      >
        {/* Loading indicator */}
        {data.isLoading && (
          <Box sx={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            zIndex: 10 
          }}>
            <LinearProgress />
          </Box>
        )}
        {filteredMessages.map(msg => {
          // Extract message info from the JSON structure
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
          
          return (
            <Paper key={msg.id} sx={{ p: 2, my: 1, backgroundColor: bgColor, position: 'relative', textAlign: 'left' }}>
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
              
              {/* Render message content */}
              {role === 'tool' ? (
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
                          conversationFolder={data.folder}
                        />
                      ))}
                    </Box>
                  )}
                </>
              )}
              
              {/* Render media attachments if any */}
              {(content.mediaRefs.length > 0 || msg.toolMedia) && (
                <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {/* Render regular media refs */}
                  {content.mediaRefs.map((media, index) => (
                    <Box 
                      key={index} 
                      sx={{ 
                        maxWidth: '100%', 
                        maxHeight: '300px',
                        cursor: 'pointer', // Add cursor pointer to indicate clickable
                        '&:hover': {
                          opacity: 0.9,
                          boxShadow: '0 0 5px rgba(0,0,0,0.2)'
                        },
                      }}
                      onClick={() => handleOpenMediaModal(media, content.mediaRefs)}
                    >
                      {media.type === 'image' ? (
                        <img 
                          src={getMediaPath(media.filename)} 
                          alt="Attachment" 
                          style={{ maxWidth: '100%', maxHeight: '300px' }}
                          onError={(e) => {
                            console.log('Image error, trying direct path:', media.filename);
                            // Try a fallback if the image fails to load
                            e.target.src = `/api/media/${data.folder}/${media.filename}`;
                          }}
                        />
                      ) : media.type === 'audio' ? (
                        <Box sx={{ p: 2, textAlign: 'center', bgcolor: '#f0f7ff', borderRadius: 1, minWidth: 250 }}>
                          <Typography variant="subtitle2" color="primary" gutterBottom>
                            Audio File
                          </Typography>
                          <audio 
                            controls 
                            src={getMediaPath(media.filename)} 
                            style={{ width: '100%' }} 
                            onClick={(e) => e.stopPropagation()} // Prevent modal open when clicking the audio controls
                            onError={(e) => {
                              console.log('Audio error, trying direct path:', media.filename);
                              // Try a fallback if the audio fails to load
                              e.target.src = `/api/media/${data.folder}/${media.filename}`;
                            }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {media.filename}
                          </Typography>
                        </Box>
                      ) : media.type === 'video' ? (
                        <Box sx={{ p: 2, textAlign: 'center', bgcolor: '#fdf7ff', borderRadius: 1, minWidth: 250 }}>
                          <Typography variant="subtitle2" color="primary" gutterBottom>
                            Video File
                          </Typography>
                          <video 
                            controls 
                            src={getMediaPath(media.filename)}
                            style={{ maxWidth: '100%', maxHeight: '200px' }} 
                            onClick={(e) => e.stopPropagation()} // Prevent modal open when clicking the video controls
                            onError={(e) => {
                              console.log('Video error, trying direct path:', media.filename);
                              // Try a fallback if the video fails to load
                              e.target.src = `/api/media/${data.folder}/${media.filename}`;
                            }}
                          />
                        </Box>
                      ) : (
                        <Box sx={{ p: 1, border: '1px solid #eee', borderRadius: 1 }}>
                          <Typography variant="caption">{media.filename}</Typography>
                        </Box>
                      )}
                    </Box>
                  ))}
                  
                  {/* Render tool media if we're hiding tool messages but displaying their media */}
                  {msg.toolMedia && msg.toolMedia.map((media, index) => (
                    <Box 
                      key={`tool-media-${index}`} 
                      sx={{ 
                        maxWidth: '100%', 
                        maxHeight: '300px',
                        cursor: 'pointer',
                        '&:hover': {
                          opacity: 0.9,
                          boxShadow: '0 0 5px rgba(0,0,0,0.2)'
                        },
                        position: 'relative'
                      }}
                      onClick={() => handleOpenMediaModal(media, msg.toolMedia)}
                    >
                      {/* Add a small indicator that this is from a tool */}
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
                      
                      {media.type === 'image' ? (
                        <img 
                          src={getMediaPath(media.filename)} 
                          alt="Tool Attachment" 
                          style={{ maxWidth: '100%', maxHeight: '300px' }}
                          onError={(e) => {
                            console.log('Tool image error, trying direct path:', media.filename);
                            e.target.src = `/api/media/${data.folder}/${media.filename}`;
                          }}
                        />
                      ) : media.type === 'audio' ? (
                        <Box sx={{ p: 2, textAlign: 'center', bgcolor: '#f0f7ff', borderRadius: 1, minWidth: 250 }}>
                          <Typography variant="subtitle2" color="primary" gutterBottom>
                            Audio File (from Hidden Message)
                          </Typography>
                          <audio 
                            controls 
                            src={getMediaPath(media.filename)} 
                            style={{ width: '100%' }} 
                            onClick={(e) => e.stopPropagation()}
                            onError={(e) => {
                              console.log('Tool audio error, trying direct path:', media.filename);
                              e.target.src = `/api/media/${data.folder}/${media.filename}`;
                            }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {media.filename}
                          </Typography>
                        </Box>
                      ) : media.type === 'video' ? (
                        <Box sx={{ p: 2, textAlign: 'center', bgcolor: '#fdf7ff', borderRadius: 1, minWidth: 250 }}>
                          <Typography variant="subtitle2" color="primary" gutterBottom>
                            Video File (from Hidden Message)
                          </Typography>
                          <video 
                            controls 
                            src={getMediaPath(media.filename)}
                            style={{ maxWidth: '100%', maxHeight: '200px' }} 
                            onClick={(e) => e.stopPropagation()}
                            onError={(e) => {
                              console.log('Tool video error, trying direct path:', media.filename);
                              e.target.src = `/api/media/${data.folder}/${media.filename}`;
                            }}
                          />
                        </Box>
                      ) : (
                        <Box sx={{ p: 1, border: '1px solid #eee', borderRadius: 1 }}>
                          <Typography variant="caption">{media.filename} (from Hidden Message)</Typography>
                        </Box>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>
          );
        })}
      </div>
      
      {/* Remove bottom pagination controls, only keep the top ones */}
      
      {/* Media Details Dialog */}
      {selectedMedia && (
        <Dialog 
          open={mediaModalOpen} 
          onClose={handleCloseMediaModal}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" noWrap sx={{ maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {selectedMedia.originalName || selectedMedia.filename}
            </Typography>
            <Box>
              <Button onClick={handleCloseMediaModal}>Close</Button>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ position: 'relative', pb: 0 }}>
            {/* Navigation Arrows */}
            {allMediaInConversation.length > 1 && (
              <>
                <IconButton 
                  onClick={handlePrevMedia}
                  sx={{ 
                    position: 'absolute', 
                    left: 10, 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    backgroundColor: 'rgba(255,255,255,0.5)',
                    '&:hover': {
                      backgroundColor: 'rgba(255,255,255,0.8)'
                    },
                    zIndex: 10
                  }}
                >
                  &lt;
                </IconButton>
                <IconButton 
                  onClick={handleNextMedia}
                  sx={{ 
                    position: 'absolute', 
                    right: 10, 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    backgroundColor: 'rgba(255,255,255,0.5)',
                    '&:hover': {
                      backgroundColor: 'rgba(255,255,255,0.8)'
                    },
                    zIndex: 10 
                  }}
                >
                  &gt;
                </IconButton>
              </>
            )}
            
            {/* Media Content */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 2 }}>
              {selectedMedia.type === 'image' ? (
                <img 
                  src={selectedMedia.path} 
                  alt={selectedMedia.filename} 
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '70vh',
                    objectFit: 'contain'
                  }}
                  onError={(e) => {
                    console.log('Modal image error, trying direct path:', selectedMedia.filename);
                    // Try a fallback if the image fails to load
                    e.target.src = `/api/media/${data.folder}/${selectedMedia.filename}`;
                  }}
                />
              ) : selectedMedia.type === 'audio' ? (
                <Box sx={{ textAlign: 'center', p: 3, bgcolor: '#f0f7ff', borderRadius: 2, width: '100%' }}>
                  <Typography variant="h6" color="primary" gutterBottom>
                    Audio File
                  </Typography>
                  <audio 
                    controls 
                    src={selectedMedia.path} 
                    style={{ width: '100%' }}
                    onError={(e) => {
                      console.log('Modal audio error, trying direct path:', selectedMedia.filename);
                      // Try a fallback if the audio fails to load
                      e.target.src = `/api/media/${data.folder}/${selectedMedia.filename}`;
                    }}
                  />
                </Box>
              ) : selectedMedia.type === 'video' ? (
                <Box sx={{ textAlign: 'center', p: 3, width: '100%' }}>
                  <video 
                    controls 
                    src={selectedMedia.path}
                    style={{ maxWidth: '100%', maxHeight: '70vh' }}
                    onError={(e) => {
                      console.log('Modal video error, trying direct path:', selectedMedia.filename);
                      // Try a fallback if the video fails to load
                      e.target.src = `/api/media/${data.folder}/${selectedMedia.filename}`;
                    }}
                  />
                </Box>
              ) : (
                <Typography variant="body1">
                  {selectedMedia.type || 'Unknown'} File
                </Typography>
              )}
            </Box>
            
            {/* Details Panel */}
            <Box sx={{ 
              mt: 2, 
              p: 2, 
              backgroundColor: '#f5f5f5',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              fontSize: '0.875rem'
            }}>
              <Box sx={{ minWidth: '200px', flex: 1 }}>
                <Typography variant="subtitle2">File ID</Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                  {selectedMedia.filename}
                </Typography>
              </Box>
              
              {selectedMedia.originalName && (
                <Box sx={{ minWidth: '200px', flex: 1 }}>
                  <Typography variant="subtitle2">Original Filename</Typography>
                  <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                    {selectedMedia.originalName}
                  </Typography>
                </Box>
              )}
              
              <Box sx={{ minWidth: '200px', flex: 2 }}>
                <Typography variant="subtitle2">From Conversation</Typography>
                <Box 
                  component={Button}
                  onClick={() => {
                    handleCloseMediaModal();
                    navigate(`/conversations/${selectedMedia.conversationId}`);
                  }}
                  sx={{ 
                    textAlign: 'left',
                    p: 0,
                    textTransform: 'none',
                    justifyContent: 'flex-start',
                    fontWeight: 'normal',
                    textDecoration: 'underline',
                    color: 'primary.main'
                  }}>
                  {selectedMedia.conversationTitle || 'Untitled'}
                </Box>
              </Box>
            </Box>
          </DialogContent>
        </Dialog>
      )}
    </Box>
  );
}