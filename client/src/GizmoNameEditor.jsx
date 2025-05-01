import React, { useState } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  TextField, 
  Typography, 
  Box, 
  Tooltip,
  Snackbar,
  Alert
} from '@mui/material';

/**
 * Component for editing Custom GPT names
 * 
 * @param {Object} props Component props
 * @param {boolean} props.open Dialog open state
 * @param {Function} props.onClose Function to call when dialog is closed
 * @param {string} props.gizmoId ID of the gizmo being edited
 * @param {string} props.currentName Current display name of the gizmo
 * @param {Function} props.onNameChange Function to call when name is successfully changed
 */
export default function GizmoNameEditor({ open, onClose, gizmoId, currentName, onNameChange }) {
  const [customName, setCustomName] = useState(currentName || gizmoId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Reset state when dialog opens with new gizmo
  React.useEffect(() => {
    if (open) {
      setCustomName(currentName || gizmoId || '');
      setIsSubmitting(false);
    }
  }, [open, gizmoId, currentName]);

  const handleSubmit = async () => {
    if (!customName.trim()) {
      setSnackbar({
        open: true,
        message: 'Name cannot be empty',
        severity: 'error'
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch(`/api/gizmos/${gizmoId}/name`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ customName: customName.trim() }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update name: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Show success message
      setSnackbar({
        open: true,
        message: 'Custom GPT name updated successfully',
        severity: 'success'
      });
      
      // Notify parent component
      if (onNameChange) {
        onNameChange(gizmoId, customName.trim());
      }
      
      // Close dialog after short delay
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Error updating Custom GPT name:', error);
      setSnackbar({
        open: true,
        message: error.message || 'Failed to update name',
        severity: 'error'
      });
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  const handleSnackbarClose = () => {
    setSnackbar({
      ...snackbar,
      open: false
    });
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Custom GPT Name</DialogTitle>
        <DialogContent>
          <Box sx={{ my: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Custom GPT ID:
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {gizmoId}
            </Typography>
          </Box>
          
          <TextField
            autoFocus
            label="Custom Name"
            fullWidth
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            margin="normal"
            helperText="Enter a name for this Custom GPT to make it more recognizable"
            disabled={isSubmitting}
          />
          
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            This name will be used across all conversations that include this Custom GPT.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            color="primary"
            disabled={isSubmitting || !customName.trim() || customName === currentName}
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
      
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
