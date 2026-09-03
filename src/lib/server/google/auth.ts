import crypto from 'crypto';

export interface GoogleTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope?: string;
  idToken?: string;
}

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_OAUTH_SCOPE = 'https://www.googleapis.com/auth/drive.file openid email';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Returns true only when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are both
 * set to non-empty strings.
 */
export function isGoogleConfigured(): boolean {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  return (
    typeof clientId === 'string' &&
    clientId.length > 0 &&
    typeof clientSecret === 'string' &&
    clientSecret.length > 0
  );
}

/**
 * Builds the Google OAuth 2.0 consent screen URL. Requests offline access with
 * a consent prompt so a refresh token is issued on every authorization.
 */
export function buildGoogleAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    state,
    scope: GOOGLE_OAUTH_SCOPE,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Generates a cryptographically random OAuth state token (32 bytes, base64url).
 */
export function generateOauthState(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * POSTs a form-encoded grant request to the Google OAuth token endpoint.
 * Returns the parsed JSON body, or null when the request or response fails.
 */
async function requestTokenEndpoint(params: URLSearchParams): Promise<unknown> {
  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Maps a raw Google token endpoint JSON body onto GoogleTokenResponse.
 * Returns null when required fields are missing or malformed.
 */
function parseTokenResponse(data: unknown): GoogleTokenResponse | null {
  if (!isRecord(data)) {
    return null;
  }
  const { access_token, refresh_token, expires_in, scope, id_token } = data;
  if (typeof access_token !== 'string' || typeof expires_in !== 'number') {
    return null;
  }
  return {
    accessToken: access_token,
    refreshToken: typeof refresh_token === 'string' ? refresh_token : undefined,
    expiresIn: expires_in,
    scope: typeof scope === 'string' ? scope : undefined,
    idToken: typeof id_token === 'string' ? id_token : undefined,
  };
}

/**
 * Exchanges an OAuth authorization code for Google tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<GoogleTokenResponse> {
  const params = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const parsed = parseTokenResponse(await requestTokenEndpoint(params));
  if (!parsed) {
    throw new Error('Failed to exchange Google authorization code');
  }
  return parsed;
}

/**
 * Refreshes an access token using a stored refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  });

  const parsed = parseTokenResponse(await requestTokenEndpoint(params));
  if (!parsed) {
    throw new Error('Failed to refresh Google access token');
  }
  return parsed;
}

/**
 * Decodes the payload segment of a Google ID token (JWT) without verifying its
 * signature. Returns null on any malformed input.
 */
export function decodeIdTokenPayload(idToken: string): { sub: string; email?: string } | null {
  try {
    const segments = idToken.split('.');
    if (segments.length < 2) {
      return null;
    }
    let base64 = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const payload: unknown = JSON.parse(atob(base64));
    if (!isRecord(payload) || typeof payload.sub !== 'string') {
      return null;
    }
    return {
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
    };
  } catch {
    return null;
  }
}
