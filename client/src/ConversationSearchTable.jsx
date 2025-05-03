// Copied from original, adapt as needed for Vite/React
import * as React from 'react';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { List, ListItem, ListItemText, CircularProgress, Box, TextField, MenuItem, Button, Paper, Pagination, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

// NOTE: For full-content search, this demo fetches all messages for each conversation on mount (can be slow for large archives)
// Cache of all fetched conversations and messages to avoid re-fetching
const cachedData = {
  conversations: [],
  messagesByConv: {},
  initialized: false
};

export default function ConversationSearchTable({ search, perPage, setPerPage }) {
  const [conversations, setConversations] = useState(cachedData.conversations);
  const [messagesByConv, setMessagesByConv] = useState(cachedData.messagesByConv); // {convId: [messages]}
  const [loading, setLoading] = useState(!cachedData.initialized);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', mediaOnly: false });
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();
  const listContainerRef = useRef(null);

  useEffect(() => {
    // Only fetch if not already cached
    if (cachedData.initialized) {
      return;
    }
    
    setLoading(true);
    // Fetch all pages of conversations
    async function fetchAllConversations() {
      let all = [];
      let pageNum = 1;
      let total = 0;
      do {
        const url = `/api/conversations?page=${pageNum}&limit=100`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch conversations');
        const data = await res.json();
        all = all.concat(data.items || []);
        total = data.total || 0;
        pageNum++;
      } while (all.length < total && total > 0);
      
      setConversations(all);
      cachedData.conversations = all;
      
      // Fetch all messages for each conversation for full-content search
      const allMessages = {};
      await Promise.all(all.map(async c => {
        try {
          const res = await fetch(`/api/conversations/${c.id}`);
          if (res.ok) {
            const d = await res.json();
            allMessages[c.id] = d.messages || [];
          } else {
            allMessages[c.id] = [];
          }
        } catch {
          allMessages[c.id] = [];
        }
      }));
      
      setMessagesByConv(allMessages);
      cachedData.messagesByConv = allMessages;
      cachedData.initialized = true;
      setLoading(false);
    }
    fetchAllConversations().catch(e => {
      setError(e.message);
      setLoading(false);
    });
  }, []);

  // Format timestamp to ISO8601 date
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp * 1000).toISOString().split('T')[0];
  };

  const handleFilterChange = (key, value) => setFilters(f => ({ ...f, [key]: value }));
  const handleMediaFilter = e => setFilters(f => ({ ...f, mediaOnly: e.target.checked }));
  // Use useMemo to cache filtered results when search or filters change
  const filtered = useMemo(() => conversations.filter(c => {
    // Date filter
    const timestamp = c.create_time || 0;
    const created = new Date(timestamp * 1000); // Convert UNIX timestamp to Date
    
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      // Reset the time to the beginning of the day
      from.setHours(0, 0, 0, 0);
      if (created < from) return false;
    }
    
    if (filters.dateTo) {
      // To-date is inclusive, so add 1 day
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999); // End of the day
      if (created > to) return false;
    }
    // Media filter
    if (filters.mediaOnly) {
      const hasMedia = (messagesByConv[c.id] || []).some(m => {
        // crude check: look for '![', '<img', 'data:image', or 'file://' or 'attachment' in content
        const content = m.content || '';
        return /!\[.*\]\(.*\)|<img|data:image|file:\/\/|attachment/i.test(content);
      });
      if (!hasMedia) return false;
    }
    // Search filter: match title/id or any message content
    if (search) {
      const s = search.toLowerCase();
      const titleMatch = (c.title || c.id || '').toLowerCase().includes(s);
      const msgMatch = (messagesByConv[c.id] || []).some(m => (m.content || '').toLowerCase().includes(s));
      return titleMatch || msgMatch;
    }
    return true;
  }), [conversations, search, filters.dateFrom, filters.dateTo, filters.mediaOnly, messagesByConv]);

  // Pagination logic - calculate these values unconditionally for React Hooks consistency
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageClamped = Math.max(1, Math.min(currentPage, totalPages));
  
  // Sort by creation date (newest first) - always call useMemo
  const sortedFiltered = useMemo(() => [...filtered].sort((a, b) => {
    return (b.create_time || 0) - (a.create_time || 0);
  }), [filtered]);
  
  // Paginate the results - always call useMemo
  const paginated = useMemo(() => 
    sortedFiltered.slice((pageClamped - 1) * perPage, pageClamped * perPage), 
    [sortedFiltered, pageClamped, perPage]
  );
  
  // Handle page change with auto-scroll to top of list
  const handlePageChange = useCallback((event, newPage) => {
    setCurrentPage(newPage);
    if (listContainerRef.current) {
      listContainerRef.current.scrollTop = 0;
    }
  }, []);

  // Early rendering for loading/error states
  if (loading) return <Box sx={{ p: 2, textAlign: 'center' }}><CircularProgress size={28} /></Box>;
  if (error) return <Box sx={{ p: 2, color: 'red' }}>{error}</Box>;
  return (
    <Box>
      {/* Filters and Controls */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="body2" sx={{ mb: 0.5 }}>Start Date</Typography>
            <TextField
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={filters.dateFrom}
              onChange={e => handleFilterChange('dateFrom', e.target.value)}
              sx={{ minWidth: '160px' }}
            />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="body2" sx={{ mb: 0.5 }}>End Date</Typography>
            <TextField
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={filters.dateTo}
              onChange={e => handleFilterChange('dateTo', e.target.value)}
              sx={{ minWidth: '160px' }}
            />
          </Box>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={filters.mediaOnly} onChange={handleMediaFilter} style={{ marginRight: 4 }} />
            Media only
          </label>
          <Button size="small" onClick={() => setFilters({ dateFrom: '', dateTo: '', mediaOnly: false })}>Clear</Button>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="body2" sx={{ mb: 0.5 }}>Items per page</Typography>
            <TextField
              type="number"
              size="small"
              value={perPage}
              onChange={e => setPerPage(Math.max(1, parseInt(e.target.value) || 10))}
              sx={{ width: 90 }}
              inputProps={{ min: 1 }}
            />
          </Box>
        </Box>
        
        {/* Top pagination controls */}
        {filtered.length > 0 && (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            mb: 1,
            overflow: 'hidden',
            position: 'sticky',
            top: '0',
            zIndex: 5,
            backgroundColor: 'white',
            borderBottom: '1px solid #eee',
            pb: 1,
            '& .MuiPagination-ul': {
              display: 'flex',
              width: '100%',
              justifyContent: 'center',
              '& .MuiPaginationItem-root': {
                margin: '0 2px' // Reduce margins between pagination items
              }
            }
          }}>
            <Pagination 
              count={totalPages} 
              page={pageClamped} 
              onChange={handlePageChange}
              size="small"
              siblingCount={1}           // Reduce sibling count to save space
              boundaryCount={1}          // Reduce boundary count to save space
              showFirstButton
              showLastButton
            />
          </Box>
        )}
      </Paper>
      
      {/* Scrollable conversation list */}
      <Paper 
        sx={{ 
          height: { xs: 'calc(100vh - 260px)', md: 'calc(100vh - 240px)' }, 
          overflow: 'auto',
          mb: 2,
          // Add space for scrollbar to prevent layout shift
          pr: { xs: 1, sm: 2 },
          // Always show scrollbar to prevent layout shifts
          overflowY: 'scroll',
          // Give a bit more space for the bottom item
          pb: 2
        }}
        ref={listContainerRef}
      >
        {filtered.length === 0 ? (
          <Box sx={{ p: 2, color: 'gray', textAlign: 'center' }}>No conversations found.</Box>
        ) : (
          <List disablePadding>
            {paginated.map(conv => (
              <ListItem button key={conv.id} onClick={() => navigate(`/conversations/${conv.id}`)} sx={{ mb: 1 }}>
                <ListItemText 
                  primary={conv.title || conv.id} 
                  secondary={
                    <>
                      {conv.create_time ? new Date(conv.create_time * 1000).toISOString().split('T')[0] : 'Unknown date'}
                      <span style={{ color: '#777', fontSize: '0.85em', marginLeft: '8px' }}>
                        ID: {conv.id.substring(0, 10)}...
                      </span>
                    </>
                  } 
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
      
      {/* Remove bottom pagination controls, only keep the top ones */}
      
      <Box sx={{ fontSize: 12, color: 'gray', mt: 1 }}>
        Note: Conversations and messages are cached for fast search. If your archive is very large, initial load may take some time.
      </Box>
    </Box>
  );
}
