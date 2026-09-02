import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import {
  SESSION_COOKIE_NAME,
  validateSessionToken,
  setSessionTokenCookie,
  deleteSessionTokenCookie,
} from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get(SESSION_COOKIE_NAME);

  if (!token) {
    event.locals.user = null;
    event.locals.session = null;
  } else {
    const { session, user } = await validateSessionToken(token);

    if (session !== null && user !== null) {
      setSessionTokenCookie(event, token, session.expiresAt);
      event.locals.session = session;
      event.locals.user = user;
    } else {
      deleteSessionTokenCookie(event);
      event.locals.session = null;
      event.locals.user = null;
    }
  }

  const pathname = event.url.pathname;

  // Route protection for API routes
  if (pathname.startsWith('/api') && !pathname.startsWith('/api/health')) {
    if (!event.locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Route protection for authenticated app views
  if (pathname.startsWith('/notes') || pathname.startsWith('/tags') || pathname.startsWith('/settings')) {
    if (!event.locals.user) {
      throw redirect(302, '/login');
    }
  }

  // Redirect already authenticated users away from login/register pages
  if (pathname === '/login' || pathname === '/register') {
    if (event.locals.user) {
      throw redirect(302, '/');
    }
  }

  return resolve(event);
};
