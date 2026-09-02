import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPublicNoteByToken } from '$lib/server/notes';

export const load: PageServerLoad = async ({ params }) => {
  const { token } = params;

  if (!token) {
    throw error(404, 'Note is private or not found');
  }

  const note = await getPublicNoteByToken(token);

  if (!note) {
    throw error(404, 'Note is private or not found');
  }

  return {
    note,
  };
};
