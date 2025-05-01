// A robust GitHub Flavored Markdown (GFM) parser with math placeholder support.
// Math placeholders (e.g., @@MATH0@@) should be inserted before calling this parser.
// This parser supports headings, bold, italic, strikethrough, code, blockquotes, lists, tables, images, links, and inline HTML.

// Note: This is a hand-rolled parser for demonstration, not a full CommonMark+GFM spec implementation.
// For production, consider using a well-maintained library.

export function parseMarkdownGFM(md) {
  // Escape HTML special chars, except for placeholders and images/links
  md = md.replace(/&(?![a-zA-Z]+;|#\d+;)/g, '&amp;')
         .replace(/</g, '&lt;')
         .replace(/>/g, '&gt;');

  // Headings (ATX style)
  md = md.replace(/^###### (.*)$/gm, '<h6>$1</h6>');
  md = md.replace(/^##### (.*)$/gm, '<h5>$1</h5>');
  md = md.replace(/^#### (.*)$/gm, '<h4>$1</h4>');
  md = md.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  md = md.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  md = md.replace(/^# (.*)$/gm, '<h1>$1</h1>');

  // Horizontal rule
  md = md.replace(/^---$/gm, '<hr/>');

  // Blockquotes
  md = md.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>');

  // Fenced code blocks
  md = md.replace(/```([\s\S]+?)```/g, (m, code) => `<pre><code>${code.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code></pre>`);

  // Inline code
  md = md.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold, italic, strikethrough
  md = md.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  md = md.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  md = md.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  md = md.replace(/_([^_]+)_/g, '<em>$1</em>');
  md = md.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  // Images: ![alt](url "title")
  md = md.replace(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g, (m, alt, url, title) => {
    let t = title ? ` title=\"${title}\"` : '';
    return `<img src="${url}" alt="${alt || ''}"${t}/>`;
  });

  // Links: [text](url "title")
  md = md.replace(/\[([^\]]+)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g, (m, text, url, title) => {
    let t = title ? ` title=\"${title}\"` : '';
    return `<a href="${url}"${t}>${text}</a>`;
  });

  // Tables (GFM, enhanced pipe/whitespace support)
  md = md.replace(/^[ \t]*\|(.+)\|[ \t]*\n[ \t]*\|([ \t:|-]+)\|[ \t]*\n((?:[ \t]*\|.*\|[ \t]*\n?)+)/gm, (m, header, sep, rows) => {
    // header, sep, rows: all without leading/trailing pipes
    const ths = header.split('|').map(h => `<th>${h.trim()}</th>`).join('');
    const trs = rows.trim().split('\n').filter(Boolean).map(row => {
      const cells = row.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(cell => `<td>${cell.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
  });

  // Unordered lists
  md = md.replace(/^(\s*)[-*+] (.*)$/gm, (m, space, item) => `${space}<li data-list-type="ul">${item}</li>`);

  // Ordered lists
  md = md.replace(/^(\s*)\d+\. (.*)$/gm, (m, space, item) => `${space}<li data-list-type="ol">${item}</li>`);

  // Group <li> elements into lists, allowing math placeholders or block math between them
  // Match <li>...</li> possibly separated by math placeholders or <span>...</span> blocks for math, or whitespace
  md = md.replace(/((<li data-list-type="(ol|ul)">[\s\S]*?<\/li>|(?:@@MATH\d+@@|<span>\\\[[\s\S]*?\\\]<\/span>))[ \t\r\f\v]*\n*)+/g, match => {
    // Find all list items and their types
    const liMatches = [...match.matchAll(/<li data-list-type="(ol|ul)">[\s\S]*?<\/li>/g)];
    if (liMatches.length === 0) return match; // no <li>, skip
    // Use the type of the first <li> in the group
    const listType = liMatches[0][1];
    return `<${listType}>${match.replace(/\s*\n\s*/g, '')}</${listType}>`;
  });

  // Paragraphs (lines not already wrapped)
  md = md.replace(/^(?!<[hluo][^>]*>|<table|<blockquote|<pre|<img|<hr|<ul|<ol|<li|<p|<\/)(.+)$/gm, '<p>$1</p>');

  // Remove multiple <ul>/<ol> wrappers
  md = md.replace(/(<ul>\s*)+(<li>)/g, '<ul>$2');
  md = md.replace(/(<ol>\s*)+(<li>)/g, '<ol>$2');

  // Remove empty <ul></ul> and <ol></ol>
  md = md.replace(/<ul>\s*<\/ul>/g, '');
  md = md.replace(/<ol>\s*<\/ol>/g, '');

  return md;
}
