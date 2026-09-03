/**
 * Markdown → neutral block AST parser for document export.
 *
 * Produces a structured representation of a markdown note that the
 * .docx renderer and the HTML (.doc / Google Docs) renderers both consume.
 * Supports the same markdown feature surface as the in-app renderer:
 * headings, paragraphs, bullet/ordered lists (with nesting), fenced code
 * blocks, tables (with alignment), blockquotes, horizontal rules, and
 * inline emphasis (bold, italic, strikethrough, code, links).
 */

export type InlineRun =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string }
  | { kind: 'em'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'del'; text: string };

export type TableCell = {
  runs: InlineRun[];
  align: 'left' | 'center' | 'right';
  header: boolean;
};

export type ListItem = {
  runs: InlineRun[];
  children: ListBlock[];
};

export type ListBlock = {
  type: 'list';
  ordered: boolean;
  items: ListItem[];
};

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; runs: InlineRun[] }
  | { type: 'paragraph'; runs: InlineRun[] }
  | { type: 'code'; language: string; lines: string[] }
  | { type: 'blockquote'; paragraphs: InlineRun[][] }
  | { type: 'table'; cells: TableCell[][] }
  | { type: 'hr' }
  | ListBlock;

const MAX_NESTING_DEPTH = 6;

/**
 * Parses inline markdown (emphasis, code spans, links) into typed runs.
 * Inline code is extracted first so its contents are never re-parsed.
 */
