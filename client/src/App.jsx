import React, { useState, useEffect } from 'react';
import './App.css';
import { AppBar, Toolbar, Typography, Container, Box, TextField, GlobalStyles, Button, CssBaseline, useMediaQuery, IconButton, Drawer, List, ListItem, ListItemText, ListItemIcon, Divider } from '@mui/material';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import ConversationView from './ConversationView.jsx';
import ConversationSearchTable from './ConversationSearchTable.jsx';
import ArchiveImportWizard from './ArchiveImportWizard.jsx';
import MediaGallery from './MediaGallery.jsx';
import ParserInfoPage from './ParserInfoPage.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

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
        // Prevent body scroll, allow only container scrolling
        'body': { 
          overflow: 'hidden', 
          height: '100vh',
          margin: 0,
          padding: 0,
        },
        'html': { overflow: 'hidden' },
        // Better scrollbars
        '::-webkit-scrollbar': { width: '8px', height: '8px' },
        '::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px' },
        '::-webkit-scrollbar-track': { backgroundColor: 'rgba(0,0,0,0.05)' },
        // Make sure divs with overflow scroll have momentum scrolling on iOS
        '.scroll-container': {
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin'
        }
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
            <Typography 
              variant="h6" 
              sx={{ 
                flexGrow: 1,
                textDecoration: 'none',
                transition: 'color 0.4s ease',
                '&:hover': {
                  color: 'rgba(255, 255, 240, 0.85)' // Soft off-white with slight yellow tint
                }
              }} 
              component={Link} 
              to="/" 
              color="inherit"
            >
              Archive Browser
            </Typography>
            
            {/* Desktop Navigation Links */}
            {!isMobile && (
              <>
                <Button 
                  color="inherit" 
                  component={Link} 
                  to="/media"
                  sx={{ 
                    ml: 2, 
                    transition: 'color 0.4s ease',
                    '&:hover': {
                      color: 'rgba(255, 255, 240, 0.85)', // Soft off-white with slight yellow tint
                      backgroundColor: 'transparent'
                    }
                  }}
                  onClick={handleNavigation}
                >
                  Media Gallery
                </Button>
                <Button 
                  color="inherit" 
                  component={Link} 
                  to="/parser"
                  sx={{ 
                    ml: 2, 
                    transition: 'color 0.4s ease',
                    '&:hover': {
                      color: 'rgba(255, 255, 240, 0.85)', // Soft off-white with slight yellow tint
                      backgroundColor: 'transparent'
                    }
                  }}
                  onClick={handleNavigation}
                >
                  Parser Info
                </Button>
                <Button 
                  color="inherit" 
                  component={Link} 
                  to="/import"
                  sx={{ 
                    ml: 2, 
                    transition: 'color 0.4s ease',
                    '&:hover': {
                      color: 'rgba(255, 255, 240, 0.85)', // Soft off-white with slight yellow tint
                      backgroundColor: 'transparent'
                    }
                  }}
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
              <ListItem 
                component={Link} 
                to="/" 
                onClick={handleNavigation}
                sx={{
                  transition: 'background-color 0.4s ease',
                  '&:hover': {
                    backgroundColor: 'rgba(25, 118, 210, 0.12)',
                  }
                }}
              >
                <ListItemText primary="Conversations" />
              </ListItem>
              <ListItem 
                component={Link} 
                to="/media" 
                onClick={handleNavigation}
                sx={{
                  transition: 'background-color 0.4s ease',
                  '&:hover': {
                    backgroundColor: 'rgba(25, 118, 210, 0.12)',
                  }
                }}
              >
                <ListItemText primary="Media Gallery" />
              </ListItem>
              <ListItem 
                component={Link} 
                to="/parser" 
                onClick={handleNavigation}
                sx={{
                  transition: 'background-color 0.4s ease',
                  '&:hover': {
                    backgroundColor: 'rgba(25, 118, 210, 0.12)',
                  }
                }}
              >
                <ListItemText primary="Parser Info" />
              </ListItem>
              <ListItem 
                component={Link} 
                to="/import" 
                onClick={handleNavigation}
                sx={{
                  transition: 'background-color 0.4s ease',
                  '&:hover': {
                    backgroundColor: 'rgba(25, 118, 210, 0.12)',
                  }
                }}
              >
                <ListItemText primary="Import Archive" />
              </ListItem>
            </List>
          </Box>
        </Drawer>
        <Container sx={{ 
          mt: { xs: 1, md: 1 }, 
          maxWidth: '100%!important', 
          width: '100%',
          height: 'calc(100vh - 64px)', // 64px is the AppBar height
          maxHeight: 'calc(100vh - 64px)',
          overflow: 'hidden',
          px: { xs: 1, sm: 2, lg: 2 },  // Reduced horizontal padding
          pb: 0,  // No bottom padding 
          display: 'flex',
          flexDirection: 'column',
        }} disableGutters={false}>
          <Routes style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
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
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: { xs: 'column', md: 'row' }, 
                      gap: 2, 
                      height: 'calc(100vh - 150px)',
                      maxHeight: 'calc(100vh - 150px)',
                      overflow: 'hidden'
                    }}>
                      <Box sx={{ 
                        flex: { md: '0 0 360px' }, // Fixed width for sidebar on desktop
                        minWidth: { xs: '100%', md: '360px' }, 
                        maxWidth: { xs: '100%', md: '360px' },
                        height: { xs: 'auto', md: '100%' }
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
                        flex: 1, 
                        minWidth: { xs: '100%', md: '0' }, 
                        height: '100%', 
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
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: { xs: 'column', md: 'row' }, 
                      gap: 2, 
                      height: 'calc(100vh - 150px)',
                      maxHeight: 'calc(100vh - 150px)',
                      overflow: 'hidden'
                    }}>
                      <Box sx={{ 
                        flex: { md: '0 0 360px' }, // Fixed width for sidebar on desktop
                        minWidth: { xs: '100%', md: '360px' }, 
                        maxWidth: { xs: '100%', md: '360px' },
                        height: { xs: 'auto', md: '100%' }
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
                        flex: 1, 
                        minWidth: { xs: '100%', md: '0' },
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                        overflow: 'hidden'
                      }}>
                        <ErrorBoundary>
                          <ConversationView />
                        </ErrorBoundary>
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