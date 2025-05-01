import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Table, 
  TableHead, 
  TableBody, 
  TableRow, 
  TableCell,
  Card,
  CardContent,
  Grid,
  Chip,
  Divider,
  Alert,
  LinearProgress
} from '@mui/material';

export default function ParserInfoPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch parser statistics from the API
  useEffect(() => {
    setLoading(true);
    fetch('/api/parser/stats')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch parser statistics');
        return res.json();
      })
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching parser stats:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <Box sx={{ mt: 4, p: 2 }}>
        <Typography variant="h5" gutterBottom>Parser Statistics</Typography>
        <LinearProgress />
        <Typography variant="body2" sx={{ mt: 2 }}>Loading parser information...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mt: 4, p: 2 }}>
        <Typography variant="h5" gutterBottom>Parser Statistics</Typography>
        <Alert severity="error">
          {error}. Please make sure the server is running and has implemented the parser statistics API.
        </Alert>
      </Box>
    );
  }

  // If we don't have stats yet and no error, show the feature is coming soon
  if (!stats) {
    return (
      <Box sx={{ mt: 4, p: 2 }}>
        <Typography variant="h5" gutterBottom>Parser Statistics</Typography>
        <Alert severity="info">
          Parser statistics feature is coming soon. This page will show information about message types and formats 
          found in your archive.
        </Alert>
        
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>What will be included:</Typography>
          
          <ul>
            <li>Count of different message types (user, assistant, tool, system)</li>
            <li>Distribution of tool message content types</li>
            <li>Detection of unknown or extended formats</li>
            <li>Usage statistics for different models</li>
            <li>Function call and tool usage trends</li>
          </ul>
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="body2" color="text.secondary">
            This feature relies on the structured parser modules implemented on the server side.
            Each message is analyzed by dedicated parsers that extract standardized data and detect extensions.
          </Typography>
        </Box>
      </Box>
    );
  }

  // Once we have stats, display them in a structured format
  return (
    <Box sx={{ mt: 4, p: 2 }}>
      <Typography variant="h5" gutterBottom>Parser Statistics</Typography>
      
      <Grid container spacing={3}>
        {/* Overall Stats */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Message Types</Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">User Messages:</Typography>
                  <Typography variant="h4">{stats.counts.user || 0}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">Assistant Messages:</Typography>
                  <Typography variant="h4">{stats.counts.assistant || 0}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">Tool Messages:</Typography>
                  <Typography variant="h4">{stats.counts.tool || 0}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">System Messages:</Typography>
                  <Typography variant="h4">{stats.counts.system || 0}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Unknown Fields */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Unknown Field Detection</Typography>
              
              {stats.unknown_fields && stats.unknown_fields.total > 0 ? (
                <>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Messages with unknown fields may indicate new ChatGPT features or format changes.
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2">User:</Typography>
                      <Typography variant="h5">{stats.unknown_fields.user || 0}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2">Assistant:</Typography>
                      <Typography variant="h5">{stats.unknown_fields.assistant || 0}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2">Tool:</Typography>
                      <Typography variant="h5">{stats.unknown_fields.tool || 0}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2">System:</Typography>
                      <Typography variant="h5">{stats.unknown_fields.system || 0}</Typography>
                    </Grid>
                  </Grid>
                </>
              ) : (
                <Alert severity="success" sx={{ mt: 2 }}>
                  No unknown fields detected in your archive. Parser is handling all message formats.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {/* Tool Message Types */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Tool Message Types</Typography>
              
              {stats.tool_types && Object.keys(stats.tool_types).length > 0 ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                  {Object.entries(stats.tool_types).map(([type, count]) => (
                    <Chip 
                      key={type}
                      label={`${type}: ${count}`}
                      color="primary"
                      variant="outlined"
                      sx={{ mb: 1 }}
                    />
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No tool messages detected in your archive.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {/* Model Usage */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Model Usage</Typography>
              
              {stats.models && Object.keys(stats.models).length > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Model</TableCell>
                      <TableCell align="right">Usage Count</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(stats.models)
                      .sort((a, b) => b[1] - a[1]) // Sort by count descending
                      .map(([model, count]) => (
                        <TableRow key={model}>
                          <TableCell>{model}</TableCell>
                          <TableCell align="right">{count}</TableCell>
                        </TableRow>
                      ))
                    }
                  </TableBody>
                </Table>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No model information detected in your archive.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {/* Gizmo/Custom GPT Usage */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Custom GPT Usage</Typography>
              
              {stats.gizmos && Object.keys(stats.gizmos).length > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Custom GPT</TableCell>
                      <TableCell align="right">Usage Count</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(stats.gizmos)
                      .sort((a, b) => b[1] - a[1]) // Sort by count descending
                      .map(([gizmo, count]) => (
                        <TableRow key={gizmo}>
                          <TableCell>{gizmo}</TableCell>
                          <TableCell align="right">{count}</TableCell>
                        </TableRow>
                      ))
                    }
                  </TableBody>
                </Table>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No Custom GPT usage detected in your archive.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}