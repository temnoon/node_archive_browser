import React from 'react';
import { Box, Alert, Button, Typography } from '@mui/material';

/**
 * Error Boundary Component
 * Catches JavaScript errors in child components
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  // Update state when an error occurs
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  // Log the error details
  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
  }

  // Reset the error state
  handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    });
  }

  render() {
    if (this.state.hasError) {
      // Render fallback UI
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            An error occurred in this component.
          </Alert>
          
          <Typography variant="body1" sx={{ mb: 2 }}>
            {this.state.error?.message || 'Something went wrong.'}
          </Typography>
          
          <Box sx={{ mt: 2, display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={this.handleReset}
            >
              Try Again
            </Button>
            
            <Button 
              variant="outlined" 
              onClick={() => window.location.href = '/'}
            >
              Go Home
            </Button>
          </Box>
          
          {/* Technical details for developers - collapsed by default */}
          <details style={{ marginTop: 20, textAlign: 'left' }}>
            <summary>Technical Details</summary>
            <pre style={{ 
              whiteSpace: 'pre-wrap', 
              backgroundColor: '#f5f5f5', 
              padding: 10, 
              borderRadius: 5 
            }}>
              {this.state.error?.toString()}
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
        </Box>
      );
    }

    // Render children if no error
    return this.props.children;
  }
}

export default ErrorBoundary;