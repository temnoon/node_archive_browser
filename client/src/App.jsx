import React, { useState } from 'react';
import { AppBar, Toolbar, Typography, Container, Box, TextField, GlobalStyles, Button } from '@mui/material';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import ConversationView from './ConversationView.jsx';
import ConversationSearchTable from './ConversationSearchTable.jsx';
import ArchiveImportWizard from './ArchiveImportWizard.jsx';
import MediaGallery from './MediaGallery.jsx';
import ParserInfoPage from './ParserInfoPage.jsx';

export default function App() {
  const [search, setSearch] = useState('');
  const [perPage, setPerPage] = useState(10);

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
            <Button 
              color="inherit" 
              component={Link} 
              to="/media"
              sx={{ ml: 2 }}
            >
              Media Gallery
            </Button>
            <Button 
              color="inherit" 
              component={Link} 
              to="/parser"
              sx={{ ml: 2 }}
            >
              Parser Info
            </Button>
            <Button 
              color="inherit" 
              component={Link} 
              to="/import"
              sx={{ ml: 2 }}
            >
              Import Archive
            </Button>
          </Toolbar>
        </AppBar>
        <Container sx={{ mt: 3, maxWidth: '100%!important', width: '100%' }} disableGutters>
          <Routes>
            <Route
              path="/parser"
              element={<ParserInfoPage />}
            />
            <Route
              path="/import"
              element={<ArchiveImportWizard />}
            />
            <Route
              path="/media"
              element={<MediaGallery />}
            />
            <Route
              path="/media/:conversationId"
              element={<MediaGallery />}
            />
            <Route
              path="/"
              element={
                <>
                  <Box mb={2} sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <TextField label="Search" value={search} onChange={e => setSearch(e.target.value)} sx={{ flex: 1 }} />
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
                    <Box sx={{ flex: 2 }}>
                      <ConversationSearchTable
                        search={search}
                        perPage={perPage}
                        setPerPage={setPerPage}
                      />
                    </Box>
                    <Box sx={{ flex: 3, minWidth: 0, height: '80vh', bgcolor: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="h6" color="text.secondary">Select a conversation to view</Typography>
                    </Box>
                  </Box>
                </>
              }
            />
            <Route
              path="/conversations/:id"
              element={
                <>
                  <Box mb={2} sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <TextField label="Search" value={search} onChange={e => setSearch(e.target.value)} sx={{ flex: 1 }} />
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
                    <Box sx={{ flex: 2 }}>
                      <ConversationSearchTable
                        search={search}
                        perPage={perPage}
                        setPerPage={setPerPage}
                      />
                    </Box>
                    <Box sx={{ flex: 3, minWidth: 0, height: '80vh', display: 'flex', flexDirection: 'column' }}>
                      <ConversationView />
                    </Box>
                  </Box>
                </>
              }
            />
          </Routes>
        </Container>
      </Router>
    </>
  );
}