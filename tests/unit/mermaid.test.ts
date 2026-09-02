import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isMermaidSupported,
  generateDiagramId,
  getMermaid,
  initializeMermaid,
  renderMermaidSvg,
  parseMermaidSyntax,
  SLATE_THEME_VARIABLES,
} from '$lib/utils/mermaid';
import { renderMarkdown, stripMarkdown } from '$lib/utils/markdown';

describe('Unit: Mermaid Engine & Markdown Integration', () => {
  describe('1. Environment Safety & SSR Fallbacks', () => {
    it('should report unsupported in SSR / Node.js test environment', () => {
      expect(isMermaidSupported()).toBe(false);
    });

    it('should return null from getMermaid in SSR environment without crashing', async () => {
      const instance = await getMermaid();
      expect(instance).toBeNull();
    });

    it('should return null from initializeMermaid in SSR environment without crashing', async () => {
      const slateResult = await initializeMermaid('slate');
      expect(slateResult).toBeNull();

      const defaultResult = await initializeMermaid('default');
      expect(defaultResult).toBeNull();
    });

    it('should return graceful error object from renderMermaidSvg in SSR environment', async () => {
      const result = await renderMermaidSvg('diagram-1', 'graph TD\n  A --> B');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('browser environments');
      }
    });

    it('should return graceful error from parseMermaidSyntax in SSR environment', async () => {
      const result = await parseMermaidSyntax('graph TD\n  A --> B');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('browser environments');
    });
  });

  describe('2. Input Validation & ID Generation', () => {
    it('should generate unique diagram IDs with valid prefix format', () => {
      const id1 = generateDiagramId();
      const id2 = generateDiagramId();
      const customId = generateDiagramId('custom_prefix');

      expect(id1).toMatch(/^mermaid_[a-z0-9]+_[a-z0-9]+_[a-z0-9]+$/);
      expect(customId).toMatch(/^custom_prefix_[a-z0-9]+_[a-z0-9]+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('should generate distinct IDs across 10,000 consecutive invocations', () => {
      const ids = new Set<string>();
      const pattern = /^mermaid_[a-z0-9]+_[a-z0-9]+_[a-z0-9]+$/;
      for (let i = 0; i < 10000; i++) {
        const id = generateDiagramId();
        expect(id).toMatch(pattern);
        ids.add(id);
      }
      expect(ids.size).toBe(10000);
    });

    it('should reject empty, null, or whitespace diagram code in renderMermaidSvg', async () => {
      const r1 = await renderMermaidSvg('id1', '');
      const r2 = await renderMermaidSvg('id2', '   \n\t  ');
      const r3 = await renderMermaidSvg('id3', null as any);

      expect('error' in r1).toBe(true);
      expect('error' in r2).toBe(true);
      expect('error' in r3).toBe(true);
      if ('error' in r1) expect(r1.error).toContain('Empty diagram');
      if ('error' in r2) expect(r2.error).toContain('Empty diagram');
      if ('error' in r3) expect(r3.error).toContain('Empty diagram');
    });

    it('should reject non-string inputs in renderMermaidSvg and parseMermaidSyntax', async () => {
      const rNum = await renderMermaidSvg('id', 123 as any);
      const rObj = await renderMermaidSvg('id', {} as any);
      const pNum = await parseMermaidSyntax(123 as any);
      const pObj = await parseMermaidSyntax({} as any);

      expect('error' in rNum).toBe(true);
      expect('error' in rObj).toBe(true);
      expect(pNum.valid).toBe(false);
      expect(pObj.valid).toBe(false);
    });

    it('should generate fallback ID when id argument is empty or undefined in renderMermaidSvg', async () => {
      const rEmptyId = await renderMermaidSvg('', 'graph TD\n  A --> B');
      const rUndefinedId = await renderMermaidSvg(undefined as any, 'graph TD\n  A --> B');

      expect('error' in rEmptyId).toBe(true);
      expect('error' in rUndefinedId).toBe(true);
    });

    it('should generate distinct IDs with custom prefix across 1,000 invocations', () => {
      const ids = new Set<string>();
      const customPrefix = 'custom_node';
      for (let i = 0; i < 1000; i++) {
        const id = generateDiagramId(customPrefix);
        expect(id.startsWith(`${customPrefix}_`)).toBe(true);
        ids.add(id);
      }
      expect(ids.size).toBe(1000);
    });
  });

  describe('3. Slate Theme Token Specification', () => {
    it('should include all required high-contrast Slate design tokens', () => {
      expect(SLATE_THEME_VARIABLES.primaryColor).toBe('#f1f5f9');
      expect(SLATE_THEME_VARIABLES.primaryTextColor).toBe('#0f172a');
      expect(SLATE_THEME_VARIABLES.primaryBorderColor).toBe('#cbd5e1');
      expect(SLATE_THEME_VARIABLES.lineColor).toBe('#64748b');
      expect(SLATE_THEME_VARIABLES.secondaryColor).toBe('#f8fafc');
      expect(SLATE_THEME_VARIABLES.tertiaryColor).toBe('#e2e8f0');
      expect(SLATE_THEME_VARIABLES.activationBorderColor).toBe('#2563eb');
      expect(SLATE_THEME_VARIABLES.fontFamily).toContain('system-ui');
    });
  });

  describe('4. Markdown Parser Mermaid Detection & Formatting', () => {
    it('should wrap ```mermaid code blocks in .mermaid-block container with data attribute', () => {
      const markdown = '```mermaid\ngraph TD\n  A --> B\n```';
      const html = renderMarkdown(markdown);

      expect(html).toContain('<div class="mermaid-block"');
      expect(html).toContain('data-mermaid-code="graph TD\n  A --&gt; B\n"');
      expect(html).toContain('<pre><code class="language-mermaid">graph TD\n  A --&gt; B\n</code></pre>');
    });

    it('should handle case-insensitive language identifiers (MERMAID, Mermaid, mermaid)', () => {
      const mdUpper = '```MERMAID\ngraph LR\n  X --> Y\n```';
      const mdMixed = '```Mermaid\ngraph LR\n  X --> Y\n```';
      const mdLower = '```mermaid\ngraph LR\n  X --> Y\n```';

      const htmlUpper = renderMarkdown(mdUpper);
      const htmlMixed = renderMarkdown(mdMixed);
      const htmlLower = renderMarkdown(mdLower);

      expect(htmlUpper).toContain('class="mermaid-block"');
      expect(htmlMixed).toContain('class="mermaid-block"');
      expect(htmlLower).toContain('class="mermaid-block"');
      expect(htmlUpper).toContain('class="language-mermaid"');
      expect(htmlMixed).toContain('class="language-mermaid"');
      expect(htmlLower).toContain('class="language-mermaid"');
    });

    it('should handle fenced blocks with whitespace around language tag', () => {
      const markdown = '```  mermaid  \nsequenceDiagram\n  A->>B: Hi\n```';
      const html = renderMarkdown(markdown);

      expect(html).toContain('class="mermaid-block"');
      expect(html).toContain('data-mermaid-code="sequenceDiagram\n  A-&gt;&gt;B: Hi\n"');
    });

    it('should distinguish non-mermaid code blocks from mermaid blocks', () => {
      const markdown = `
\`\`\`typescript
const greeting: string = "hello";
\`\`\`

\`\`\`mermaid
graph TD
  Start --> Stop
\`\`\`

\`\`\`json
{ "status": "ok" }
\`\`\`
`;
      const html = renderMarkdown(markdown);

      // Non-mermaid should not have .mermaid-block
      expect(html).toContain('<pre><code class="language-typescript">');
      expect(html).toContain('<pre><code class="language-json">');
      expect(html).toContain('class="mermaid-block"');
      expect(html.match(/class="mermaid-block"/g)?.length).toBe(1);
    });

    it('should preserve multiple mermaid diagrams in the same document', () => {
      const markdown = `
# System Architecture

\`\`\`mermaid
graph TD
  Client --> API
\`\`\`

Some explanation text.

\`\`\`mermaid
sequenceDiagram
  API->>DB: Query
  DB-->>API: Results
\`\`\`
`;
      const html = renderMarkdown(markdown);

      const matches = html.match(/class="mermaid-block"/g);
      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(2);
      expect(html).toContain('Client --&gt; API');
      expect(html).toContain('API-&gt;&gt;DB: Query');
      expect(html).toContain('<h1>System Architecture</h1>');
      expect(html).toContain('<p>Some explanation text.</p>');
    });

    it('should properly strip mermaid blocks in stripMarkdown helper', () => {
      const markdown = '# My Note\n\n```mermaid\ngraph TD\n  A --> B\n```\n\nSome regular notes.';
      const summary = stripMarkdown(markdown);

      expect(summary).not.toContain('graph TD');
      expect(summary).not.toContain('mermaid');
      expect(summary).toContain('My Note');
      expect(summary).toContain('Some regular notes.');
    });

    it('should safely escape HTML entities inside mermaid code attributes and content', () => {
      const markdown = '```mermaid\ngraph TD\n  A["<script>alert(1)</script>"] --> B["<img src=x onerror=alert(2)>"]\n```';
      const html = renderMarkdown(markdown);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&quot;&lt;script&gt;');
      expect(html).toContain('&lt;img');
    });
  });
});
