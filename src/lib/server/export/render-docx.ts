/**
 * Renders a markdown note as a Microsoft Word .docx document.
 * Server-only (relies on the `docx` package and Node Buffer).
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { Block, InlineRun, ListBlock, TableCell as ExportTableCell } from './markdown-blocks';
import { parseMarkdownBlocks } from './markdown-blocks';

const BODY_FONT = 'Calibri';
const CODE_FONT = 'Consolas';
const BODY_COLOR = '1E293B';
const MUTED_COLOR = '64748B';
const LINK_COLOR = '2563EB';
const CODE_BG = 'F1F5F9';
const BORDER_COLOR = 'E2E8F0';
const QUOTE_BAR_COLOR = '94A3B8';

const HEADING_LEVELS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
] as const;

export interface DocxExportOptions {
  title: string;
  author?: string | null;
  tags?: Array<{ name: string }>;
  updatedAt?: Date;
}

function runToDocxChild(
  run: InlineRun,
  opts: { bold?: boolean } = {}
): TextRun | ExternalHyperlink {
  const bold = opts.bold ?? false;
  switch (run.kind) {
    case 'strong':
      return new TextRun({ text: run.text, bold: true, color: BODY_COLOR });
    case 'em':
      return new TextRun({ text: run.text, italics: true, bold, color: BODY_COLOR });
    case 'del':
      return new TextRun({ text: run.text, strike: true, bold, color: BODY_COLOR });
    case 'code':
      return new TextRun({
        text: run.text,
        font: CODE_FONT,
        size: 20,
        bold,
        color: BODY_COLOR,
        shading: { type: ShadingType.CLEAR, fill: CODE_BG },
      });
    case 'link':
      return new ExternalHyperlink({
        link: run.href,
        children: [
          new TextRun({
            text: run.text,
            color: LINK_COLOR,
            bold,
            underline: { type: 'single' },
          }),
        ],
      });
    case 'text':
    default:
      return new TextRun({ text: run.text, bold, color: BODY_COLOR });
  }
}

function runsToChildren(
  runs: InlineRun[],
  opts: { bold?: boolean } = {}
): Array<TextRun | ExternalHyperlink> {
  return runs.map((run) => runToDocxChild(run, opts));
}

function headingParagraph(level: 1 | 2 | 3 | 4 | 5 | 6, runs: InlineRun[]): Paragraph {
  return new Paragraph({
    heading: HEADING_LEVELS[level - 1],
    children: runsToChildren(runs),
  });
}

function paragraph(runs: InlineRun[]): Paragraph {
  return new Paragraph({
    children: runsToChildren(runs),
    spacing: { after: 120 },
  });
}

function codeBlockParagraphs(language: string, lines: string[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  if (language) {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: language, font: CODE_FONT, size: 14, color: MUTED_COLOR })],
        spacing: { after: 40 },
        keepNext: true,
      })
    );
  }

  for (const line of lines) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: line.length > 0 ? line : ' ',
            font: CODE_FONT,
            size: 18,
            color: BODY_COLOR,
          }),
        ],
        shading: { type: ShadingType.CLEAR, fill: CODE_BG },
        spacing: { after: 0, line: 240 },
        keepLines: true,
      })
    );
  }

  if (paragraphs.length > 0) {
    paragraphs[paragraphs.length - 1] = new Paragraph({
      children: [new TextRun({ text: ' ', font: CODE_FONT, size: 18 })],
      spacing: { after: 120 },
    });
  }

  return paragraphs;
}

function blockquoteParagraphs(paragraphs: InlineRun[][]): Paragraph[] {
  return paragraphs.map((runs) => {
    const children = runs.map((run) =>
      run.kind === 'text'
        ? new TextRun({ text: run.text, italics: true, color: MUTED_COLOR })
        : runToDocxChild(run)
    );
    return new Paragraph({
      children,
      indent: { left: 360 },
      border: {
        left: { style: BorderStyle.SINGLE, size: 12, color: QUOTE_BAR_COLOR, space: 8 },
      },
      spacing: { after: 120 },
    });
  });
}

function alignmentFor(align: 'left' | 'center' | 'right'): (typeof AlignmentType)[keyof typeof AlignmentType] {
  if (align === 'center') return AlignmentType.CENTER;
  if (align === 'right') return AlignmentType.RIGHT;
  return AlignmentType.LEFT;
}

function table(cells: ExportTableCell[][]): Table {
  const rows = cells.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: runsToChildren(cell.runs, { bold: cell.header }),
                  alignment: alignmentFor(cell.align),
                }),
              ],
              shading: cell.header
                ? { type: ShadingType.CLEAR, fill: CODE_BG }
                : undefined,
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
            })
        ),
      })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
      left: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
      right: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
    },
  });
}

function hrParagraph(): Paragraph {
  return new Paragraph({
    children: [],
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: BORDER_COLOR, space: 1 },
    },
    spacing: { before: 120, after: 120 },
  });
}

interface NumberingState {
  counter: number;
  configs: Array<{
    reference: string;
    levels: Array<{
      level: number;
      format: (typeof LevelFormat)[keyof typeof LevelFormat];
      text: string;
      alignment: (typeof AlignmentType)[keyof typeof AlignmentType];
      style: { paragraph: { indent: { left: number; hanging: number } } };
    }>;
  }>;
}

function numberingLevels(maxLevel: number) {
  const levels = [];
  for (let lvl = 0; lvl <= maxLevel; lvl++) {
    const text = Array.from({ length: lvl + 1 }, (_, n) => `%${n + 1}`).join('.') + '.';
    levels.push({
      level: lvl,
      format: LevelFormat.DECIMAL,
      text,
      alignment: AlignmentType.START,
      style: { paragraph: { indent: { left: 720 + lvl * 360, hanging: 360 } } },
    });
  }
  return levels;
}

function listParagraphs(
  list: ListBlock,
  numbering: NumberingState,
  depth = 0
): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const level = Math.min(depth, 5);

  let reference: string | undefined;
  if (list.ordered) {
    numbering.counter += 1;
    reference = `export-ol-${numbering.counter}`;
    numbering.configs.push({
      reference,
      levels: numberingLevels(5),
    });
  }

  for (const item of list.items) {
    paragraphs.push(
      new Paragraph({
        children: runsToChildren(item.runs),
        ...(list.ordered
          ? { numbering: { reference: reference!, level } }
          : { bullet: { level } }),
        spacing: { after: 40 },
      })
    );
    for (const child of item.children) {
      paragraphs.push(...listParagraphs(child, numbering, depth + 1));
    }
  }

  return paragraphs;
}

function titleBlock(options: DocxExportOptions): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: options.title, color: BODY_COLOR })],
    }),
  ];

  const metaParts: string[] = [];
  if (options.tags && options.tags.length > 0) {
    metaParts.push(options.tags.map((t) => `#${t.name}`).join(' '));
  }
  if (options.updatedAt) {
    metaParts.push(`Updated ${options.updatedAt.toISOString().slice(0, 10)}`);
  }
  if (metaParts.length > 0) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: metaParts.join(' · '),
            size: 16,
            color: MUTED_COLOR,
          }),
        ],
        spacing: { after: 240 },
      })
    );
  }

  return paragraphs;
}

function blocksToChildren(
  blocks: Block[],
  numbering: NumberingState
): Array<Paragraph | Table> {
  const children: Array<Paragraph | Table> = [];
  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
        children.push(headingParagraph(block.level, block.runs));
        break;
      case 'paragraph':
        children.push(paragraph(block.runs));
        break;
      case 'code':
        children.push(...codeBlockParagraphs(block.language, block.lines));
        break;
      case 'blockquote':
        children.push(...blockquoteParagraphs(block.paragraphs));
        break;
      case 'table':
        children.push(table(block.cells));
        children.push(new Paragraph({ text: '', spacing: { after: 120 } }));
        break;
      case 'hr':
        children.push(hrParagraph());
        break;
      case 'list':
        children.push(...listParagraphs(block, numbering));
        children.push(new Paragraph({ text: '', spacing: { after: 40 } }));
        break;
    }
  }
  return children;
}

export function buildNoteDocx(markdown: string, options: DocxExportOptions): Document {
  const blocks = parseMarkdownBlocks(markdown);
  const numbering: NumberingState = { counter: 0, configs: [] };
  const children = [...titleBlock(options), ...blocksToChildren(blocks, numbering)];

  return new Document({
    creator: options.author ?? 'Notes App',
    title: options.title,
    description: 'Exported from Notes',
    styles: {
      default: {
        document: {
          run: { font: BODY_FONT, size: 22, color: BODY_COLOR },
        },
      },
    },
    numbering: numbering.configs.length > 0 ? { config: numbering.configs } : undefined,
    sections: [{ children }],
  });
}

export async function noteToDocxBuffer(
  markdown: string,
  options: DocxExportOptions
): Promise<Buffer> {
  const doc = buildNoteDocx(markdown, options);
  return Packer.toBuffer(doc);
}
