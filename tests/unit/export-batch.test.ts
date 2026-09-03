import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import {
  sanitizeZipEntryName,
  dedupeZipEntryNames,
  buildNotesZip,
  type BatchExportNote,
} from '$lib/server/export/batch';

const ZIP_MAGIC = 'PK';

const MIXED_MARKDOWN = `# Mixed Content Note **bold**

Paragraph with *italic*, \`inline code\` and a [link](https://example.com).

\`\`\`typescript
const answer = 42;
\`\`\`

| Name | Value |
|:-----|------:|
| a | 1 |
| b | 2 |
`;

function makeNote(overrides: Partial<BatchExportNote> = {}): BatchExportNote {
  return {
    id: 'note-1',
    title: 'Note Title',
    content: 'Plain paragraph.',
    updatedAt: new Date('2026-09-01T10:00:00Z'),
    tags: [{ name: 'work' }],
    ...overrides,
  };
}

describe('Unit: sanitizeZipEntryName', () => {
  it('replaces filesystem-reserved characters with dashes', () => {
    expect(sanitizeZipEntryName('a/b\\c:d*e?f"g<h>i|j')).toBe('a-b-c-d-e-f-g-h-i-j');
  });

  it('strips control characters', () => {
    expect(sanitizeZipEntryName('bad\u0000\u001f\u007fname')).toBe('badname');
  });

  it('collapses whitespace to a single space', () => {
    expect(sanitizeZipEntryName('  lots \t of\n   space  ')).toBe('lots of space');
  });

  it('returns "untitled" for empty input', () => {
    expect(sanitizeZipEntryName('')).toBe('untitled');
    expect(sanitizeZipEntryName('   \t\n  ')).toBe('untitled');
    expect(sanitizeZipEntryName('\u0000\u0001')).toBe('untitled');
  });

  it('caps length at 100 characters', () => {
    const result = sanitizeZipEntryName('x'.repeat(150));
    expect(result.length).toBe(100);
  });
});

describe('Unit: dedupeZipEntryNames', () => {
  it('returns sanitized names unchanged when there are no collisions', () => {
    expect(dedupeZipEntryNames(['Alpha', 'Beta Note'])).toEqual(['Alpha', 'Beta Note']);
  });

  it('appends (2), (3) suffixes on collision', () => {
    expect(dedupeZipEntryNames(['T', 'T', 'T'])).toEqual(['T', 'T (2)', 'T (3)']);
  });

  it('preserves input order', () => {
    expect(dedupeZipEntryNames(['B', 'A', 'B', 'A', 'C'])).toEqual([
      'B',
      'A',
      'B (2)',
      'A (2)',
      'C',
    ]);
  });

  it('treats case-sensitive names that sanitize identically as collisions', () => {
    expect(dedupeZipEntryNames(['note', 'note'])).toEqual(['note', 'note (2)']);
  });

  it('does not confuse a suffixed name with a later raw title', () => {
    // 'T (2)' raw must not collide with the generated 'T (2)' unless it appears twice.
    expect(dedupeZipEntryNames(['T', 'T', 'T (2)'])).toEqual(['T', 'T (2)', 'T (2) (2)']);
  });
});

describe('Unit: buildNotesZip', () => {
  it('builds a valid zip with one .docx entry per distinct-titled note', async () => {
    const notes = [
      makeNote({ id: 'n1', title: 'First' }),
      makeNote({ id: 'n2', title: 'Second' }),
      makeNote({ id: 'n3', title: 'Third' }),
    ];

    const { buffer, fileCount } = await buildNotesZip(notes, 'docx', 'author@example.com');

    expect(buffer.subarray(0, 2).toString('latin1')).toBe(ZIP_MAGIC);
    expect(fileCount).toBe(3);

    const zip = await JSZip.loadAsync(buffer);
    const names = Object.keys(zip.files);
    expect(names).toHaveLength(3);
    for (const name of names) {
      expect(name.endsWith('.docx')).toBe(true);
    }
  });

  it('suffixes duplicate titles with (2)', async () => {
    const notes = [
      makeNote({ id: 'n1', title: 'T', content: 'one' }),
      makeNote({ id: 'n2', title: 'T', content: 'two' }),
    ];

    const { buffer } = await buildNotesZip(notes, 'docx');

    const zip = await JSZip.loadAsync(buffer);
    const names = Object.keys(zip.files).sort();
    expect(names).toEqual(['T (2).docx', 'T.docx']);
  });

  it('writes string HTML entries containing a doctype for format html', async () => {
    const notes = [makeNote({ id: 'n1', title: 'HTML Note' })];

    const { buffer } = await buildNotesZip(notes, 'html');

    const zip = await JSZip.loadAsync(buffer);
    const entry = zip.file('HTML Note.html');
    expect(entry).not.toBeNull();
    const text = await entry!.async('string');
    expect(text).toContain('<!DOCTYPE html>');
    expect(text).toContain('<h1 style="margin-top: 0;">HTML Note</h1>');
  });

  it('returns a valid empty zip for zero notes', async () => {
    const { buffer, fileCount } = await buildNotesZip([], 'docx');

    expect(buffer.subarray(0, 2).toString('latin1')).toBe(ZIP_MAGIC);
    expect(fileCount).toBe(0);
    expect(buffer.length).toBeGreaterThan(0);

    const zip = await JSZip.loadAsync(buffer);
    expect(Object.keys(zip.files)).toHaveLength(0);
  });

  it('produces a non-trivially sized docx entry for mixed markdown', async () => {
    const notes = [makeNote({ id: 'n1', title: 'Mixed', content: MIXED_MARKDOWN })];

    const { buffer } = await buildNotesZip(notes, 'docx');

    const zip = await JSZip.loadAsync(buffer);
    const entry = zip.file('Mixed.docx');
    expect(entry).not.toBeNull();
    const raw = await entry!.async('uint8array');
    expect(raw.length).toBeGreaterThan(1000);
  });

  it('defaults the docx author when none is supplied', async () => {
    const notes = [makeNote({ id: 'n1', title: 'NoAuthor' })];

    const { buffer } = await buildNotesZip(notes, 'docx', null);

    expect(buffer.subarray(0, 2).toString('latin1')).toBe(ZIP_MAGIC);
    const zip = await JSZip.loadAsync(buffer);
    expect(zip.file('NoAuthor.docx')).not.toBeNull();
  });
});
