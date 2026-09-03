import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getNotes } from '$lib/server/notes';
import type { BatchExportFormat, BatchExportNote } from '$lib/server/export/batch';
import { buildNotesZip } from '$lib/server/export/batch';

const SUPPORTED_FORMATS: readonly string[] = ['docx', 'doc', 'html'];

const MAX_NOTES_PER_EXPORT = 200;

function isBatchExportFormat(value: unknown): value is BatchExportFormat {
  return typeof value === 'string' && SUPPORTED_FORMATS.includes(value);
}

function parseNoteIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_NOTES_PER_EXPORT) {
    return null;
  }
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.length === 0) {
      return null;
    }
    ids.push(item);
  }
  return ids;
}

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  if (body === null) {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body !== 'object') {
    return json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { format, noteIds } = body as Record<string, unknown>;

  if (!isBatchExportFormat(format)) {
    return json(
      { error: 'Unsupported format. Supported: docx, doc, html' },
      { status: 400 }
    );
  }

  const requestedIds = parseNoteIds(noteIds);
  if (requestedIds === null) {
    return json(
      { error: 'noteIds must be an array of 1-200 note IDs' },
      { status: 400 }
    );
  }

  let matched: BatchExportNote[] = [];
  try {
    const userNotes = await getNotes(locals.user.id);
    const byRequestOrder = new Map(userNotes.map((note) => [note.id, note]));
    matched = Array.from(new Set(requestedIds)).flatMap((id) => {
      const note = byRequestOrder.get(id);
      return note ? [note] : [];
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch notes';
    return json({ error: message }, { status: 500 });
  }

  if (matched.length === 0) {
    return json({ error: 'No notes found' }, { status: 404 });
  }

  try {
    const { buffer } = await buildNotesZip(
      matched,
      format,
      locals.user.name ?? locals.user.email
    );

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="notes-export-${matched.length}-notes.zip"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to build export archive';
    return json({ error: message }, { status: 500 });
  }
};
