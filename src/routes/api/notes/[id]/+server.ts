import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getNoteById, updateNote, deleteNote } from '$lib/server/notes';
import { validateNoteInput } from '$lib/utils/validation';

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return json({ error: 'Note ID is required' }, { status: 400 });
  }

  try {
    const note = await getNoteById(locals.user.id, id);
    if (!note) {
      return json({ error: 'Note not found' }, { status: 404 });
    }
    return json(note, { status: 200 });
  } catch (err: any) {
    return json({ error: err?.message || 'Failed to fetch note' }, { status: 500 });
  }
};

export const PUT: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return json({ error: 'Note ID is required' }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return json({ error: 'Request body must be a JSON object' }, { status: 400 });
  }

  if (body.title !== undefined) {
    if (!validateNoteInput({ title: body.title })) {
      return json(
        { error: 'Title must be between 1 and 200 characters' },
        { status: 400 }
      );
    }
  }

  if (body.tagNames !== undefined) {
    if (
      !Array.isArray(body.tagNames) ||
      body.tagNames.some((t: any) => typeof t !== 'string')
    ) {
      return json(
        { error: 'tagNames must be an array of strings' },
        { status: 400 }
      );
    }
  }

  try {
    const updated = await updateNote(locals.user.id, id, {
      title: body.title,
      content: typeof body.content === 'string' ? body.content : undefined,
      isPinned: typeof body.isPinned === 'boolean' ? body.isPinned : undefined,
      tagNames: body.tagNames,
    });

    if (!updated) {
      return json({ error: 'Note not found' }, { status: 404 });
    }

    return json(updated, { status: 200 });
  } catch (err: any) {
    return json({ error: err?.message || 'Failed to update note' }, { status: 400 });
  }
};

export const PATCH: RequestHandler = PUT;

export const DELETE: RequestHandler = async ({ locals, params }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return json({ error: 'Note ID is required' }, { status: 400 });
  }

  try {
    const deleted = await deleteNote(locals.user.id, id);
    if (!deleted) {
      return json({ error: 'Note not found' }, { status: 404 });
    }
    return json({ success: true }, { status: 200 });
  } catch (err: any) {
    return json({ error: err?.message || 'Failed to delete note' }, { status: 500 });
  }
};
