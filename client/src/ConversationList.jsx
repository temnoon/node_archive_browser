import React, { useEffect, useState } from 'react';
import { List, ListItem, ListItemText, Box } from '@mui/material';
import { Link } from 'react-router-dom';

function fetchAPI(url) {
  return fetch(url)
    .then(res => {
      if (!res.ok) throw new Error('API error');
      return res.json();
    });
}

export default function ConversationList() {
  const [conversations, setConversations] = useState([]);
  useEffect(() => {
    fetchAPI('/api/conversations')
      .then(res => setConversations(res.items || []));
  }, []);
  return (
    <Box>
      <List>
        {conversations.map(conv => (
          <ListItem component={Link} to={`/conversations/${conv.id}`} key={conv.id}>
            <ListItemText
              primary={conv.title || conv.id}
              secondary={`${conv.create_time} (${conv.message_count || 0} messages)${conv.gizmo_ids ? ' | Gizmo(s): ' + conv.gizmo_ids.join(', ') : ''}${conv.models ? ' | Model(s): ' + conv.models.join(', ') : ''}`}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}
