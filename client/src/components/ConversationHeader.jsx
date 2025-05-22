import React from 'react';
import { Box, Typography } from '@mui/material';
import CanvasSummary from './CanvasSummary';

/**
 * ConversationHeader Component
 * Displays the title, date, and metadata for a conversation
 */
export default function ConversationHeader({ 
  data, 
  expandedCanvasId, 
  setExpandedCanvasId,
  logUnknownTypesWarning
}) {
  // Extract unique gizmo IDs and models from messages
  const gizmoIds = Array.from(new Set((data.messages || []).map(m => 
    m.message?.metadata?.gizmo_id).filter(Boolean)));
  const modelNames = Array.from(new Set((data.messages || []).map(m => 
    m.message?.metadata?.model_slug).filter(Boolean)));

  return (
    <Box sx={{ 
      position: 'sticky', 
      top: 0, 
      bgcolor: 'background.paper', 
      zIndex: 6, /* Higher than pagination */
      pb: 1,
      mb: 1, 
      borderBottom: '1px solid #eee'
    }}>
      <Typography variant="h5">{data.title || data.id}</Typography>
      <Typography variant="subtitle2" color="text.secondary">
        {data.create_time ? new Date(data.create_time * 1000).toISOString().split('T')[0] : ''}
        <span style={{ color: '#777', marginLeft: '10px' }}>
          ID: {data.id}
        </span>
      </Typography>
      
      {/* Gizmo IDs and Models */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {gizmoIds.length > 0 && (
          <Typography variant="subtitle2" color="text.secondary">
            Gizmo ID(s): {gizmoIds.join(', ')}
          </Typography>
        )}
        {modelNames.length > 0 && (
          <Typography variant="subtitle2" color="text.secondary">
            Model(s): {modelNames.join(', ')}
          </Typography>
        )}
      </Box>
      
      {/* Log unknown types to console instead of showing in UI */}
      {data.unknown_types && logUnknownTypesWarning && logUnknownTypesWarning()}
      
      {/* Display canvas summary */}
      {data.canvas_ids && data.canvas_ids.length > 0 && (
        <CanvasSummary 
          canvasIds={data.canvas_ids} 
          expandedCanvasId={expandedCanvasId}
          setExpandedCanvasId={setExpandedCanvasId}
          folder={data.folder}
        />
      )}
    </Box>
  );
}
