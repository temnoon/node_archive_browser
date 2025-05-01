import React, { useEffect, useMemo, useRef } from 'react';
import { parseMarkdownGFM } from './markdown-gfm';
import { useParams } from 'react-router-dom';
import { extractMathSegments, replaceLatexPlaceholders } from './latexUtils';

// Helper function to fix media URLs in the DOM
function fixMediaUrls(element, conversationId) {
  if (!element || !conversationId) return;

  // Find all images
  const images = element.querySelectorAll('img');
  if (!images.length) return;

  images.forEach(img => {
    const src = img.getAttribute('src');
    if (!src) return;

    // Various patterns that media URLs might have
    if (src.startsWith('../media/')) {
      // Convert ../media/filename to /api/media/[conversation-id]/filename
      const filename = src.replace('../media/', '');
      img.setAttribute('src', `/api/media/${conversationId}/${filename}`);
    } 
    else if (src.match(/^[^\/]+\.(png|jpg|jpeg|gif|webp|svg)$/i)) {
      // Handle bare filenames (likely media files)
      img.setAttribute('src', `/api/media/${conversationId}/${src}`);
    }
    else if (src.includes('file-') || src.includes('file_')) {
      // Handle ChatGPT-style media references
      img.setAttribute('src', `/api/media/${conversationId}/${src}`);
    }
  });
}

export default function Markdown({ children, segments: propSegments }) {
  const src = useMemo(() => (typeof children === 'string' ? children : ''), [children]);
  
  // Use segments from props if provided, otherwise extract them from the source
  const { text, segments } = useMemo(() => {
    if (propSegments && Array.isArray(propSegments) && propSegments.length > 0) {
      return { text: src, segments: propSegments };
    }
    return extractMathSegments(src);
  }, [src, propSegments]);
  
  const html = useMemo(() => parseMarkdownGFM(text), [text]);
  const ref = useRef();
  const { id: conversationId } = useParams();

  useEffect(() => {
    if (ref.current) {
      // Fix media URLs in the DOM after it's loaded
      fixMediaUrls(ref.current, conversationId);
      
      // Replace LaTeX placeholders with actual LaTeX markup
      if (segments && segments.length > 0) {
        replaceLatexPlaceholders(ref.current, segments);
      }
    }
  }, [html, segments, conversationId]);
  
  return <span ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}