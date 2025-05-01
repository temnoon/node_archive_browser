// Copied from original, adapt as needed for Vite/React
import * as React from 'react';
import { useEffect, useState } from 'react';
import { List, ListItem, ListItemText, CircularProgress, Box, TextField, MenuItem, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

// NOTE: For full-content search, this demo fetches all messages for each conversation on mount (can be slow for large archives)
export default function ConversationSearchTable({ search, perPage, setPerPage }) {
  const [conversations, setConversations] = useState([]);
  const [messagesByConv, setMessagesByConv] = useState({}); // {convId: [messages]}
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', mediaOnly: false });
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
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
      setLoading(false);
    }
    fetchAllConversations().catch(e => {
      setError(e.message);
      setLoading(false);
    });
  }, []);

  const handleFilterChange = (key, value) => setFilters(f => ({ ...f, [key]: value }));
  const handleMediaFilter = e => setFilters(f => ({ ...f, mediaOnly: e.target.checked }));
  const filtered = conversations.filter(c => {
    // Date filter
    const created = c.create_time ? new Date(c.create_time) : null;
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      if (!created || created < from) return false;
    }
    if (filters.dateTo) {
      // To-date is inclusive, so add 1 day
      const to = new Date(filters.dateTo);
      to.setDate(to.getDate() + 1);
      if (!created || created >= to) return false;
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
  });

  if (loading) return <Box sx={{ p: 2, textAlign: 'center' }}><CircularProgress size={28} /></Box>;
  if (error) return <Box sx={{ p: 2, color: 'red' }}>{error}</Box>;
  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageClamped = Math.max(1, Math.min(currentPage, totalPages));
  const paginated = filtered.slice((pageClamped - 1) * perPage, pageClamped * perPage);
  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          label="Date From"
          type="date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={filters.dateFrom}
          onChange={e => handleFilterChange('dateFrom', e.target.value)}
        />
        <TextField
          label="Date To"
          type="date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={filters.dateTo}
          onChange={e => handleFilterChange('dateTo', e.target.value)}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={filters.mediaOnly} onChange={handleMediaFilter} style={{ marginRight: 4 }} />
          Media only
        </label>
        <Button size="small" onClick={() => setFilters({ dateFrom: '', dateTo: '', mediaOnly: false })}>Clear</Button>
        <TextField
          label="Per page"
          type="number"
          size="small"
          value={perPage}
          onChange={e => setPerPage(Math.max(1, parseInt(e.target.value) || 10))}
          sx={{ width: 90 }}
          inputProps={{ min: 1 }}
        />
        <Button size="small" disabled={pageClamped <= 1} onClick={() => setCurrentPage(pageClamped - 1)}>Prev</Button>
        <span style={{ minWidth: 60, textAlign: 'center' }}>Page {pageClamped} / {totalPages}</span>
        <Button size="small" disabled={pageClamped >= totalPages} onClick={() => setCurrentPage(pageClamped + 1)}>Next</Button>
      </Box>
      {filtered.length === 0 ? (
        <Box sx={{ p: 2, color: 'gray' }}>No conversations found.</Box>
      ) : (
        <List>
          {paginated.map(conv => (
            <ListItem button key={conv.id} onClick={() => navigate(`/conversations/${conv.id}`)}>
              <ListItemText primary={conv.title || conv.id} secondary={conv.create_time} />
            </ListItem>
          ))}
        </List>
      )}
      <Box sx={{ fontSize: 12, color: 'gray', mt: 1 }}>
        Note: All conversations and messages are kept in memory for fast search. If your archive is very large, initial load may take some time.
      </Box>
    </Box>
  );
}
