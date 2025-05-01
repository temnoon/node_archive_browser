import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button,
  CircularProgress,
  Paper,
  InputAdornment,
  IconButton,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  Divider
} from '@mui/material';
import { useNavigate, useLocation, useParams } from 'react-router-dom';

// Function to fetch all media files
async function fetchAllMedia() {
  try {
    const response = await fetch('/api/media-gallery');
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching media gallery:', error);
    throw error;
  }
}

// Function to fetch media files for a specific conversation
async function fetchConversationMedia(conversationId) {
  try {
    // First get the conversation details to get the folder
    const convResponse = await fetch(`/api/conversations/${conversationId}`);
    if (!convResponse.ok) {
      throw new Error(`Server error: ${convResponse.status}`);
    }
    const convData = await convResponse.json();
    
    // Then get the media files for this conversation
    const mediaResponse = await fetch(`/api/media/${convData.folder}`);
    if (!mediaResponse.ok) {
      throw new Error(`Server error: ${mediaResponse.status}`);
    }
    const fileNames = await mediaResponse.json();
    
    // Format the response to match the structure expected by the component
    const mediaFiles = fileNames.map(fileName => {
      // Determine file type based on extension
      const fileExt = fileName.split('.').pop().toLowerCase();
      let fileType = 'unknown';
      const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
      const audioExts = ['mp3', 'wav', 'ogg', 'm4a'];
      const videoExts = ['mp4', 'webm', 'mov'];
      
      if (imageExts.includes(fileExt)) fileType = 'image';
      else if (audioExts.includes(fileExt)) fileType = 'audio';
      else if (videoExts.includes(fileExt)) fileType = 'video';
      
      // Extract file ID from name
      const fileId = fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
      
      return {
        id: fileId,
        originalFilename: fileName,
        conversationId: conversationId,
        conversationTitle: convData.title || 'Untitled',
        folder: convData.folder,
        path: `/api/media/${convData.folder}/${fileName}`,
        type: fileType
      };
    });
    
    return {
      mediaFiles,
      total: mediaFiles.length,
      conversationTitle: convData.title
    };
  } catch (error) {
    console.error(`Error fetching media for conversation ${conversationId}:`, error);
    throw error;
  }
}

