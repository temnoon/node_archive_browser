import React from 'react';
import Markdown from './Markdown';

// Utility to check if a string looks like markdown/TeX block
function isMarkdownBlock(str) {
  if (typeof str !== 'string') return false;
  // Heuristics: long, has markdown/TeX markers, or multiline
  return (
    str.length > 60 ||
    /\n/.test(str) ||
    /[#*_`~\[\]\\$]/.test(str) ||
    /\\\(|\\\[|\$/.test(str)
  );
}

// Recursively render JSON as YAML, with markdown/TeX blocks rendered nicely
function renderYaml(obj, indent = 0) {
  if (typeof obj !== 'object' || obj === null) {
    // Render as plain value
    // Try to parse nested JSON string
    if (typeof obj === 'string' && obj.trim().startsWith('{') && obj.trim().endsWith('}')) {
      try {
        const parsed = JSON.parse(obj);
        return renderYaml(parsed, indent + 1);
      } catch (e) { /* not JSON, leave as is */ }
    }
    return <span style={{ whiteSpace: 'pre-wrap' }}>{String(obj)}</span>;
  }
  return (
    <div style={{ paddingLeft: indent * 16 }}>
      {Object.entries(obj).map(([key, value], idx) => {
        // Recursively parse stringified JSON at any depth
        let parsed = value;
        if (typeof value === 'string' && value.trim().startsWith('{') && value.trim().endsWith('}')) {
          try {
            parsed = JSON.parse(value);
          } catch (e) { /* not JSON, leave as is */ }
        }
        // If value is a markdown block, render with Markdown
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
        // If value is an object, recurse
        if (typeof parsed === 'object' && parsed !== null) {
          return (
            <div key={key + idx} style={{ marginBottom: 8 }}>
              <span style={{ color: '#7b869c' }}>{key}:</span>
              {renderYaml(parsed, indent + 1)}
            </div>
          );
        }
        // Otherwise, show as YAML line
        return (
          <div key={key + idx} style={{ marginBottom: 4 }}>
            <span style={{ color: '#7b869c' }}>{key}:</span> <span style={{ color: '#2d313a' }}>{String(parsed)}</span>
          </div>
        );
      })}
    </div>
  );
}

function isTetherType(obj) {
  // Recognize any content_type starting with 'tether' (case-insensitive)
  if (!obj || typeof obj !== 'object') return false;
  const type = (obj.content_type || obj.contenttype || '').toLowerCase();
  return type.startsWith('tether');
}

function isCanvasOrQuote(obj) {
  // Recognize content_type for canvas, tether_quote, or similar
  if (!obj || typeof obj !== 'object') return false;
  const type = obj.content_type || obj.contenttype;
  return type === 'canvas' || type === 'tether_quote' || type === 'tetherbrowsingdisplay';
}

// Helper: Should a field be rendered as markdown text block?
function isTextLikeField(key, value) {
  if (typeof value !== 'string') return false;
  if (key === 'text' || key === 'code') return value.length > 40 || /[\n#*_`~\[\]\\$]/.test(value);
  return false;
}

export default function ToolMessageRenderer({ json }) {
  // Always try to parse JSON first if string
  let parsed = json;
  if (typeof json === 'string') {
    try {
      parsed = JSON.parse(json);
    } catch (e) {
      // Only fallback to <pre> if not valid JSON
      return <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, overflowX: 'auto' }}>{json}</pre>;
    }
  }
  // Special pretty rendering for tether/canvas/quote types
  if (isTetherType(parsed) || isCanvasOrQuote(parsed)) {
    // Find the first long/textual field: result, text, code
    const { result, text, code, ...meta } = parsed;
    let mainBlock = null;
    if (typeof result === 'string' && (isTextLikeField('result', result) || isMarkdownBlock(result))) {
      mainBlock = <Markdown>{result}</Markdown>;
    } else if (typeof text === 'string' && (isTextLikeField('text', text) || isMarkdownBlock(text))) {
      mainBlock = <Markdown>{text}</Markdown>;
    } else if (typeof code === 'string' && (isTextLikeField('code', code) || isMarkdownBlock(code))) {
      mainBlock = <Markdown>{code}</Markdown>;
    }
    return (
      <div style={{ background: '#fcfcfc', border: '1px solid #e0e0e0', borderRadius: 8, padding: 16, margin: '12px 0', overflowX: 'auto' }}>
        {mainBlock && (
          <div style={{ marginBottom: 18, fontFamily: 'system-ui, sans-serif', fontSize: 17, color: '#20232a', lineHeight: 1.65 }}>
            {mainBlock}
          </div>
        )}
        <div style={{ fontFamily: 'Menlo, monospace', fontSize: 14, color: '#6a6d74' }}>
          {renderYaml(meta)}
        </div>
      </div>
    );
  }
  // Default: YAML/Markdown hybrid rendering, but render 'code' fields as markdown if they look like text
  function renderYamlWithCode(obj, indent = 0) {
    if (typeof obj !== 'object' || obj === null) {
      // Try to parse nested JSON string
      if (typeof obj === 'string' && obj.trim().startsWith('{') && obj.trim().endsWith('}')) {
        try {
          const parsed = JSON.parse(obj);
          return renderYamlWithCode(parsed, indent + 1);
        } catch (e) { /* not JSON, leave as is */ }
      }
      return <span style={{ whiteSpace: 'pre-wrap' }}>{String(obj)}</span>;
    }
    return (
      <div style={{ paddingLeft: indent * 16 }}>
        {Object.entries(obj).map(([key, value], idx) => {
          // Recursively parse stringified JSON at any depth
          let parsed = value;
          if (typeof value === 'string' && value.trim().startsWith('{') && value.trim().endsWith('}')) {
            try {
              parsed = JSON.parse(value);
            } catch (e) { /* not JSON, leave as is */ }
          }
          // If value is a markdown block or text-like code, render with Markdown
          if (isTextLikeField(key, parsed) || isMarkdownBlock(parsed)) {
            return (
              <div key={key + idx} style={{ marginBottom: 12 }}>
                <span style={{ color: '#7b869c' }}>{key}:</span>
                <div style={{ border: '1px solid #e0e0e0', borderRadius: 6, background: '#fafbfc', margin: '4px 0', padding: '8px 12px', overflowX: 'auto' }}>
                  <Markdown>{parsed}</Markdown>
                </div>
              </div>
            );
          }
          // If value is an object, recurse
          if (typeof parsed === 'object' && parsed !== null) {
            return (
              <div key={key + idx} style={{ marginBottom: 8 }}>
                <span style={{ color: '#7b869c' }}>{key}:</span>
                {renderYamlWithCode(parsed, indent + 1)}
              </div>
            );
          }
          // Otherwise, show as YAML line
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
