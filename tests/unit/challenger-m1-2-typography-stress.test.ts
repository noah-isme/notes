import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import NoteEditor from '../../src/lib/components/NoteEditor.svelte';
import MarkdownViewer from '../../src/lib/components/MarkdownViewer.svelte';
import { renderMarkdown } from '../../src/lib/utils/markdown';
import fs from 'node:fs';
import path from 'node:path';

describe('Challenger M1.2: Typography, Prose Wrapping & Code Block Scrolling Stress Tests', () => {
  // =========================================================================
  // 1. Monospace Font Stack & CSS Rules Verification
  // =========================================================================
  describe('1. Monospace Font Stack & Typography Rules in Component Styles', () => {
    const noteEditorPath = path.resolve(process.cwd(), 'src/lib/components/NoteEditor.svelte');
    const markdownViewerPath = path.resolve(process.cwd(), 'src/lib/components/MarkdownViewer.svelte');
    const noteEditorSource = fs.readFileSync(noteEditorPath, 'utf-8');
    const markdownViewerSource = fs.readFileSync(markdownViewerPath, 'utf-8');

    const expectedFontStack =
      'ui-monospace, "JetBrains Mono", "IBM Plex Mono", Menlo, Consolas, monospace';

    it('CSS-1.1: NoteEditor textarea defines the exact high-legibility monospace stack', () => {
      expect(noteEditorSource).toContain(
        `font-family: ${expectedFontStack};`
      );
    });

    it('CSS-1.2: NoteEditor textarea specifies font-size 0.875rem (~14px) and line-height 1.6', () => {
      expect(noteEditorSource).toContain('font-size: 0.875rem;');
      expect(noteEditorSource).toContain('line-height: 1.6;');
    });

    it('CSS-1.3: NoteEditor textarea specifies tab-size 2 and -moz-tab-size 2', () => {
      expect(noteEditorSource).toContain('tab-size: 2;');
      expect(noteEditorSource).toContain('-moz-tab-size: 2;');
    });

    it('CSS-1.4: NoteEditor textarea enforces soft prose wrapping (white-space: pre-wrap and overflow-wrap: break-word)', () => {
      expect(noteEditorSource).toContain('white-space: pre-wrap;');
      expect(noteEditorSource).toContain('overflow-wrap: break-word;');
    });

    it('CSS-1.5: NoteEditor preview pane code and pre use unified monospace stack and 1.6 line height', () => {
      expect(noteEditorSource).toContain(':global(.markdown-preview code)');
      expect(noteEditorSource).toContain(':global(.markdown-preview pre)');
      expect(noteEditorSource).toContain(
        `font-family: ${expectedFontStack};`
      );
    });

    it('CSS-1.6: MarkdownViewer pre and code use unified monospace stack and 1.6 line height', () => {
      expect(markdownViewerSource).toContain(':global(.markdown-viewer code)');
      expect(markdownViewerSource).toContain(':global(.markdown-viewer pre)');
      expect(markdownViewerSource).toContain(
        `font-family: ${expectedFontStack};`
      );
      expect(markdownViewerSource).toContain('line-height: 1.6;');
    });

    it('CSS-1.7: Code block pre elements enforce white-space: pre without word-wrap mangling', () => {
      // In NoteEditor
      expect(noteEditorSource).toContain('white-space: pre;');
      expect(noteEditorSource).toContain('word-break: normal;');
      expect(noteEditorSource).toContain('word-wrap: normal;');
      expect(noteEditorSource).toContain('overflow-wrap: normal;');
      expect(noteEditorSource).toContain('overflow-x: auto;');
      expect(noteEditorSource).toContain('max-width: 100%;');

      // In MarkdownViewer
      expect(markdownViewerSource).toContain('white-space: pre;');
      expect(markdownViewerSource).toContain('word-break: normal;');
      expect(markdownViewerSource).toContain('word-wrap: normal;');
      expect(markdownViewerSource).toContain('overflow-wrap: normal;');
      expect(markdownViewerSource).toContain('overflow-x: auto;');
      expect(markdownViewerSource).toContain('max-width: 100%;');
    });

    it('CSS-1.8: NoteEditor workspace-pane has min-width: 0 to prevent CSS Grid flex track blowout', () => {
      expect(noteEditorSource).toContain('.workspace-pane {');
      expect(noteEditorSource).toContain('min-width: 0;');
    });

    it('CSS-1.9: Pre blocks include touch scrolling and overscroll behavior contain', () => {
      expect(noteEditorSource).toContain('-webkit-overflow-scrolling: touch;');
      expect(noteEditorSource).toContain('overscroll-behavior-x: contain;');
      expect(markdownViewerSource).toContain('-webkit-overflow-scrolling: touch;');
      expect(markdownViewerSource).toContain('overscroll-behavior-x: contain;');
    });
  });

  // =========================================================================
  // 2. Stress Test: Long Unspaced Strings in Prose
  // =========================================================================
  describe('2. Stress Test: Long Unspaced Strings in Prose Wrapping', () => {
    it('PROSE-2.1: 500-char continuous URL in prose renders safely without truncating or failing', () => {
      const longUrl = 'https://example.com/api/v1/resource?' + 'paramKey=paramValueDataChunk1234567890'.repeat(15);
      expect(longUrl.length).toBeGreaterThanOrEqual(500);

      const markdown = `Check this reference URL:\n\n${longUrl}\n\nAnd some following prose.`;
      const html = renderMarkdown(markdown);

      expect(html).toContain('<p>');
      expect(html).toContain(longUrl);
      expect(html).toContain('And some following prose.');

      const { html: rendered } = render(MarkdownViewer, { props: { content: markdown } });
      expect(rendered).toContain('markdown-viewer');
      expect(rendered).toContain(longUrl);
    });

    it('PROSE-2.2: 1,000-char continuous hex hash string wraps inside prose paragraph', () => {
      const hexHash = 'a1b2c3d4e5f6'.repeat(85); // 1020 chars
      const markdown = `Commit hash: ${hexHash}`;
      const html = renderMarkdown(markdown);

      expect(html).toContain(`<p>Commit hash: ${hexHash}</p>`);

      const { html: noteEditorHtml } = render(NoteEditor, {
        props: {
          note: {
            id: 'hex-test',
            title: 'Hex Test',
            content: markdown,
            isPinned: false,
            tags: [],
          },
        },
      });
      expect(noteEditorHtml).toContain(hexHash);
      expect(noteEditorHtml).toContain('markdown-textarea');
      expect(noteEditorHtml).toContain('markdown-preview');
    });

    it('PROSE-2.3: Multiple consecutive 300-char unbroken strings separated by punctuation', () => {
      const token1 = 'TOKEN' + 'ABCDEF123456'.repeat(25);
      const token2 = 'SIGNATURE' + 'FEDCBA654321'.repeat(25);
      const markdown = `Tokens:\n1. ${token1}\n2. ${token2}`;
      const html = renderMarkdown(markdown);

      expect(html).toContain('<li>');
      expect(html).toContain(token1);
      expect(html).toContain(token2);
    });

    it('PROSE-2.4: 500-char URL in Markdown link syntax [Text](URL)', () => {
      const longUrl = 'https://subdomain.domain.org/path/to/resource?' + 'param=1234567890'.repeat(30);
      const markdown = `[Click here for deep link](${longUrl})`;
      const html = renderMarkdown(markdown);

      expect(html).toContain('<a href=');
      expect(html).toContain(longUrl);
      expect(html).toContain('Click here for deep link');
    });
  });

  // =========================================================================
  // 3. Stress Test: Fenced Code Blocks & Whitespace Preservation
  // =========================================================================
  describe('3. Stress Test: Fenced Code Blocks & Whitespace Preservation', () => {
    it('CODE-3.1: 500-char single-line code statement retains single-line formatting in <pre><code>', () => {
      const singleLongLine =
        'export const createQueryPipeline = (db: Database, context: ExecutionContext, config: PipelineConfig, metricsCollector: MetricsCollector) => db.transaction(async (tx) => { return await tx.select().from(schema.notes).innerJoin(schema.users, eq(schema.notes.userId, schema.users.id)).where(and(eq(schema.notes.status, "ACTIVE"), inArray(schema.notes.tagId, config.allowedTagIds))).orderBy(desc(schema.notes.updatedAt)).limit(config.pageSize).offset(config.pageOffset); });';
      expect(singleLongLine.length).toBeGreaterThan(400);

      const markdown = `\`\`\`typescript\n${singleLongLine}\n\`\`\``;
      const html = renderMarkdown(markdown);

      expect(html).toContain('<pre><code class="language-typescript">');
      // Verify HTML-escaped characters are present
      expect(html).toContain('export const createQueryPipeline');
      expect(html).toContain('=&gt;');
      expect(html).toContain('&quot;ACTIVE&quot;');

      // Verify no extra line breaks were injected inside code line
      const codeMatch = html.match(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/);
      expect(codeMatch).toBeTruthy();
      if (codeMatch) {
        // Line count inside code tag must be exactly 1
        expect(codeMatch[1].trim().split('\n').length).toBe(1);
      }
    });

    it('CODE-3.2: Code block with exact leading indentation and multi-level nesting preserves spaces', () => {
      const indentedCode = [
        'function evaluateNestedTree(node: TreeNode, depth: number = 0): AnalysisResult {',
        '  if (!node) return { valid: false, count: 0 };',
        '    if (depth > 10) {',
        '      throw new Error("Maximum depth exceeded");',
        '    }',
        '      return {',
        '        valid: true,',
        '        count: node.children.length,',
        '      };',
        '}',
      ].join('\n');

      const markdown = `\`\`\`typescript\n${indentedCode}\n\`\`\``;
      const html = renderMarkdown(markdown);

      expect(html).toContain('<pre><code class="language-typescript">');
      expect(html).toContain('  if (!node) return { valid: false, count: 0 };');
      expect(html).toContain('    if (depth &gt; 10) {');
      expect(html).toContain('      throw new Error(&quot;Maximum depth exceeded&quot;);');
      expect(html).toContain('        count: node.children.length,');
    });

    it('CODE-3.3: Code block containing special characters (&, <, >, quotes) escapes HTML entities', () => {
      const codeWithEntities = 'const test = a < b && c > d && "hello" !== \'world\';';
      const markdown = `\`\`\`javascript\n${codeWithEntities}\n\`\`\``;
      const html = renderMarkdown(markdown);

      expect(html).toContain('&lt;');
      expect(html).toContain('&gt;');
      expect(html).toContain('&amp;&amp;');
      expect(html).not.toContain('<script>');
    });

    it('CODE-3.4: Mixed document with prose, 500-char URLs, and wide code blocks renders in NoteEditor', () => {
      const mixedMarkdown = [
        '# Comprehensive Technical Note',
        '',
        'Here is a long URL reference: https://api.service.io/v2/datasets/analytics/timeseries/aggregates?granularity=hourly&dimensions=region,device,browser,country&metrics=request_count,error_count,latency_p95,latency_p99&filters=env%3Dprod%2Cstatus%3Dactive',
        '',
        '```sql',
        'SELECT n.id, n.title, n.content, n.is_pinned, array_agg(t.name) AS tags, u.email AS author_email FROM notes n LEFT JOIN note_tags nt ON nt.note_id = n.id LEFT JOIN tags t ON t.id = nt.tag_id INNER JOIN users u ON u.id = n.user_id WHERE n.user_id = $1 AND n.deleted_at IS NULL GROUP BY n.id, u.email ORDER BY n.is_pinned DESC, n.updated_at DESC LIMIT 50;',
        '```',
        '',
        'Final paragraph.',
      ].join('\n');

      const { html } = render(NoteEditor, {
        props: {
          note: {
            id: 'mixed-1',
            title: 'Technical Note',
            content: mixedMarkdown,
            isPinned: true,
            tags: [{ id: 't1', name: 'sql' }, { id: 't2', name: 'api' }],
          },
        },
      });

      expect(html).toContain('markdown-textarea');
      expect(html).toContain('markdown-preview');
      expect(html).toContain('Comprehensive Technical Note');
      expect(html).toContain('language-sql');
      expect(html).toContain('SELECT n.id, n.title');
    });

    it('CODE-3.5: Empty code blocks or code blocks with only whitespace handle gracefully', () => {
      const emptyCode = '```\n\n```';
      const html = renderMarkdown(emptyCode);
      expect(html).toContain('<pre><code>');
    });
  });

  // =========================================================================
  // 4. Monospace Font Stack Fallback Verification
  // =========================================================================
  describe('4. Monospace Font Stack Fallback Verification', () => {
    it('FONT-4.1: Font stack contains platform-native first-party monospace fonts', () => {
      const noteEditorPath = path.resolve(process.cwd(), 'src/lib/components/NoteEditor.svelte');
      const noteEditorSource = fs.readFileSync(noteEditorPath, 'utf-8');

      // Apple platforms (macOS / iOS modern): ui-monospace, Menlo
      expect(noteEditorSource).toContain('ui-monospace');
      expect(noteEditorSource).toContain('Menlo');

      // Windows platform: Consolas
      expect(noteEditorSource).toContain('Consolas');

      // High-quality cross-platform dev fonts: JetBrains Mono, IBM Plex Mono
      expect(noteEditorSource).toContain('"JetBrains Mono"');
      expect(noteEditorSource).toContain('"IBM Plex Mono"');

      // Generic fallback: monospace
      expect(noteEditorSource).toContain('monospace');
    });

    it('FONT-4.2: MarkdownViewer matches NoteEditor font family definition exactly', () => {
      const noteEditorPath = path.resolve(process.cwd(), 'src/lib/components/NoteEditor.svelte');
      const markdownViewerPath = path.resolve(process.cwd(), 'src/lib/components/MarkdownViewer.svelte');
      const noteEditorSource = fs.readFileSync(noteEditorPath, 'utf-8');
      const markdownViewerSource = fs.readFileSync(markdownViewerPath, 'utf-8');

      const editorMatch = noteEditorSource.match(/font-family:\s*([^;]+);/);
      const viewerMatch = markdownViewerSource.match(/font-family:\s*([^;]+);/);

      expect(editorMatch).toBeTruthy();
      expect(viewerMatch).toBeTruthy();
      if (editorMatch && viewerMatch) {
        expect(editorMatch[1].trim()).toBe(viewerMatch[1].trim());
      }
    });
  });
});
