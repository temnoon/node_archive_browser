// --- PATCH: ToolMessageRenderer integration for ConversationView ---
// This patch demonstrates how to integrate ToolMessageRenderer in ConversationView
// Rollback: Remove the conditional and use only <Markdown>{msg.content}</Markdown> as before.

import React, { useEffect, useState } from 'react';
import Markdown from './Markdown';
import ToolMessageRenderer from './ToolMessageRenderer';
import { BrowserRouter as Router, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Container, List, ListItem, ListItemText, TextField, Box, Paper, Button, GlobalStyles } from '@mui/material';

// --- PATCH START ---
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
// --- PATCH END ---

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
  if (!data.title) return <div>Loading...</div>;
  return (
    <Box>
      <Typography variant="h5">{data.title || id}</Typography>
      <Typography variant="subtitle2" color="text.secondary">{data.create_time}</Typography>
      {data.messages.map(msg => (
        <Paper key={msg.id} sx={{ p: 2, my: 1, backgroundColor: msg.role === 'user' ? '#e3f2fd' : msg.role === 'assistant' ? '#f3e5f5' : '#eeeeee' }}>
          <Typography variant="subtitle2" color="text.secondary">{msg.role} – {msg.create_time}</Typography>
          {/* PATCH: Use ToolMessageRenderer for likely tool/assistant JSON blocks, fallback to Markdown otherwise */}
          {isLikelyToolJson(msg.content)
            ? <ToolMessageRenderer json={msg.content} />
            : <Markdown>{msg.content}</Markdown>
          }
        </Paper>
      ))}
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

export default ConversationView;
// --- END PATCH ---
