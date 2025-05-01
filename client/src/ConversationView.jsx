import React, { useEffect, useState, useRef } from 'react';
import { Box, Typography, Paper, Button, LinearProgress } from '@mui/material';
import { useParams } from 'react-router-dom';
import Markdown from './Markdown.jsx';
import ToolMessageRenderer from './ToolMessageRenderer';
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
    return { text: '', mediaRefs: [], segments: [] };
  }
  
  const content = message.content;
  const mediaRefs = [];
  let textContent = '';
  let segments = [];

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
    segments
  };
}

function isLikelyToolJson(content) {
  if (typeof content !== 'string') return false;
  const trimmed = content.trim();
  return trimmed.startsWith('{') && (trimmed.length > 120 || trimmed.includes('\"') || trimmed.includes('\n'));
}

export default function ConversationView() {
  const { id } = useParams();
  const [data, setData] = useState({ messages: [], total_messages: 0, page: 1, per_page: 10, title: '', create_time: '', folder: '' });
  const [mediaFilenames, setMediaFilenames] = useState({});
  const scrollRef = useRef();

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

  if (!data.title) return <div>Loading...</div>;

  // Extract unique gizmo IDs and models from messages
  const gizmoIds = Array.from(new Set((data.messages || []).map(m => 
    m.message?.metadata?.gizmo_id).filter(Boolean)));
  const modelNames = Array.from(new Set((data.messages || []).map(m => 
    m.message?.metadata?.model_slug).filter(Boolean)));

  return (
    <Box>
      <Typography variant="h5">{data.title || id}</Typography>
      <Typography variant="subtitle2" color="text.secondary">{data.create_time}</Typography>
      {gizmoIds.length > 0 && (
        <Typography variant="subtitle2" color="text.secondary">Gizmo ID(s): {gizmoIds.join(', ')}</Typography>
      )}
      {modelNames.length > 0 && (
        <Typography variant="subtitle2" color="text.secondary">Model(s): {modelNames.join(', ')}</Typography>
      )}
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
            <Paper key={msg.id} sx={{ p: 2, my: 1, backgroundColor: bgColor }}>
              <Typography variant="subtitle2" color="text.secondary">
                {role} {createTime ? `– ${new Date(createTime * 1000).toLocaleString()}` : ''}
                {msg.message?.metadata?.model_slug ? ` (${msg.message.metadata.model_slug})` : ''}
              </Typography>
              
              {/* Render message content */}
              {role === 'tool' ? (
                <ToolMessageRenderer message={msg.message} />
              ) : (
                <Markdown 
                  children={content.text} 
                  segments={content.segments} 
                />
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