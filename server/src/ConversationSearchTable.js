import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TableSortLabel, TextField, Box, Button, Typography, MenuItem } from '@mui/material';

function descendingComparator(a, b, orderBy) {
  if (b[orderBy] < a[orderBy]) return -1;
  if (b[orderBy] > a[orderBy]) return 1;
  return 0;
}

function getComparator(order, orderBy) {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

function stableSort(array, comparator) {
  const stabilized = array.map((el, index) => [el, index]);
  stabilized.sort((a, b) => {
    const cmp = comparator(a[0], b[0]);
    if (cmp !== 0) return cmp;
    return a[1] - b[1];
  });
  return stabilized.map(el => el[0]);
}


// No change here, but for context: ConversationView will filter empty system messages.
export default function ConversationSearchTable({ items, onRowClick }) {
  // Filters
  // Persisted filters
  const defaultFilter = { dateFrom: '', dateTo: '', gizmo: '', model: '', title: '', text: '' };
  const getInitialFilter = () => {
    try {
      const f = JSON.parse(localStorage.getItem('convFilters'));
      return f && typeof f === 'object' ? { ...defaultFilter, ...f } : defaultFilter;
    } catch {
      return defaultFilter;
    }
  };
  const [filter, setFilter] = useState(getInitialFilter);
  useEffect(() => { localStorage.setItem('convFilters', JSON.stringify(filter)); }, [filter]);

  // Sorting
  const [order, setOrder] = useState('desc');
  const [orderBy, setOrderBy] = useState('date');

  // Per-page
  const getInitialPerPage = () => {
    const v = localStorage.getItem('perPage');
    return v ? parseInt(v, 10) : 10;
  };
  const [perPage, setPerPage] = useState(getInitialPerPage);
  useEffect(() => { localStorage.setItem('perPage', perPage); }, [perPage]);

  // Paging
  const [page, setPage] = useState(1);

  // Reset page to 1 when filters change
  useEffect(() => { setPage(1); }, [filter, order, orderBy, perPage, items]);

  // Filtered/sorted data
  // Apply filters to all items
  const filtered = items.filter(item => {
    if (filter.dateFrom && item.create_time < filter.dateFrom) return false;
    if (filter.dateTo && item.create_time > filter.dateTo) return false;
    if (filter.gizmo && !(item.gizmo_id || '').toLowerCase().includes(filter.gizmo.toLowerCase())) return false;
    if (filter.model && !(item.model || '').toLowerCase().includes(filter.model.toLowerCase())) return false;
    if (filter.title && !(item.title || '').toLowerCase().includes(filter.title.toLowerCase())) return false;
    if (filter.text && !(item.text || item.snippet || '').toLowerCase().includes(filter.text.toLowerCase())) return false;
    return true;
  });
  // Sort all filtered items
  const sorted = stableSort(filtered, getComparator(order, orderBy));
  // Paging
  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const paged = sorted.slice((page - 1) * perPage, page * perPage);

  // Compute contextual gizmo/model lists from filtered
  const contextualGizmoList = Array.from(new Set(filtered.map(i => i.gizmo_id).filter(Boolean))).sort();
  const contextualModelList = Array.from(new Set(filtered.map(i => i.model).filter(Boolean))).sort();

  // Word/message count helpers
  // For word count, sum all words in all content messages (if available)
  const getWordCount = item => {
    if (Array.isArray(item.messages) && item.messages.length > 0) {
      return item.messages
        .filter(m => typeof m.content === 'string' && m.content.trim().length > 0)
        .map(m => m.content.split(/\s+/).filter(Boolean).length)
        .reduce((a, b) => a + b, 0);
    }
    // If no messages are loaded, show 'N/A' or blank
    return '';
  };
  const getMsgCount = item => item.message_count || item.messages?.length || item.messages || 0;

  // Table columns
  const columns = [
    { id: 'date', label: 'Date', get: item => item.create_time },
    { id: 'gizmo_id', label: 'Gizmo ID', get: item => item.gizmo_id || '' },
    { id: 'model', label: 'Model', get: item => item.model || '' },
    { id: 'title', label: 'Title', get: item => item.title || '' },
    { id: 'word_count', label: 'Words', get: getWordCount },
    { id: 'message_count', label: 'Messages', get: getMsgCount },
  ];

  // Sorting
  const handleSort = (colId) => {
    if (orderBy === colId) setOrder(order === 'asc' ? 'desc' : 'asc');
    else { setOrder('asc'); setOrderBy(colId); }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField label="From" type="date" size="small" value={filter.dateFrom} onChange={e => setFilter(f => ({ ...f, dateFrom: e.target.value }))} InputLabelProps={{ shrink: true }} helperText="Start date" />
        <Button size="small" onClick={() => setFilter(f => ({ ...f, dateFrom: '' }))}>Clear</Button>
        <TextField label="To" type="date" size="small" value={filter.dateTo} onChange={e => setFilter(f => ({ ...f, dateTo: e.target.value }))} InputLabelProps={{ shrink: true }} helperText="End date" />
        <Button size="small" onClick={() => setFilter(f => ({ ...f, dateTo: '' }))}>Clear</Button>
        <TextField
          select
          label="Gizmo ID"
          size="small"
          value={filter.gizmo}
          onChange={e => setFilter(f => ({ ...f, gizmo: e.target.value }))}
          sx={{ minWidth: 120 }}
          helperText="Filter by gizmo id"
        >
          <MenuItem value="">All</MenuItem>
          {contextualGizmoList.map(gz => <MenuItem key={gz} value={gz}>{gz}</MenuItem>)}
        </TextField>
        <Button size="small" onClick={() => setFilter(f => ({ ...f, gizmo: '' }))}>Clear</Button>
        <TextField
          select
          label="Model"
          size="small"
          value={filter.model}
          onChange={e => setFilter(f => ({ ...f, model: e.target.value }))}
          sx={{ minWidth: 120 }}
          helperText="Filter by model"
        >
          <MenuItem value="">All</MenuItem>
          {contextualModelList.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
        </TextField>
        <Button size="small" onClick={() => setFilter(f => ({ ...f, model: '' }))}>Clear</Button>
        <TextField label="Title" size="small" value={filter.title} onChange={e => setFilter(f => ({ ...f, title: e.target.value }))} placeholder="Title contains..." helperText="Filter by title" />
        <Button size="small" onClick={() => setFilter(f => ({ ...f, title: '' }))}>Clear</Button>
        <TextField label="Text" size="small" value={filter.text} onChange={e => setFilter(f => ({ ...f, text: e.target.value }))} placeholder="Text contains..." helperText="Filter by content" />
        <Button size="small" onClick={() => setFilter(f => ({ ...f, text: '' }))}>Clear</Button>
        <TextField
          select
          label="Results/page"
          size="small"
          value={perPage}
          onChange={e => setPerPage(Number(e.target.value))}
          sx={{ minWidth: 120 }}
          helperText="Conversations per page"
        >
          {[10, 20, 50, 100].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
        </TextField>
        <Button size="small" color="secondary" variant="outlined" onClick={() => setFilter({ dateFrom: '', dateTo: '', gizmo: '', model: '', title: '', text: '' })}>
          Reset Filters
        </Button>
      </Box>
      <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map(col => (
                <TableCell key={col.id} sx={{ backgroundColor: '#fafafa', position: 'sticky', top: 0, zIndex: 1 }}>
                  <TableSortLabel
                    active={orderBy === col.id}
                    direction={orderBy === col.id ? order : 'asc'}
                    onClick={() => handleSort(col.id)}
                  >
                    {col.label}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {paged.map((item, idx) => (
              <TableRow hover key={item.id || idx} style={{ cursor: onRowClick ? 'pointer' : undefined }} onClick={onRowClick ? () => onRowClick(item) : undefined}>
                {columns.map(col => (
                  <TableCell key={col.id}>
                    {col.id === 'gizmo_id' && item.gizmo_id && item.gizmo_id !== 'none' ? item.gizmo_id :
                     col.id === 'model' && item.model && item.model !== 'none' ? item.model :
                     col.get(item)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ display: 'flex', alignItems: 'center', mt: 2, gap: 2 }}>
        <Typography variant="caption" sx={{ color: '#888' }}>
          {sorted.length} results
        </Typography>
        {totalPages > 1 && (
          <>
            <Button size="small" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Typography variant="caption">Page {page} / {totalPages}</Typography>
            <Button size="small" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </>
        )}
      </Box>
    </Box>
  );
}