export default function MediaGallery() {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [conversationTitle, setConversationTitle] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get the conversation ID from the location state (if coming from a conversation)
  // or from URL params if navigating directly
  const { conversationId: urlConversationId } = useParams();
  const conversationId = urlConversationId || location.state?.conversationId;

  useEffect(() => {
    const loadMedia = async () => {
      try {
        setLoading(true);
        
        // If we have a conversation ID, load media for that conversation only
        if (conversationId) {
          const data = await fetchConversationMedia(conversationId);
          setMediaFiles(data.mediaFiles || []);
          setFilteredFiles(data.mediaFiles || []);
          setConversationTitle(data.conversationTitle);
        } else {
          // Otherwise load all media
          const data = await fetchAllMedia();
          setMediaFiles(data.mediaFiles || []);
          setFilteredFiles(data.mediaFiles || []);
        }
      } catch (err) {
        setError(`Failed to load media files: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadMedia();
  }, [conversationId]);

  // Add keyboard navigation for dialog
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!dialogOpen) return;
      
      if (e.key === 'ArrowLeft') {
        handlePrevMedia();
      } else if (e.key === 'ArrowRight') {
        handleNextMedia();
      } else if (e.key === 'Escape') {
        setDialogOpen(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialogOpen]);

  // Update filtered files when search term changes
  useEffect(() => {
    if (!search.trim()) {
      setFilteredFiles(mediaFiles);
      return;
    }

    const term = search.toLowerCase();
    const filtered = mediaFiles.filter(file => 
      file.id.toLowerCase().includes(term) || 
      file.originalFilename?.toLowerCase().includes(term) ||
      file.conversationTitle?.toLowerCase().includes(term)
    );
    
    setFilteredFiles(filtered);
  }, [search, mediaFiles]);
  
  // Handle direct file ID search
  const searchFileById = async () => {
    if (!search.trim()) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/media-file/${encodeURIComponent(search.trim())}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.matches && data.matches.length > 0) {
          setFilteredFiles(data.matches);
        } else {
          setError(`No files found matching ID: ${search}`);
          setFilteredFiles([]);
        }
      } else if (response.status === 404) {
        setError(`No files found matching ID: ${search}`);
        setFilteredFiles([]);
      } else {
        throw new Error(`Server error: ${response.status}`);
      }
    } catch (err) {
      setError(`Error searching for file: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle navigation to conversation
  const navigateToConversation = (convId) => {
    setDialogOpen(false);
    navigate(`/conversations/${convId}`);
  };

  // Handle viewing media details
  const handleViewMedia = (media, index) => {
    setSelectedMedia(media);
    setCurrentIndex(index);
    setDialogOpen(true);
  };
  
  // Navigate to previous media in dialog
  const handlePrevMedia = useCallback(() => {
    if (filteredFiles.length <= 1) return;
    
    const newIndex = currentIndex > 0 ? currentIndex - 1 : filteredFiles.length - 1;
    setCurrentIndex(newIndex);
    setSelectedMedia(filteredFiles[newIndex]);
  }, [filteredFiles, currentIndex]);
  
  // Navigate to next media in dialog
  const handleNextMedia = useCallback(() => {
    if (filteredFiles.length <= 1) return;
    
    const newIndex = (currentIndex + 1) % filteredFiles.length;
    setCurrentIndex(newIndex);
    setSelectedMedia(filteredFiles[newIndex]);
  }, [filteredFiles, currentIndex]);

  // Render media item based on type
  const renderMediaItem = (file) => {
    const isImage = file.type === 'image';
    const isAudio = file.type === 'audio';
    const isVideo = file.type === 'video';
    
    if (isImage) {
      return (
        <img
          src={file.path}
          alt={file.id || 'Media file'}
          style={{ 
            width: '100%',
            aspectRatio: '1',
            objectFit: 'cover',
            backgroundColor: '#f5f5f5' 
          }}
          loading="lazy"
        />
      );
    } else if (isAudio) {
      return (
        <Box sx={{ 
          aspectRatio: '1', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          bgcolor: '#f0f7ff',
          p: 1
        }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              Audio
            </Typography>
            <Box sx={{ color: '#3f51b5', fontSize: '2rem', mb: 1 }}>
              ♫
            </Box>
          </Box>
        </Box>
      );
    } else if (isVideo) {
      return (
        <Box sx={{ 
          aspectRatio: '1', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          bgcolor: '#fdf7ff',
          p: 1
        }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              Video
            </Typography>
            <Box sx={{ color: '#9c27b0', fontSize: '2rem', mb: 1 }}>
              ▶
            </Box>
          </Box>
        </Box>
      );
    } else {
      return (
        <Box sx={{ 
          aspectRatio: '1', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          bgcolor: '#f5f5f5',
          p: 1
        }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              {file.type || 'Unknown'}
            </Typography>
            <Box sx={{ color: '#9e9e9e', fontSize: '2rem', mb: 1 }}>
              ⤓
            </Box>
          </Box>
        </Box>
      );
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Loading media files...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" color="error" gutterBottom>
            Error
          </Typography>
          <Button variant="outlined" onClick={() => setError(null)}>
            Clear Error
          </Button>
        </Box>
        <Typography variant="body1" gutterBottom>{error}</Typography>
        <Button variant="contained" onClick={() => {
          setError(null);
          setLoading(true);
          fetchAllMedia().then(data => {
            setMediaFiles(data.mediaFiles || []);
            setFilteredFiles(data.mediaFiles || []);
          }).catch(err => {
            setError(`Failed to load media files: ${err.message}`);
          }).finally(() => {
            setLoading(false);
          });
        }}>
          Reload All Media
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Media Gallery
        {conversationTitle && (
          <Typography 
            component="span" 
            variant="h6" 
            color="text.secondary"
            sx={{ ml: 2 }}
          >
            {conversationTitle}
          </Typography>
        )}
      </Typography>
      
      {conversationId && (
        <Box sx={{ mb: 2 }}>
          <Button variant="outlined" onClick={() => navigate('/media')}>
            View All Media
          </Button>
          <Button 
            variant="text" 
            onClick={() => navigate(`/conversations/${conversationId}`)}
            sx={{ ml: 2 }}
          >
            Back to Conversation
          </Button>
        </Box>
      )}
      
      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField
          fullWidth
          label="Search by file ID, filename or conversation title"
          variant="outlined"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              searchFileById();
            }
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                {search && (
                  <IconButton onClick={() => setSearch('')} sx={{ mr: 1 }}>
                    ✕
                  </IconButton>
                )}
                <Button
                  variant="contained" 
                  size="small"
                  onClick={searchFileById}
                  disabled={!search.trim()}
                >
                  Search
                </Button>
              </InputAdornment>
            ),
          }}
        />
        
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {filteredFiles.length} of {mediaFiles.length} media files
          </Typography>
        </Box>
      </Paper>

      {filteredFiles.length === 0 ? (
        <Typography variant="body1" sx={{ textAlign: 'center', my: 4 }}>
          No media files found matching your search criteria.
        </Typography>
      ) : (
        <Box sx={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '8px',
          justifyContent: 'flex-start'
        }}>
          {filteredFiles.map((file, index) => (
            <Box 
              key={`${file.id}-${index}`}
              sx={{
                position: 'relative',
                width: { xs: '100%', sm: '48%', md: '32%', lg: '24%', xl: '19%' },
                '&:hover .media-overlay': {
                  opacity: 1
                }
              }}
            >
              {renderMediaItem(file)}
              
              {/* Overlay with filename - shows only on hover */}
              <Box 
                className="media-overlay"
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                  color: 'white',
                  padding: '8px',
                  opacity: 0,
                  transition: 'opacity 0.3s',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
                onClick={() => handleViewMedia(file, index)}
              >
                {file.originalFilename || file.id}
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* Media Details Dialog */}
      {selectedMedia && (
        <Dialog 
          open={dialogOpen} 
          onClose={() => setDialogOpen(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" noWrap sx={{ maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {selectedMedia.originalFilename || selectedMedia.id}
            </Typography>
            <Box>
              <Button onClick={() => setDialogOpen(false)}>Close</Button>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ position: 'relative', pb: 0 }}>
            {/* Navigation Arrows */}
            {filteredFiles.length > 1 && (
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
                  alt={selectedMedia.id} 
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '70vh',
                    objectFit: 'contain'
                  }}
                />
              ) : selectedMedia.type === 'audio' ? (
                <Box sx={{ textAlign: 'center', p: 3, bgcolor: '#f0f7ff', borderRadius: 2, width: '100%' }}>
                  <Typography variant="h6" color="primary" gutterBottom>
                    Audio File
                  </Typography>
                  <audio controls src={selectedMedia.path} style={{ width: '100%' }} />
                </Box>
              ) : selectedMedia.type === 'video' ? (
                <Box sx={{ textAlign: 'center', p: 3, width: '100%' }}>
                  <video 
                    controls 
                    src={selectedMedia.path}
                    style={{ maxWidth: '100%', maxHeight: '70vh' }} 
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
                  {selectedMedia.id}
                </Typography>
              </Box>
              
              <Box sx={{ minWidth: '200px', flex: 2 }}>
                <Typography variant="subtitle2">From Conversation</Typography>
                <Typography variant="body2" noWrap>
                  {selectedMedia.conversationTitle}
                  <Button 
                    size="small" 
                    sx={{ ml: 1 }} 
                    onClick={() => navigateToConversation(selectedMedia.conversationId)}
                  >
                    View
                  </Button>
                </Typography>
              </Box>
              
              <Box sx={{ width: '100%' }}>
                <Typography variant="subtitle2">Path</Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-all', fontSize: '0.75rem' }}>
                  {selectedMedia.path}
                </Typography>
              </Box>
            </Box>
          </DialogContent>
        </Dialog>
      )}
    </Box>
  );
}