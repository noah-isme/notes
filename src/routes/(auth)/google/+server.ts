import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  isGoogleConfigured,
  buildGoogleAuthUrl,
  generateOauthState,
} from '$lib/server/google/auth';

export const GET: RequestHandler = async ({ locals, url, cookies }) => {
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  if (!isGoogleConfigured()) {
    return json({ error: 'Google OAuth is not configured' }, { status: 503 });
  }

  const state = generateOauthState();
  const redirectUri = `${url.origin}/google/callback`;

  cookies.set('google_oauth_state', state, {
    httpOnly: true,
    path: '/',
    maxAge: 600,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
  });

  const authUrl = buildGoogleAuthUrl(state, redirectUri);
  throw redirect(302, authUrl);
};
