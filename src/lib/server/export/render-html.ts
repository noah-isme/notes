/**
 * Renders a markdown note as HTML in two dialects:
 *
 * 1. "word" — Word-compatible HTML (MHTML-style Office namespaces) saved as .doc.
 *    Opens natively in Microsoft Word (97 through current) and imports into Google Docs.
 * 2. "clean" — standalone HTML5 document with inline styles. Uploads to Google Drive
 *    and converts to a native Google Doc; also opens in Word.
 */
import type { Block, InlineRun, ListBlock } from './markdown-blocks';
import { parseMarkdownBlocks } from './markdown-blocks';

export interface HtmlExportOptions {
  title: string;
  tags?: Array<{ name: string }>;
  updatedAt?: Date;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSafeHref(href: string): boolean {
  const normalized = href.trim().toLowerCase();
  return (
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('mailto:') ||
    normalized.startsWith('#') ||
    normalized.startsWith('/')
  );
}

function runToHtml(run: InlineRun): string {
  switch (run.kind) {
    case 'strong':
      return `<strong>${escapeHtml(run.text)}</strong>`;
    case 'em':
      return `<em>${escapeHtml(run.text)}</em>`;
    case 'del':
      return `<del>${escapeHtml(run.text)}</del>`;
    case 'code':
      return `<code style="font-family: Consolas, 'Courier New', monospace; background-color: #f1f5f9; padding: 0 3px; border-radius: 3px; font-size: 0.9em;">${escapeHtml(run.text)}</code>`;
    case 'link':
      return isSafeHref(run.href)
        ? `<a href="${escapeHtml(run.href)}" target="_blank" rel="noopener noreferrer" style="color: #2563eb;">${escapeHtml(run.text)}</a>`
        : escapeHtml(run.text);
    case 'text':
    default:
      return escapeHtml(run.text);
  }
}

function runsToHtml(runs: InlineRun[]): string {
  return runs.map(runToHtml).join('');
}

function blockToHtml(block: Block): string {
  switch (block.type) {
    case 'heading': {
      const tag = `h${block.level}`;
      return `<${tag}>${runsToHtml(block.runs)}</${tag}>`;
    }
    case 'paragraph':
      return `<p>${runsToHtml(block.runs)}</p>`;
    case 'code': {
      const langAttr = block.language ? ` data-language="${escapeHtml(block.language)}"` : '';
      const code = escapeHtml(block.lines.join('\n'));
      return `<pre${langAttr} style="font-family: Consolas, 'Courier New', monospace; font-size: 13px; background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px 12px; white-space: pre-wrap; overflow-wrap: break-word; margin: 12px 0;"><code>${code}</code></pre>`;
    }
    case 'blockquote': {
      const paragraphs = block.paragraphs
        .map((runs) => `<p>${runsToHtml(runs)}</p>`)
        .join('');
      return `<blockquote style="margin: 12px 0; padding: 4px 12px; border-left: 4px solid #94a3b8; color: #475569; font-style: italic;">${paragraphs}</blockquote>`;
    }
    case 'table': {
      const rows = block.cells
        .map((row) => {
          const cells = row
            .map((cell) => {
              const tag = cell.header ? 'th' : 'td';
              const align = cell.align === 'left' ? 'text-align: left;' : `text-align: ${cell.align};`;
              const bg = cell.header ? 'background-color: #f1f5f9;' : '';
              return `<${tag} style="border: 1px solid #e2e8f0; padding: 6px 10px; ${align}${bg}">${runsToHtml(cell.runs)}</${tag}>`;
            })
            .join('');
          return `<tr>${cells}</tr>`;
        })
        .join('');
      return `<table style="border-collapse: collapse; margin: 12px 0; max-width: 100%;">${rows}</table>`;
    }
    case 'hr':
      return `<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />`;
    case 'list':
      return listToHtml(block);
  }
}

function listToHtml(list: ListBlock, depth = 0): string {
  const tag = list.ordered ? 'ol' : 'ul';
  const margin = 8 + depth * 18;
  const items = list.items
    .map((item) => {
      const children = item.children
        .map((child) => listToHtml(child, depth + 1))
        .join('');
      return `<li>${runsToHtml(item.runs)}${children}</li>`;
    })
    .join('');
  return `<${tag} style="margin: 8px 0 ${margin}px; padding-left: 24px;">${items}</${tag}>`;
}

function bodyHtml(blocks: Block[]): string {
  return blocks.map(blockToHtml).join('\n');
}

function metaLine(options: HtmlExportOptions): string {
  const parts: string[] = [];
  if (options.tags && options.tags.length > 0) {
    parts.push(options.tags.map((t) => `#${escapeHtml(t.name)}`).join(' '));
  }
  if (options.updatedAt) {
    parts.push(`Updated ${options.updatedAt.toISOString().slice(0, 10)}`);
  }
  if (parts.length === 0) return '';
  return `<p style="color: #64748b; font-size: 12px; margin: 0 0 24px 0;">${parts.join(' &middot; ')}</p>`;
}

const CONTENT_STYLES = `
  body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b; line-height: 1.5; max-width: 820px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 22pt; margin: 24px 0 10px; }
  h2 { font-size: 17pt; margin: 22px 0 9px; }
  h3 { font-size: 14pt; margin: 20px 0 8px; }
  h4, h5, h6 { font-size: 12pt; margin: 18px 0 7px; }
  p { margin: 0 0 12px; }
  h1:first-child { margin-top: 0; }
`;

/**
 * Word-compatible HTML (.doc). Uses the Office HTML namespaces + WordDocument
 * settings block so Word renders it natively when opened from disk.
 */
export function noteToWordHtml(markdown: string, options: HtmlExportOptions): string {
  const blocks = parseMarkdownBlocks(markdown);
  const title = escapeHtml(options.title);

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<meta name="ProgId" content="Word.Document" />
<meta name="Generator" content="Microsoft Word 15" />
<meta name="Originator" content="Microsoft Word 15" />
<title>${title}</title>
<!--[if gte mso 9]><xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml><![endif]-->
<style>
@page { size: 21cm 29.7cm; margin: 2.5cm; }
${CONTENT_STYLES}
</style>
</head>
<body lang="EN-US">
<h1 style="margin-top: 0;">${title}</h1>
${metaLine(options)}
${bodyHtml(blocks)}
</body>
</html>`;
}

/**
 * Standalone HTML5 document optimized for Google Docs import
 * (Drive upload → "Open with Google Docs") and Word.
 */
export function noteToCleanHtml(markdown: string, options: HtmlExportOptions): string {
  const blocks = parseMarkdownBlocks(markdown);
  const title = escapeHtml(options.title);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
${CONTENT_STYLES}
</style>
</head>
<body>
<h1 style="margin-top: 0;">${title}</h1>
${metaLine(options)}
${bodyHtml(blocks)}
</body>
</html>`;
}
