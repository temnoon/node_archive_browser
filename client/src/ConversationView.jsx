import React, { useEffect, useState, useRef } from 'react';
import { Box, Typography, Paper, Button, LinearProgress, Chip, Collapse } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import Markdown from './Markdown.jsx';
import ToolMessageRenderer from './ToolMessageRenderer';
import EnhancedToolMessageRenderer from './EnhancedToolMessageRenderer';
import CanvasRenderer from './CanvasRenderer';
import GizmoNameEditor from './GizmoNameEditor';
import { processLatexInText } from './latexUtils';

function fetchAPI(url) {
  return fetch(url)
    .then(res => {
      if (!res.ok) throw new Error('API error');
      return res.json();
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
  const scrollRef = useRef();

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

  // Load all media files in the conversation to map file IDs to full filenames
  const loadMediaFilenames = async (folder) => {
    try {
      const response = await fetch(`/api/media/${folder}`);
      if (response.ok) {
        const files = await response.json();
        if (files && Array.isArray(files)) {
          // Create a map of partial file IDs to full filenames
          const filenameMap = {};
          files.forEach(file => {
            // Extract the file ID from the filename
            const fileIdMatch = file.match(/file-[\w\d]+/);
            if (fileIdMatch) {
              const fileId = fileIdMatch[0];
              filenameMap[fileId] = file;
            }
          });
          setMediaFilenames(filenameMap);
        }
      }
    } catch (error) {
      console.error('Error loading media filenames:', error);
    }
  };
  
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

  const fetchPage = (page) => {
    fetchAPI(`/api/conversations/${id}?page=${page}&limit=${data.per_page}`)
      .then(res => {
        setData(res);
        // Load media filenames when conversation data is fetched
        if (res.folder) {
          loadMediaFilenames(res.folder);
        }
      });
  };

  useEffect(() => { fetchPage(1); }, [id]);
  useEffect(() => {
    if (window.MathJax && data.messages && data.messages.length > 0) {
      // Wait a bit for the DOM to settle before trying to render MathJax
      setTimeout(() => {
        try {
          window.MathJax.typesetPromise()
            .catch(err => console.error('MathJax typesetting error:', err));
        } catch (e) {
          console.error('MathJax error:', e);
        }
      }, 500);
    }
  }, [data.messages]);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [data.page]);

  // Filter out empty system messages after the first user message
  let filteredMessages = [];
  if (Array.isArray(data.messages)) {
    let firstUserIdx = data.messages.findIndex(msg => 
      msg.message && msg.message.author && msg.message.author.role === 'user'
    );
    if (firstUserIdx !== -1) {
      filteredMessages = data.messages.slice(firstUserIdx);
      filteredMessages = [filteredMessages[0]].concat(
        filteredMessages.slice(1).filter(msg => 
          !(msg.message && msg.message.author && msg.message.author.role === 'system' && 
          (!msg.message.content || !msg.message.content.parts || msg.message.content.parts.length === 0))
        )
      );
    } else {
      // If no user message found, just use all messages
      filteredMessages = data.messages;
    }
  }

  // Display unknown message types if any are present
  const renderUnknownTypesWarning = () => {
    if (!data.unknown_types) return null;
    
    return (
      <Box sx={{ mb: 2, p: 1, bgcolor: '#fff4e5', borderRadius: 1, border: '1px solid #ffe0b2' }}>
        <Typography variant="subtitle2" color="warning.main">Archive Parser Notice:</Typography>
        <Typography variant="body2">
          This conversation contains message types that may have new or extended formats.
          {Object.entries(data.unknown_types).map(([type, count]) => (
            <Chip 
              key={type}
              label={`${type}: ${count}`}
              size="small"
              sx={{ m: 0.5 }}
              color="warning"
              variant="outlined"
            />
          ))}
        </Typography>
      </Box>
    );
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

  if (!data.title) return <div>Loading...</div>;

  // Extract unique gizmo IDs and models from messages
  const gizmoIds = Array.from(new Set((data.messages || []).map(m => 
    m.message?.metadata?.gizmo_id).filter(Boolean)));
  const modelNames = Array.from(new Set((data.messages || []).map(m => 
    m.message?.metadata?.model_slug).filter(Boolean)));

  return (
    <Box>
      <Typography variant="h5">{data.title || id}</Typography>
      <Typography variant="subtitle2" color="text.secondary">
        {data.create_time ? new Date(data.create_time * 1000).toISOString().split('T')[0] : ''}
        <span style={{ color: '#777', marginLeft: '10px' }}>
          ID: {id}
        </span>
      </Typography>
      {gizmoIds.length > 0 && (
        <Typography variant="subtitle2" color="text.secondary">Gizmo ID(s): {gizmoIds.join(', ')}</Typography>
      )}
      {modelNames.length > 0 && (
        <Typography variant="subtitle2" color="text.secondary">Model(s): {modelNames.join(', ')}</Typography>
      )}
      
      {/* Display warnings about unknown message types */}
      {renderUnknownTypesWarning()}
      
      {/* Display canvas summary */}
      {renderCanvasSummary()}
      
      {/* Display View Media button if the conversation has media */}
      {data.has_media && (
        <Box sx={{ mb: 2 }}>
          <Button 
            variant="outlined" 
            onClick={() => navigate('/media', { state: { conversationId: id } })}
          >
            View Conversation Media
          </Button>
        </Box>
      )}
      
      {/* Gizmo Name Editor Dialog */}
      <GizmoNameEditor
        open={gizmoEditorOpen}
        onClose={() => setGizmoEditorOpen(false)}
        gizmoId={currentGizmo.id}
        currentName={currentGizmo.name}
        onNameChange={handleGizmoNameChange}
      />
      
      <Box sx={{ flex: 1, minHeight: 0, height: '100%', overflow: 'auto' }} ref={scrollRef}>
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
            <Paper key={msg.id} sx={{ p: 2, my: 1, backgroundColor: bgColor, position: 'relative' }}>
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
              {content.mediaRefs.length > 0 && (
                <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {content.mediaRefs.map((media, index) => (
                    <Box key={index} sx={{ maxWidth: '100%', maxHeight: '300px' }}>
                          {media.type === 'image' ? (
                            <img 
                              src={`/api/media/${data.folder}/${mediaFilenames[media.filename] || media.filename}`} 
                              alt="Attachment" 
                              style={{ maxWidth: '100%', maxHeight: '300px' }}
                            />
                      ) : media.type === 'audio' ? (
                        <Box sx={{ p: 2, textAlign: 'center', bgcolor: '#f0f7ff', borderRadius: 1, minWidth: 250 }}>
                          <Typography variant="subtitle2" color="primary" gutterBottom>
                            Audio File
                          </Typography>
                          <audio 
                            controls 
                            src={`/api/media/${data.folder}/${mediaFilenames[media.filename] || media.filename}`} 
                            style={{ width: '100%' }} 
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
                            src={`/api/media/${data.folder}/${mediaFilenames[media.filename] || media.filename}`}
                            style={{ maxWidth: '100%', maxHeight: '200px' }} 
                          />
                        </Box>
                      ) : (
                        <Box sx={{ p: 1, border: '1px solid #eee', borderRadius: 1 }}>
                          <Typography variant="caption">{media.filename}</Typography>
                        </Box>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>
          );
        })}
      </Box>
      {data.total_messages > data.per_page && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
          <Button disabled={data.page <= 1} onClick={() => fetchPage(data.page - 1)}>Previous</Button>
          <Typography sx={{ alignSelf: 'center' }}>Page {data.page} / {Math.ceil(data.total_messages / data.per_page)}</Typography>
          <Button disabled={data.page >= Math.ceil(data.total_messages / data.per_page)} onClick={() => fetchPage(data.page + 1)}>Next</Button>
        </Box>
      )}
    </Box>
  );
}