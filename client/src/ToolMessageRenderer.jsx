import React, { useState } from 'react';
import { Box, Typography, Paper, Chip, Divider, Link, Collapse, Button } from '@mui/material';
import Markdown from './Markdown.jsx';

// Helper to determine if content is likely markdown
function isMarkdownBlock(str) {
  if (typeof str !== 'string') return false;
  return (
    str.length > 60 ||
    /\n/.test(str) ||
    /[#*_`~\[\]\\$]/.test(str) ||
    /\\\(|\\\[|\$/.test(str)
  );
}

// Helper to extract content type from tool message
function getToolType(message) {
  // First check for message with content_type
  if (message?.content?.content_type) {
    return message.content.content_type;
  }
  
  // Check for specific author names
  if (message?.author?.name === 'web') {
    return 'web_search';
  }
  
  // Check for code interpreter
  if (message?.author?.name === 'python') {
    return 'code_interpreter';
  }
  
  // Check for tether quotes (citations)
  if (message?.content?.domain && message?.content?.url && message?.content?.text) {
    return 'tether_quote';
  }
  
  // Check for file operations
  if (message?.content?.file_path || message?.content?.file_id) {
    return 'file_operation';
  }
  
  // Default to generic tool
  return 'generic_tool';
}

// Renders a web search result
function WebSearchRenderer({ message }) {
  const [expandedResult, setExpandedResult] = useState(null);
  
  // Extract search results content
  let searchResults = [];
  let searchQuery = '';
  
  // Try to find the search content in different formats
  if (message.content && message.content.content_type === 'text' && message.content.parts) {
    try {
      // Web search results are often stored as JSON in the parts
      const jsonContent = JSON.parse(message.content.parts[0]);
      if (jsonContent.search_results) {
        searchResults = jsonContent.search_results;
      }
      if (jsonContent.search_query) {
        searchQuery = jsonContent.search_query;
      }
    } catch (e) {
      // If not JSON, try to parse as regular text
      const text = message.content.parts.join('\n');
      if (text.includes('Search results:')) {
        // Simple parsing of text-based search results
        const parts = text.split('Search results:');
        if (parts.length > 1) {
          searchQuery = parts[0].replace('Search query:', '').trim();
          // Parse the rest as results
          searchResults = parts[1]
            .split(/\d+\.\s/)
            .filter(Boolean)
            .map(part => {
              const titleMatch = part.match(/(.*?)(?:\n|$)/);
              const urlMatch = part.match(/URL:\s*(https?:\/\/[^\s]+)/);
              const snippetMatch = part.match(/Snippet:\s*([\s\S]+)$/);
              
              return {
                title: titleMatch ? titleMatch[1].trim() : 'Untitled',
                url: urlMatch ? urlMatch[1].trim() : '',
                snippet: snippetMatch ? snippetMatch[1].trim() : part
              };
            });
        }
      }
    }
  }
  
  // If no search results found through parsing, show raw content
  if (searchResults.length === 0) {
    return (
      <Box sx={{ fontFamily: 'monospace', fontSize: 14, whiteSpace: 'pre-wrap' }}>
        <Typography variant="subtitle2" color="primary" gutterBottom>
          Web Search
        </Typography>
        {renderYaml(message.content)}
      </Box>
    );
  }
  
  return (
    <Box sx={{ bgcolor: '#f8f9fa', p: 2, borderRadius: 1 }}>
      <Typography variant="subtitle2" color="primary" gutterBottom>
        Web Search: <span style={{ fontWeight: 'normal', color: '#555' }}>{searchQuery}</span>
      </Typography>
      
      <Divider sx={{ my: 1 }} />
      
      {searchResults.map((result, index) => (
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
      ))}
    </Box>
  );
}

// Renders a web citation/tether quote
function TetherQuoteRenderer({ message }) {
  const content = message.content || {};
  
  return (
    <Box sx={{ bgcolor: '#f8fbff', p: 2, borderRadius: 1, border: '1px solid #e1e8ed' }}>
      <Typography variant="subtitle2" color="primary" gutterBottom>
        Citation from {content.domain || 'source'}
      </Typography>
      
      {content.url && (
        <Link 
          href={content.url}
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
          {content.url.length > 60 ? content.url.substring(0, 60) + '...' : content.url}
        </Link>
      )}
      
      <Box sx={{ 
        mt: 1, 
        pl: 2, 
        borderLeft: '3px solid #e1e8ed',
        fontStyle: 'italic'
      }}>
        <Typography variant="body2">
          {content.text}
        </Typography>
      </Box>
    </Box>
  );
}

// Renders code execution results
function CodeInterpreterRenderer({ message }) {
  // Extract code execution content
  let input = '';
  let outputs = [];
  
  if (message.content && message.content.content_type === 'code') {
    input = message.content.text || '';
    outputs = message.content.outputs || [];
  } else if (typeof message.content === 'object') {
    // Try to find code contents in different formats
    if (message.content.input) {
      input = message.content.input;
    }
    if (message.content.outputs) {
      outputs = message.content.outputs;
    }
  }
  
  return (
    <Box sx={{ fontFamily: 'monospace', fontSize: 14 }}>
      <Typography variant="subtitle2" color="primary" gutterBottom>
        Code Execution
      </Typography>
      
      {input && (
        <Box sx={{ 
          mb: 2, 
          p: 1.5, 
          bgcolor: '#f5f7f9', 
          borderRadius: 1,
          border: '1px solid #e0e0e0',
          whiteSpace: 'pre-wrap',
          overflowX: 'auto'
        }}>
          <Typography 
            component="pre"
            sx={{ 
              fontFamily: 'monospace', 
              m: 0,
              fontSize: '0.85rem'
            }}
          >
            {input}
          </Typography>
        </Box>
      )}
      
      {outputs.length > 0 && (
        <Box>
          <Typography variant="caption" sx={{ color: '#555', mb: 1, display: 'block' }}>
            Output:
          </Typography>
          
          {outputs.map((output, index) => {
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
            
            // Handle other outputs as JSON
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

// Renders file operation results
function FileOperationRenderer({ message }) {
  const content = message.content || {};
  
  // File operation type
  let operationType = 'File Operation';
  if (content.content_type === 'file_path') {
    operationType = 'File Path';
  } else if (content.content_type === 'file_citation') {
    operationType = 'File Citation';
  } else if (content.content_type === 'file_upload') {
    operationType = 'File Upload';
  }
  
  // Get file path or ID
  const filePath = content.file_path || content.path;
  const fileId = content.file_id || content.id;
  
  return (
    <Box sx={{ bgcolor: '#f5f8fa', p: 2, borderRadius: 1, border: '1px solid #dde4e9' }}>
      <Typography variant="subtitle2" color="primary" gutterBottom>
        {operationType}
      </Typography>
      
      {filePath && (
        <Box sx={{ mb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Path:
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {filePath}
          </Typography>
        </Box>
      )}
      
      {fileId && (
        <Box sx={{ mb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            ID:
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {fileId}
          </Typography>
        </Box>
      )}
      
      {content.text && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Content:
          </Typography>
          <Box sx={{ 
            mt: 0.5, 
            p: 1.5, 
            bgcolor: '#fff', 
            borderRadius: 1,
            border: '1px solid #e0e0e0',
            maxHeight: '200px',
            overflow: 'auto'
          }}>
            {isMarkdownBlock(content.text) ? (
              <Markdown children={content.text} />
            ) : (
              <Typography 
                component="pre"
                sx={{ 
                  fontFamily: 'monospace', 
                  m: 0,
                  fontSize: '0.85rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}
              >
                {content.text}
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}

// Generic renderer for YAML-like data visualization
function renderYaml(obj, indent = 0) {
  if (typeof obj !== 'object' || obj === null) {
    if (typeof obj === 'string' && obj.trim().startsWith('{') && obj.trim().endsWith('}')) {
      try {
        const parsed = JSON.parse(obj);
        return renderYaml(parsed, indent + 1);
      } catch (e) {}
    }
    return <span style={{ whiteSpace: 'pre-wrap' }}>{String(obj)}</span>;
  }
  return (
    <div style={{ paddingLeft: indent * 16 }}>
      {Object.entries(obj).map(([key, value], idx) => {
        let parsed = value;
        if (typeof value === 'string' && value.trim().startsWith('{') && value.trim().endsWith('}')) {
          try {
            parsed = JSON.parse(value);
          } catch (e) {}
        }
        if (isMarkdownBlock(parsed)) {
          return (
            <div key={key + idx} style={{ marginBottom: 12 }}>
              <span style={{ color: '#7b869c' }}>{key}:</span>
              <div style={{ border: '1px solid #e0e0e0', borderRadius: 6, background: '#fafbfc', margin: '4px 0', padding: '8px 12px', overflowX: 'auto' }}>
                <Markdown>{parsed}</Markdown>
              </div>
            </div>
          );
        }
        if (typeof parsed === 'object' && parsed !== null) {
          return (
            <div key={key + idx} style={{ marginBottom: 8 }}>
              <span style={{ color: '#7b869c' }}>{key}:</span>
              {renderYaml(parsed, indent + 1)}
            </div>
          );
        }
        return (
          <div key={key + idx} style={{ marginBottom: 4 }}>
            <span style={{ color: '#7b869c' }}>{key}:</span> <span style={{ color: '#2d313a' }}>{String(parsed)}</span>
          </div>
        );
      })}
    </div>
  );
}

// Main Tool Message Renderer component
export default function ToolMessageRenderer({ message }) {
  // Determine the tool type
  const toolType = getToolType(message);
  
  // Choose the appropriate renderer based on tool type
  switch (toolType) {
    case 'web_search':
      return <WebSearchRenderer message={message} />;
      
    case 'tether_quote':
      return <TetherQuoteRenderer message={message} />;
      
    case 'code':
    case 'code_interpreter':
      return <CodeInterpreterRenderer message={message} />;
      
    case 'file_path':
    case 'file_citation':
    case 'file_upload':
    case 'file_operation':
      return <FileOperationRenderer message={message} />;
      
    default:
      // Extract content from the tool message
      let json = '';
      
      if (message && message.content) {
        // Check if the content is directly in the message
        if (message.content.content_type === 'text' && message.content.parts) {
          // Join all parts
          json = message.content.parts.join('\n');
        } else if (typeof message.content === 'string') {
          // Direct string content
          json = message.content;
        }
      }
      
      let parsed = json;
      if (typeof json === 'string') {
        try {
          parsed = JSON.parse(json);
        } catch (e) {
          return <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, overflowX: 'auto' }}>{json}</pre>;
        }
      }
      
      // Render as YAML-like structure
      return (
        <div style={{ fontFamily: 'Menlo, monospace', fontSize: 15, background: '#fcfcfc', border: '1px solid #e0e0e0', borderRadius: 8, padding: 16, margin: '12px 0', overflowX: 'auto' }}>
          {renderYaml(parsed)}
        </div>
      );
  }
}
