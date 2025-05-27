import React, { useEffect, useRef, useMemo } from 'react';

/**
 * LaTeX and Markdown Renderer for PDF Editor
 * Processes content in order: LaTeX extraction -> Markdown parsing -> LaTeX restoration
 */

// Extract LaTeX segments (matches latexUtils.js approach)
function extractMathSegments(text) {
  if (!text || typeof text !== 'string') {
    return { text: '', segments: [] };
  }
  
  const segments = [];
  let idx = 0;
  
  // Process display LaTeX with double dollar signs: $$ ... $$ (should come first)
  let processedText = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, content) => {
    const key = `@@MATH${idx}@@`;
    segments.push({ key, math: content.trim(), type: 'block' });
    idx++;
    return key;
  });
  
  // Process block LaTeX: \[ ... \]
  processedText = processedText.replace(/\\\[((?:.|\n)+?)\\\]/g, (_, content) => {
    const key = `@@MATH${idx}@@`;
    segments.push({ key, math: content, type: 'block' });
    idx++;
    return key;
  });
  
  // Process inline LaTeX: \( ... \)
  processedText = processedText.replace(/\\\((.+?)\\\)/g, (_, content) => {
    const key = `@@MATH${idx}@@`;
    segments.push({ key, math: content, type: 'inline' });
    idx++;
    return key;
  });
  
  // Process inline LaTeX with single dollar signs: $ ... $
  processedText = processedText.replace(/\$([^$\n]+?)\$/g, (match, content) => {
    // Validation: Check if content looks like mathematics
    if (content.includes('\\') || 
        content.match(/\\[a-zA-Z]+/) || 
        content.includes('{') || 
        content.includes('^') || 
        content.includes('_') ||
        content.match(/^[a-zA-Z]$/) ||
        content.match(/^[a-zA-Z][0-9]*$/) || 
        (content.match(/^[a-zA-Z]+$/) && content.length <= 3) ||
        content.includes('+') || content.includes('-') || content.includes('*') ||
        content.includes('/') || content.includes('=') || content.includes('<') ||
        content.includes('>')) {
      
      // Exclude obvious non-mathematical content (currency patterns)
      if (!content.match(/^[0-9]+\.?[0-9]*$/) && 
          !content.match(/^[0-9]+$/) && 
          !(content.includes('.') && content.match(/[0-9]/) && !content.match(/[a-zA-Z]/))) {
        const key = `@@MATH${idx}@@`;
        segments.push({ key, math: content, type: 'inline' });
        idx++;
        return key;
      }
    }
    
    return match; // Leave as is if not mathematical
  });
  
  return { text: processedText, segments };
}

// Parse markdown (simplified version focusing on PDF rendering)
function parseMarkdownGFM(md) {
  md = md.replace(/&(?![a-zA-Z]+;|#\d+;)/g, '&amp;')
         .replace(/</g, '&lt;')
         .replace(/>/g, '&gt;');
  
  // Headers
  md = md.replace(/^###### (.*)$/gm, '<h6>$1</h6>');
  md = md.replace(/^##### (.*)$/gm, '<h5>$1</h5>');
  md = md.replace(/^#### (.*)$/gm, '<h4>$1</h4>');
  md = md.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  md = md.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  md = md.replace(/^# (.*)$/gm, '<h1>$1</h1>');
  
  // Horizontal rules
  md = md.replace(/^---$/gm, '<hr/>');
  
  // Blockquotes
  md = md.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>');
  
  // Code blocks
  md = md.replace(/```([\s\S]+?)```/g, (m, code) => 
    `<pre><code>${code.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code></pre>`);
  
  // Inline code
  md = md.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Bold/Strong
  md = md.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  md = md.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  
  // Italic/Emphasis
  md = md.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  md = md.replace(/_([^_]+)_/g, '<em>$1</em>');
  
  // Strikethrough
  md = md.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  
  // Links
  md = md.replace(/\[([^\]]+)\]\(([^\s)]+)(?:\s+\"([^\"]*)\")?\)/g, (m, text, url, title) => {
    let t = title ? ` title="${title}"` : '';
    return `<a href="${url}"${t}>${text}</a>`;
  });
  
  // Images (simplified for PDF context)
  md = md.replace(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+\"([^\"]*)\")?\)/g, (m, alt, url, title) => {
    let t = title ? ` title="${title}"` : '';
    return `<img src="${url}" alt="${alt || ''}"${t}/>`;
  });
  
  // Lists (basic support)
  md = md.replace(/^[-*+] (.*)$/gm, '<li>$1</li>');
  md = md.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  
  // Convert newlines to line breaks
  md = md.replace(/\n/g, '<br/>');
  
  return md;
}

// Replace LaTeX placeholders with MathJax markup
function replaceLatexPlaceholders(element, segments) {
  if (!element || !segments || segments.length === 0) {
    return;
  }
  
  segments.forEach(({ key, math, type }) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
      const idx = node.nodeValue.indexOf(key);
      if (idx !== -1) {
        const before = node.nodeValue.slice(0, idx);
        const after = node.nodeValue.slice(idx + key.length);
        const span = document.createElement('span');
        
        if (type === 'block') {
          const scroll = document.createElement('div');
          scroll.style.overflowX = 'auto';
          scroll.style.maxWidth = '100%';
          scroll.style.WebkitOverflowScrolling = 'touch';
          scroll.style.padding = '0.25em 0';
          scroll.style.textAlign = 'center';
          span.innerHTML = `\\[${math}\\]`;
          scroll.appendChild(span);
          
          const parent = node.parentNode;
          if (before) parent.insertBefore(document.createTextNode(before), node);
          parent.insertBefore(scroll, node);
          if (after) parent.insertBefore(document.createTextNode(after), node);
          parent.removeChild(node);
        } else {
          span.innerHTML = `\\(${math}\\)`;
          
          const parent = node.parentNode;
          if (before) parent.insertBefore(document.createTextNode(before), node);
          parent.insertBefore(span, node);
          if (after) parent.insertBefore(document.createTextNode(after), node);
          parent.removeChild(node);
        }
      }
    }
  });
  
  // Trigger MathJax rendering
  if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
    window.MathJax.typesetPromise([element]).catch(err => {
      console.error('MathJax typesetting error:', err);
    });
  }
}

const LatexMarkdownRenderer = ({ children, style = {} }) => {
  const ref = useRef();
  const content = useMemo(() => (typeof children === 'string' ? children : ''), [children]);
  
  // Process content: LaTeX extraction -> Markdown parsing
  const { text, segments } = useMemo(() => {
    if (!content) return { text: '', segments: [] };
    return extractMathSegments(content);
  }, [content]);
  
  const html = useMemo(() => parseMarkdownGFM(text), [text]);

  useEffect(() => {
    if (ref.current && segments.length > 0) {
      // Replace LaTeX placeholders with actual LaTeX markup
      replaceLatexPlaceholders(ref.current, segments);
    }
  }, [html, segments]);

  const defaultStyle = {
    fontSize: '11px',
    fontFamily: 'Helvetica, Arial, sans-serif',
    lineHeight: 1.4,
    color: '#000000',
    ...style
  };

  return (
    <div 
      ref={ref} 
      style={defaultStyle}
      dangerouslySetInnerHTML={{ __html: html }} 
    />
  );
};

export default LatexMarkdownRenderer;