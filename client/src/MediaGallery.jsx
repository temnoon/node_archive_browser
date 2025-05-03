import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  Divider,
  Pagination,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import { useNavigate, useLocation, useParams } from 'react-router-dom';

// Cache of media files to avoid re-fetching
const mediaCache = {
  allMedia: [],
  byConversation: {},
  initialized: false
};

// Function to fetch all media files
async function fetchAllMedia() {
  try {
    // If cached data is available and we're fetching all media, use it
    if (mediaCache.initialized && mediaCache.allMedia.length > 0) {
      return {
        mediaFiles: mediaCache.allMedia,
        total: mediaCache.allMedia.length
      };
    }
    
    const response = await fetch('/api/media-gallery');
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    const data = await response.json();
    
    // Cache the results
    mediaCache.allMedia = data.mediaFiles || [];
    mediaCache.initialized = true;
    
    return data;
  } catch (error) {
    console.error('Error fetching media gallery:', error);
    throw error;
  }
}

// Function to fetch media files for a specific conversation
async function fetchConversationMedia(conversationId) {
  try {
    // Check if we already have this conversation's media cached
    if (mediaCache.byConversation[conversationId]) {
      return mediaCache.byConversation[conversationId];
    }
    
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
    
    // Cache the results
    const result = {
      mediaFiles,
      total: mediaFiles.length,
      conversationTitle: convData.title
    };
    
    mediaCache.byConversation[conversationId] = result;
    return result;
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
  const [isLimited, setIsLimited] = useState(false);
  const [totalMediaCount, setTotalMediaCount] = useState(0);
  const [maxFiles, setMaxFiles] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [paginatedFiles, setPaginatedFiles] = useState([]);
  const [filesPerPage, setFilesPerPage] = useState(100);
  const galleryScrollRef = useRef(null);
  
  // Filter options
  const [showImages, setShowImages] = useState(true);
  const [showAudio, setShowAudio] = useState(true);
  const [showUserUploads, setShowUserUploads] = useState(true);
  const [showAiGenerated, setShowAiGenerated] = useState(true);
  
  // Sorting options
  const [sortBy, setSortBy] = useState('createTime');
  const [sortDirection, setSortDirection] = useState('desc');
  
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
          setIsLimited(false); // Single conversation is unlikely to hit limits
          setTotalMediaCount(data.mediaFiles?.length || 0);
        } else {
          // Otherwise load all media
          const data = await fetchAllMedia();
          setMediaFiles(data.mediaFiles || []);
          setFilteredFiles(data.mediaFiles || []);
          // Store info about limits
          setIsLimited(data.limited || false);
          setTotalMediaCount(data.total || data.mediaFiles?.length || 0);
          setMaxFiles(data.maxFiles || 0);
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

  // Apply filters and search term - use useMemo to cache results
  const filtered = useMemo(() => {
    let filtered = [...mediaFiles];
    
    // Apply type filters
    if (!showImages || !showAudio) {
      filtered = filtered.filter(file => {
        if (!showImages && file.type === 'image') return false;
        if (!showAudio && file.type === 'audio') return false;
        return true;
      });
    }
    
    // Apply source filters
    if (!showUserUploads || !showAiGenerated) {
      filtered = filtered.filter(file => {
        if (!showUserUploads && file.sourceType === 'user_upload') return false;
        if (!showAiGenerated && file.sourceType === 'ai_generated') return false;
        return true;
      });
    }
    
    // Apply search filter
    if (search.trim()) {
      const term = search.toLowerCase();
      filtered = filtered.filter(file => 
        file.id.toLowerCase().includes(term) || 
        file.originalFilename?.toLowerCase().includes(term) ||
        file.conversationTitle?.toLowerCase().includes(term) ||
        file.displayFilename?.toLowerCase().includes(term)
      );
    }
    
    // Apply sorting
    return [...filtered].sort((a, b) => {
      let valueA, valueB;
      
      // Get values based on sortBy
      switch (sortBy) {
        case 'filename':
          valueA = a.displayFilename || a.originalFilename || '';
          valueB = b.displayFilename || b.originalFilename || '';
          // String comparison
          return sortDirection === 'asc' ? 
            valueA.localeCompare(valueB) : 
            valueB.localeCompare(valueA);
        
        case 'createTime':
          valueA = a.createTime || 0;
          valueB = b.createTime || 0;
          break;
          
        case 'fileId':
          valueA = a.id || '';
          valueB = b.id || '';
          // String comparison
          return sortDirection === 'asc' ? 
            valueA.localeCompare(valueB) : 
            valueB.localeCompare(valueA);
          
        default:
          valueA = a.createTime || 0;
          valueB = b.createTime || 0;
      }
      
      // Numeric comparison for non-string cases
      return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
    });
  }, [mediaFiles, search, showImages, showAudio, showUserUploads, showAiGenerated, sortBy, sortDirection]);
  
  // Update filteredFiles state when filtered memoized value changes
  useEffect(() => {
    setFilteredFiles(filtered);
    // Reset to first page when filters change
    setCurrentPage(1);
  }, [filtered]);
  
  // Paginate the filtered files - use useMemo for performance
  const paginated = useMemo(() => {
    const startIndex = (currentPage - 1) * filesPerPage;
    const endIndex = startIndex + filesPerPage;
    return filteredFiles.slice(startIndex, endIndex);
  }, [filteredFiles, currentPage, filesPerPage]);
  
  // Update paginatedFiles when paginated memoized value changes
  useEffect(() => {
    setPaginatedFiles(paginated);
  }, [paginated]);
  
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
  
  // Handle page change with scroll to top
  const handlePageChange = useCallback((event, newPage) => {
    setCurrentPage(newPage);
    // Scroll to top of gallery
    if (galleryScrollRef.current) {
      galleryScrollRef.current.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);
  
  // Handle filter changes
  const handleFilterChange = (filterName, value) => {
    switch(filterName) {
      case 'images':
        setShowImages(value);
        break;
      case 'audio':
        setShowAudio(value);
        break;
      case 'userUploads':
        setShowUserUploads(value);
        break;
      case 'aiGenerated':
        setShowAiGenerated(value);
        break;
      default:
        break;
    }
  };
  
  // Handle sort changes
  const handleSortChange = (event) => {
    setSortBy(event.target.value);
  };
  
  // Handle sort direction change
  const handleSortDirectionChange = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

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
      
      <Paper sx={{ p: 2, mb: 3 }} ref={galleryScrollRef}>
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
        
        {/* Filter and Sort Controls */}
        <Box sx={{ mt: 2, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
          {/* Filters */}
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" gutterBottom>Filters</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {/* Type Filters */}
              <FormGroup row sx={{ mr: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox 
                      checked={showImages} 
                      onChange={(e) => handleFilterChange('images', e.target.checked)} 
                    />
                  }
                  label="Images"
                />
                <FormControlLabel
                  control={
                    <Checkbox 
                      checked={showAudio} 
                      onChange={(e) => handleFilterChange('audio', e.target.checked)} 
                    />
                  }
                  label="Audio"
                />
              </FormGroup>
              
              {/* Source Filters */}
              <FormGroup row>
                <FormControlLabel
                  control={
                    <Checkbox 
                      checked={showUserUploads} 
                      onChange={(e) => handleFilterChange('userUploads', e.target.checked)} 
                    />
                  }
                  label="User Uploads"
                />
                <FormControlLabel
                  control={
                    <Checkbox 
                      checked={showAiGenerated} 
                      onChange={(e) => handleFilterChange('aiGenerated', e.target.checked)} 
                    />
                  }
                  label="AI Generated"
                />
              </FormGroup>
            </Box>
          </Box>
          
          {/* Sorting */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>Sort by</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <FormControl variant="outlined" size="small" sx={{ minWidth: 150 }}>
                <Select
                  value={sortBy}
                  onChange={handleSortChange}
                >
                  <MenuItem value="createTime">Date</MenuItem>
                  <MenuItem value="filename">Filename</MenuItem>
                  <MenuItem value="fileId">File ID</MenuItem>
                </Select>
              </FormControl>
              <Button 
                size="small" 
                onClick={handleSortDirectionChange}
                sx={{ ml: 1 }}
              >
                {sortDirection === 'asc' ? '↑ Ascending' : '↓ Descending'}
              </Button>
            </Box>
          </Box>
        </Box>
        
        <Box sx={{ mt: 2, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' } }}>
          <Typography variant="body2" color="text.secondary">
            {filteredFiles.length} of {mediaFiles.length} media files {isLimited && `(limited to first ${maxFiles} files)`}
          </Typography>
          
          {filteredFiles.length > filesPerPage && (
            <Box sx={{ mt: { xs: 1, sm: 0 } }}>
              <Typography variant="body2" color="text.secondary" sx={{ display: 'inline-block', mr: 1 }}>
                Page {currentPage} of {Math.ceil(filteredFiles.length / filesPerPage)}
              </Typography>
              <Button 
                size="small" 
                variant="outlined" 
                sx={{ ml: 1 }}
                onClick={() => setFilesPerPage(prev => prev === 100 ? 250 : prev === 250 ? 500 : 100)}
              >
                {filesPerPage} per page
              </Button>
            </Box>
          )}
        </Box>
      </Paper>

      {filteredFiles.length === 0 ? (
        <Typography variant="body1" sx={{ textAlign: 'center', my: 4 }}>
          No media files found matching your search criteria.
        </Typography>
      ) : (
        <>
          {/* Top pagination controls */}
          {filteredFiles.length > filesPerPage && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, mb: 2 }}>
              <Pagination 
                count={Math.ceil(filteredFiles.length / filesPerPage)} 
                page={currentPage} 
                onChange={handlePageChange} 
                color="primary" 
                showFirstButton 
                showLastButton
                size="medium"
              />
            </Box>
          )}
          
          <Box 
            className="media-gallery-container"
            sx={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '8px',
            justifyContent: 'flex-start',
            // Add padding to account for scrollbar
            pr: { xs: 1, sm: 2 },
            // Fixed height with scrolling for media grid
            height: { xs: 'auto', md: 'calc(100vh - 350px)' },
            maxHeight: { xs: 'auto', md: 'calc(100vh - 350px)' },
            overflow: { xs: 'visible', md: 'scroll' },
            // Always force scrolling to be visible
            overflowY: { md: 'scroll' },
            // Add bottom padding to ensure last row is fully visible
            pb: 4
          }}>
            {paginatedFiles.map((file, index) => {
              // Calculate the global index in the filteredFiles array
              const globalIndex = (currentPage - 1) * filesPerPage + index;
              
              return (
                <Box 
                  key={`${file.id}-${globalIndex}`}
                  onClick={() => handleViewMedia(file, globalIndex)}
                  sx={{
                    position: 'relative',
                    width: { xs: '100%', sm: '48%', md: '32%', lg: '24%', xl: '19%' },
                    cursor: 'pointer',
                    '&:hover': {
                      opacity: 0.9,
                      boxShadow: '0 0 10px rgba(0,0,0,0.2)'
                    },
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
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                    onClick={(e) => e.stopPropagation()} // Prevent duplicate events
                  >
                    {file.originalFilename || file.id}
                  </Box>
                </Box>
              );
            })}
          </Box>
          
          {/* Bottom pagination controls - visible on both mobile and desktop */}
          {filteredFiles.length > filesPerPage && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 2, position: 'sticky', bottom: 0, pb: 2, bgcolor: 'background.paper', zIndex: 1, pt: 2, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
              <Pagination 
                count={Math.ceil(filteredFiles.length / filesPerPage)} 
                page={currentPage} 
                onChange={handlePageChange} 
                color="primary" 
                showFirstButton 
                showLastButton
                size="large"
              />
            </Box>
          )}
        </>
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
              
              {selectedMedia.displayFilename && (
                <Box sx={{ minWidth: '200px', flex: 1 }}>
                  <Typography variant="subtitle2">Display Filename</Typography>
                  <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                    {selectedMedia.displayFilename}
                  </Typography>
                </Box>
              )}
              
              <Box sx={{ minWidth: '200px', flex: 1 }}>
                <Typography variant="subtitle2">Source Type</Typography>
                <Typography variant="body2">
                  {selectedMedia.sourceType === 'user_upload' ? 'User Upload' : 
                   selectedMedia.sourceType === 'ai_generated' ? 'AI Generated' : 
                   selectedMedia.sourceType || 'Unknown'}
                </Typography>
              </Box>
              
              <Box sx={{ minWidth: '200px', flex: 2 }}>
                <Typography variant="subtitle2">From Conversation</Typography>
                <Box 
                  component={Button}
                  onClick={() => navigateToConversation(selectedMedia.conversationId)}
                  sx={{ 
                    textAlign: 'left',
                    p: 0,
                    textTransform: 'none',
                    justifyContent: 'flex-start',
                    fontWeight: 'normal',
                    textDecoration: 'underline',
                    color: 'primary.main',
                    whiteSpace: 'normal',
                    lineHeight: 1.2,
                    wordBreak: 'break-word'
                  }}>
                  {selectedMedia.conversationTitle}
                </Box>
              </Box>
              
              {selectedMedia.createDate && (
                <Box sx={{ minWidth: '200px', flex: 1 }}>
                  <Typography variant="subtitle2">Date</Typography>
                  <Typography variant="body2">
                    {new Date(selectedMedia.createDate).toLocaleString()}
                  </Typography>
                </Box>
              )}
              
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