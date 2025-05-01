import React, { useState } from 'react';
import { Box, Typography, Paper, Chip, Divider, Link, Collapse, Button, Alert } from '@mui/material';
import Markdown from './Markdown.jsx';

/**
 * Enhanced Tool Message Renderer
 * Leverages the structured parsed data from our new message parsers
 */
export default function EnhancedToolMessageRenderer({ message, parsedData }) {
  // If no parsed data available, fall back to the original renderer
  if (!parsedData) {
    return <LegacyToolMessageRenderer message={message} />;
  }

  // Determine the specific tool content type
  const contentType = parsedData.content_type || 'unknown';

  // Render based on the structured parsed data
  switch (contentType) {
    case 'tether_quote':
      return <TetherQuoteRenderer parsed={parsedData} />;
    
    case 'code':
      return <CodeRenderer parsed={parsedData} />;
      
    case 'file_citation':
      return <FileCitationRenderer parsed={parsedData} />;
      
    case 'file_path':
      return <FilePathRenderer parsed={parsedData} />;
      
    case 'search_results':
      return <SearchResultsRenderer parsed={parsedData} />;
      
    case 'tool_result':
      return <ToolResultRenderer parsed={parsedData} />;
      
    case 'execution_output':
      return <ExecutionOutputRenderer parsed={parsedData} />;
      
    default:
      // For unknown or unimplemented types, use a generic renderer
      return <GenericToolRenderer parsed={parsedData} message={message} />;
  }
}

/**
 * Specialized renderer for tether quotes (web citations)
 */
function TetherQuoteRenderer({ parsed }) {
  return (
    <Box sx={{ bgcolor: '#f8fbff', p: 2, borderRadius: 1, border: '1px solid #e1e8ed' }}>
      <Typography variant="subtitle2" color="primary" gutterBottom>
        Citation from {parsed.domain || 'source'}
        {parsed.has_unknown_fields && (
          <Chip size="small" label="Enhanced Format" color="secondary" sx={{ ml: 1 }} />
        )}
      </Typography>
      
      {parsed.url && (
        <Link 
          href={parsed.url}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ 
            display: 'block',
            mb: 1,
            fontSize: '0.8rem',
            color: '#0366d6',
            textDecoration: 'none',
            '&:hover': { textDecoration: 'underline' }
          }}
        >
          {parsed.url.length > 60 ? parsed.url.substring(0, 60) + '...' : parsed.url}
        </Link>
      )}
      
      <Box sx={{ 
        mt: 1, 
        pl: 2, 
        borderLeft: '3px solid #e1e8ed',
        fontStyle: 'italic'
      }}>
        <Typography variant="body2">
          {parsed.text}
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * Specialized renderer for code execution results
 */
