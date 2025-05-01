import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Switch,
  FormControlLabel,
  LinearProgress,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Collapse
} from '@mui/material';

// Using simple buttons instead of icon buttons to avoid dependency issues
const ExpandButton = ({ expanded, onClick }) => (
  <Button 
    size="small" 
    variant="text"
    onClick={onClick}
    sx={{ minWidth: 'auto', px: 1 }}
  >
    {expanded ? '▲' : '▼'}
  </Button>
);

const DEFAULT_CONFIG = {
  archiveType: 'openai',
  sourceDir: '',
  outputDir: '',
  archiveName: 'exploded_archive',
  conversationPattern: '{uuid}_{date}_{title}',
  preserveJson: true,
  mediaFolder: 'media',
  useIsoDate: true,
  useMessageReferences: true, // New option to avoid message content duplication
  skipFailedConversations: true // Skip failures and continue import
};

export default function ArchiveImportWizard() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false); // Separate loading state for preview
  const [error, setError] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [importProgress, setImportProgress] = useState(null);
  const [previewTimeout, setPreviewTimeout] = useState(null); // To store the timeout ID
  const [failedDetailsOpen, setFailedDetailsOpen] = useState(false);

  // Load saved config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/import/config');
        if (response.ok) {
          const savedConfig = await response.json();
          setConfig(savedConfig);
        }
      } catch (err) {
        console.error('Failed to load config:', err);
        // Use defaults - already set
      }
    };
    loadConfig();
    
    // Cleanup function for preview timeout
    return () => {
      if (previewTimeout) {
        clearTimeout(previewTimeout);
      }
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (e) => {
    const { name, checked } = e.target;
    setConfig(prev => ({ ...prev, [name]: checked }));
  };

  const handlePreview = async () => {
    if (!config.sourceDir) {
      setError('Please provide a source directory');
      return;
    }
    
    try {
      // Set preview loading state
      setIsPreviewLoading(true);
      
      // Add timeout to prevent UI hanging indefinitely
      const timeout = setTimeout(() => {
        setIsPreviewLoading(false);
        setError('Preview generation timed out. The source directory might be too large. Try proceeding with the import directly.');
      }, 30000); // 30 second timeout
      
      setPreviewTimeout(timeout);
      
      const response = await fetch('/api/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      // Clear timeout since request completed
      clearTimeout(timeout);
      setPreviewTimeout(null);
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const previewData = await response.json();
      setPreview(previewData);
      setPreviewOpen(true);
      setError(null);
    } catch (err) {
      setError(`Failed to generate preview: ${err.message}`);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/import/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      setError(null);
    } catch (err) {
      setError(`Failed to save config: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!config.sourceDir || !config.outputDir) {
      setError('Please provide both source and destination directories');
      return;
    }
    
    try {
      setIsLoading(true);
      const response = await fetch('/api/import/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      // Start polling for progress updates
      pollImportProgress();
      setError(null);
    } catch (err) {
      setError(`Failed to start import: ${err.message}`);
      setIsLoading(false);
    }
  };

  const pollImportProgress = async () => {
    let failedAttempts = 0;
    const MAX_FAILED_ATTEMPTS = 3;
    
    const checkProgress = async () => {
      try {
        const response = await fetch('/api/import/status');
        
        if (!response.ok) {
          failedAttempts++;
          // Show error but keep trying unless we exceed max attempts
          const errorMessage = `Server error: ${response.status}`;
          console.error(errorMessage);
          
          if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
            throw new Error(errorMessage);
          } else {
            // For transient errors, keep polling but show warning
            setError(`Warning: ${errorMessage} (retrying... ${failedAttempts}/${MAX_FAILED_ATTEMPTS})`);
            setTimeout(checkProgress, 2000); // Slightly longer interval for retry
            return;
          }
        }
        
        // Reset error counter on success
        failedAttempts = 0;
        
        const status = await response.json();
        setImportProgress(status);
        
        if (status.status === 'completed' || status.status === 'completed_with_errors') {
          setIsLoading(false);
          setError(null); // Clear any previous errors
        } else if (status.status === 'failed') {
          setIsLoading(false);
          setError(`Import failed: ${status.error || 'Unknown error'}`);
        } else {
          // Continue polling
          setTimeout(checkProgress, 1000);
        }
      } catch (err) {
        console.error('Error polling status:', err);
        setError(`Failed to get import status: ${err.message}`);
        setIsLoading(false);
      }
    };
    
    checkProgress();
  };

  // Function to get severity based on import status
  const getAlertSeverity = (status) => {
    if (status === 'completed') return 'success';
    if (status === 'completed_with_errors') return 'warning';
    if (status === 'failed') return 'error';
    return 'info';
  };

  // Function to get status message based on import status
  const getStatusMessage = (progress) => {
    if (!progress) return '';
    
    switch(progress.status) {
      case 'completed':
        return 'Import completed successfully!';
      case 'completed_with_errors':
        return `Import completed with ${progress.failedConversations?.length || 0} failed conversations.`;
      case 'failed':
        return `Import failed: ${progress.error || 'Unknown error'}`;
      case 'in_progress':
        return `Import in progress: ${progress.progress}%`;
      default:
        return 'Unknown status';
    }
  };

  // Render the failed conversations list if any
  const renderFailedConversations = () => {
    if (!importProgress?.failedConversations?.length) return null;
    
    const failedCount = importProgress.failedConversations.length;
    
    return (
      <Box sx={{ mt: 2 }}>
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            cursor: 'pointer',
            mb: 1
          }}
          onClick={() => setFailedDetailsOpen(!failedDetailsOpen)}
        >
          <Typography variant="body2" color="text.secondary">
            {failedCount} conversation{failedCount !== 1 ? 's' : ''} failed to process
          </Typography>
          <ExpandButton 
            expanded={failedDetailsOpen} 
            onClick={(e) => {
              e.stopPropagation();
              setFailedDetailsOpen(!failedDetailsOpen);
            }} 
          />
        </Box>
        
        <Collapse in={failedDetailsOpen}>
          <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto', p: 1 }}>
            <List dense disablePadding>
              {importProgress.failedConversations.map((failed, i) => (
                <ListItem key={i} divider={i < importProgress.failedConversations.length - 1}>
                  <ListItemText
                    primary={failed.title || `Conversation ${failed.id}`}
                    secondary={failed.error || 'Unknown error'}
                    primaryTypographyProps={{ variant: 'body2' }}
                    secondaryTypographyProps={{ variant: 'caption', color: 'error' }}
                  />
                </ListItem>
              ))}
              {importProgress.failedConversationsTruncated && (
                <ListItem>
                  <ListItemText
                    primary="More failed conversations not shown"
                    secondary="Check import_errors.json in the output directory for a full list"
                    primaryTypographyProps={{ variant: 'caption' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItem>
              )}
            </List>
          </Paper>
        </Collapse>
      </Box>
    );
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', my: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Archive Import Wizard
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {importProgress && (
          <Alert 
            severity={getAlertSeverity(importProgress.status)} 
            sx={{ mb: 3 }}
          >
            {getStatusMessage(importProgress)}
            
            {importProgress.status === 'in_progress' && (
              <Box sx={{ width: '100%', mt: 1 }}>
                <LinearProgress variant="determinate" value={importProgress.progress} />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Processed {importProgress.processedConversations} of {importProgress.totalConversations} conversations
                </Typography>
              </Box>
            )}
            
            {renderFailedConversations()}
          </Alert>
        )}
        
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Archive Type</InputLabel>
              <Select
                name="archiveType"
                value={config.archiveType}
                onChange={handleChange}
                label="Archive Type"
              >
                <MenuItem value="openai">OpenAI / ChatGPT</MenuItem>
                <MenuItem value="anthropic" disabled>Anthropic / Claude (Coming Soon)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Source Folder (unzipped export)"
              name="sourceDir"
              value={config.sourceDir}
              onChange={handleChange}
              helperText="Path to the unzipped export folder (e.g., /Users/you/Downloads/ChatGPT_export)"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Output Directory"
              name="outputDir"
              value={config.outputDir}
              onChange={handleChange}
              helperText="Where to create the exploded archive"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Exploded Archive Name"
              name="archiveName"
              value={config.archiveName}
              onChange={handleChange}
              helperText="Name of the main folder that will contain all exploded data"
            />
          </Grid>
          
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              Storage Options
            </Typography>
          </Grid>
          
          <Grid item xs={12}>
            <Tooltip title="Use references to message files instead of duplicating message content, significantly reducing disk space usage">
              <FormControlLabel
                control={
                  <Switch
                    checked={config.useMessageReferences}
                    onChange={handleSwitchChange}
                    name="useMessageReferences"
                  />
                }
                label="Use Message References (Recommended)"
              />
            </Tooltip>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 2 }}>
              Store message content only once and use references in conversation.json to reduce duplication
            </Typography>
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.preserveJson}
                  onChange={handleSwitchChange}
                  name="preserveJson"
                />
              }
              label="Preserve Original JSON"
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 2 }}>
              Store complete original JSON with all metadata instead of converting to markdown
            </Typography>
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.useIsoDate}
                  onChange={handleSwitchChange}
                  name="useIsoDate"
                />
              }
              label="Use ISO8601 Date Format"
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 2 }}>
              Format dates as YYYY-MM-DDThh-mm-ss for better sorting (e.g., 2023-04-30T14-30-00)
            </Typography>
          </Grid>
          
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              Error Handling
            </Typography>
          </Grid>
          
          <Grid item xs={12}>
            <Tooltip title="Continue the import process even if some conversations fail to process">
              <FormControlLabel
                control={
                  <Switch
                    checked={config.skipFailedConversations}
                    onChange={handleSwitchChange}
                    name="skipFailedConversations"
                  />
                }
                label="Skip Failed Conversations"
              />
            </Tooltip>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 2 }}>
              Continue processing even if some conversations fail (recommended for large archives)
            </Typography>
          </Grid>
          
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              Naming Options
            </Typography>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Conversation Folder Pattern"
              name="conversationPattern"
              value={config.conversationPattern}
              onChange={handleChange}
              helperText="Pattern for naming conversation folders. Available variables: {uuid}, {title}, {date}"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Media Folder Name"
              name="mediaFolder"
              value={config.mediaFolder}
              onChange={handleChange}
              helperText="Name of the folder that will contain media files for each conversation"
            />
          </Grid>
        </Grid>
        
        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
          <Button 
            variant="outlined" 
            onClick={handlePreview}
            disabled={isLoading || isPreviewLoading || !config.sourceDir}
            startIcon={isPreviewLoading ? <CircularProgress size={20} /> : null}
          >
            {isPreviewLoading ? 'Generating Preview...' : 'Preview Structure'}
          </Button>
          
          <Box>
            <Button 
              variant="outlined" 
              onClick={handleSaveConfig}
              disabled={isLoading || isPreviewLoading}
              sx={{ mr: 2 }}
            >
              Save as Default
            </Button>
            
            <Button 
              variant="contained" 
              color="primary" 
              onClick={handleImport}
              disabled={isLoading || isPreviewLoading || !config.sourceDir || !config.outputDir}
            >
              {isLoading ? <CircularProgress size={24} sx={{ mr: 1 }} color="inherit" /> : null}
              Import & Explode
            </Button>
          </Box>
        </Box>
      </Paper>
      
      {/* Preview Dialog */}
      <Dialog 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)} 
        maxWidth="md" 
        fullWidth
        sx={{ '& .MuiPaper-root': { maxHeight: '80vh' } }}
      >
        <DialogTitle>Folder Structure Preview</DialogTitle>
        <DialogContent>
          {preview ? (
            <Box sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', overflow: 'auto' }}>
              {preview.isGeneric && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  This is a generic preview. The actual structure may vary based on your archive.
                </Alert>
              )}
              {preview.folderStructure}
            </Box>
          ) : (
            <DialogContentText>
              {isPreviewLoading ? 'Generating preview...' : 'No preview available yet.'}
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}