export function parseInlineRuns(input: string): InlineRun[] {
  const runs: InlineRun[] = [];
  // Split out inline code spans first, preserving their raw content.
  const segments = input.split(/(`[^`\n]+`)/g);

  for (const segment of segments) {
    if (segment === '') continue;

    if (segment.startsWith('`') && segment.endsWith('`') && segment.length >= 2) {
      runs.push({ kind: 'code', text: segment.slice(1, -1) });
      continue;
    }

    runs.push(...parseEmphasis(segment));
  }

  return runs;
}

const EM_START = '\uE000EMU\uE000';
const EM_END = '\uE000END\uE000';

/**
 * Parses emphasis, strikethrough, and links within a code-free text segment.
 * Italic emphasis is matched with boundary preservation (the character before
 * the opening `*` must not be a `*`), using private-use markers so the
 * surrounding text survives as literal runs.
 */
function parseEmphasis(text: string): InlineRun[] {
  let runs: InlineRun[] = [{ kind: 'text', text }];

  // Links: [label](url)
  runs = applyPattern(
    runs,
    /\[([^\]]+)\]\(\s*((?:[^\s()]+|\([^\s()]*\))+)\s*\)/g,
    (m) => ({ kind: 'link', text: m[1], href: m[2].trim() })
  );

  // Strikethrough: ~~text~~
  runs = applyPattern(runs, /~~([^~]+)~~/g, (m) => ({ kind: 'del', text: m[1] }));

  // Bold: **text** or __text__
  runs = applyPattern(runs, /\*\*([^*]+)\*\*/g, (m) => ({ kind: 'strong', text: m[1] }));
  runs = applyPattern(runs, /__([^_]+)__/g, (m) => ({ kind: 'strong', text: m[1] }));

  // Italic (boundary-preserving): *text* allows intraword emphasis,
  // _text_ does not (CommonMark semantics for underscores)
  runs = applyPattern(runs, /(^|[^*])\*([^*]+)\*([^*]|$)/g, (m) => ({
    kind: 'text',
    text: `${m[1]}${EM_START}${m[2]}${EM_END}${m[3]}`,
  }));
  runs = applyPattern(runs, /(^|[^A-Za-z0-9_])_([^_]+)_([^A-Za-z0-9_]|$)/g, (m) => ({
    kind: 'text',
    text: `${m[1]}${EM_START}${m[2]}${EM_END}${m[3]}`,
  }));

  // Resolve markers into em runs
  const out: InlineRun[] = [];
  for (const run of runs) {
    if (run.kind !== 'text' || !run.text.includes(EM_START)) {
      out.push(run);
      continue;
    }
    let text = run.text;
    let replaced = true;
    while (replaced) {
      replaced = false;
      const startIdx = text.indexOf(EM_START);
      if (startIdx === -1) break;
      const before = text.slice(0, startIdx);
      const rest = text.slice(startIdx + EM_START.length);
      const endIdx = rest.indexOf(EM_END);
      if (endIdx === -1) break;
      const inner = rest.slice(0, endIdx);
      const after = rest.slice(endIdx + EM_END.length);
      if (before) out.push({ kind: 'text', text: before });
      out.push({ kind: 'em', text: inner });
      text = after;
      replaced = true;
    }
    if (text) out.push({ kind: 'text', text });
  }

  return mergeAdjacentText(out);
}

/**
 * Applies a regex pattern to every text run, splitting it into
 * replacement runs (from repl) and remaining literal text.
 */
function applyPattern(
  runs: InlineRun[],
  pattern: RegExp,
  repl: (match: RegExpExecArray) => InlineRun
): InlineRun[] {
  const out: InlineRun[] = [];
  for (const run of runs) {
    if (run.kind !== 'text') {
      out.push(run);
      continue;
    }
    let lastIndex = 0;
    const regex = new RegExp(
      pattern.source,
      pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'
    );
    let match: RegExpExecArray | null;
    while ((match = regex.exec(run.text)) !== null) {
      if (match.index > lastIndex) {
        out.push({ kind: 'text', text: run.text.slice(lastIndex, match.index) });
      }
      out.push(repl(match));
      lastIndex = match.index + match[0].length;
      if (match[0].length === 0) regex.lastIndex++;
    }
    if (lastIndex < run.text.length) {
      out.push({ kind: 'text', text: run.text.slice(lastIndex) });
    }
  }
  return out;
}

function mergeAdjacentText(runs: InlineRun[]): InlineRun[] {
  const out: InlineRun[] = [];
  for (const run of runs) {
    const prev = out[out.length - 1];
    if (run.kind === 'text' && prev && prev.kind === 'text') {
      out[out.length - 1] = { kind: 'text', text: prev.text + run.text };
    } else {
      out.push(run);
    }
  }
  return out;
}

function splitTableRow(rowStr: string): string[] {
  let trimmed = rowStr.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.substring(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.substring(0, trimmed.length - 1);
  return trimmed.split('|').map((c) => c.trim());
}

function isTableSeparator(str: string): boolean {
  const trimmed = str.trim();
  if (!trimmed.includes('-') && !trimmed.includes(':')) return false;
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(trimmed);
}

function isTableRow(str: string): boolean {
  const trimmed = str.trim();
  if (!trimmed.includes('|')) return false;
  if (trimmed.startsWith('#') || trimmed.startsWith('>')) return false;
  return splitTableRow(trimmed).length >= 2;
}

function parseTableAlignment(sepRow: string): Array<'left' | 'center' | 'right'> {
  return splitTableRow(sepRow).map((cell) => {
    const trimmed = cell.trim();
    const starts = trimmed.startsWith(':');
    const ends = trimmed.endsWith(':');
    if (starts && ends) return 'center';
    if (ends) return 'right';
    return 'left';
  });
}

/**
 * Computes nesting depth for a list line from its leading whitespace
 * (2 spaces per level, capped at MAX_NESTING_DEPTH).
 */
function listLevel(indent: string): number {
  const spaces = indent.length;
  return Math.min(Math.floor(spaces / 2), MAX_NESTING_DEPTH - 1);
}

/**
 * Parses a markdown document into export blocks.
 */
export function parseMarkdownBlocks(markdown: string): Block[] {
  if (!markdown || typeof markdown !== 'string') return [];

  const normalized = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const blocks: Block[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Blank line
    if (trimmed === '') {
      i++;
      continue;
    }

    // Fenced code block (``` or ~~~)
    const fenceMatch = trimmed.match(/^(```|~~~)/);
    if (fenceMatch) {
      const fence = fenceMatch[1];
      const language = trimmed.slice(fence.length).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // consume closing fence (or EOF)
      blocks.push({ type: 'code', language, lines: codeLines });
      continue;
    }

    // Heading
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6,
        runs: parseInlineRuns(headingMatch[2].trim()),
      });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Table (header row followed by separator row)
    if (isTableRow(trimmed)) {
      const next = lines[i + 1]?.trim() ?? '';
      if (next !== '' && isTableSeparator(next)) {
        const headerCells = splitTableRow(trimmed);
        const alignments = parseTableAlignment(next);
        const rows: string[][] = [];
        let r = i + 2;
        while (r < lines.length) {
          const rowLine = lines[r].trim();
          if (rowLine === '' || !isTableRow(rowLine) || isTableSeparator(rowLine)) break;
          rows.push(splitTableRow(rowLine));
          r++;
        }

        const cells: TableCell[][] = [
          headerCells.map((cell, cIdx) => ({
            runs: parseInlineRuns(cell),
            align: alignments[cIdx] ?? 'left',
            header: true,
          })),
        ];
        for (const row of rows) {
          cells.push(
            row.map((cell, cIdx) => ({
              runs: parseInlineRuns(cell),
              align: alignments[cIdx] ?? 'left',
              header: false,
            }))
          );
        }

        blocks.push({ type: 'table', cells });
        i = r;
        continue;
      }
    }

    // Blockquote (collect consecutive > lines)
    if (trimmed.startsWith('>')) {
      const paragraphs: InlineRun[][] = [];
      let current: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        current.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      if (current.length > 0) {
        paragraphs.push(parseInlineRuns(current.join(' ')));
      }
      blocks.push({ type: 'blockquote', paragraphs });
      continue;
    }

    // Lists (bullet or ordered, with nesting)
    const isListItem = /^\s*([-*+]|\d+[.)])\s+/.test(line);
    if (isListItem) {
      const root: ListBlock = {
        type: 'list',
        ordered: /^\s*\d+[.)]\s+/.test(line),
        items: [],
      };
      const stack: ListBlock[] = [root];

      while (i < lines.length) {
        const listLine = lines[i];
        const listTrimmed = listLine.trim();
        const isUl = listLine.match(/^(\s*)[-*+]\s+(.+)$/);
        const isOl = listLine.match(/^(\s*)\d+[.)]\s+(.+)$/);
        const match = isUl ?? isOl;
        if (!match) {
          // Blank line ends the list unless the next non-blank line continues it
          if (listTrimmed === '') {
            const nextNonBlank = lines[i + 1]?.trim() ?? '';
            const nextIsList =
              /^\s*[-*+]\s+/.test(nextNonBlank) || /^\s*\d+[.)]\s+/.test(nextNonBlank);
            if (nextIsList) {
              i++;
              continue;
            }
          }
          break;
        }

        const itemOrdered = Boolean(isOl);
        const level = listLevel(match[1]);
        const itemRuns = parseInlineRuns(match[2]);

        // A list-type switch at the attachment level starts a new list block
        if (stack.length >= level + 1 && stack[level].ordered !== itemOrdered) {
          break;
        }

        // Adjust stack depth
        while (stack.length > level + 1) stack.pop();
        while (stack.length < level + 1) {
          const nested: ListBlock = { type: 'list', ordered: itemOrdered, items: [] };
          const parent = stack[stack.length - 1];
          if (parent.items.length === 0) {
            // Nested list with no parent item: attach to a synthetic parent item
            parent.items.push({ runs: [], children: [] });
          }
          parent.items[parent.items.length - 1].children.push(nested);
          stack.push(nested);
        }

        stack[stack.length - 1].items.push({ runs: itemRuns, children: [] });
        i++;
      }

      blocks.push(root);
      continue;
    }

    // Paragraph (consume consecutive non-blank, non-structural lines)
    const paragraphLines: string[] = [trimmed];
    i++;
    while (i < lines.length) {
      const nextLine = lines[i];
      const nextTrimmed = nextLine.trim();
      if (
        nextTrimmed === '' ||
        nextTrimmed.startsWith('#') ||
        nextTrimmed.startsWith('>') ||
        /^(\s*)([-*+]|\d+[.)])\s+/.test(nextLine) ||
        /^(```|~~~)/.test(nextTrimmed) ||
        /^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(nextTrimmed) ||
        (isTableRow(nextTrimmed) && isTableSeparator(lines[i + 1]?.trim() ?? ''))
      ) {
        break;
      }
      paragraphLines.push(nextTrimmed);
      i++;
    }
    blocks.push({ type: 'paragraph', runs: parseInlineRuns(paragraphLines.join(' ')) });
  }

  return blocks;
}