function CodeRenderer({ parsed }) {
  return (
    <Box sx={{ fontFamily: 'monospace', fontSize: 14 }}>
      <Typography variant="subtitle2" color="primary" gutterBottom>
        Code Execution
        {parsed.has_unknown_fields && (
          <Chip size="small" label="Enhanced Format" color="secondary" sx={{ ml: 1 }} />
        )}
      </Typography>
      
      {parsed.input && (
        <Box sx={{ 
          mb: 2, 
          p: 1.5, 
          bgcolor: '#f5f7f9', 
          borderRadius: 1,
          border: '1px solid #e0e0e0',
          whiteSpace: 'pre-wrap',
          overflowX: 'auto'
        }}>
          <Typography component="pre" sx={{ 
            fontFamily: 'monospace', 
            m: 0,
            fontSize: '0.85rem',
            whiteSpace: 'pre-wrap'
          }}>
            {parsed.input}
          </Typography>
        </Box>
      )}
      
      {parsed.language && (
        <Typography variant="caption" sx={{ display: 'block', mb: 1, color: '#555' }}>
          Language: {parsed.language}
        </Typography>
      )}
      
      {parsed.outputs && parsed.outputs.length > 0 && (
        <Box>
          <Typography variant="caption" sx={{ color: '#555', mb: 1, display: 'block' }}>
            Output:
          </Typography>
          
          {parsed.outputs.map((output, index) => {
            // Handle text output
            if (output.type === 'text' || typeof output.text === 'string') {
              return (
                <Box 
                  key={index}
                  sx={{ 
                    p: 1, 
                    bgcolor: '#f0f0f0', 
                    borderRadius: 1,
                    mb: 1,
                    whiteSpace: 'pre-wrap',
                    overflowX: 'auto',
                    fontFamily: 'monospace'
                  }}
                >
                  {output.text}
                </Box>
              );
            }
            
            // Handle image output
            if (output.type === 'image' || output.image_url) {
              const imgUrl = output.image_url || output.url;
              return (
                <Box key={index} sx={{ textAlign: 'center', mb: 2 }}>
                  <img 
                    src={imgUrl} 
                    alt="Code execution result" 
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: '300px',
                      border: '1px solid #e0e0e0',
                      borderRadius: '4px'
                    }} 
                  />
                </Box>
              );
            }
            
            // Generic JSON rendering for other output types
            return (
              <Box key={index} sx={{ mb: 1 }}>
                <pre style={{ margin: 0, overflow: 'auto' }}>
                  {JSON.stringify(output, null, 2)}
                </pre>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

/**
 * Specialized renderer for file citations
 */
function FileCitationRenderer({ parsed }) {
  return (
    <Box sx={{ bgcolor: '#f0f7ff', p: 2, borderRadius: 1, border: '1px solid #dde4ea' }}>
      <Typography variant="subtitle2" color="primary" gutterBottom>
        File Citation
        {parsed.has_unknown_fields && (
          <Chip size="small" label="Enhanced Format" color="secondary" sx={{ ml: 1 }} />
        )}
      </Typography>
      
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Chip
          label={parsed.file_name || 'File'} 
          variant="outlined"
          size="small"
          sx={{ mr: 1 }}
        />
        <Typography variant="caption" color="text.secondary">
          {parsed.file_id}
        </Typography>
      </Box>
      
      {parsed.citation_format && (
        <Typography variant="caption" sx={{ display: 'block', color: '#555' }}>
          Format: {parsed.citation_format}
        </Typography>
      )}
      
      {parsed.citation && (
        <Box sx={{ 
          mt: 1, 
          p: 1.5, 
          bgcolor: '#fff', 
          borderRadius: 1,
          border: '1px solid #e0e0e0'
        }}>
          <Typography variant="body2">
            {parsed.citation}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

/**
 * Specialized renderer for file paths
 */
function FilePathRenderer({ parsed }) {
  return (
    <Box sx={{ bgcolor: '#f5f8fa', p: 2, borderRadius: 1, border: '1px solid #dde4e9' }}>
      <Typography variant="subtitle2" color="primary" gutterBottom>
        File Path
        {parsed.has_unknown_fields && (
          <Chip size="small" label="Enhanced Format" color="secondary" sx={{ ml: 1 }} />
        )}
      </Typography>
      
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Chip
          label={parsed.file_name || 'File'} 
          variant="outlined"
          size="small"
          sx={{ mr: 1 }}
        />
        <Typography variant="caption" color="text.secondary">
          {parsed.file_id}
        </Typography>
      </Box>
      
      {parsed.path && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Path:
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {parsed.path}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

/**
 * Specialized renderer for search results
 */
function SearchResultsRenderer({ parsed }) {
  const [expandedResult, setExpandedResult] = useState(null);
  
  // Handle case when results are not properly structured
  if (!parsed.results || !Array.isArray(parsed.results)) {
    return (
      <Box sx={{ bgcolor: '#f8f9fa', p: 2, borderRadius: 1 }}>
        <Typography variant="subtitle2" color="primary" gutterBottom>
          Web Search Results
          {parsed.has_unknown_fields && (
            <Chip size="small" label="Enhanced Format" color="secondary" sx={{ ml: 1 }} />
          )}
        </Typography>
        <Alert severity="info">
          Search results couldn't be parsed correctly. Please check the raw message.
        </Alert>
      </Box>
    );
  }
  
  return (
    <Box sx={{ bgcolor: '#f8f9fa', p: 2, borderRadius: 1 }}>
      <Typography variant="subtitle2" color="primary" gutterBottom>
        Web Search Results
        {parsed.has_unknown_fields && (
          <Chip size="small" label="Enhanced Format" color="secondary" sx={{ ml: 1 }} />
        )}
      </Typography>
      
      <Divider sx={{ my: 1 }} />
      
      {parsed.results.length === 0 ? (
        <Typography variant="body2" sx={{ color: '#666', fontStyle: 'italic' }}>
          No search results found.
        </Typography>
      ) : (
        parsed.results.map((result, index) => (
          <Box key={index} sx={{ mt: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 0.5
              }}
            >
              <Typography 
                variant="subtitle2" 
                component={Link}
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ 
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' },
                  fontWeight: 'bold',
                  color: '#1a0dab',
                  display: 'block',
                  mb: 0.5 
                }}
              >
                {result.title || 'Untitled'}
              </Typography>
              
              <Button
                size="small"
                variant="text"
                onClick={() => setExpandedResult(expandedResult === index ? null : index)}
                sx={{ minWidth: 'auto', p: 0.5 }}
              >
                {expandedResult === index ? 'Less' : 'More'}
              </Button>
            </Box>
            
            {result.url && (
              <Typography 
                variant="caption" 
                sx={{ color: '#006621', display: 'block', mb: 0.5 }}
              >
                {result.url.length > 70 ? result.url.substring(0, 70) + '...' : result.url}
              </Typography>
            )}
            
            <Collapse in={expandedResult === index}>
              <Box sx={{ mb: 1, pl: 1, borderLeft: '3px solid #e0e0e0' }}>
                <Typography variant="body2" sx={{ color: '#545454', mb: 1 }}>
                  {result.snippet}
                </Typography>
              </Box>
            </Collapse>
            
            {expandedResult !== index && (
              <Typography 
                variant="body2" 
                sx={{ 
                  color: '#545454', 
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  mb: 1
                }}
              >
                {result.snippet}
              </Typography>
            )}
          </Box>
        ))
      )}
    </Box>
  );
}

/**
 * Specialized renderer for tool results
 */
function ToolResultRenderer({ parsed }) {
  const [expanded, setExpanded] = useState(false);
  
  // Try to parse the result as JSON if it's a string
  let resultData = parsed.result;
  let isJson = false;
  
  if (typeof resultData === 'string') {
    try {
      resultData = JSON.parse(parsed.result);
      isJson = true;
    } catch (e) {
      // Not valid JSON, keep as string
    }
  }
  
  return (
    <Box sx={{ bgcolor: '#f7f8fa', p: 2, borderRadius: 1, border: '1px solid #e1e5ea' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle2" color="primary" gutterBottom>
          Tool Result
          {parsed.has_unknown_fields && (
            <Chip size="small" label="Enhanced Format" color="secondary" sx={{ ml: 1 }} />
          )}
        </Typography>
        
        {parsed.tool_call_id && (
          <Chip 
            label={`ID: ${parsed.tool_call_id.substring(0, 8)}...`}
            size="small"
            variant="outlined"
          />
        )}
      </Box>
      
      <Button 
        size="small" 
        onClick={() => setExpanded(!expanded)}
        sx={{ mb: 1 }}
      >
        {expanded ? 'Show Less' : 'Show More'}
      </Button>
      
      <Collapse in={expanded}>
        {isJson ? (
          <Box sx={{ 
            p: 1.5, 
            bgcolor: '#fff', 
            borderRadius: 1,
            border: '1px solid #e0e0e0',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            overflowX: 'auto'
          }}>
            <pre style={{ margin: 0 }}>
              {JSON.stringify(resultData, null, 2)}
            </pre>
          </Box>
        ) : (
          <Box sx={{ 
            p: 1.5, 
            bgcolor: '#fff', 
            borderRadius: 1,
            border: '1px solid #e0e0e0',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {resultData}
          </Box>
        )}
      </Collapse>
      
      {!expanded && (
        <Box sx={{ 
          p: 1, 
          bgcolor: '#f0f0f0', 
          borderRadius: 1,
          height: '3em',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            padding: '8px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {typeof resultData === 'string' 
              ? resultData 
              : JSON.stringify(resultData).substring(0, 100) + '...'}
          </div>
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '24px',
            background: 'linear-gradient(transparent, #f0f0f0)'
          }}></div>
        </Box>
      )}
    </Box>
  );
}

/**
 * Specialized renderer for execution outputs
 */
function ExecutionOutputRenderer({ parsed }) {
  return (
    <Box sx={{ bgcolor: '#f5f7ff', p: 2, borderRadius: 1, border: '1px solid #e1e6f5' }}>
      <Typography variant="subtitle2" color="primary" gutterBottom>
        Execution Output
        {parsed.has_unknown_fields && (
          <Chip size="small" label="Enhanced Format" color="secondary" sx={{ ml: 1 }} />
        )}
      </Typography>
      
      {parsed.execution_id && (
        <Typography variant="caption" sx={{ display: 'block', mb: 1, color: '#555' }}>
          Execution ID: {parsed.execution_id}
        </Typography>
      )}
      
      {parsed.output_type && (
        <Typography variant="caption" sx={{ display: 'block', mb: 1, color: '#555' }}>
          Type: {parsed.output_type}
        </Typography>
      )}
      
      {parsed.text && (
        <Box sx={{ 
          p: 1.5, 
          bgcolor: '#fff', 
          borderRadius: 1,
          border: '1px solid #e0e0e0',
          fontFamily: 'monospace',
          fontSize: '0.85rem',
          whiteSpace: 'pre-wrap',
          maxHeight: '300px',
          overflow: 'auto'
        }}>
          {parsed.text}
        </Box>
      )}
    </Box>
  );
}

/**
 * Generic renderer for any tool type
 * Falls back to showing the parsed data as JSON
 */
function GenericToolRenderer({ parsed, message }) {
  const [showRaw, setShowRaw] = useState(false);
  
  return (
    <Box sx={{ bgcolor: '#f8f8f8', p: 2, borderRadius: 1, border: '1px solid #e0e0e0' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2" color="primary">
          {parsed.tool_name || parsed.content_type || 'Tool Message'}
          {parsed.has_unknown_fields && (
            <Chip size="small" label="Enhanced Format" color="secondary" sx={{ ml: 1 }} />
          )}
        </Typography>
        
        <Button 
          size="small" 
          variant="outlined"
          onClick={() => setShowRaw(!showRaw)}
        >
          {showRaw ? 'Show Parsed' : 'Show Raw'}
        </Button>
      </Box>
      
      {showRaw ? (
        <Box sx={{ 
          p: 1.5, 
          bgcolor: '#fff', 
          borderRadius: 1,
          border: '1px solid #e0e0e0',
          fontFamily: 'monospace',
          fontSize: '0.85rem',
          overflowX: 'auto'
        }}>
          <pre style={{ margin: 0 }}>
            {JSON.stringify(message, null, 2)}
          </pre>
        </Box>
      ) : (
        <Box sx={{ 
          p: 1.5, 
          bgcolor: '#fff', 
          borderRadius: 1,
          border: '1px solid #e0e0e0',
          fontFamily: 'monospace',
          fontSize: '0.85rem',
          overflowX: 'auto'
        }}>
          <pre style={{ margin: 0 }}>
            {JSON.stringify(parsed, null, 2)}
          </pre>
        </Box>
      )}
    </Box>
  );
}

/**
 * Legacy Tool Message Renderer
 * Used as a fallback when no parsed data is available
 */
function LegacyToolMessageRenderer({ message }) {
  const contentType = message?.content?.content_type || 'unknown';
  
  return (
    <Box sx={{ bgcolor: '#fff9f0', p: 2, borderRadius: 1, border: '1px solid #efe0cd' }}>
      <Typography variant="subtitle2" color="warning.main" gutterBottom>
        Legacy Tool Renderer: {contentType}
        <Chip size="small" label="Legacy Format" color="warning" sx={{ ml: 1 }} />
      </Typography>
      
      <Box sx={{ 
        p: 1.5, 
        bgcolor: '#fffaf0', 
        borderRadius: 1,
        border: '1px solid #efe0cd',
        fontFamily: 'monospace',
        fontSize: '0.85rem',
        overflowX: 'auto'
      }}>
        <pre style={{ margin: 0 }}>
          {JSON.stringify(message, null, 2)}
        </pre>
      </Box>
    </Box>
  );
}
