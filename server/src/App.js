import React, { useEffect, useState } from 'react';
import Markdown from './Markdown';
import ToolMessageRenderer from './ToolMessageRenderer';
import ConversationSearchTable from './ConversationSearchTable';
import { BrowserRouter as Router, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Container, List, ListItem, ListItemText, TextField, Box, Paper, Button, GlobalStyles } from '@mui/material';

function fetchAPI(url) {
  return fetch(url)
    .then(res => {
      if (!res.ok) throw new Error('API error');
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Not JSON: ' + contentType);
      }
      return res.json();
    });
}

function ConversationList() {
  const [data, setData] = useState({ total: 0, page: 0, per_page: 10 });
  const [allItems, setAllItems] = useState([]);
  // Load first page
  useEffect(() => {
    fetchAPI(`/api/conversations?page=1&limit=${data.per_page}`)
      .then(res => {
        setData(res);
        setAllItems(res.items);
      });
  }, []);
  // Lazy-load subsequent pages
  useEffect(() => {
    if (data.page > 0 && data.page * data.per_page < data.total) {
      fetchAPI(`/api/conversations?page=${data.page + 1}&limit=${data.per_page}`)
        .then(res => {
          setData(res);
          setAllItems(prev => [...prev, ...res.items]);
        });
    }
  }, [data]);
  return (
    <Box>
      <List>
        {allItems.map(conv => (
          <ListItem button component={Link} to={`/conversations/${conv.id}`} key={conv.id}>
            <ListItemText
              primary={conv.title || conv.id}
              secondary={`${conv.create_time} (${conv.message_count} messages)`}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

// Helper: Detect if msg.content is likely a JSON structure with markdown blocks
function isLikelyToolJson(content) {
  if (typeof content !== 'string') return false;
  // Heuristics: starts with { and contains \" or \n or long length
  const trimmed = content.trim();
  if (trimmed.startsWith('{') && (trimmed.includes('\\n') || trimmed.includes('prompt') || trimmed.length > 120)) return true;
  // Also JSON with 'result' or 'text' keys
  if (/"(result|text)":\s*"/.test(trimmed)) return true;
  return false;
}

function ConversationView() {
  const { id } = useParams();
  const [data, setData] = useState({ messages: [], total_messages: 0, page: 1, per_page: 10, title: '', create_time: '', folder: '' });
  const fetchPage = (page) => {
    fetchAPI(`/api/conversations/${id}?page=${page}&limit=${data.per_page}`)
      .then(res => setData(res));
  };
  useEffect(() => { fetchPage(1); }, [id]);
  useEffect(() => {
    if (window.MathJax && data.messages && data.messages.length > 0) {
      window.MathJax.typesetPromise();
    }
  }, [data.messages]);
  const scrollRef = React.useRef();
  // Filter out empty system messages
  let filteredMessages = [];
  if (Array.isArray(data.messages)) {
    let firstUserIdx = data.messages.findIndex(msg => msg.role === 'user');
    if (firstUserIdx !== -1) {
      // Start at the first user message
      filteredMessages = data.messages.slice(firstUserIdx);
      // For the rest, filter out empty system messages (after the first user message)
      filteredMessages = [filteredMessages[0]].concat(
        filteredMessages.slice(1).filter(msg => !(msg.role === 'system' && (!msg.content || msg.content.trim() === '')))
      );
    }
  }

  useEffect(() => {
    if (window.MathJax && data.messages && data.messages.length > 0) {
      window.MathJax.typesetPromise();
    }
  }, [data.messages]);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [data.page]);

  if (!data.title) return <div>Loading...</div>;

  // Extract unique gizmo IDs and models from messages
  const gizmoIds = Array.from(new Set((data.messages || []).map(m => m.gizmo_id).filter(Boolean)));
  const modelNames = Array.from(new Set((data.messages || []).map(m => m.model).filter(Boolean)));

  return (
    <Box>
      <Typography variant="h5">{data.title || id}</Typography>
      <Typography variant="subtitle2" color="text.secondary">{data.create_time}</Typography>
      {gizmoIds.length > 0 && (
        <Typography variant="subtitle2" color="text.secondary">Gizmo ID(s): {gizmoIds.join(', ')}</Typography>
      )}
      {modelNames.length > 0 && (
        <Typography variant="subtitle2" color="text.secondary">Model(s): {modelNames.join(', ')}</Typography>
      )}
      <Box sx={{ flex: 1, minHeight: 0, height: '100%', overflow: 'auto' }} ref={scrollRef}>
        {filteredMessages.map(msg => (
          <Paper key={msg.id} sx={{ p: 2, my: 1, backgroundColor: msg.role === 'user' ? '#e3f2fd' : msg.role === 'assistant' ? '#f3e5f5' : '#eeeeee' }}>
            <Typography variant="subtitle2" color="text.secondary">{msg.role} – {msg.create_time}</Typography>
            {/* Use ToolMessageRenderer for likely tool/assistant JSON blocks, fallback to Markdown otherwise */}
            {isLikelyToolJson(msg.content)
              ? <ToolMessageRenderer json={msg.content} />
              : <Markdown>{msg.content}</Markdown>
            }
          </Paper>
        ))}
      </Box>
      {data.total_messages > data.per_page && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
          <Button disabled={data.page <= 1} onClick={() => fetchPage(data.page - 1)}>Previous</Button>
          <Typography sx={{ alignSelf: 'center' }}>Page {data.page} / {Math.ceil(data.total_messages / data.per_page)}</Typography>
          <Button disabled={data.page >= Math.ceil(data.total_messages / data.per_page)} onClick={() => fetchPage(data.page + 1)}>Next</Button>
        </Box>
      )}
    </Box>
  );
}

function MessageView() {
  const { id } = useParams();
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    fetchAPI(`/api/messages/${id}`).then(setMsg);
  }, [id]);
  // Trigger MathJax after rendering message
  useEffect(() => {
    if (window.MathJax && msg && msg.html) {
      window.MathJax.typesetPromise();
    }
  }, [msg]);
  if (!msg) return <div>Loading...</div>;
  return (
    <Box>
      <Typography variant="h6">{msg.role} ({msg.create_time})</Typography>
      <Paper sx={{ p: 2, my: 2 }}>
        <Markdown>{msg.content}</Markdown>
      </Paper>
      <Button component={Link} to={-1}>Back</Button>
    </Box>
  );
}


function SearchResults({ search }) {
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const perPage = 100; // Use a large page size to minimize requests
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function fetchAll(endpoint) {
      setLoading(true);
      let all = [];
      let page = 1;
      let total = 0;
      do {
        const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}page=${page}&limit=${perPage}`;
        const res = await fetchAPI(url);
        if (cancelled) return;
        all = all.concat(res.items || []);
        total = res.total || 0;
        page++;
      } while (all.length < total && total > 0);
      setAllItems(all);
      setLoading(false);
    }
    if (!search) {
      fetchAll('/api/conversations');
    } else {
      fetchAll(`/api/search?q=${encodeURIComponent(search)}`);
    }
    return () => { cancelled = true; };
  }, [search]);

  return (
    <Box>
      <Typography variant="h6">Search Results</Typography>
      {loading ? <Typography>Loading...</Typography> :
        <ConversationSearchTable
          items={allItems}
          onRowClick={item => navigate(`/conversations/${item.id}`)}
        />}
    </Box>
  );
}

export default function App() {
  // Persisted per_page
  const getInitialPerPage = () => {
    const v = localStorage.getItem('perPage');
    return v ? parseInt(v, 10) : 10;
  };
  const [search, setSearch] = useState('');
  const [perPage, setPerPage] = useState(getInitialPerPage);
  const [modelList, setModelList] = useState([]);
  const [gizmoList, setGizmoList] = useState([]);

  // Fetch all models/gizmo ids for pulldowns (on mount)
  useEffect(() => {
    fetch('/api/conversations/meta').then(r => r.json()).then(meta => {
      setModelList(meta.models || []);
      setGizmoList(meta.gizmos || []);
    });
  }, []);

  // Persist perPage
  useEffect(() => {
    localStorage.setItem('perPage', perPage);
  }, [perPage]);

  return (
    <>
      <GlobalStyles styles={{
        'pre': { whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: '0 0 1em' },
        'img': { maxWidth: '100%', maxHeight: '72vh', height: 'auto', display: 'block', margin: '0px auto' }
      }} />
      <Router>
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1 }} component={Link} to="/" color="inherit" style={{ textDecoration: 'none' }}>
              Archive Browser
            </Typography>
          </Toolbar>
        </AppBar>
        <Container sx={{ mt: 3, maxWidth: '100%!important', width: '100%' }} disableGutters>
          <Box mb={2} sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField label="Search" value={search} onChange={e => setSearch(e.target.value)} sx={{ flex: 1 }} />
          </Box>
          <Routes>
            <Route
              path="/"
              element={
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
                  <Box sx={{ flex: 2 }}>
                    <SearchResults
                      search={search}
                      perPage={perPage}
                      setPerPage={setPerPage}
                      modelList={modelList}
                      gizmoList={gizmoList}
                    />
                  </Box>
                  <Box sx={{ flex: 3, minWidth: 0, height: '80vh', bgcolor: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="h6" color="text.secondary">Select a conversation to view</Typography>
                  </Box>
                </Box>
              }
            />
            <Route
              path="conversations/:id"
              element={
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
                  <Box sx={{ flex: 2 }}>
                    <SearchResults
                      search={search}
                      perPage={perPage}
                      setPerPage={setPerPage}
                      modelList={modelList}
                      gizmoList={gizmoList}
                    />
                  </Box>
                  <Box sx={{ flex: 3, minWidth: 0, height: '80vh', display: 'flex', flexDirection: 'column' }}>
                    <ConversationView />
                  </Box>
                </Box>
              }
            />
            <Route path="messages/:id" element={<MessageView />} />
          </Routes>
        </Container>
      </Router>
    </>
  );
}
