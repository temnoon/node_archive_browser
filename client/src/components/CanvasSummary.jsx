import React from 'react';
import { Box, Typography, Chip, Collapse } from '@mui/material';
import CanvasRenderer from '../CanvasRenderer';

/**
 * CanvasSummary Component
 * Displays a summary of canvas content with expand/collapse functionality
 */
export default function CanvasSummary({ 
  canvasIds = [], 
  expandedCanvasId, 
  setExpandedCanvasId,
  folder
}) {
  if (!canvasIds || canvasIds.length === 0) return null;
  
  return (
    <Box sx={{ mb: 2, p: 1, bgcolor: '#f0f7ff', borderRadius: 1 }}>
      <Typography variant="subtitle2">Canvas Content:</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
        {canvasIds.map(canvasId => (
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
              conversationFolder={folder}
            />
          </Box>
        </Collapse>
      )}
    </Box>
  );
}
