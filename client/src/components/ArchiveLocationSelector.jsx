import React, { useState, useEffect } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Paper, 
  Typography, 
  Alert, 
  CircularProgress,
  Chip,
  FormHelperText
} from '@mui/material';

export default function ArchiveLocationSelector() {
  const [archiveRoot, setArchiveRoot] = useState('');
  const [archiveInfo, setArchiveInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  // Load current archive location on mount
  useEffect(() => {
    const loadArchiveLocation = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/archive-info');
        if (response.ok) {
          const info = await response.json();
          setArchiveRoot(info.archiveRoot || '');
          setArchiveInfo(info);
        }
      } catch (err) {
        console.error('Failed to load archive location:', err);
        setError('Failed to load current archive location');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadArchiveLocation();
  }, []);

  const handleChange = (e) => {
    setArchiveRoot(e.target.value);
    // Clear any previous status messages
    setSuccess(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!archiveRoot) {
      setError('Please provide an archive location');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(false);
      
      const response = await fetch('/api/set-archive-root', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archiveRoot })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update archive location');
      }
      
      // Show success message
      setSuccess(true);
      
      // Refresh archive info
      const infoResponse = await fetch('/api/archive-info');
      if (infoResponse.ok) {
        const info = await infoResponse.json();
        setArchiveInfo(info);
      }
      
    } catch (err) {
      console.error('Error updating archive location:', err);
      setError(err.message || 'Failed to update archive location');
    } finally {
      setIsLoading(false);
    }
  };



  const getStatusChip = () => {
    if (!archiveInfo) return null;
    
    if (!archiveInfo.exists) {
      return <Chip label="Directory Not Found" color="error" size="small" />;
    }
    
    if (!archiveInfo.valid) {
      return <Chip label="Invalid Archive" color="warning" size="small" />;
    }
    
    return <Chip label="Valid Archive" color="success" size="small" />;
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h5" gutterBottom>
        Current Archive Location
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Select the location of your exploded archive. This is the folder containing your processed conversations.
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Archive location updated successfully! The browser will now load conversations from the new location.
        </Alert>
      )}
      
      <Alert severity="info" sx={{ mb: 2 }}>
        Folder dialog is only available in the desktop app. Please enter the path manually.
      </Alert>
      
      <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
        <TextField
          fullWidth
          label="Archive Location"
          value={archiveRoot}
          onChange={handleChange}
          placeholder="e.g., /Users/username/exploded_archive_node"
        />
      </Box>
      
      {archiveInfo && (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Status:
          </Typography>
          {getStatusChip()}
          {archiveInfo.reason && (
            <Typography variant="caption" color="text.secondary">
              ({archiveInfo.reason})
            </Typography>
          )}
        </Box>
      )}
      
      <FormHelperText sx={{ mb: 2 }}>
        The archive should contain individual conversation folders (with names like "2024-05-22_Title_UUID" or UUID format).
        After importing a new archive, this location will be automatically updated.
      </FormHelperText>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={isLoading || !archiveRoot}
        >
          {isLoading ? <CircularProgress size={24} sx={{ mr: 1 }} color="inherit" /> : null}
          Save & Apply
        </Button>
      </Box>
    </Paper>
  );
}
