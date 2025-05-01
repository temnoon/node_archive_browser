import React, { useEffect, useMemo, useRef } from 'react';
import { parseMarkdownGFM } from './markdown-gfm';

function extractMathSegments(md) {
  const segments = [];
  let idx = 0;
  let text = md.replace(/\\\[((?:.|\n)+?)\\\]/g, (_, content) => {
    const key = `@@MATH${idx}@@`;
    segments.push({ key, math: content, type: 'block' });
    idx++;
    return key;
  });
  text = text.replace(/\\\((.+?)\\\)/g, (_, content) => {
    const key = `@@MATH${idx}@@`;
    segments.push({ key, math: content, type: 'inline' });
    idx++;
    return key;
  });
  return { text, segments };
}

export default function Markdown({ children }) {
  const src = useMemo(() => (typeof children === 'string' ? children : ''), [children]);
  const { text, segments } = useMemo(() => extractMathSegments(src), [src]);
  const html = useMemo(() => parseMarkdownGFM(text), [text]);
  const ref = useRef();
  useEffect(() => {
    if (ref.current) {
      let el = ref.current;
      segments.forEach(({ key, math, type }) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
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
              scroll.style.maxWidth = '100vw';
              scroll.style.WebkitOverflowScrolling = 'touch';
              scroll.style.padding = '0.25em 0';
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
      if (window.MathJax) {
        window.MathJax.typesetPromise([el]);
      }
    }
  }, [html, segments]);
  return <span ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}
