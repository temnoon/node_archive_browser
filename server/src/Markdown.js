import React, { useEffect, useMemo, useRef } from 'react';
import { parseMarkdownGFM } from './markdown-gfm';

// Extract TeX math segments into placeholders
function extractMathSegments(md) {
  const segments = [];
  let idx = 0;
  // Block math: \[ ... \] (allow multiline)
  let text = md.replace(/\\\[((?:.|\n)+?)\\\]/g, (_, content) => {
    const key = `@@MATH${idx}@@`;
    segments.push({ key, math: content, type: 'block' });
    idx++;
    return key;
  });
  // Inline math: \( ... \) (allow any content except closing paren)
  text = text.replace(/\\\((.+?)\\\)/g, (_, content) => {
    const key = `@@MATH${idx}@@`;
    segments.push({ key, math: content, type: 'inline' });
    idx++;
    return key;
  });
  return { text, segments };
}

export default function Markdown({ children }) {
  // 1. Extract math segments and replace with placeholders
  const src = useMemo(() => (typeof children === 'string' ? children : ''), [children]);
  const { text, segments } = useMemo(() => extractMathSegments(src), [src]);

  // 2. Render markdown with GFM support (placeholders already present)
  const html = useMemo(() => parseMarkdownGFM(text), [text]);
  const ref = useRef();

  // 4. Post-process: Replace placeholders with MathJax script tags
  useEffect(() => {
    if (ref.current) {
      let el = ref.current;
      // Replace all placeholders in the DOM
      segments.forEach(({ key, math, type }) => {
        // Find all text nodes containing the placeholder
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while ((node = walker.nextNode())) {
          const idx = node.nodeValue.indexOf(key);
          if (idx !== -1) {
            const before = node.nodeValue.slice(0, idx);
            const after = node.nodeValue.slice(idx + key.length);
            // Insert TeX directly into the DOM using delimiters
            const span = document.createElement('span');
            if (type === 'block') {
              // Wrap block math in a scrollable container
              const scroll = document.createElement('div');
              scroll.style.overflowX = 'auto';
              scroll.style.maxWidth = '100vw';
              scroll.style.WebkitOverflowScrolling = 'touch'; // for smooth scrolling on iOS
              scroll.style.padding = '0.25em 0';
              span.innerHTML = `\\[${math}\\]`;
              scroll.appendChild(span);
              const parent = node.parentNode;
              if (before) parent.insertBefore(document.createTextNode(before), node);
              parent.insertBefore(scroll, node);
              if (after) parent.insertBefore(document.createTextNode(after), node);
              parent.removeChild(node);
              continue;
            } else {
              span.innerHTML = `\\(${math}\\)`;
            }
            const parent = node.parentNode;
            if (before) parent.insertBefore(document.createTextNode(before), node);
            parent.insertBefore(span, node);
            if (after) parent.insertBefore(document.createTextNode(after), node);
            parent.removeChild(node);
          }
        }
      });
      // Style tables
      el.querySelectorAll('table').forEach(t => {
        t.style.borderCollapse = 'collapse';
        t.style.width = 'auto';
        t.style.maxWidth = '100%';
        t.style.margin = '1em 0';
        t.style.background = '#fafafa';
        t.style.borderRadius = '6px';
        t.style.overflow = 'hidden';
        t.style.border = '1px solid #e0e0e0';
        t.style.tableLayout = 'auto';
        t.style.boxShadow = '0 1px 4px rgba(0,0,0,0.03)';
      });
      el.querySelectorAll('th').forEach(th => {
        th.style.background = '#f5f6fa'; // lighter grey
        th.style.border = '1px solid #e0e0e0';
        th.style.padding = '10px 16px';
        th.style.fontWeight = 'bold';
        th.style.textAlign = 'left';
        th.style.verticalAlign = 'middle';
        th.style.whiteSpace = 'pre-line';
      });
      el.querySelectorAll('td').forEach(td => {
        td.style.border = '1px solid #e0e0e0';
        td.style.padding = '10px 16px';
        td.style.textAlign = 'left';
        td.style.verticalAlign = 'middle';
        td.style.whiteSpace = 'pre-line';
      });
      // Robust MathJax typeset: poll until MathJax is loaded, then typeset
      function typesetMathJax() {
        if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
          window.MathJax.typesetPromise([el]);
        } else {
          setTimeout(typesetMathJax, 100);
        }
      }
      typesetMathJax();
    }
  }, [html, segments]);

  return <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}
