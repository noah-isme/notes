import { describe, it, expect } from 'vitest';
import * as markdownModule from '$lib/utils/markdown';
import { FIXTURES } from '../helpers/fixtures';

// Handle both renderMarkdown and parseMarkdown export conventions
const renderMarkdown: (md: string) => string | Promise<string> =
  (markdownModule as any).renderMarkdown || (markdownModule as any).parseMarkdown || (markdownModule as any).default;

describe('Unit: Markdown Parser & XSS Sanitizer', () => {
  const parse = async (input: string): Promise<string> => {
    const res = renderMarkdown(input);
    return res instanceof Promise ? await res : res;
  };

  describe('Standard Markdown Rendering', () => {
    it('should render markdown headings correctly', async () => {
      const input = '# Heading 1\n## Heading 2\n### Heading 3';
      const html = await parse(input);

      expect(html).toContain('<h1>Heading 1</h1>');
      expect(html).toContain('<h2>Heading 2</h2>');
      expect(html).toContain('<h3>Heading 3</h3>');
    });

    it('should render bold and italic text styles', async () => {
      const input = '**bold text** and *italic text* and __also bold__';
      const html = await parse(input);

      expect(html).toMatch(/<strong>bold text<\/strong>|<b>bold text<\/b>/);
      expect(html).toMatch(/<em>italic text<\/em>|<i>italic text<\/i>/);
      expect(html).toMatch(/<strong>also bold<\/strong>|<b>also bold<\/b>/);
    });

    it('should render unordered and ordered lists', async () => {
      const input = '- Item 1\n- Item 2\n\n1. First\n2. Second';
      const html = await parse(input);

      expect(html).toContain('<ul>');
      expect(html).toContain('<li>Item 1</li>');
      expect(html).toContain('<li>Item 2</li>');
      expect(html).toContain('<ol>');
      expect(html).toContain('<li>First</li>');
      expect(html).toContain('<li>Second</li>');
    });

    it('should render inline code and fenced code blocks', async () => {
      const input = 'Use `const x = 10;` in code.\n\n```typescript\nfunction hello() {\n  return "world";\n}\n```';
      const html = await parse(input);

      expect(html).toContain('<code>const x = 10;</code>');
      expect(html).toContain('<pre>');
      expect(html).toContain('function hello()');
    });

    it('should render blockquotes', async () => {
      const input = '> This is a blockquote message.';
      const html = await parse(input);

      expect(html).toContain('<blockquote>');
      expect(html).toContain('This is a blockquote message.');
    });

    it('should render safe external links', async () => {
      const input = '[Official Docs](https://svelte.dev)';
      const html = await parse(input);

      expect(html).toContain('<a');
      expect(html).toContain('href="https://svelte.dev"');
      expect(html).toContain('Official Docs');
    });

    it('should handle empty string and plain text gracefully', async () => {
      expect(await parse('')).toBe('');
      const plain = await parse('Plain text with no special markdown.');
      expect(plain).toContain('Plain text with no special markdown.');
    });
  });

  describe('Adversarial XSS Sanitization', () => {
    it('should sanitize raw <script> tags', async () => {
      const input = 'Note content with <script>alert("XSS")</script> malicious payload.';
      const html = await parse(input);

      expect(html).not.toContain('<script>');
      expect(html).not.toContain('alert("XSS")</script>');
    });

    it('should strip inline onerror handlers from <img> tags', async () => {
      const input = '<img src="invalid.jpg" onerror="alert(document.cookie)" />';
      const html = await parse(input);

      expect(html).not.toContain('onerror=');
      expect(html).not.toContain('document.cookie');
    });

    it('should strip javascript: pseudo-protocols from markdown links', async () => {
      const input = '[Click to exploit](javascript:alert("XSS"))';
      const html = await parse(input);

      expect(html).not.toContain('href="javascript:');
    });

    it('should sanitize iframe, object, and embed elements', async () => {
      const input = '<iframe src="https://evil.com"></iframe><object data="malicious.swf"></object>';
      const html = await parse(input);

      expect(html).not.toContain('<iframe');
      expect(html).not.toContain('<object');
    });

    it('should sanitize SVG onload event handlers', async () => {
      const input = '<svg onload="alert(\'svg-xss\')"><circle cx="50" cy="50" r="40" /></svg>';
      const html = await parse(input);

      expect(html).not.toContain('onload=');
      expect(html).not.toContain('alert(');
    });

    it('should sanitize all adversarial payloads from fixtures suite', async () => {
      for (const xss of FIXTURES.xssPayloads) {
        const rendered = await parse(`Test payload: ${xss.payload}`);
        expect(rendered.toLowerCase()).not.toContain('<script>');
        expect(rendered.toLowerCase()).not.toContain('javascript:');
        expect(rendered.toLowerCase()).not.toContain('onerror=');
        expect(rendered.toLowerCase()).not.toContain('onload=');
        expect(rendered.toLowerCase()).not.toContain('onmouseover=');
      }
    });
  });
});
