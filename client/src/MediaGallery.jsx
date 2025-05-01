import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Grid, 
  Card, 
  CardMedia, 
  CardContent, 
  CardActions,
  Button,
  CircularProgress,
  Divider,
  Paper,
  InputAdornment,
  IconButton,
  Tooltip,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

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

export default function MediaGallery() {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const loadMedia = async () => {
      try {
        setLoading(true);
        const data = await fetchAllMedia();
        setMediaFiles(data.mediaFiles || []);
        setFilteredFiles(data.mediaFiles || []);
      } catch (err) {
        setError(`Failed to load media files: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadMedia();
  }, []);

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
  const handleViewMedia = (media) => {
    setSelectedMedia(media);
    setDialogOpen(true);
  };

  // Render media item based on type
  const renderMediaItem = (file) => {
    const isImage = file.type === 'image';
    const isAudio = file.type === 'audio';
    const isVideo = file.type === 'video';
    
    if (isImage) {
      return (
        <CardMedia
          component="img"
          height="200"
          image={file.path}
          alt={file.id || 'Media file'}
          sx={{ objectFit: 'contain', bgcolor: '#f5f5f5' }}
        />
      );
    } else if (isAudio) {
      return (
        <Box sx={{ p: 2, textAlign: 'center', bgcolor: '#f0f7ff', height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="h6" color="primary" gutterBottom>
            Audio File
          </Typography>
          <audio controls src={file.path} style={{ width: '100%', marginBottom: '10px' }} />
          <Typography variant="caption" color="text.secondary">
            {file.originalFilename}
          </Typography>
        </Box>
      );
    } else if (isVideo) {
      return (
        <Box sx={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#fdf7ff' }}>
          <Typography variant="h6" color="primary" gutterBottom>
            Video File
          </Typography>
          <video 
            controls 
            src={file.path} 
            style={{ maxWidth: '100%', maxHeight: '140px' }} 
            preload="metadata"
          />
        </Box>
      );
    } else {
      return (
        <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f5f5f5' }}>
          <Typography variant="body2" color="text.secondary">
            {file.type || 'Unknown'} file
          </Typography>
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
      </Typography>
      
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
        <Grid container spacing={3}>
          {filteredFiles.map((file, index) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={`${file.id}-${index}`}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {renderMediaItem(file)}
                <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle1" component="div" noWrap>
                {file.originalFilename || file.id}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                ID: {file.id}
                </Typography>
                {file.type && (
          <Typography variant="body2" color="text.secondary" noWrap>
            Type: {file.type.charAt(0).toUpperCase() + file.type.slice(1)}
          </Typography>
        )}
        {file.conversationTitle && (
                    <Typography variant="body2" color="text.secondary" noWrap>
                      From: {file.conversationTitle}
                    </Typography>
                  )}
                </CardContent>
                <CardActions>
                  <Button size="small" onClick={() => handleViewMedia(file)}>
                    View Details
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Media Details Dialog */}
      {selectedMedia && (
        <Dialog 
          open={dialogOpen} 
          onClose={() => setDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Media Details
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mb: 2 }}>
              {selectedMedia.type === 'image' ? (
                <Box sx={{ textAlign: 'center', my: 2 }}>
                  <img 
                    src={selectedMedia.path} 
                    alt={selectedMedia.id} 
                    style={{ maxWidth: '100%', maxHeight: '60vh' }}
                  />
                </Box>
              ) : selectedMedia.type === 'audio' ? (
                <Box sx={{ textAlign: 'center', my: 2, p: 3, bgcolor: '#f0f7ff', borderRadius: 2 }}>
                  <Typography variant="h6" color="primary" gutterBottom>
                    Audio File
                  </Typography>
                  <audio controls src={selectedMedia.path} style={{ width: '100%' }} />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    {selectedMedia.originalFilename}
                  </Typography>
                </Box>
              ) : selectedMedia.type === 'video' ? (
                <Box sx={{ textAlign: 'center', my: 2, p: 3, bgcolor: '#fdf7ff', borderRadius: 2 }}>
                  <Typography variant="h6" color="primary" gutterBottom>
                    Video File
                  </Typography>
                  <video 
                    controls 
                    src={selectedMedia.path}
                    style={{ maxWidth: '100%', maxHeight: '50vh' }} 
                  />
                </Box>
              ) : (
                <Typography variant="body1">
                  {selectedMedia.type || 'Unknown'} File
                </Typography>
              )}
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2">File ID:</Typography>
                <Typography variant="body1" gutterBottom>{selectedMedia.id}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2">Original Filename:</Typography>
                <Typography variant="body1" gutterBottom>{selectedMedia.originalFilename}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2">Conversation:</Typography>
                <Typography variant="body1" gutterBottom>{selectedMedia.conversationTitle}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2">Full Path:</Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>{selectedMedia.path}</Typography>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Close</Button>
            <Button 
              variant="contained" 
              onClick={() => navigateToConversation(selectedMedia.conversationId)}
            >
              View Conversation
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
