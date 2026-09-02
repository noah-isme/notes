import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import * as notesService from '$lib/server/notes';
import { validateNoteInput } from '$lib/utils/validation';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) {
    throw redirect(302, '/login');
  }

  const search = url.searchParams.get('search') || undefined;
  const tagId = url.searchParams.get('tagId') || undefined;
  const isPinnedParam = url.searchParams.get('isPinned');
  const isPinned =
    isPinnedParam === 'true' ? true : isPinnedParam === 'false' ? false : undefined;

  const [notesList, tagsList] = await Promise.all([
    notesService.getNotes(locals.user.id, { search, tagId, isPinned }),
    notesService.getUserTags(locals.user.id),
  ]);

  return {
    notes: notesList,
    tags: tagsList,
    filters: {
      search: search ?? '',
      tagId: tagId ?? '',
      isPinned,
    },
  };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { error: 'Unauthorized' });

    const formData = await request.formData();
    const title = formData.get('title')?.toString() ?? '';
    const content = formData.get('content')?.toString() ?? '';
    const isPinned =
      formData.get('isPinned') === 'true' || formData.get('isPinned') === 'on';
    const tagsRaw = formData.get('tags')?.toString() ?? '';

    if (!validateNoteInput({ title, content })) {
      return fail(400, {
        error: 'Title is required (1-200 characters)',
        values: { title, content, isPinned, tags: tagsRaw },
      });
    }

    const tagNames = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    try {
      const note = await notesService.createNote(locals.user.id, {
        title,
        content,
        isPinned,
        tagNames,
      });
      return { success: true, note };
    } catch (err: any) {
      return fail(500, { error: err?.message || 'Failed to create note' });
    }
  },

  update: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { error: 'Unauthorized' });

    const formData = await request.formData();
    const id = formData.get('id')?.toString();
    const title = formData.get('title')?.toString();
    const content = formData.get('content')?.toString();
    const isPinnedRaw = formData.get('isPinned');
    const isPinned =
      isPinnedRaw !== null ? isPinnedRaw === 'true' || isPinnedRaw === 'on' : undefined;
    const tagsRaw = formData.get('tags')?.toString();

    if (!id) return fail(400, { error: 'Note ID is required' });

    if (title !== undefined && !validateNoteInput({ title })) {
      return fail(400, { error: 'Title must be between 1 and 200 characters' });
    }

    const tagNames =
      tagsRaw !== undefined
        ? tagsRaw
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t.length > 0)
        : undefined;

    try {
      const updated = await notesService.updateNote(locals.user.id, id, {
        title,
        content,
        isPinned,
        tagNames,
      });
      if (!updated) return fail(404, { error: 'Note not found' });
      return { success: true, note: updated };
    } catch (err: any) {
      return fail(500, { error: err?.message || 'Failed to update note' });
    }
  },

  delete: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { error: 'Unauthorized' });

    const formData = await request.formData();
    const id = formData.get('id')?.toString();
    if (!id) return fail(400, { error: 'Note ID is required' });

    try {
      const deleted = await notesService.deleteNote(locals.user.id, id);
      if (!deleted) return fail(404, { error: 'Note not found' });
      return { success: true };
    } catch (err: any) {
      return fail(500, { error: err?.message || 'Failed to delete note' });
    }
  },

  togglePin: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { error: 'Unauthorized' });

    const formData = await request.formData();
    const id = formData.get('id')?.toString();
    const isPinned =
      formData.get('isPinned') === 'true' || formData.get('isPinned') === 'on';

    if (!id) return fail(400, { error: 'Note ID is required' });

    try {
      const updated = await notesService.updateNote(locals.user.id, id, { isPinned });
      if (!updated) return fail(404, { error: 'Note not found' });
      return { success: true, note: updated };
    } catch (err: any) {
      return fail(500, { error: err?.message || 'Failed to toggle pin' });
    }
  },
};
