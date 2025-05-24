// Utility functions for LaTeX handling in JSON content

/**
 * Extracts LaTeX segments from text content
 * 
 * @param {string} text - The input text containing LaTeX notation
 * @returns {Object} Object containing processed text and extracted segments
 */
export function extractMathSegments(text) {
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
    
    // 1. Complex LaTeX expressions (keep existing validation)
    if (content.includes('\\') || 
        content.match(/\\[a-zA-Z]+/) || 
        content.includes('{') || 
        content.includes('^') || 
        content.includes('_')) {
      const key = `@@MATH${idx}@@`;
      segments.push({ key, math: content, type: 'inline' });
      idx++;
      return key;
    }
    
    // 2. Single letters (standard mathematical variables)
    if (content.match(/^[a-zA-Z]$/)) {
      const key = `@@MATH${idx}@@`;
      segments.push({ key, math: content, type: 'inline' });
      idx++;
      return key;
    }
    
    // 3. Short mathematical expressions (letter + number, simple combinations)
    if (content.match(/^[a-zA-Z][0-9]*$/) || 
        (content.match(/^[a-zA-Z]+$/) && content.length <= 3)) {
      const key = `@@MATH${idx}@@`;
      segments.push({ key, math: content, type: 'inline' });
      idx++;
      return key;
    }
    
    // 4. Exclude obvious non-mathematical content
    // Currency patterns: numbers with decimals, multiple digits, etc.
    if (content.match(/^[0-9]+\.?[0-9]*$/) || 
        content.match(/^[0-9]+$/) || 
        (content.includes('.') && content.match(/[0-9]/))) {
      return match; // Leave as is - likely currency
    }
    
    // 5. Other mathematical patterns (operators, etc.)
    if (content.includes('+') || content.includes('-') || content.includes('*') ||
        content.includes('/') || content.includes('=') || content.includes('<') ||
        content.includes('>')) {
      const key = `@@MATH${idx}@@`;
      segments.push({ key, math: content, type: 'inline' });
      idx++;
      return key;
    }
    
    // If none of the above, leave as is
    return match;
  });
  
  return { text: processedText, segments };
}

/**
 * Replaces LaTeX placeholders with actual LaTeX markup in DOM elements
 * 
 * @param {HTMLElement} element - The DOM element containing LaTeX placeholders
 * @param {Array} segments - Array of LaTeX segments with keys and content
 */
export function replaceLatexPlaceholders(element, segments) {
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
  
  // Trigger MathJax rendering
  if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
    window.MathJax.typesetPromise([element]).catch(err => {
      console.error('MathJax typesetting error:', err);
    });
  }
}

/**
 * Process text content to properly handle LaTeX
 * 
 * @param {string} text - The raw text content
 * @returns {Object} Object with text containing placeholders and segments array
 */
export function processLatexInText(text) {
  return extractMathSegments(text);
}
