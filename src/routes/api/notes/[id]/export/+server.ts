import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getNoteById } from '$lib/server/notes';
import { noteToDocxBuffer } from '$lib/server/export/render-docx';
import { noteToWordHtml, noteToCleanHtml } from '$lib/server/export/render-html';

const EXPORT_FORMATS = ['docx', 'doc', 'html'] as const;
type ExportFormat = (typeof EXPORT_FORMATS)[number];

const FORMAT_CONTENT_TYPES: Record<ExportFormat, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  html: 'text/html; charset=utf-8',
};

/**
 * Sanitizes a note title into a safe download filename
 * (ASCII-safe base name + RFC 5987 UTF-8 extended fallback).
 */
function buildContentDisposition(title: string, extension: string): string {
  const base =
    title
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100) || 'note';

  const asciiSafe = base.replace(/[^\x20-\x7e]/g, '').trim() || 'note';
  const utf8Encoded = encodeURIComponent(base);

  return `attachment; filename="${asciiSafe}.${extension}"; filename*=UTF-8''${utf8Encoded}.${extension}`;
}

export const GET: RequestHandler = async ({ locals, params, url }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return json({ error: 'Note ID is required' }, { status: 400 });
  }

  const format = (url.searchParams.get('format') ?? 'docx').toLowerCase();
  if (!EXPORT_FORMATS.includes(format as ExportFormat)) {
    return json(
      { error: `Unsupported format. Supported: ${EXPORT_FORMATS.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const note = await getNoteById(locals.user.id, id);
    if (!note) {
      return json({ error: 'Note not found' }, { status: 404 });
    }

    const exportFormat = format as ExportFormat;
    const disposition = buildContentDisposition(note.title, exportFormat);
    const headers = {
      'Content-Type': FORMAT_CONTENT_TYPES[exportFormat],
      'Content-Disposition': disposition,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    };

    if (exportFormat === 'docx') {
      const buffer = await noteToDocxBuffer(note.content, {
        title: note.title,
        author: locals.user.name ?? locals.user.email,
        tags: note.tags,
        updatedAt: note.updatedAt,
      });
      return new Response(new Uint8Array(buffer), { headers });
    }

    if (exportFormat === 'doc') {
      const html = noteToWordHtml(note.content, {
        title: note.title,
        tags: note.tags,
        updatedAt: note.updatedAt,
      });
      return new Response(html, { headers });
    }

    const html = noteToCleanHtml(note.content, {
      title: note.title,
      tags: note.tags,
      updatedAt: note.updatedAt,
    });
    return new Response(html, { headers });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to export note';
    return json({ error: message }, { status: 500 });
  }
};
