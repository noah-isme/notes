import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getNotes, createNote } from '$lib/server/notes';
import { validateNoteInput } from '$lib/utils/validation';

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const search = url.searchParams.get('search') || undefined;
  const tagId = url.searchParams.get('tagId') || undefined;
  const isPinnedParam = url.searchParams.get('isPinned');
  const isPinned =
    isPinnedParam === 'true' ? true : isPinnedParam === 'false' ? false : undefined;

  try {
    const notes = await getNotes(locals.user.id, { search, tagId, isPinned });
    return json(notes, { status: 200 });
  } catch (err: any) {
    return json({ error: err?.message || 'Failed to fetch notes' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
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

  const title = body.title;
  const content = typeof body.content === 'string' ? body.content : '';
  const isPinned = typeof body.isPinned === 'boolean' ? body.isPinned : false;

  if (!validateNoteInput({ title, content })) {
    return json(
      { error: 'Title is required and must be between 1 and 200 characters' },
      { status: 400 }
    );
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
    const note = await createNote(locals.user.id, {
      title,
      content,
      isPinned,
      tagNames: body.tagNames,
    });
    return json(note, { status: 201 });
  } catch (err: any) {
    return json({ error: err?.message || 'Failed to create note' }, { status: 400 });
  }
};
