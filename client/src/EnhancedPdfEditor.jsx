import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Paper,
  Grid,
  IconButton,
  Tabs,
  Tab,
  Card,
  CardContent,
  Slider,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Menu,
  MenuList,
  MenuItem as MenuItemComponent,
  Divider,
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  TextFields as TextIcon,
  Crop as CropIcon,
  Rectangle as RectangleIcon,
  Circle as CircleIcon,
  Image as ImageIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Save as SaveIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Settings as SettingsIcon,
  Palette as PaletteIcon,
  FormatBold as BoldIcon,
  FormatItalic as ItalicIcon,
  FormatUnderlined as UnderlineIcon,
  FormatAlignLeft as AlignLeftIcon,
  FormatAlignCenter as AlignCenterIcon,
  FormatAlignRight as AlignRightIcon,
  FormatAlignJustify as AlignJustifyIcon,
  ExpandMore as ExpandMoreIcon,
  Folder as FolderIcon,
  FontDownload as FontIcon,
  Layers as LayersIcon,
  GridOn as GridIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon
} from '@mui/icons-material';

// Utility function to add delays between API calls
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const EnhancedPdfEditor = () => {
  const { conversationId } = useParams();
  const [searchParams] = useSearchParams();
  // Core state
  const [document, setDocument] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedElement, setSelectedElement] = useState(null);
  const [selectedTool, setSelectedTool] = useState('select');
  const [zoom, setZoom] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Font management state
  const [availableFonts, setAvailableFonts] = useState([]);
  const [selectedFont, setSelectedFont] = useState('Helvetica');
  const [fontSize, setFontSize] = useState(12);
  const [fontWeight, setFontWeight] = useState('normal');
  const [fontStyle, setFontStyle] = useState('normal');
  const [textColor, setTextColor] = useState('#000000');
  const [textAlign, setTextAlign] = useState('left');

  // UI state
  const [activeTab, setActiveTab] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [propertyPanelOpen, setPropertyPanelOpen] = useState(true);
  const [layerPanelOpen, setLayerPanelOpen] = useState(true);
  const [fontDialogOpen, setFontDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Refs
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // API base URL
  const API_BASE = '/api/enhanced-pdf';

  // Initialize editor
  useEffect(() => {
    const source = searchParams.get('source');
    console.log('EnhancedPdfEditor: useEffect initialization', {
      conversationId,
      source,
      searchParams: Object.fromEntries(searchParams.entries()),
      currentURL: window.location.href
    });
    
    if (source === 'collected') {
      console.log('EnhancedPdfEditor: Taking collected messages path');
      createFromCollectedMessages();
    } else if (conversationId) {
      console.log('EnhancedPdfEditor: Taking single conversation path', { conversationId });
      createFromConversation();
    } else {
      console.log('EnhancedPdfEditor: Taking new document path');
      createNewDocument();
    }
    loadFonts();
  }, [conversationId, searchParams]);

  // API calls
  const apiCall = useCallback(async (endpoint, options = {}) => {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      setError(error.message);
      throw error;
    }
  }, []);

  const createNewDocument = async () => {
    setLoading(true);
    try {
      const response = await apiCall('/documents', {
        method: 'POST',
        body: JSON.stringify({
          title: 'New Document',
          size: 'A4',
          orientation: 'portrait'
        })
      });
      setDocument(response.document);
      setSuccess('Document created successfully');
    } catch (error) {
      setError('Failed to create document');
    } finally {
      setLoading(false);
    }
  };

  const createFromConversation = async () => {
    setLoading(true);
    try {
      const response = await apiCall(`/from-conversation/${conversationId}`, {
        method: 'POST',
        body: JSON.stringify({
          template: 'conversation',
          options: { includeMetadata: true }
        })
      });
      setDocument(response.document);
      setSuccess('Document created from conversation');
    } catch (error) {
      setError('Failed to create document from conversation');
    } finally {
      setLoading(false);
    }
  };

  const createFromCollectedMessages = async () => {
    setLoading(true);
    try {
      // Get collected messages from sessionStorage
      const collectedMessages = JSON.parse(sessionStorage.getItem('documentBuilder_messages') || '[]');
      const collectedConversations = JSON.parse(sessionStorage.getItem('documentBuilder_conversations') || '[]');
      
      console.log('EnhancedPdfEditor: createFromCollectedMessages', {
        collectedMessagesLength: collectedMessages.length,
        collectedConversationsLength: collectedConversations.length,
        sessionStorageKeys: Object.keys(sessionStorage),
        collectedMessagesPreview: collectedMessages.slice(0, 3).map(m => ({
          id: m.id,
          conversationId: m.conversationId,
          hasContent: !!m.content
        }))
      });
      
      if (collectedMessages.length === 0) {
        console.error('EnhancedPdfEditor: No collected messages found in sessionStorage');
        throw new Error('No collected messages found');
      }

      // Create a new document
      const response = await apiCall('/documents', {
        method: 'POST',
        body: JSON.stringify({
          title: `Collected Messages Document (${collectedConversations.length} conversations)`,
          template: 'multi-conversation',
          pageFormat: 'A4'
        })
      });

      // Process collected messages into document elements
      let yPosition = 100;
      const pageWidth = 595;
      const pageHeight = 842; // A4 height in points
      const margins = { left: 72, right: 72, top: 72, bottom: 72 };
      const contentWidth = pageWidth - margins.left - margins.right;
      const maxContentHeight = pageHeight - margins.top - margins.bottom;
      let currentPageIndex = 0;
      
      // Helper function to create new page when content overflows
      const createNewPageIfNeeded = async (requiredHeight = 50) => {
        if (yPosition + requiredHeight > maxContentHeight) {
          console.log('EnhancedPdfEditor: Creating new page due to content overflow', {
            currentYPosition: yPosition,
            requiredHeight,
            maxContentHeight,
            currentPageIndex
          });
          
          // Add new page to document
          const newPageResponse = await apiCall(`/documents/${response.document.id}/pages`, {
            method: 'POST',
            body: JSON.stringify({
              size: 'A4',
              orientation: 'portrait',
              margins: margins,
              background: { color: '#ffffff' }
            })
          });
          
          // Add delay after page creation
          await delay(200);
          
          if (newPageResponse.success) {
            response.document.pages.push(newPageResponse.page);
            currentPageIndex = response.document.pages.length - 1;
            yPosition = margins.top + 20; // Reset Y position for new page
            console.log('EnhancedPdfEditor: New page created successfully', {
              newPageId: newPageResponse.page.id,
              currentPageIndex,
              resetYPosition: yPosition
            });
          }
        }
      };

      // Group messages by conversation
      const messagesByConversation = collectedMessages.reduce((acc, message) => {
        if (!acc[message.conversationId]) {
          acc[message.conversationId] = {
            title: message.conversationTitle,
            messages: []
          };
        }
        acc[message.conversationId].messages.push(message);
        return acc;
      }, {});

      // Add content for each conversation
      for (const [conversationId, convData] of Object.entries(messagesByConversation)) {
        // Add conversation title
        try {
          await createNewPageIfNeeded(35); // Check if we need new page for title
          
          console.log('EnhancedPdfEditor: Adding conversation title element', {
            conversationId,
            title: convData.title,
            yPosition,
            documentId: response.document.id,
            pageId: response.document.pages[currentPageIndex].id,
            currentPageIndex
          });
          
          const titleResponse = await apiCall(`/documents/${response.document.id}/pages/${response.document.pages[currentPageIndex].id}/elements`, {
            method: 'POST',
            body: JSON.stringify({
              type: 'text',
              content: convData.title,
              bounds: { x: margins.left, y: yPosition, width: contentWidth, height: 25 },
              style: {
                fontFamily: 'Helvetica',
                fontSize: 16,
                fontWeight: 'bold',
                color: '#1976D2'
              }
            })
          });
          
          // Add delay to prevent rate limiting
          await delay(150);
          
          console.log('EnhancedPdfEditor: Conversation title element added successfully', {
            response: titleResponse,
            success: titleResponse.success
          });
        } catch (error) {
          console.error('EnhancedPdfEditor: Failed to add conversation title element', {
            error: error.message,
            conversationId,
            title: convData.title
          });
        }
        yPosition += 35;

        // Add messages
        console.log('EnhancedPdfEditor: Processing messages for conversation', {
          conversationId,
          messageCount: convData.messages.length,
          messages: convData.messages.slice(0, 3).map(m => ({
            id: m.id,
            hasContent: !!m.content,
            contentType: typeof m.content,
            hasParts: !!(m.content && m.content.parts),
            partsLength: m.content?.parts?.length,
            authorRole: m.author?.role,
            actualContent: JSON.stringify(m.content, null, 2),
            messageStructure: Object.keys(m)
          }))
        });
        
        for (const message of convData.messages) {
          console.log('EnhancedPdfEditor: Processing individual message', {
            messageId: message.id,
            hasContent: !!message.message?.content,
            contentStructure: message.message?.content ? Object.keys(message.message.content) : null,
            hasParts: !!(message.message?.content && message.message.content.parts),
            partsCount: message.message?.content?.parts?.length || 0,
            parts: message.message?.content?.parts?.slice(0, 2), // First 2 parts for debugging
            authorRole: message.message?.author?.role
          });
          
          if (message.message?.content && message.message.content.parts) {
            console.log('EnhancedPdfEditor: Message has content and parts, processing...');
            for (const part of message.message.content.parts) {
              console.log('EnhancedPdfEditor: Processing message part', {
                partType: typeof part,
                isString: typeof part === 'string',
                hasContent: typeof part === 'string' && part.trim().length > 0,
                partLength: typeof part === 'string' ? part.length : 'not string',
                partPreview: typeof part === 'string' ? part.substring(0, 100) + '...' : part,
                isImageAsset: part && typeof part === 'object' && part.content_type === 'image_asset_pointer',
                hasAssetPointer: part && typeof part === 'object' && part.asset_pointer
              });
              
              // Handle image content
              if (part && typeof part === 'object' && part.content_type === 'image_asset_pointer' && part.asset_pointer) {
                try {
                  const imageHeight = 200; // Standard image height
                  await createNewPageIfNeeded(imageHeight + 30);
                  
                  console.log('EnhancedPdfEditor: Adding image element', {
                    messageId: message.id,
                    imageUrl: part.asset_pointer.url,
                    imageWidth: part.asset_pointer.width,
                    imageHeight: part.asset_pointer.height,
                    yPosition,
                    currentPageIndex
                  });
                  
                  const imageResponse = await apiCall(`/documents/${response.document.id}/pages/${response.document.pages[currentPageIndex].id}/elements`, {
                    method: 'POST',
                    body: JSON.stringify({
                      type: 'image',
                      content: {
                        url: part.asset_pointer.url,
                        originalWidth: part.asset_pointer.width,
                        originalHeight: part.asset_pointer.height
                      },
                      bounds: { 
                        x: margins.left, 
                        y: yPosition, 
                        width: Math.min(contentWidth, part.asset_pointer.width || 400),
                        height: imageHeight 
                      },
                      style: {
                        border: '1px solid #ddd',
                        borderRadius: '4px'
                      }
                    })
                  });
                  
                  console.log('EnhancedPdfEditor: Image element added successfully', {
                    response: imageResponse,
                    success: imageResponse.success,
                    elementId: imageResponse.element?.id
                  });

                  yPosition += imageHeight + 15;
                  
                } catch (error) {
                  console.error('EnhancedPdfEditor: Failed to add image element', {
                    error: error.message,
                    messageId: message.id,
                    imageUrl: part.asset_pointer?.url
                  });
                }
              }
              // Handle code blocks
              else if (typeof part === 'string' && part.trim() && (part.includes('```') || part.match(/^\s*```/m))) {
                try {
                  // Detect and process code blocks
                  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
                  const parts = [];
                  let lastIndex = 0;
                  let match;
                  
                  while ((match = codeBlockRegex.exec(part)) !== null) {
                    // Add text before code block
                    if (match.index > lastIndex) {
                      const textBefore = part.substring(lastIndex, match.index).trim();
                      if (textBefore) {
                        parts.push({ type: 'text', content: textBefore });
                      }
                    }
                    
                    // Add code block
                    const language = match[1] || 'text';
                    const codeContent = match[2];
                    parts.push({ type: 'code', content: codeContent, language });
                    
                    lastIndex = match.index + match[0].length;
                  }
                  
                  // Add remaining text after last code block
                  if (lastIndex < part.length) {
                    const textAfter = part.substring(lastIndex).trim();
                    if (textAfter) {
                      parts.push({ type: 'text', content: textAfter });
                    }
                  }
                  
                  // If no code blocks found, treat as regular text
                  if (parts.length === 0) {
                    parts.push({ type: 'text', content: part.trim() });
                  }
                  
                  // Process each part
                  for (const partItem of parts) {
                    if (partItem.type === 'code') {
                      // Add role header for code blocks
                      const roleText = message.message?.author?.role === 'user' ? 'User:' : 'Assistant:';
                      await createNewPageIfNeeded(25);
                      
                      const roleResponse = await apiCall(`/documents/${response.document.id}/pages/${response.document.pages[currentPageIndex].id}/elements`, {
                        method: 'POST',
                        body: JSON.stringify({
                          type: 'text',
                          content: roleText,
                          bounds: { x: margins.left, y: yPosition, width: contentWidth, height: 20 },
                          style: {
                            fontFamily: 'Helvetica',
                            fontSize: 12,
                            fontWeight: 'bold',
                            color: message.message?.author?.role === 'user' ? '#2E7D32' : '#1976D2'
                          }
                        })
                      });
                      yPosition += 25;
                      
                      // Calculate code block height
                      const codeLines = partItem.content.split('\n');
                      const codeHeight = Math.max(40, codeLines.length * 14 + 20);
                      
                      await createNewPageIfNeeded(codeHeight + 20);
                      
                      console.log('EnhancedPdfEditor: Adding code block element', {
                        messageId: message.id,
                        language: partItem.language,
                        lineCount: codeLines.length,
                        codeHeight,
                        yPosition,
                        currentPageIndex
                      });
                      
                      const codeResponse = await apiCall(`/documents/${response.document.id}/pages/${response.document.pages[currentPageIndex].id}/elements`, {
                        method: 'POST',
                        body: JSON.stringify({
                          type: 'text',
                          content: partItem.content,
                          bounds: { x: margins.left, y: yPosition, width: contentWidth, height: codeHeight },
                          style: {
                            fontFamily: 'Courier',
                            fontSize: 9,
                            color: '#000000',
                            backgroundColor: '#f5f5f5',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            padding: '8px',
                            whiteSpace: 'pre',
                            overflow: 'auto'
                          }
                        })
                      });
                      
                      console.log('EnhancedPdfEditor: Code block element added successfully', {
                        response: codeResponse,
                        success: codeResponse.success,
                        elementId: codeResponse.element?.id,
                        language: partItem.language
                      });

                      yPosition += codeHeight + 15;
                      
                    } else if (partItem.type === 'text') {
                      // Process as regular text (reuse existing text processing logic)
                      const roleText = message.message?.author?.role === 'user' ? 'User:' : 'Assistant:';
                      await createNewPageIfNeeded(25);
                      
                      const roleResponse = await apiCall(`/documents/${response.document.id}/pages/${response.document.pages[currentPageIndex].id}/elements`, {
                        method: 'POST',
                        body: JSON.stringify({
                          type: 'text',
                          content: roleText,
                          bounds: { x: margins.left, y: yPosition, width: contentWidth, height: 20 },
                          style: {
                            fontFamily: 'Helvetica',
                            fontSize: 12,
                            fontWeight: 'bold',
                            color: message.message?.author?.role === 'user' ? '#2E7D32' : '#1976D2'
                          }
                        })
                      });
                      yPosition += 25;
                      
                      // Process text content as single block
                      const textContent = partItem.content.trim();
                      const estimatedLines = Math.ceil(textContent.length / 80);
                      const textHeight = Math.max(40, estimatedLines * 14);
                      
                      await createNewPageIfNeeded(textHeight + 15);
                      
                      const contentResponse = await apiCall(`/documents/${response.document.id}/pages/${response.document.pages[currentPageIndex].id}/elements`, {
                        method: 'POST',
                        body: JSON.stringify({
                          type: 'text',
                          content: textContent,
                          bounds: { x: margins.left, y: yPosition, width: contentWidth, height: textHeight },
                          style: {
                            fontFamily: 'Helvetica',
                            fontSize: 11,
                            color: '#000000',
                            lineHeight: 1.4,
                            whiteSpace: 'pre-wrap'
                          }
                        })
                      });
                      
                      // Add delay between content blocks
                      await delay(75);

                      yPosition += textHeight + 15;
                    }
                  }
                  
                } catch (error) {
                  console.error('EnhancedPdfEditor: Failed to process code block content', {
                    error: error.message,
                    messageId: message.id,
                    contentLength: part.length
                  });
                }
              }
              // Handle regular text content
              else if (typeof part === 'string' && part.trim()) {
                // Add role header
                const roleText = message.message?.author?.role === 'user' ? 'User:' : 'Assistant:';
                try {
                  await createNewPageIfNeeded(25); // Check if we need new page for role header
                  
                  console.log('EnhancedPdfEditor: Adding role header element', {
                    roleText,
                    messageId: message.id,
                    authorRole: message.message?.author?.role,
                    yPosition,
                    currentPageIndex
                  });
                  
                  const roleResponse = await apiCall(`/documents/${response.document.id}/pages/${response.document.pages[currentPageIndex].id}/elements`, {
                    method: 'POST',
                    body: JSON.stringify({
                      type: 'text',
                      content: roleText,
                      bounds: { x: margins.left, y: yPosition, width: contentWidth, height: 20 },
                      style: {
                        fontFamily: 'Helvetica',
                        fontSize: 12,
                        fontWeight: 'bold',
                        color: message.message?.author?.role === 'user' ? '#2E7D32' : '#1976D2'
                      }
                    })
                  });
                  
                  // Add delay between API calls
                  await delay(100);
                  
                  console.log('EnhancedPdfEditor: Role header element added successfully', {
                    response: roleResponse,
                    success: roleResponse.success
                  });
                } catch (error) {
                  console.error('EnhancedPdfEditor: Failed to add role header element', {
                    error: error.message,
                    roleText,
                    messageId: message.id
                  });
                }
                yPosition += 20;

                // Combine content into larger blocks to reduce API calls
                const fullContent = part.trim();
                const estimatedLines = Math.ceil(fullContent.length / 80);
                const contentHeight = Math.max(60, estimatedLines * 14);
                
                try {
                  await createNewPageIfNeeded(contentHeight + 20);
                  
                  console.log('EnhancedPdfEditor: Adding combined message content', {
                    messageId: message.id,
                    contentLength: fullContent.length,
                    estimatedLines,
                    contentHeight,
                    yPosition,
                    currentPageIndex
                  });
                  
                  const contentResponse = await apiCall(`/documents/${response.document.id}/pages/${response.document.pages[currentPageIndex].id}/elements`, {
                    method: 'POST',
                    body: JSON.stringify({
                      type: 'text',
                      content: fullContent,
                      bounds: { x: margins.left, y: yPosition, width: contentWidth, height: contentHeight },
                      style: {
                        fontFamily: 'Helvetica',
                        fontSize: 11,
                        color: '#000000',
                        lineHeight: 1.4,
                        whiteSpace: 'pre-wrap'
                      }
                    })
                  });
                  
                  // Add delay between major content blocks
                  await delay(100);
                  
                  console.log('EnhancedPdfEditor: Combined content element added successfully', {
                    response: contentResponse,
                    success: contentResponse.success,
                    elementId: contentResponse.element?.id
                  });

                  yPosition += contentHeight + 20;
                  
                } catch (error) {
                  console.error('EnhancedPdfEditor: Failed to add combined content element', {
                    error: error.message,
                    messageId: message.id,
                    contentLength: fullContent.length
                  });
                }
              }
            }
          }
        }
        yPosition += 30; // Space between conversations
      }

      // Get updated document
      try {
        console.log('EnhancedPdfEditor: Fetching updated document after element creation');
        const updatedDoc = await apiCall(`/documents/${response.document.id}`);
        console.log('EnhancedPdfEditor: Updated document fetched', {
          documentId: updatedDoc.document.id,
          elementsCount: updatedDoc.document.pages[0]?.elements?.length || 0,
          elements: updatedDoc.document.pages[0]?.elements?.map(e => ({
            id: e.id,
            type: e.type,
            content: e.content?.substring(0, 50) + '...'
          })) || []
        });
        setDocument(updatedDoc.document);
        setSuccess(`Document created with ${collectedMessages.length} messages from ${collectedConversations.length} conversations`);
      } catch (error) {
        console.error('EnhancedPdfEditor: Failed to fetch updated document', {
          error: error.message,
          documentId: response.document.id
        });
        // Still set the original document if update fetch fails
        setDocument(response.document);
        setSuccess(`Document created with ${collectedMessages.length} messages (may need refresh)`);
      }
      
      // Clear collected messages
      console.log('EnhancedPdfEditor: Clearing sessionStorage after successful import');
      sessionStorage.removeItem('documentBuilder_messages');
      sessionStorage.removeItem('documentBuilder_conversations');
      
    } catch (error) {
      setError('Failed to create document from collected messages: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadFonts = async () => {
    try {
      const response = await apiCall('/fonts');
      setAvailableFonts(response.fonts);
    } catch (error) {
      setError('Failed to load fonts');
    }
  };

  const saveDocument = async () => {
    if (!document) return;
    
    setLoading(true);
    try {
      await apiCall(`/documents/${document.id}`, {
        method: 'PUT',
        body: JSON.stringify(document)
      });
      setSuccess('Document saved successfully');
    } catch (error) {
      setError('Failed to save document');
    } finally {
      setLoading(false);
    }
  };

  // Page navigation functions
  const goToPreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
      setSelectedElement(null); // Clear selection when changing pages
    }
  };

  const goToNextPage = () => {
    if (document && currentPage < document.pages.length - 1) {
      setCurrentPage(currentPage + 1);
      setSelectedElement(null); // Clear selection when changing pages
    }
  };

  const goToPage = (pageNumber) => {
    if (document && pageNumber >= 1 && pageNumber <= document.pages.length) {
      setCurrentPage(pageNumber - 1); // Convert to 0-based index
      setSelectedElement(null); // Clear selection when changing pages
    }
  };

  const addElement = async (elementData) => {
    if (!document || !document.pages[currentPage]) return;
    
    try {
      const response = await apiCall(
        `/documents/${document.id}/pages/${document.pages[currentPage].id}/elements`,
        {
          method: 'POST',
          body: JSON.stringify(elementData)
        }
      );
      
      // Update local state
      const updatedDocument = { ...document };
      updatedDocument.pages[currentPage].elements.push(response.element);
      setDocument(updatedDocument);
      setSelectedElement(response.element);
    } catch (error) {
      setError('Failed to add element');
    }
  };

  const updateElement = async (elementId, updates) => {
    if (!document || !document.pages[currentPage]) return;
    
    try {
      const response = await apiCall(
        `/documents/${document.id}/pages/${document.pages[currentPage].id}/elements/${elementId}`,
        {
          method: 'PUT',
          body: JSON.stringify(updates)
        }
      );
      
      // Update local state
      const updatedDocument = { ...document };
      const elementIndex = updatedDocument.pages[currentPage].elements.findIndex(el => el.id === elementId);
      if (elementIndex !== -1) {
        updatedDocument.pages[currentPage].elements[elementIndex] = response.element;
        setDocument(updatedDocument);
        if (selectedElement && selectedElement.id === elementId) {
          setSelectedElement(response.element);
        }
      }
    } catch (error) {
      setError('Failed to update element');
    }
  };

  const deleteElement = async (elementId) => {
    if (!document || !document.pages[currentPage]) return;
    
    try {
      await apiCall(
        `/documents/${document.id}/pages/${document.pages[currentPage].id}/elements/${elementId}`,
        { method: 'DELETE' }
      );
      
      // Update local state
      const updatedDocument = { ...document };
      updatedDocument.pages[currentPage].elements = updatedDocument.pages[currentPage].elements.filter(
        el => el.id !== elementId
      );
      setDocument(updatedDocument);
      if (selectedElement && selectedElement.id === elementId) {
        setSelectedElement(null);
      }
    } catch (error) {
      setError('Failed to delete element');
    }
  };

  const exportDocument = async (format = 'pdf') => {
    if (!document) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/documents/${document.id}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format })
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${document.metadata.title}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setSuccess('Document exported successfully');
    } catch (error) {
      setError('Failed to export document');
    } finally {
      setLoading(false);
    }
  };

  // Tool handlers
  const handleToolSelect = (tool) => {
    setSelectedTool(tool);
    setSelectedElement(null);
  };

  const handleCanvasClick = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    if (selectedTool === 'text') {
      addTextElement(x, y);
    } else if (selectedTool === 'rectangle') {
      addShapeElement('rectangle', x, y);
    } else if (selectedTool === 'circle') {
      addShapeElement('circle', x, y);
    }
  };

  const addTextElement = (x, y) => {
    const elementData = {
      type: 'text',
      bounds: { x, y, width: 200, height: 40 },
      content: 'Double-click to edit',
      style: {
        fontFamily: selectedFont,
        fontSize: fontSize,
        fontWeight: fontWeight,
        fontStyle: fontStyle,
        color: textColor,
        textAlign: textAlign
      }
    };
    addElement(elementData);
  };

  const addShapeElement = (shape, x, y) => {
    const elementData = {
      type: 'shape',
      bounds: { x, y, width: 100, height: 100 },
      content: { shape },
      style: {
        fill: '#e3f2fd',
        stroke: '#2196f3',
        strokeWidth: 2
      }
    };
    addElement(elementData);
  };

  // Render methods
  const renderToolbar = () => (
    <Paper elevation={1} sx={{ p: 1, mb: 1 }}>
      <Grid container spacing={1} alignItems="center">
        <Grid item>
          <Button
            variant={selectedTool === 'select' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => handleToolSelect('select')}
          >
            Select
          </Button>
        </Grid>
        <Grid item>
          <IconButton
            color={selectedTool === 'text' ? 'primary' : 'default'}
            onClick={() => handleToolSelect('text')}
          >
            <TextIcon />
          </IconButton>
        </Grid>
        <Grid item>
          <IconButton
            color={selectedTool === 'rectangle' ? 'primary' : 'default'}
            onClick={() => handleToolSelect('rectangle')}
          >
            <RectangleIcon />
          </IconButton>
        </Grid>
        <Grid item>
          <IconButton
            color={selectedTool === 'circle' ? 'primary' : 'default'}
            onClick={() => handleToolSelect('circle')}
          >
            <CircleIcon />
          </IconButton>
        </Grid>
        <Grid item>
          <IconButton onClick={() => fileInputRef.current?.click()}>
            <ImageIcon />
          </IconButton>
        </Grid>
        <Grid item>
          <Divider orientation="vertical" flexItem />
        </Grid>
        <Grid item>
          <IconButton onClick={saveDocument} disabled={loading}>
            <SaveIcon />
          </IconButton>
        </Grid>
        <Grid item>
          <IconButton onClick={() => setExportDialogOpen(true)}>
            <DownloadIcon />
          </IconButton>
        </Grid>
        <Grid item>
          <Divider orientation="vertical" flexItem />
        </Grid>
        <Grid item>
          <IconButton onClick={() => setZoom(Math.max(25, zoom - 25))}>
            <ZoomOutIcon />
          </IconButton>
        </Grid>
        <Grid item>
          <Typography variant="body2">{zoom}%</Typography>
        </Grid>
        <Grid item>
          <IconButton onClick={() => setZoom(Math.min(400, zoom + 25))}>
            <ZoomInIcon />
          </IconButton>
        </Grid>
      </Grid>
    </Paper>
  );

  const renderCanvas = () => (
    <Box>
      {/* Page indicator */}
      <Box sx={{ mb: 1, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Page {currentPage + 1} {document ? `of ${document.pages.length}` : ''}
        </Typography>
      </Box>
      
      <Paper
        elevation={2}
        sx={{
          height: 800,
          width: '100%',
          position: 'relative',
          overflow: 'auto',
          backgroundColor: '#f5f5f5',
          backgroundImage: showGrid ? 'radial-gradient(circle, #ccc 1px, transparent 1px)' : 'none',
          backgroundSize: showGrid ? '20px 20px' : 'auto'
        }}
        ref={canvasRef}
        onClick={handleCanvasClick}
      >
      {document && document.pages[currentPage] && (
        <Box
          sx={{
            width: 595, // A4 width in points
            height: 842, // A4 height in points
            backgroundColor: 'white',
            margin: '20px auto',
            position: 'relative',
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'center top',
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
            cursor: selectedTool === 'select' ? 'default' : 'crosshair'
          }}
        >
          {document.pages[currentPage].elements.map((element) => (
            <Box
              key={element.id}
              sx={{
                position: 'absolute',
                left: element.bounds.x,
                top: element.bounds.y,
                width: element.bounds.width,
                height: element.bounds.height,
                border: selectedElement?.id === element.id ? '2px solid #2196f3' : '1px solid transparent',
                cursor: 'pointer',
                ...getElementStyles(element)
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedElement(element);
              }}
            >
              {renderElement(element)}
            </Box>
          ))}
        </Box>
      )}
    </Paper>
    </Box>
  );

  const getElementStyles = (element) => {
    const styles = {};
    
    if (element.type === 'text') {
      styles.fontFamily = element.style?.fontFamily || 'Helvetica';
      styles.fontSize = element.style?.fontSize || 12;
      styles.fontWeight = element.style?.fontWeight || 'normal';
      styles.fontStyle = element.style?.fontStyle || 'normal';
      styles.color = element.style?.color || '#000000';
      styles.textAlign = element.style?.textAlign || 'left';
      styles.display = 'flex';
      styles.alignItems = 'center';
      styles.padding = '4px';
    } else if (element.type === 'shape') {
      styles.backgroundColor = element.style?.fill || 'transparent';
      styles.border = element.style?.stroke ? `${element.style.strokeWidth || 1}px solid ${element.style.stroke}` : 'none';
      if (element.content?.shape === 'circle') {
        styles.borderRadius = '50%';
      }
    }
    
    return styles;
  };

  const renderElement = (element) => {
    if (element.type === 'text') {
      return element.content || 'Text';
    } else if (element.type === 'shape') {
      return null; // Shape styling is handled by CSS
    }
    return null;
  };

  const renderPropertyPanel = () => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Properties
        </Typography>
        
        {selectedElement ? (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {selectedElement.type === 'text' ? 'Text Element' : 'Shape Element'}
            </Typography>
            
            {selectedElement.type === 'text' && (
              <Box>
                <FormControl fullWidth margin="dense">
                  <InputLabel>Font Family</InputLabel>
                  <Select
                    value={selectedElement.style?.fontFamily || 'Helvetica'}
                    onChange={(e) => updateElement(selectedElement.id, {
                      style: { ...selectedElement.style, fontFamily: e.target.value }
                    })}
                  >
                    {availableFonts.map((font) => (
                      <MenuItem key={font.familyName} value={font.familyName}>
                        {font.familyName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <TextField
                  fullWidth
                  margin="dense"
                  label="Font Size"
                  type="number"
                  value={selectedElement.style?.fontSize || 12}
                  onChange={(e) => updateElement(selectedElement.id, {
                    style: { ...selectedElement.style, fontSize: parseInt(e.target.value) }
                  })}
                />
                
                <TextField
                  fullWidth
                  margin="dense"
                  label="Text Color"
                  type="color"
                  value={selectedElement.style?.color || '#000000'}
                  onChange={(e) => updateElement(selectedElement.id, {
                    style: { ...selectedElement.style, color: e.target.value }
                  })}
                />
                
                <TextField
                  fullWidth
                  margin="dense"
                  label="Content"
                  multiline
                  rows={3}
                  value={selectedElement.content || ''}
                  onChange={(e) => updateElement(selectedElement.id, {
                    content: e.target.value
                  })}
                />
              </Box>
            )}
            
            <Box mt={2}>
              <Typography variant="subtitle2">Position</Typography>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <TextField
                    label="X"
                    type="number"
                    size="small"
                    value={selectedElement.bounds?.x || 0}
                    onChange={(e) => updateElement(selectedElement.id, {
                      bounds: { ...selectedElement.bounds, x: parseInt(e.target.value) }
                    })}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Y"
                    type="number"
                    size="small"
                    value={selectedElement.bounds?.y || 0}
                    onChange={(e) => updateElement(selectedElement.id, {
                      bounds: { ...selectedElement.bounds, y: parseInt(e.target.value) }
                    })}
                  />
                </Grid>
              </Grid>
            </Box>
            
            <Box mt={2}>
              <Button
                variant="outlined"
                color="error"
                fullWidth
                onClick={() => deleteElement(selectedElement.id)}
              >
                Delete Element
              </Button>
            </Box>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Select an element to edit its properties
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  const renderLayerPanel = () => (
    <Card sx={{ height: '100%', backgroundColor: '#ffffff' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ color: '#000000' }}>
          Layers
        </Typography>
        
        {document && document.pages[currentPage] && (
          <List dense>
            {document.pages[currentPage].elements.map((element, index) => (
              <ListItem
                key={element.id}
                selected={selectedElement?.id === element.id}
                onClick={() => setSelectedElement(element)}
                sx={{ 
                  cursor: 'pointer',
                  backgroundColor: selectedElement?.id === element.id ? 'rgba(25, 118, 210, 0.12)' : 'transparent',
                  color: '#000000',
                  '&:hover': {
                    backgroundColor: selectedElement?.id === element.id ? 'rgba(25, 118, 210, 0.2)' : 'rgba(0, 0, 0, 0.04)'
                  }
                }}
              >
                <ListItemIcon sx={{ color: '#000000' }}>
                  {element.type === 'text' ? <TextIcon /> : <RectangleIcon />}
                </ListItemIcon>
                <ListItemText
                  primary={`${element.type} ${index + 1}`}
                  secondary={
                    element.type === 'text' 
                      ? (typeof element.content === 'string' ? element.content.substring(0, 30) + '...' : 'Text element')
                      : element.type === 'shape' 
                      ? (element.content?.shape || 'Shape')
                      : 'Element'
                  }
                  sx={{ 
                    '& .MuiListItemText-primary': { color: '#000000' },
                    '& .MuiListItemText-secondary': { color: '#666666' }
                  }}
                />
                <IconButton 
                  size="small" 
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteElement(element.id);
                  }}
                  sx={{ color: '#666666' }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );

  if (loading && !document) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      {renderToolbar()}
      
      {/* Main editor area */}
      <Box sx={{ flex: 1, display: 'flex', gap: 1 }}>
        {/* Left sidebar - Properties */}
        <Box sx={{ width: 300, display: propertyPanelOpen ? 'block' : 'none' }}>
          {renderPropertyPanel()}
        </Box>
        
        {/* Canvas area */}
        <Box sx={{ flex: 1 }}>
          {renderCanvas()}
        </Box>
        
        {/* Right sidebar - Layers */}
        <Box sx={{ width: 250, display: layerPanelOpen ? 'block' : 'none' }}>
          {renderLayerPanel()}
        </Box>
      </Box>
      
      {/* Status bar */}
      <Paper elevation={1} sx={{ p: 1 }}>
        <Grid container justifyContent="space-between" alignItems="center">
          <Grid item>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={goToPreviousPage}
                disabled={!document || currentPage === 0}
              >
                Previous
              </Button>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2">Page</Typography>
                <TextField
                  size="small"
                  type="number"
                  value={currentPage + 1}
                  onChange={(e) => goToPage(parseInt(e.target.value))}
                  inputProps={{ 
                    min: 1, 
                    max: document?.pages?.length || 1,
                    style: { width: '60px', textAlign: 'center' }
                  }}
                  sx={{ width: '80px' }}
                />
                <Typography variant="body2">
                  of {document ? document.pages.length : 0}
                </Typography>
              </Box>
              
              <Button
                size="small"
                variant="outlined"
                onClick={goToNextPage}
                disabled={!document || currentPage >= (document?.pages?.length - 1)}
              >
                Next
              </Button>
            </Box>
          </Grid>
          <Grid item>
            <FormControlLabel
              control={
                <Switch
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                />
              }
              label="Grid"
            />
          </Grid>
        </Grid>
      </Paper>
      
      {/* Hidden file input for image uploads */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={(e) => {
          // Handle image upload
          console.log('Image upload:', e.target.files[0]);
        }}
      />
      
      {/* Snackbar notifications */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
      
      <Snackbar
        open={!!success}
        autoHideDuration={3000}
        onClose={() => setSuccess(null)}
      >
        <Alert severity="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default EnhancedPdfEditor;