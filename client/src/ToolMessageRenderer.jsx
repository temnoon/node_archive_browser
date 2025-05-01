import React from 'react';
import Markdown from './Markdown.jsx';

function isMarkdownBlock(str) {
  if (typeof str !== 'string') return false;
  return (
    str.length > 60 ||
    /\n/.test(str) ||
    /[#*_`~\[\]\\$]/.test(str) ||
    /\\\(|\\\[|\$/.test(str)
  );
}

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

export default function ToolMessageRenderer({ message }) {
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
  function renderYamlWithCode(obj, indent = 0) {
    if (typeof obj !== 'object' || obj === null) {
      if (typeof obj === 'string' && obj.trim().startsWith('{') && obj.trim().endsWith('}')) {
        try {
          const parsed = JSON.parse(obj);
          return renderYamlWithCode(parsed, indent + 1);
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
                {renderYamlWithCode(parsed, indent + 1)}
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
  return (
    <div style={{ fontFamily: 'Menlo, monospace', fontSize: 15, background: '#fcfcfc', border: '1px solid #e0e0e0', borderRadius: 8, padding: 16, margin: '12px 0', overflowX: 'auto' }}>
      {renderYamlWithCode(parsed)}
    </div>
  );
}
