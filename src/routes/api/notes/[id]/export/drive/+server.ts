import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getNoteById } from '$lib/server/notes';
import { noteToDocxBuffer } from '$lib/server/export/render-docx';
import { noteToCleanHtml } from '$lib/server/export/render-html';
import { isGoogleConfigured } from '$lib/server/google/auth';
import { getValidAccessToken } from '$lib/server/google/connection';
import { uploadFileToDrive } from '$lib/server/google/drive';

/**
 * Sanitizes a note title into a safe Drive upload filename.
 */
function buildFilename(title: string, extension: string): string {
  const base =
    title
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100) || 'note';

  return `${base}.${extension}`;
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  const body: unknown = await request.json().catch(() => null);
  if (body === null) {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const bodyFormat: unknown =
    typeof body === 'object' && body !== null && 'format' in body
      ? body.format
      : undefined;
  if (bodyFormat !== undefined && typeof bodyFormat !== 'string') {
    return json({ error: 'Unsupported format. Supported: docx, html' }, { status: 400 });
  }

  const format = typeof bodyFormat === 'string' ? bodyFormat : 'docx';
  if (format !== 'docx' && format !== 'html') {
    return json({ error: 'Unsupported format. Supported: docx, html' }, { status: 400 });
  }

  try {
    const note = await getNoteById(locals.user.id, id);
    if (!note) {
      return json({ error: 'Note not found' }, { status: 404 });
    }

    if (!isGoogleConfigured()) {
      return json(
        {
          error: 'Google Drive is not configured on this server',
          code: 'google_not_configured',
        },
        { status: 503 }
      );
    }

    const accessToken = await getValidAccessToken(locals.user.id);
    if (!accessToken) {
      return json(
        {
          error: 'Google account not connected',
          code: 'google_not_connected',
        },
        { status: 400 }
      );
    }

    let mimeType: string;
    let content: Uint8Array;
    if (format === 'docx') {
      const buffer = await noteToDocxBuffer(note.content, {
        title: note.title,
        author: locals.user.name ?? locals.user.email,
        tags: note.tags,
        updatedAt: note.updatedAt,
      });
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      content = new Uint8Array(buffer);
    } else {
      const html = noteToCleanHtml(note.content, {
        title: note.title,
        tags: note.tags,
        updatedAt: note.updatedAt,
      });
      mimeType = 'text/html';
      content = new TextEncoder().encode(html);
    }

    const filename = buildFilename(note.title, format);

    try {
      const result = await uploadFileToDrive(accessToken, filename, mimeType, content);
      return json({ fileId: result.id, link: result.webViewLink }, { status: 200 });
    } catch {
      return json({ error: 'Google Drive upload failed' }, { status: 502 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to export note to Google Drive';
    return json({ error: message }, { status: 500 });
  }
};
