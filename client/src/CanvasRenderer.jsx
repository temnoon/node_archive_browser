import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Button, CircularProgress, Alert } from '@mui/material';

// Canvas node types and their renderers
const NODE_RENDERERS = {
  text: TextNodeRenderer,
  image: ImageNodeRenderer,
  group: GroupNodeRenderer,
  default: DefaultNodeRenderer
};

// Default canvas dimensions (if not specified in the canvas data)
const DEFAULT_CANVAS_DIMENSIONS = {
  width: 1000,
  height: 800
};

/**
 * Main Canvas Renderer component
 */
export default function CanvasRenderer({ canvasId, conversationFolder }) {
  const [canvasData, setCanvasData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Fetch canvas data on component mount
  useEffect(() => {
    if (!canvasId) {
      setError('No canvas ID provided');
      setLoading(false);
      return;
    }
    
    fetchCanvasData(canvasId);
  }, [canvasId]);
  
  // Fetch canvas data from the API
  const fetchCanvasData = async (id) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/canvas/${id}`);
      
      if (!response.ok) {
        throw new Error(`Error fetching canvas data: ${response.status}`);
      }
      
      const data = await response.json();
      setCanvasData(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching canvas data:', err);
      setError(`Failed to load canvas: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }
  
  if (!canvasData) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        Canvas content unavailable.
      </Alert>
    );
  }
  
  // Get canvas dimensions
  const canvasDimensions = canvasData.dimensions || DEFAULT_CANVAS_DIMENSIONS;
  
  return (
    <Paper 
      sx={{ 
        overflow: 'auto',
        mb: 2,
        p: 2,
        border: '1px solid #e0e0e0',
        backgroundColor: '#fafafa'
      }}
    >
      <Typography variant="subtitle1" gutterBottom>
        Canvas View: {canvasData.title || 'Untitled Canvas'}
      </Typography>
      
      <Box 
        sx={{
          position: 'relative',
          width: '100%',
          height: 500,
          overflow: 'auto',
          border: '1px solid #e0e0e0',
          backgroundColor: '#ffffff'
        }}
      >
        {/* Main canvas container */}
        <Box 
          sx={{
            position: 'relative',
            width: canvasDimensions.width,
            height: canvasDimensions.height,
            overflow: 'hidden'
          }}
        >
          {/* Render nodes */}
          {canvasData.nodes && canvasData.nodes.map(node => (
            <CanvasNode key={node.id} node={node} />
          ))}
        </Box>
      </Box>
    </Paper>
  );
}

/**
 * Canvas Node component - dispatches to the appropriate renderer
 */
function CanvasNode({ node }) {
  // Choose the appropriate renderer based on node type
  const NodeRenderer = NODE_RENDERERS[node.type] || NODE_RENDERERS.default;
  
  // Position the node
  const nodeStyle = {
    position: 'absolute',
    left: node.position?.x || 0,
    top: node.position?.y || 0,
    width: node.dimensions?.width || 'auto',
    height: node.dimensions?.height || 'auto',
    transform: node.transform || 'none',
    zIndex: node.z_index || 0
  };
  
  return (
    <Box sx={nodeStyle}>
      <NodeRenderer node={node} />
    </Box>
  );
}

/**
 * Text Node Renderer
 */
function TextNodeRenderer({ node }) {
  if (!node.content || !node.content.text) {
    return <Typography variant="body2">Empty Text Node</Typography>;
  }
  
  // Handle simple text content
  if (typeof node.content.text === 'string') {
    return <Typography variant="body1">{node.content.text}</Typography>;
  }
  
  // Handle rich text content (array of segments)
  return (
    <Typography variant="body1">
      {node.content.text.map((segment, index) => {
        if (typeof segment === 'string') {
          return <span key={index}>{segment}</span>;
        } else if (segment && segment.text) {
          // Apply styling based on segment properties
          const style = {
            fontWeight: segment.bold ? 'bold' : 'normal',
            fontStyle: segment.italic ? 'italic' : 'normal',
            textDecoration: segment.underline ? 'underline' : 'none',
            color: segment.color || 'inherit'
          };
          
          return <span key={index} style={style}>{segment.text}</span>;
        }
        return null;
      })}
    </Typography>
  );
}

/**
 * Image Node Renderer
 */
function ImageNodeRenderer({ node }) {
  if (!node.content || !node.content.src) {
    return <Typography variant="body2">Missing Image Source</Typography>;
  }
  
  // Handle image sources that might be media references
  const imageSrc = node.content.src;
  let displaySrc = imageSrc;
  
  // Check if it's a media reference
  if (imageSrc.startsWith('file-') || imageSrc.includes('file_')) {
    // Convert to media API endpoint
    // This would need conversation folder context, which could be passed down
    // For now, show a placeholder
    displaySrc = `/api/media-file/${imageSrc}`; // This API endpoint would need to be implemented
  }
  
  return (
    <Box 
      sx={{ 
        width: '100%', 
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden'
      }}
    >
      <img 
        src={displaySrc} 
        alt={node.content.alt || "Canvas image"} 
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: node.content.objectFit || 'contain'
        }}
      />
    </Box>
  );
}

/**
 * Group Node Renderer - container for other nodes
 */
function GroupNodeRenderer({ node }) {
  if (!node.children || !Array.isArray(node.children)) {
    return <Typography variant="body2">Empty Group</Typography>;
  }
  
  return (
    <Box 
      sx={{ 
        width: '100%', 
        height: '100%',
        position: 'relative',
        border: node.style?.border ? `1px solid ${node.style.borderColor || '#e0e0e0'}` : 'none',
        backgroundColor: node.style?.backgroundColor || 'transparent',
        borderRadius: node.style?.borderRadius || 0
      }}
    >
      {node.children.map(childNode => (
        <CanvasNode key={childNode.id} node={childNode} />
      ))}
    </Box>
  );
}

/**
 * Default Node Renderer for unknown node types
 */
function DefaultNodeRenderer({ node }) {
  return (
    <Box 
      sx={{ 
        p: 1, 
        border: '1px dashed #ccc',
        backgroundColor: '#f5f5f5',
        borderRadius: 1
      }}
    >
      <Typography variant="caption" color="text.secondary">
        Unknown node type: {node.type}
      </Typography>
    </Box>
  );
}
