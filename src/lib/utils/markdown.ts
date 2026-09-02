/**
 * Isomorphic Zero-Dependency Markdown Parser & XSS Sanitizer
 * Optimized for serverless Node.js and browser environments.
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Decodes HTML entities (decimal, hex, and named entities).
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#x([0-9a-fA-F]+);?/g, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return '';
      }
    })
    .replace(/&#([0-9]+);?/g, (_, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10));
      } catch {
        return '';
      }
    })
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

/**
 * Checks if a URL contains dangerous pseudo-protocols (javascript:, vbscript:, data:)
 * after decoding HTML entities, percent encodings, and stripping whitespace/control characters.
 */
function isDangerousUrl(rawUrl: string): boolean {
  if (!rawUrl) return false;

  let decoded = decodeHtmlEntities(rawUrl);
  try {
    decoded = decodeURI(decoded);
  } catch {
    // ignore malformed URI errors
  }

  // Strip whitespace and ASCII / Unicode control chars
  const normalized = decoded
    .replace(/[\x00-\x20\s\u0000-\u001F\u007F-\u009F]+/g, '')
    .toLowerCase();

  return (
    normalized.startsWith('javascript:') ||
    normalized.startsWith('vbscript:') ||
    normalized.startsWith('data:')
  );
}

/**
 * Remove dangerous tags, inline event handlers, and malicious pseudo-protocols from HTML.
 */
function sanitizeHtml(html: string): string {
  let clean = html;

  // 1. Strip dangerous tags and their content:
  // script, iframe, object, embed, svg, form, meta, base, style, applet, frame, frameset, link
  const dangerousTags = [
    'script',
    'iframe',
    'object',
    'embed',
    'svg',
    'form',
    'meta',
    'base',
    'style',
    'applet',
    'frame',
    'frameset',
    'link',
  ];

  for (const tag of dangerousTags) {
    const pairedRegex = new RegExp(`<\\s*${tag}\\b[\\s\\S]*?(?:<\\/\\s*${tag}\\s*>|$)`, 'gi');
    clean = clean.replace(pairedRegex, '');
    const unclosedRegex = new RegExp(`<\\s*${tag}\\b[^>]*\\/?>`, 'gi');
    clean = clean.replace(unclosedRegex, '');
  }

  // 2. Strip inline event handlers (on\w+ preceded by whitespace or slash, e.g. onerror=, onclick=, /onload=)
  clean = clean.replace(/([<\s/])on[a-zA-Z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>/]+)/gi, '$1');

  // 3. Strip dangerous protocol attributes (href, src, action, data, xlink:href, formaction, etc.)
  clean = clean.replace(
    /([<\s/])(?:href|src|action|data|xlink:href|formaction)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>/]+))/gi,
    (match, prefix, valDouble, valSingle, valUnquoted) => {
      const val = valDouble ?? valSingle ?? valUnquoted ?? '';
      if (isDangerousUrl(val)) {
        return prefix === '<' ? '<' : ' ';
      }
      return match;
    }
  );

  return clean;
}

/**
 * Parse inline Markdown elements (bold, italic, links, strikethrough).
 */
function parseInline(text: string): string {
  let result = text;

  // Markdown links: [text](url)
  result = result.replace(/\[([^\]]+)\]\(\s*((?:[^\s()]+|\([^\s()]*\))+)\s*\)/g, (_, label, url) => {
    const trimmedUrl = url.trim();

    if (isDangerousUrl(trimmedUrl)) {
      return escapeHtml(label);
    }

    try {
      const safeUrl = encodeURI(decodeURI(trimmedUrl)).replace(/"/g, '&quot;');
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    } catch {
      const safeUrl = escapeHtml(trimmedUrl);
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    }
  });

  // Bold (**bold** or __bold__)
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // Italic (*italic* or _italic_)
  result = result.replace(/(^|[^*])\*([^*]+)\*([^*]|$)/g, '$1<em>$2</em>$3');
  result = result.replace(/(^|[^_])_([^_]+)_([^_]|$)/g, '$1<em>$2</em>$3');

  // Strikethrough (~~text~~)
  result = result.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  return result;
}

/**
 * Parses markdown string to sanitized HTML.
 */
