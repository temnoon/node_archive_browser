import React, { useState, useEffect } from 'react';
import { AppBar, Toolbar, Typography, Container, Box, TextField, GlobalStyles, Button, CssBaseline, useMediaQuery, IconButton, Drawer, List, ListItem, ListItemText, ListItemIcon, Divider } from '@mui/material';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import ConversationView from './ConversationView.jsx';
import ConversationSearchTable from './ConversationSearchTable.jsx';
import ArchiveImportWizard from './ArchiveImportWizard.jsx';
import MediaGallery from './MediaGallery.jsx';
import ParserInfoPage from './ParserInfoPage.jsx';

export default function App() {
  const [search, setSearch] = useState('');
  const [perPage, setPerPage] = useState(10);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width:899px)');
  
  // Close mobile menu when route changes
  const handleNavigation = () => {
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  return (
    <>
      <CssBaseline />
      <GlobalStyles styles={{
        'pre': { whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: '0 0 1em' },
        'img': { maxWidth: '100%', maxHeight: '72vh', height: 'auto', display: 'block', margin: '0px auto' },
        // Add buffer space for scroll bars
        'body': { overflowY: 'scroll' },
        '::-webkit-scrollbar': { width: '8px', height: '8px' },
        '::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px' },
        '::-webkit-scrollbar-track': { backgroundColor: 'rgba(0,0,0,0.05)' }
      }} />
      <Router>
        <AppBar position="sticky">
          <Toolbar>
            {isMobile && (
              <IconButton 
                edge="start" 
                color="inherit" 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                sx={{ mr: 2 }}
              >
                ≡
              </IconButton>
            )}
            <Typography variant="h6" sx={{ flexGrow: 1 }} component={Link} to="/" color="inherit" style={{ textDecoration: 'none' }}>
              Archive Browser
            </Typography>
            
            {/* Desktop Navigation Links */}
            {!isMobile && (
              <>
                <Button 
                  color="inherit" 
                  component={Link} 
                  to="/media"
                  sx={{ ml: 2 }}
                  onClick={handleNavigation}
                >
                  Media Gallery
                </Button>
                <Button 
                  color="inherit" 
                  component={Link} 
                  to="/parser"
                  sx={{ ml: 2 }}
                  onClick={handleNavigation}
                >
                  Parser Info
                </Button>
                <Button 
                  color="inherit" 
                  component={Link} 
                  to="/import"
                  sx={{ ml: 2 }}
                  onClick={handleNavigation}
                >
                  Import Archive
                </Button>
              </>
            )}
          </Toolbar>
        </AppBar>
        
        {/* Mobile Navigation Drawer */}
        <Drawer
          anchor="left"
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        >
          <Box sx={{ width: 250 }} role="presentation">
            <List>
              <ListItem button component={Link} to="/" onClick={handleNavigation}>
                <ListItemText primary="Conversations" />
              </ListItem>
              <ListItem button component={Link} to="/media" onClick={handleNavigation}>
                <ListItemText primary="Media Gallery" />
              </ListItem>
              <ListItem button component={Link} to="/parser" onClick={handleNavigation}>
                <ListItemText primary="Parser Info" />
              </ListItem>
              <ListItem button component={Link} to="/import" onClick={handleNavigation}>
                <ListItemText primary="Import Archive" />
              </ListItem>
            </List>
          </Box>
        </Drawer>
        <Container sx={{ 
          mt: { xs: 1, md: 3 }, 
          maxWidth: '100%!important', 
          width: '100%',
          px: { xs: 1, sm: 2, lg: 3 },  // Responsive horizontal padding
          pb: { xs: 1, sm: 2, lg: 3 },  // Responsive bottom padding 
          // Allow space for scrollbars
          pr: { xs: 2, sm: 3, lg: 4 },  // Extra right padding for scrollbar
        }} disableGutters={false}>
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
                      <Box sx={{ 
                        flex: 2, 
                        minWidth: { xs: '100%', md: '300px' }, 
                        maxWidth: { md: '400px' }
                      }}>
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="h6" sx={{ mb: 0.5 }}>Conversations</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Browse your archive conversations
                          </Typography>
                        </Box>
                        <ConversationSearchTable
                          search={search}
                          perPage={perPage}
                          setPerPage={setPerPage}
                        />
                      </Box>
                      <Box sx={{ 
                        flex: 3, 
                        minWidth: { xs: '100%', md: '0' }, 
                        height: { xs: 'calc(100vh - 400px)', md: 'calc(100vh - 350px)' }, 
                        bgcolor: '#fafafa', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        border: '1px solid #eee',
                        borderRadius: 1,
                      }}>
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
                      <Box sx={{ 
                        flex: 2, 
                        minWidth: { xs: '100%', md: '300px' }, 
                        maxWidth: { md: '400px' }
                      }}>
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="h6" sx={{ mb: 0.5 }}>Conversations</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Browse your archive conversations
                          </Typography>
                        </Box>
                        <ConversationSearchTable
                          search={search}
                          perPage={perPage}
                          setPerPage={setPerPage}
                        />
                      </Box>
                      <Box sx={{ 
                        flex: 3, 
                        minWidth: { xs: '100%', md: '0' },
                        display: 'flex', 
                        flexDirection: 'column' 
                      }}>
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