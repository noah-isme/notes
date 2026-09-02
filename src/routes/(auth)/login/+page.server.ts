import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import {
  verifyPassword,
  generateSessionToken,
  createSession,
  setSessionTokenCookie,
} from '$lib/server/auth';
import { validateEmail } from '$lib/utils/validation';

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) {
    throw redirect(302, '/');
  }
  return {};
};

export const actions: Actions = {
  default: async (event) => {
    const formData = await event.request.formData();
    const email = formData.get('email');
    const password = formData.get('password');

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email ||
      !password ||
      !validateEmail(email)
    ) {
      return fail(400, {
        email: typeof email === 'string' ? email : '',
        error: 'Invalid email or password.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail));

    if (!user) {
      return fail(400, {
        email,
        error: 'Invalid email or password.',
      });
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return fail(400, {
        email,
        error: 'Invalid email or password.',
      });
    }

    const token = generateSessionToken();
    const session = await createSession(token, user.id);
    setSessionTokenCookie(event, token, session.expiresAt);

    throw redirect(303, '/');
  },
};
