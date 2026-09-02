import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import {
  hashPassword,
  generateSessionToken,
  createSession,
  setSessionTokenCookie,
} from '$lib/server/auth';
import { validateEmail, validatePassword } from '$lib/utils/validation';
import { checkRateLimit, extractClientIp, resetRateLimit } from '$lib/server/rateLimit';

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) {
    throw redirect(302, '/');
  }
  return {};
};

export const actions: Actions = {
  default: async (event) => {
    const ip = extractClientIp(event.request, event.getClientAddress);
    const rateLimit = checkRateLimit(`register:${ip}`, 5, 60000);

    if (!rateLimit.allowed) {
      return fail(429, {
        email: '',
        error: `Too many registration attempts. Please try again in ${rateLimit.retryAfterSec} seconds.`,
      });
    }

    const formData = await event.request.formData();
    const email = formData.get('email');
    const password = formData.get('password');

    if (typeof email !== 'string' || !validateEmail(email)) {
      return fail(400, {
        email: typeof email === 'string' ? email : '',
        error: 'Please enter a valid email address.',
      });
    }

    if (typeof password !== 'string' || !validatePassword(password)) {
      return fail(400, {
        email,
        error: 'Password must be at least 6 characters long.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check duplicate email
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail));

    if (existingUser) {
      return fail(400, {
        email,
        error: 'An account with this email address already exists.',
      });
    }

    const passwordHash = await hashPassword(password);

    const [newUser] = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        passwordHash,
      })
      .returning();

    resetRateLimit(`register:${ip}`);

    // Automatically issue session and log user in
    const token = generateSessionToken();
    const session = await createSession(token, newUser.id);
    setSessionTokenCookie(event, token, session.expiresAt);

    throw redirect(303, '/');
  },
};
