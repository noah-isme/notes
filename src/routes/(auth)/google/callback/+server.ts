import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exchangeCodeForTokens, decodeIdTokenPayload } from '$lib/server/google/auth';
import { saveGoogleConnection } from '$lib/server/google/connection';

export const GET: RequestHandler = async ({ locals, url, cookies }) => {
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = cookies.get('google_oauth_state');

  if (!code || !state || !storedState || state !== storedState) {
    cookies.delete('google_oauth_state', { path: '/' });
    throw redirect(303, '/?google_error=invalid_state');
  }

  cookies.delete('google_oauth_state', { path: '/' });

  let tokens: Awaited<ReturnType<typeof exchangeCodeForTokens>>;
  try {
    tokens = await exchangeCodeForTokens(code, `${url.origin}/google/callback`);
  } catch {
    throw redirect(303, '/?google_error=exchange_failed');
  }

  const identity = decodeIdTokenPayload(tokens.idToken ?? '');
  const googleSub = identity?.sub ?? 'unknown';
  const email = identity?.email ?? null;

  try {
    await saveGoogleConnection(locals.user.id, {
      googleSub,
      email,
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      refreshToken: tokens.refreshToken,
      scope: tokens.scope,
    });
  } catch {
    throw redirect(303, '/?google_error=save_failed');
  }

  throw redirect(303, '/');
};
