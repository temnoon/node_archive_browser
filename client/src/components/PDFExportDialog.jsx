import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Stepper,
  Step,
  StepLabel,
  Typography,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Select,
  MenuItem,
  TextField,
  Divider,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Grid,
  Paper
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  PictureAsPdf as PdfIcon,
  GetApp as DownloadIcon,
  Settings as SettingsIcon,
  Visibility as PreviewIcon
} from '@mui/icons-material';

/**
 * PDF Export Dialog Component
 * Provides a comprehensive interface for exporting conversations to PDF
 */
export default function PDFExportDialog({ 
  open, 
  onClose, 
  conversationData,
  selectedMessages = [],
  onSelectionChange = () => {},
  exportType = 'conversation' // 'conversation', 'messages', 'multiple'
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [exportOptions, setExportOptions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  
  // Export configuration state
  const [config, setConfig] = useState({
    layout: {
      format: 'A4',
      margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' }
    },
    style: {
      fontFamily: 'Times, serif',
      fontSize: '12pt',
      includeHeaders: true,
      includePageNumbers: true
    },
    filter: {
      includeToolMessages: false,
      includeSystemMessages: false,
      roles: ['user', 'assistant']
    },
    title: conversationData?.title || 'Conversation Export'
  });

  const steps = [
    'Select Content',
    'Customize Layout', 
    'Preview & Export'
  ];

  // Load export options on mount
  useEffect(() => {
    if (open) {
      loadExportOptions();
    }
  }, [open]);

  const loadExportOptions = async () => {
    try {
      const response = await fetch('/api/pdf/options');
      if (response.ok) {
        const options = await response.json();
        setExportOptions(options);
      }
    } catch (err) {
      console.error('Failed to load export options:', err);
    }
  };

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      handleExport();
    } else {
      setActiveStep(prev => prev + 1);
      if (activeStep === 1) {
        loadPreview();
      }
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const handleConfigChange = (section, key, value) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  const handleRoleToggle = (role) => {
    const currentRoles = config.filter.roles;
    const newRoles = currentRoles.includes(role)
      ? currentRoles.filter(r => r !== role)
      : [...currentRoles, role];
    
    handleConfigChange('filter', 'roles', newRoles);
  };

  const loadPreview = async () => {
    if (!conversationData) return;
    
    setLoading(true);
    try {
      const requestBody = {
        ...config,
        messageIds: exportType === 'messages' ? selectedMessages : null
      };

      const response = await fetch(`/api/pdf/preview/${conversationData.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const previewData = await response.json();
        setPreview(previewData);
      } else {
        throw new Error('Failed to generate preview');
      }
    } catch (err) {
      setError('Failed to generate preview: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!conversationData) return;
    
    setLoading(true);
    setError('');
    
    try {
      let endpoint;
      let requestBody = { ...config };

      if (exportType === 'messages') {
        endpoint = '/api/pdf/messages';
        requestBody.conversationId = conversationData.id;
        requestBody.messageIds = selectedMessages;
      } else {
        endpoint = `/api/pdf/conversation/${conversationData.id}`;
        if (selectedMessages.length > 0) {
          requestBody.messageIds = selectedMessages;
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        // Download the PDF
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${config.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        onClose();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }
    } catch (err) {
      setError('Export failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return renderContentSelection();
      case 1:
        return renderLayoutCustomization();
      case 2:
        return renderPreviewAndExport();
      default:
        return null;
    }
  };

  const renderContentSelection = () => (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        Select Content to Export
      </Typography>
      
      <FormControl component="fieldset" sx={{ mt: 2 }}>
        <FormLabel component="legend">Message Types</FormLabel>
        <FormGroup row>
          {exportOptions?.filters?.roles?.map(role => (
            <FormControlLabel
              key={role}
              control={
                <Checkbox
                  checked={config.filter.roles.includes(role)}
                  onChange={() => handleRoleToggle(role)}
                />
              }
              label={role.charAt(0).toUpperCase() + role.slice(1)}
            />
          ))}
        </FormGroup>
      </FormControl>

      <Box sx={{ mt: 3 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={config.filter.includeToolMessages}
              onChange={(e) => handleConfigChange('filter', 'includeToolMessages', e.target.checked)}
            />
          }
          label="Include tool messages"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={config.filter.includeSystemMessages}
              onChange={(e) => handleConfigChange('filter', 'includeSystemMessages', e.target.checked)}
            />
          }
          label="Include system messages"
        />
      </Box>

      {exportType === 'messages' && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Selected Messages: {selectedMessages.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Go back to the conversation to select specific messages
          </Typography>
        </Box>
      )}

      <TextField
        fullWidth
        label="Export Title"
        value={config.title}
        onChange={(e) => setConfig(prev => ({ ...prev, title: e.target.value }))}
        sx={{ mt: 3 }}
      />
    </Box>
  );

  const renderLayoutCustomization = () => (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        Customize Layout & Style
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Page Layout</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <FormLabel>Page Format</FormLabel>
                <Select
                  value={config.layout.format}
                  onChange={(e) => handleConfigChange('layout', 'format', e.target.value)}
                >
                  {exportOptions?.layouts?.formats?.map(format => (
                    <MenuItem key={format} value={format}>{format}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <FormControl fullWidth>
                <FormLabel>Margins</FormLabel>
                <Select
                  value={JSON.stringify(config.layout.margin)}
                  onChange={(e) => handleConfigChange('layout', 'margin', JSON.parse(e.target.value))}
                >
                  {exportOptions?.layouts?.margins && Object.entries(exportOptions.layouts.margins).map(([name, margin]) => (
                    <MenuItem key={name} value={JSON.stringify(margin)}>
                      {name.charAt(0).toUpperCase() + name.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </AccordionDetails>
          </Accordion>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Typography</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <FormLabel>Font Family</FormLabel>
                <Select
                  value={config.style.fontFamily}
                  onChange={(e) => handleConfigChange('style', 'fontFamily', e.target.value)}
                >
                  {exportOptions?.styles?.fonts?.map(font => (
                    <MenuItem key={font} value={font}>{font.split(',')[0]}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <FormControl fullWidth sx={{ mb: 2 }}>
                <FormLabel>Font Size</FormLabel>
                <Select
                  value={config.style.fontSize}
                  onChange={(e) => handleConfigChange('style', 'fontSize', e.target.value)}
                >
                  {exportOptions?.styles?.fontSizes?.map(size => (
                    <MenuItem key={size} value={size}>{size}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <FormControlLabel
                control={
                  <Checkbox
                    checked={config.style.includeHeaders}
                    onChange={(e) => handleConfigChange('style', 'includeHeaders', e.target.checked)}
                  />
                }
                label="Include headers"
              />
              
              <FormControlLabel
                control={
                  <Checkbox
                    checked={config.style.includePageNumbers}
                    onChange={(e) => handleConfigChange('style', 'includePageNumbers', e.target.checked)}
                  />
                }
                label="Include page numbers"
              />
            </AccordionDetails>
          </Accordion>
        </Grid>
      </Grid>
    </Box>
  );

  const renderPreviewAndExport = () => (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        Preview & Export
      </Typography>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : preview ? (
        <Paper sx={{ p: 3, mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            {preview.title}
          </Typography>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            <Chip label={`${preview.messageCount} messages`} size="small" />
            <Chip label={`~${preview.estimatedPages} pages`} size="small" />
            <Chip label={config.layout.format} size="small" />
            <Chip label={config.style.fontFamily.split(',')[0]} size="small" />
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle2" gutterBottom>
            Content Preview:
          </Typography>
          
          {preview.preview.map((msg, index) => (
            <Box key={index} sx={{ mb: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {msg.role} {msg.hasMedia && '📎'}
              </Typography>
              <Typography variant="body2" noWrap>
                {msg.textPreview}
              </Typography>
            </Box>
          ))}
        </Paper>
      ) : (
        <Alert severity="info">
          Preview will be generated when you proceed to this step.
        </Alert>
      )}
    </Box>
  );

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { minHeight: '70vh' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PdfIcon />
        Export to PDF
      </DialogTitle>
      
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {renderStepContent()}
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose}>
          Cancel
        </Button>
        
        {activeStep > 0 && (
          <Button onClick={handleBack}>
            Back
          </Button>
        )}
        
        <Button 
          variant="contained" 
          onClick={handleNext}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : 
                   activeStep === steps.length - 1 ? <DownloadIcon /> : null}
        >
          {activeStep === steps.length - 1 ? 'Export PDF' : 'Next'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
