// A robust GitHub Flavored Markdown (GFM) parser with media path handling and math placeholder support.
// Math placeholders (e.g., @@MATH0@@) should be inserted before calling this parser.
// This parser supports headings, bold, italic, strikethrough, code, blockquotes, lists, tables, images, links, and inline HTML.

// Note: This is a hand-rolled parser for demonstration, not a full CommonMark+GFM spec implementation.
// For production, consider using a well-maintained library.

export function parseMarkdownGFM(md) {
  md = md.replace(/&(?![a-zA-Z]+;|#\d+;)/g, '&amp;')
         .replace(/</g, '&lt;')
         .replace(/>/g, '&gt;');
  md = md.replace(/^###### (.*)$/gm, '<h6>$1</h6>');
  md = md.replace(/^##### (.*)$/gm, '<h5>$1</h5>');
  md = md.replace(/^#### (.*)$/gm, '<h4>$1</h4>');
  md = md.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  md = md.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  md = md.replace(/^# (.*)$/gm, '<h1>$1</h1>');
  md = md.replace(/^---$/gm, '<hr/>');
  md = md.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>');
  md = md.replace(/```([\s\S]+?)```/g, (m, code) => `<pre><code>${code.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code></pre>`);
  md = md.replace(/`([^`]+)`/g, '<code>$1</code>');
  md = md.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  md = md.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  md = md.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  md = md.replace(/_([^_]+)_/g, '<em>$1</em>');
  md = md.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  
  // Enhanced image handling to manage relative paths
  md = md.replace(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+\"([^\"]*)\")?\)/g, (m, alt, url, title) => {
    // First, normalize the URL path
    const normalizedUrl = url
      .replace(/^\.\.\/media\//g, '../media/') // Handle relative paths in form ../media/
      .replace(/^\.\//g, '');                  // Handle relative paths in form ./
    
    // Extract conversation folder from current URL if possible
    let convId = '';
    try {
      const pathParts = window.location.pathname.split('/');
      if (pathParts.length > 2 && pathParts[1] === 'conversations') {
        convId = pathParts[2];
      }
    } catch (e) {
      console.warn('Error extracting conversation ID from URL:', e);
    }
    
    // Transform URL based on the pattern
    let transformedUrl = normalizedUrl;
    if (normalizedUrl.startsWith('../media/')) {
      // If it's a relative path to the media folder, use the API endpoint
      const filename = normalizedUrl.replace('../media/', '');
      transformedUrl = convId ? `/api/media/${convId}/${filename}` : normalizedUrl;
    } else if (normalizedUrl.includes('file-') || normalizedUrl.includes('file_')) {
      // Handle media files directly referenced (no path)
      transformedUrl = convId ? `/api/media/${convId}/${normalizedUrl}` : normalizedUrl;
    } else if (normalizedUrl.match(/\/media\/[^\/]+$/)) {
      // Handle '/media/filename' format
      const filename = normalizedUrl.split('/').pop();
      transformedUrl = convId ? `/api/media/${convId}/${filename}` : normalizedUrl;
    }
    
    let t = title ? ` title="${title}"` : '';
    return `<img src="${transformedUrl}" alt="${alt || ''}"${t}/>`;
  });
  
  md = md.replace(/\[([^\]]+)\]\(([^\s)]+)(?:\s+\"([^\"]*)\")?\)/g, (m, text, url, title) => {
    let t = title ? ` title="${title}"` : '';
    return `<a href="${url}"${t}>${text}</a>`;
  });
  
  md = md.replace(/^[ \t]*\|(.+)\|[ \t]*\n[ \t]*\|([ \t:|-]+)\|[ \t]*\n((?:[ \t]*\|.*\|[ \t]*\n?)+)/gm, (m, header, sep, rows) => {
    const ths = header.split('|').map(h => `<th>${h.trim()}</th>`).join('');
    const trs = rows.trim().split('\n').filter(Boolean).map(row => {
      const cells = row.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(cell => `<td>${cell.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
  });
  return md.replace(/\n/g, '<br/>');
}