import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { invalidateSession, deleteSessionTokenCookie } from '$lib/server/auth';

export const load: PageServerLoad = async () => {
  throw redirect(302, '/');
};

export const actions: Actions = {
  default: async (event) => {
    if (event.locals.session) {
      await invalidateSession(event.locals.session.id);
    }
    deleteSessionTokenCookie(event);
    event.locals.user = null;
    event.locals.session = null;
    throw redirect(303, '/login');
  },
};
