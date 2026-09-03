import { describe, it, expect } from 'vitest';
import { parseMarkdownBlocks, parseInlineRuns } from '$lib/server/export/markdown-blocks';

describe('Unit: Export Markdown Block Parser', () => {
  describe('parseInlineRuns', () => {
    it('parses bold, italic, strikethrough, code, and links', () => {
      const runs = parseInlineRuns(
        'plain **bold** *em* ~~gone~~ `code` [site](https://example.com)'
      );
      const kinds = runs.map((r) => r.kind);
      expect(kinds).toContain('strong');
      expect(kinds).toContain('em');
      expect(kinds).toContain('del');
      expect(kinds).toContain('code');
      expect(kinds).toContain('link');

      const link = runs.find((r) => r.kind === 'link');
      expect(link).toMatchObject({ kind: 'link', text: 'site', href: 'https://example.com' });
    });

    it('protects inline code contents from emphasis parsing', () => {
      const runs = parseInlineRuns('see `a *b* c` end');
      const code = runs.find((r) => r.kind === 'code');
      expect(code).toMatchObject({ kind: 'code', text: 'a *b* c' });
    });

    it('merges adjacent plain text runs', () => {
      const runs = parseInlineRuns('one two three');
      expect(runs).toEqual([{ kind: 'text', text: 'one two three' }]);
    });

    it('returns a single text run for plain input', () => {
      expect(parseInlineRuns('hello')).toEqual([{ kind: 'text', text: 'hello' }]);
    });

    it('does not treat underscores inside words as italic boundaries', () => {
      const runs = parseInlineRuns('snake_case_name here');
      const em = runs.find((r) => r.kind === 'em');
      expect(em?.text ?? '').not.toBe('case');
    });
  });

  describe('parseMarkdownBlocks', () => {
    it('returns an empty array for empty or invalid input', () => {
      expect(parseMarkdownBlocks('')).toEqual([]);
      expect(parseMarkdownBlocks(null as unknown as string)).toEqual([]);
      expect(parseMarkdownBlocks(undefined as unknown as string)).toEqual([]);
    });

    it('parses heading levels 1-6', () => {
      const blocks = parseMarkdownBlocks('# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6');
      const headings = blocks.filter((b) => b.type === 'heading');
      expect(headings.map((h) => (h as { level: number }).level)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('parses a paragraph with inline styling into a single block', () => {
      const blocks = parseMarkdownBlocks('first line\nsecond line');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('paragraph');
    });

    it('parses fenced code blocks with language and content', () => {
      const blocks = parseMarkdownBlocks('```typescript\nconst a = 1;\nconst b = 2;\n```');
      expect(blocks).toHaveLength(1);
      const code = blocks[0] as Extract<
        (typeof blocks)[number],
        { type: 'code' }
      >;
      expect(code.type).toBe('code');
      expect(code.language).toBe('typescript');
      expect(code.lines).toEqual(['const a = 1;', 'const b = 2;']);
    });

    it('does not treat indented list syntax inside code blocks as lists', () => {
      const md = '```\n- not a list\n1. also not\n```';
      const blocks = parseMarkdownBlocks(md);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('code');
    });

    it('parses horizontal rules', () => {
      for (const rule of ['---', '***', '___']) {
        const blocks = parseMarkdownBlocks(`before\n\n${rule}\n\nafter`);
        expect(blocks.some((b) => b.type === 'hr')).toBe(true);
      }
    });

    it('parses unordered lists with nesting', () => {
      const blocks = parseMarkdownBlocks('- one\n- two\n  - nested');
      expect(blocks).toHaveLength(1);
      const list = blocks[0] as { type: 'list'; ordered: boolean; items: Array<{ children: unknown[] }> };
      expect(list.ordered).toBe(false);
      expect(list.items).toHaveLength(2);
      expect(list.items[1].children).toHaveLength(1);
    });

    it('separates ordered lists from preceding unordered lists', () => {
      const blocks = parseMarkdownBlocks('- bullet\n1. ordered');
      const lists = blocks.filter((b) => b.type === 'list');
      expect(lists).toHaveLength(2);
      expect((lists[0] as { ordered: boolean }).ordered).toBe(false);
      expect((lists[1] as { ordered: boolean }).ordered).toBe(true);
    });

    it('parses ordered lists', () => {
      const blocks = parseMarkdownBlocks('1. first\n2. second\n3. third');
      expect(blocks).toHaveLength(1);
      const list = blocks[0] as { ordered: boolean; items: unknown[] };
      expect(list.ordered).toBe(true);
      expect(list.items).toHaveLength(3);
    });

    it('parses blockquotes with inline styling', () => {
      const blocks = parseMarkdownBlocks('> quoted **bold** text\n> second line');
      expect(blocks).toHaveLength(1);
      const quote = blocks[0] as {
        type: 'blockquote';
        paragraphs: Array<Array<{ kind: string }>>;
      };
      expect(quote.paragraphs).toHaveLength(1);
      const kinds = quote.paragraphs[0].map((r) => r.kind);
      expect(kinds).toContain('strong');
    });

    it('parses tables with alignment and header row', () => {
      const blocks = parseMarkdownBlocks('| A | B | C |\n|:--|--:|:--:|\n| 1 | 2 | 3 |');
      expect(blocks).toHaveLength(1);
      const table = blocks[0] as {
        type: 'table';
        cells: Array<Array<{ align: string; header: boolean }>>;
      };
      expect(table.cells).toHaveLength(2);
      expect(table.cells[0].map((c) => c.header)).toEqual([true, true, true]);
      expect(table.cells[1].map((c) => c.header)).toEqual([false, false, false]);
      expect(table.cells[0].map((c) => c.align)).toEqual(['left', 'right', 'center']);
    });

    it('does not treat a lone pipe row as a table without separator', () => {
      const blocks = parseMarkdownBlocks('just | some | text');
      expect(blocks.every((b) => b.type === 'paragraph')).toBe(true);
    });

    it('normalizes Windows line endings', () => {
      const blocks = parseMarkdownBlocks('# Title\r\n\r\ntext\r\n');
      expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph']);
    });

    it('handles a full document without throwing', () => {
      const md = [
        '# Export Test',
        '',
        'Paragraph with **bold**, *italic*, `code`, [link](https://example.com).',
        '',
        '- item 1',
        '- item 2',
        '  - nested',
        '  - deeper',
        '    - deepest',
        '',
        '1. first',
        '2. second',
        '',
        '> a quote',
        '',
        '```python',
        'print("hi")',
        '```',
        '',
        '| Name | Value |',
        '|------|-------|',
        '| x | 1 |',
        '',
        '---',
        '',
        'End.',
      ].join('\n');

      const blocks = parseMarkdownBlocks(md);
      const types = blocks.map((b) => b.type);
      expect(types).toContain('heading');
      expect(types).toContain('paragraph');
      expect(types).toContain('list');
      expect(types).toContain('blockquote');
      expect(types).toContain('code');
      expect(types).toContain('table');
      expect(types).toContain('hr');
    });
  });
});
