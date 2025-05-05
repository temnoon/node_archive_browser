import React, { useEffect, useState } from 'react';
import { List, ListItem, ListItemText, Box, LinearProgress, Typography, Alert } from '@mui/material';
import { Link } from 'react-router-dom';
import { fetchAPI } from './utils/fetchUtils';

export default function ConversationList() {
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    
    fetchAPI('/api/conversations', {
      maxRetries: 3,
      retryDelay: 1000
    })
      .then(res => {
        setConversations(res.items || []);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Error loading conversations:', err);
        setError(err.message || 'Failed to load conversations');
        setIsLoading(false);
      });
  }, []);
  
  // Display loading state
  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2 }} variant="body1" align="center">
          Loading conversations...
        </Typography>
      </Box>
    );
  }
  
  // Display error state
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {error}
        </Alert>
        <Typography sx={{ mt: 2 }} variant="body2" align="center">
          Try refreshing the page
        </Typography>
      </Box>
    );
  }
  
  // Display empty state
  if (conversations.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1">
          No conversations found
        </Typography>
      </Box>
    );
  }
  
  // Display conversation list
  return (
    <Box>
      <List>
        {conversations.map(conv => (
          <ListItem 
            component={Link} 
            to={`/conversations/${conv.id}`} 
            key={conv.id}
            sx={{ 
              borderBottom: '1px solid #eee',
              textDecoration: 'none',
              color: 'inherit'
            }}
          >
            <ListItemText
              primary={conv.title || 'Untitled Conversation'}
              secondary={
                <React.Fragment>
                  {conv.create_time ? new Date(conv.create_time * 1000).toISOString().split('T')[0] : ''} 
                  {conv.message_count ? ` (${conv.message_count} messages)` : ''}
                  {conv.gizmo_ids && conv.gizmo_ids.length > 0 ? ' | Gizmo(s): ' + conv.gizmo_ids.join(', ') : ''}
                  {conv.models && conv.models.length > 0 ? ' | Model(s): ' + conv.models.join(', ') : ''}
                </React.Fragment>
              }
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}
