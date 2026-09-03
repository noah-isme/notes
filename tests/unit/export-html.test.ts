import { describe, it, expect } from 'vitest';
import { noteToWordHtml, noteToCleanHtml } from '$lib/server/export/render-html';

const FULL_NOTE = `# Heading **bold**

Paragraph with *italic*, [link](https://example.com), and \`code\`.

- item 1
- item 2

1. ordered 1
2. ordered 2

> quote text

\`\`\`js
const x = 1;
\`\`\`

| Col A | Col B |
|:------|------:|
| 1 | 2 |

---
`;

const OPTIONS = {
  title: 'My Note',
  tags: [{ name: 'work' }, { name: 'ideas' }],
  updatedAt: new Date('2026-09-01T00:00:00Z'),
};

describe('Unit: Word HTML (.doc) Export Renderer', () => {
  it('includes the Office namespaces and Word metadata required by Word', () => {
    const html = noteToWordHtml(FULL_NOTE, OPTIONS);
    expect(html).toContain('xmlns:o="urn:schemas-microsoft-com:office:office"');
    expect(html).toContain('xmlns:w="urn:schemas-microsoft-com:office:word"');
    expect(html).toContain('<w:WordDocument>');
    expect(html).toContain('name="ProgId" content="Word.Document"');
    expect(html).toContain('@page');
  });

  it('renders all structural elements', () => {
    const html = noteToWordHtml(FULL_NOTE, OPTIONS);
    expect(html).toContain('<h1>');
    expect(html).toContain('<strong>');
    expect(html).toContain('<em>');
    expect(html).toContain('<ul');
    expect(html).toContain('<ol');
    expect(html).toContain('<blockquote');
    expect(html).toContain('<pre');
    expect(html).toContain('<table');
    expect(html).toContain('<th');
    expect(html).toContain('<td');
    expect(html).toContain('<hr');
    expect(html).toContain('<a href="https://example.com"');
  });

  it('escapes HTML in note content and title', () => {
    const html = noteToWordHtml('<script>alert(1)</script> & "quotes"', {
      title: '<b>Title</b>',
    });
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&amp;');
    expect(html).toContain('&lt;b&gt;Title&lt;/b&gt;');
  });

  it('neutralizes dangerous link hrefs', () => {
    const html = noteToWordHtml('[click](javascript:alert(1))', { title: 'x' });
    expect(html).not.toContain('href="javascript:');
  });

  it('renders the note title as the document h1 and page title', () => {
    const html = noteToWordHtml('body', { title: 'The Note' });
    expect(html).toContain('<title>The Note</title>');
    expect(html).toContain('<h1 style="margin-top: 0;">The Note</h1>');
  });

  it('includes tags and updated date metadata when provided', () => {
    const html = noteToWordHtml('body', OPTIONS);
    expect(html).toContain('#work');
    expect(html).toContain('#ideas');
    expect(html).toContain('Updated 2026-09-01');
  });

  it('omits the metadata line when no tags or date are given', () => {
    const html = noteToWordHtml('body', { title: 'x' });
    expect(html).not.toContain('Updated');
  });
});

describe('Unit: Google Docs (clean HTML) Export Renderer', () => {
  it('produces a standalone HTML5 document without Office markup', () => {
    const html = noteToCleanHtml(FULL_NOTE, OPTIONS);
    expect(html.trim().startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<meta charset="utf-8"');
    expect(html).not.toContain('schemas-microsoft-com');
    expect(html).not.toContain('<w:WordDocument>');
  });

  it('renders structural elements Google Docs imports (headings, lists, tables, quotes, code)', () => {
    const html = noteToCleanHtml(FULL_NOTE, OPTIONS);
    expect(html).toContain('<h1>');
    expect(html).toContain('<ul');
    expect(html).toContain('<ol');
    expect(html).toContain('<blockquote');
    expect(html).toContain('<pre');
    expect(html).toContain('<table');
    expect(html).toContain('<hr');
  });

  it('escapes HTML in content', () => {
    const html = noteToCleanHtml('<img src=x onerror=alert(1)>', { title: 'x' });
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('<img');
  });

  it('handles empty notes with just the title', () => {
    const html = noteToCleanHtml('', { title: 'Empty' });
    expect(html).toContain('<h1 style="margin-top: 0;">Empty</h1>');
  });
});
