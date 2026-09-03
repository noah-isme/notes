/**
 * Batch export: bundles multiple notes into a single ZIP archive.
 * Server-only (relies on Node Buffer and the pure-JS `jszip` package).
 */
import JSZip from 'jszip';
import { noteToDocxBuffer } from './render-docx';
import { noteToWordHtml, noteToCleanHtml } from './render-html';

export type BatchExportFormat = 'docx' | 'doc' | 'html';

export interface BatchExportNote {
  id: string;
  title: string;
  content: string;
  updatedAt: Date;
  tags: Array<{ name: string }>;
}

const ENTRY_EXTENSIONS: Record<BatchExportFormat, string> = {
  docx: '.docx',
  doc: '.doc',
  html: '.html',
};

/**
 * Makes a note title safe to use as a ZIP entry name: strips control
 * characters, replaces filesystem-reserved characters with '-', collapses
 * whitespace, trims, and caps the length at 100 characters.
 */
export function sanitizeZipEntryName(title: string): string {
  const cleaned = title
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
  return cleaned.length > 0 ? cleaned : 'untitled';
}

/**
 * Given raw titles (order preserved), returns unique entry BASE names.
 * Sanitizes each title; on collision appends ' (2)', ' (3)', etc. before
 * the extension is added later.
 */
export function dedupeZipEntryNames(titles: string[]): string[] {
  const used = new Set<string>();
  const results: string[] = [];

  for (const title of titles) {
    const base = sanitizeZipEntryName(title);
    let name = base;
    let counter = 2;
    while (used.has(name)) {
      name = `${base} (${counter})`;
      counter += 1;
    }
    used.add(name);
    results.push(name);
  }

  return results;
}

/**
 * Builds a ZIP archive containing one file per note, in the given order.
 * An empty note list still yields a valid (empty) ZIP.
 */
export async function buildNotesZip(
  notes: BatchExportNote[],
  format: BatchExportFormat,
  author?: string | null
): Promise<{ buffer: Buffer; fileCount: number }> {
  const extension = ENTRY_EXTENSIONS[format];
  const baseNames = dedupeZipEntryNames(notes.map((note) => note.title));
  const zip = new JSZip();

  for (const [index, note] of notes.entries()) {
    const entryName = `${baseNames[index]}${extension}`;

    let content: Buffer | string;
    switch (format) {
      case 'docx':
        content = await noteToDocxBuffer(note.content, {
          title: note.title,
          author: author ?? undefined,
          tags: note.tags,
          updatedAt: note.updatedAt,
        });
        break;
      case 'doc':
        content = noteToWordHtml(note.content, {
          title: note.title,
          tags: note.tags,
          updatedAt: note.updatedAt,
        });
        break;
      case 'html':
        content = noteToCleanHtml(note.content, {
          title: note.title,
          tags: note.tags,
          updatedAt: note.updatedAt,
        });
        break;
    }

    zip.file(entryName, content);
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  return { buffer, fileCount: notes.length };
}