export function renderMarkdown(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  const normalized = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (normalized.trim() === '') {
    return '';
  }

  const codeBlocks: string[] = [];
  const inlineCodes: string[] = [];

  // Phase 1: Shield Fenced Code Blocks (using private Unicode characters \uE000CBi\uE000)
  let workingText = normalized.replace(
    /```([^\n`]*)\n([\s\S]*?)```/g,
    (_, lang, code) => {
      const idx = codeBlocks.length;
      const cleanLang = (lang || '').trim();
      const isMermaid = cleanLang.toLowerCase() === 'mermaid';

      if (isMermaid) {
        codeBlocks.push(
          `<div class="mermaid-block" data-mermaid-code="${escapeHtml(code)}"><pre><code class="language-mermaid">${escapeHtml(code)}</code></pre></div>`
        );
      } else {
        const langAttr = cleanLang ? ` class="language-${escapeHtml(cleanLang)}"` : '';
        codeBlocks.push(`<pre><code${langAttr}>${escapeHtml(code)}</code></pre>`);
      }
      return `\uE000CB${idx}\uE000`;
    }
  );

  // Phase 2: Shield Inline Code Spans (using private Unicode characters \uE000ICi\uE000)
  workingText = workingText.replace(/`([^`\n]+)`/g, (_, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
    return `\uE000IC${idx}\uE000`;
  });

  // Phase 3: Initial HTML Sanitization on raw text
  workingText = sanitizeHtml(workingText);

  // Phase 4: Block-level parsing
  const lines = workingText.split('\n');
  const output: string[] = [];
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let currentBlockquote: string[] | null = null;

  function flushList() {
    if (currentList) {
      const tag = currentList.type;
      const itemsHtml = currentList.items
        .map((item) => `<li>${parseInline(item)}</li>`)
        .join('');
      output.push(`<${tag}>${itemsHtml}</${tag}>`);
      currentList = null;
    }
  }

  function flushBlockquote() {
    if (currentBlockquote) {
      const content = currentBlockquote
        .map((line) => parseInline(line))
        .join('<br />');
      output.push(`<blockquote><p>${content}</p></blockquote>`);
      currentBlockquote = null;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for Code Block Placeholder
    if (/^\uE000CB\d+\uE000$/.test(trimmed)) {
      flushList();
      flushBlockquote();
      output.push(trimmed);
      continue;
    }

    // Empty Line
    if (trimmed === '') {
      flushList();
      flushBlockquote();
      continue;
    }

    // Blockquote (> text)
    if (trimmed.startsWith('>')) {
      flushList();
      const quoteText = trimmed.replace(/^>\s?/, '');
      if (!currentBlockquote) {
        currentBlockquote = [];
      }
      currentBlockquote.push(quoteText);
      continue;
    } else {
      flushBlockquote();
    }

    // Headings (# H1 to ###### H6)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const text = parseInline(headingMatch[2]);
      output.push(`<h${level}>${text}</h${level}>`);
      continue;
    }

    // Horizontal Rule (---, ***, ___)
    if (/^(?:---|\*\*\*|___)\s*$/.test(trimmed)) {
      flushList();
      output.push('<hr />');
      continue;
    }

    // Unordered List (- item or * item)
    const ulMatch = line.match(/^\s*[-*+]\s+(.+)$/);
    if (ulMatch) {
      if (currentList && currentList.type !== 'ul') {
        flushList();
      }
      if (!currentList) {
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(ulMatch[1]);
      continue;
    }

    // Ordered List (1. item)
    const olMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (olMatch) {
      if (currentList && currentList.type !== 'ol') {
        flushList();
      }
      if (!currentList) {
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(olMatch[1]);
      continue;
    }

    // Regular line / paragraph
    flushList();
    output.push(`<p>${parseInline(trimmed)}</p>`);
  }

  flushList();
  flushBlockquote();

  let rendered = output.join('\n');

  // Sanitize rendered HTML before restoring shielded code blocks
  rendered = sanitizeHtml(rendered);

  // Phase 5: Restore shielded tokens
  rendered = rendered.replace(/\uE000CB(\d+)\uE000/g, (_, idx) => codeBlocks[Number(idx)] ?? '');
  rendered = rendered.replace(/\uE000IC(\d+)\uE000/g, (_, idx) => inlineCodes[Number(idx)] ?? '');

  return rendered;
}

/**
 * Export aliases for maximum interoperability.
 */
export const parseMarkdown = renderMarkdown;
export default renderMarkdown;

/**
 * Strips markdown syntax and returns plain text summary.
 */
export function stripMarkdown(markdown: string, maxLength = 120): string {
  if (!markdown || typeof markdown !== 'string') return '';
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#+\s+/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~>-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (plain.length <= maxLength) return plain;
  return plain.substring(0, maxLength).trim() + '...';
}
