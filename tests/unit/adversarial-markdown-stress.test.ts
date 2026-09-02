import { describe, it, expect } from 'vitest';
import { renderMarkdown, stripMarkdown } from '$lib/utils/markdown';
import { FIXTURES } from '../helpers/fixtures';

describe('Challenger M4: Adversarial Markdown & XSS Stress Verification Suite', () => {
  describe('1. Baseline & Placeholder Integrity', () => {
    it('should correctly render inline code without placeholder mangling', () => {
      const input = 'Use `const x = 10;` in code.';
      const output = renderMarkdown(input);
      expect(output).toContain('<code>const x = 10;</code>');
      expect(output).not.toContain('__INLINE');
      expect(output).not.toContain('<em>CODE</em>');
    });

    it('should render inline code containing underscores', () => {
      const input = 'Check variable `user_session_token_id` now.';
      const output = renderMarkdown(input);
      expect(output).toContain('<code>user_session_token_id</code>');
      expect(output).not.toContain('<em>session</em>');
      expect(output).not.toContain('__INLINE');
    });

    it('should render multiple inline codes on a single line', () => {
      const input = 'Compare `item_a` with `item_b` and `item_c`.';
      const output = renderMarkdown(input);
      expect(output).toContain('<code>item_a</code>');
      expect(output).toContain('<code>item_b</code>');
      expect(output).toContain('<code>item_c</code>');
      expect(output).not.toContain('__INLINE');
    });

    it('should preserve code block content containing HTML-like tokens without over-sanitization', () => {
      const input = '```html\n<button onclick="handleClick()">Click</button>\n<img src="pic.jpg" onerror="logError()" />\n```';
      const output = renderMarkdown(input);
      expect(output).toContain('<pre><code class="language-html">');
      expect(output).toContain('&lt;button');
      // Code inside fenced blocks must not have its text stripped
      expect(output).toContain('onclick');
      expect(output).toContain('onerror');
    });
  });

  describe('2. Adversarial XSS Attacks & Bypasses', () => {
    it('should neutralize raw and unclosed script tags', () => {
      const vectors = [
        '<script>alert("XSS")</script>',
        '<script src="https://evil.com/payload.js"></script>',
        '<SCRIPT>alert(1)</SCRIPT>',
        '<script/x>alert(1)</script>',
        '<script type="text/javascript">alert(1)</script>'
      ];

      for (const vector of vectors) {
        const output = renderMarkdown(`Injected: ${vector}`);
        expect(output.toLowerCase()).not.toContain('<script');
        expect(output.toLowerCase()).not.toContain('alert(');
      }
    });

    it('should neutralize inline event handlers with standard whitespace', () => {
      const vectors = [
        '<img src="x" onerror="alert(1)" />',
        '<img src="x" onerror=alert(1)>',
        '<svg onload="alert(1)"></svg>',
        '<body onload="alert(1)">',
        '<div onmouseover="alert(1)">hover</div>',
        '<details open ontoggle="alert(1)">content</details>'
      ];

      for (const vector of vectors) {
        const output = renderMarkdown(`Vector: ${vector}`);
        expect(output.toLowerCase()).not.toMatch(/\s+on[a-z]+\s*=/);
        expect(output.toLowerCase()).not.toContain('alert(1)');
      }
    });

    it('should neutralize slash-delimited attribute event handlers (non-whitespace delimiter bypass)', () => {
      const vectors = [
        '<img/src="x"/onerror="alert(1)">',
        '<img/src=x/onerror=alert(1)>',
        '<svg/onload=alert(1)>',
        '<input/autofocus/onfocus=alert(1)>',
        '<details/open/ontoggle=alert(1)>details</details>',
        '<video/src=x/onerror=alert(1)>'
      ];

      for (const vector of vectors) {
        const output = renderMarkdown(`Vector: ${vector}`);
        expect(output.toLowerCase()).not.toMatch(/[\s/]on[a-z]+\s*=/);
        expect(output.toLowerCase()).not.toContain('alert(1)');
      }
    });

    it('should neutralize javascript: and data: pseudo-protocols in links and attributes', () => {
      const vectors = [
        '[Exploit](javascript:alert("XSS"))',
        '[Exploit](JAVASCRIPT:alert("XSS"))',
        '[Exploit](  javascript:alert("XSS")  )',
        '[Exploit](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
        '<a href="javascript:alert(1)">link</a>',
        '<a href="JAVASCRIPT:alert(1)">link</a>',
        '<a/href="javascript:alert(1)">link</a>',
        '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">link</a>',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<object data="javascript:alert(1)"></object>',
        '<embed src="javascript:alert(1)"></embed>'
      ];

      for (const vector of vectors) {
        const output = renderMarkdown(`Vector: ${vector}`);
        expect(output.toLowerCase()).not.toContain('href="javascript:');
        expect(output.toLowerCase()).not.toContain('href="data:text/html');
        expect(output.toLowerCase()).not.toContain('<iframe');
        expect(output.toLowerCase()).not.toContain('<object');
        expect(output.toLowerCase()).not.toContain('<embed');
      }
    });

    it('should neutralize entity-encoded javascript: URLs in links', () => {
      const vectors = [
        '<a href="jav&#x61;script:alert(1)">link</a>',
        '[Link](jav&#x61;script:alert(1))'
      ];

      for (const vector of vectors) {
        const output = renderMarkdown(`Vector: ${vector}`);
        expect(output.toLowerCase()).not.toMatch(/href=["']?jav(?:&#x61;|&#97;|%61)?script:/i);
        expect(output.toLowerCase()).not.toContain('alert(1)');
      }
    });

    it('should neutralize iframe srcdoc injections', () => {
      const input = '<iframe srcdoc="<script>alert(\'srcdoc-xss\')</script>"></iframe>';
      const output = renderMarkdown(input);
      expect(output.toLowerCase()).not.toContain('<iframe');
      expect(output.toLowerCase()).not.toContain('srcdoc');
      expect(output.toLowerCase()).not.toContain('alert(');
    });

    it('should pass all fixture XSS payloads without vulnerability', () => {
      for (const fixture of FIXTURES.xssPayloads) {
        const output = renderMarkdown(fixture.payload);
        expect(output.toLowerCase()).not.toContain('<script');
        expect(output.toLowerCase()).not.toContain('javascript:');
        expect(output.toLowerCase()).not.toMatch(/[\s/]on[a-z]+\s*=/);
      }
    });
  });

  describe('3. Complex Markdown Syntax & Edge Cases', () => {
    it('should render multi-level headings and paragraphs', () => {
      const input = '# Heading 1\n\nParagraph 1\n\n## Heading 2\n\nParagraph 2\n\n### Heading 3';
      const output = renderMarkdown(input);
      expect(output).toContain('<h1>Heading 1</h1>');
      expect(output).toContain('<p>Paragraph 1</p>');
      expect(output).toContain('<h2>Heading 2</h2>');
      expect(output).toContain('<p>Paragraph 2</p>');
      expect(output).toContain('<h3>Heading 3</h3>');
    });

    it('should render blockquotes containing formatted inline elements', () => {
      const input = '> This is **important** with *italic* and a [link](https://example.com)';
      const output = renderMarkdown(input);
      expect(output).toContain('<blockquote><p>');
      expect(output).toContain('<strong>important</strong>');
      expect(output).toContain('<em>italic</em>');
      expect(output).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer">link</a>');
    });

    it('should render lists properly', () => {
      const input = '- First bullet\n- Second bullet\n- Third bullet\n\n1. Number one\n2. Number two';
      const output = renderMarkdown(input);
      expect(output).toContain('<ul>');
      expect(output).toContain('<li>First bullet</li>');
      expect(output).toContain('<li>Second bullet</li>');
      expect(output).toContain('<li>Third bullet</li>');
      expect(output).toContain('<ol>');
      expect(output).toContain('<li>Number one</li>');
      expect(output).toContain('<li>Number two</li>');
    });

    it('should handle edge cases: empty input, null/undefined, whitespace only', () => {
      expect(renderMarkdown('')).toBe('');
      expect(renderMarkdown('   ')).toBe('');
      expect(renderMarkdown('\n\n\n')).toBe('');
      expect((renderMarkdown as any)(null)).toBe('');
      expect((renderMarkdown as any)(undefined)).toBe('');
    });

    it('should properly strip markdown in stripMarkdown helper', () => {
      const complexMd = '# Title\n\nThis is **bold** and `code` with a [link](https://example.com).\n\n```js\nconsole.log(1);\n```';
      const stripped = stripMarkdown(complexMd, 50);
      expect(stripped).not.toContain('#');
      expect(stripped).not.toContain('**');
      expect(stripped).not.toContain('`');
      expect(stripped).toContain('Title');
      expect(stripped).toContain('This is bold and code with a link.');
      expect(stripped.length).toBeLessThanOrEqual(53); // max 50 + '...'
    });
  });
});
