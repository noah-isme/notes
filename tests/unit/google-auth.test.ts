import { describe, it, expect, vi, afterEach } from 'vitest';

const authModule = await import('$lib/server/google/auth');
const {
  isGoogleConfigured,
  buildGoogleAuthUrl,
  generateOauthState,
  decodeIdTokenPayload,
  exchangeCodeForTokens,
  refreshAccessToken,
} = authModule as {
  isGoogleConfigured: () => boolean;
  buildGoogleAuthUrl: (state: string, redirectUri: string) => string;
  generateOauthState: () => string;
  decodeIdTokenPayload: (idToken: string) => { sub: string; email?: string } | null;
  exchangeCodeForTokens: (code: string, redirectUri: string) => Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
    scope?: string;
    idToken?: string;
  }>;
  refreshAccessToken: (refreshToken: string) => Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
  }>;
};

function base64url(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function makeIdToken(payload: object): string {
  return `${base64url(JSON.stringify({ alg: 'RS256', kid: 'test' }))}.${base64url(
    JSON.stringify(payload)
  )}.${base64url('signature')}`;
}

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

describe('Unit: Google OAuth Auth Helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  describe('isGoogleConfigured', () => {
    it('returns true when both client id and secret are set', () => {
      vi.stubEnv('GOOGLE_CLIENT_ID', 'client-id-123');
      vi.stubEnv('GOOGLE_CLIENT_SECRET', 'client-secret-456');
      expect(isGoogleConfigured()).toBe(true);
    });

    it('returns false when either value is missing', () => {
      vi.stubEnv('GOOGLE_CLIENT_ID', 'client-id-123');
      vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
      expect(isGoogleConfigured()).toBe(false);

      vi.stubEnv('GOOGLE_CLIENT_ID', '');
      vi.stubEnv('GOOGLE_CLIENT_SECRET', 'client-secret-456');
      expect(isGoogleConfigured()).toBe(false);
    });

    it('returns false when both are missing', () => {
      vi.stubEnv('GOOGLE_CLIENT_ID', '');
      vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
      expect(isGoogleConfigured()).toBe(false);
    });
  });

  describe('buildGoogleAuthUrl', () => {
    it('contains all required OAuth parameters', () => {
      const url = new URL(
        buildGoogleAuthUrl('state-token', 'http://localhost:5173/google/callback')
      );
      expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('access_type')).toBe('offline');
      expect(url.searchParams.get('prompt')).toBe('consent');
      expect(url.searchParams.get('state')).toBe('state-token');
      expect(url.searchParams.get('redirect_uri')).toBe(
        'http://localhost:5173/google/callback'
      );
    });

    it('requests the drive.file and identity scopes', () => {
      const url = new URL(
        buildGoogleAuthUrl('s', 'http://localhost:5173/google/callback')
      );
      const scope = url.searchParams.get('scope') ?? '';
      expect(scope).toContain('https://www.googleapis.com/auth/drive.file');
      expect(scope).toContain('openid');
      expect(scope).toContain('email');
    });

    it('includes client id when configured', () => {
      vi.stubEnv('GOOGLE_CLIENT_ID', 'my-client-id');
      const url = new URL(buildGoogleAuthUrl('s', 'http://x/google/callback'));
      expect(url.searchParams.get('client_id')).toBe('my-client-id');
    });
  });

  describe('generateOauthState', () => {
    it('produces URL-safe, sufficiently long, unique values', () => {
      const a = generateOauthState();
      const b = generateOauthState();
      expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(a.length).toBeGreaterThanOrEqual(32);
      expect(a).not.toBe(b);
    });
  });

  describe('decodeIdTokenPayload', () => {
    it('decodes a valid JWT payload', () => {
      const token = makeIdToken({ sub: 'google-sub-123', email: 'user@gmail.com' });
      expect(decodeIdTokenPayload(token)).toEqual({
        sub: 'google-sub-123',
        email: 'user@gmail.com',
      });
    });

    it('decodes without email claim', () => {
      const token = makeIdToken({ sub: 'google-sub-123' });
      expect(decodeIdTokenPayload(token)).toEqual({ sub: 'google-sub-123' });
    });

    it('returns null for malformed tokens', () => {
      expect(decodeIdTokenPayload('not-a-jwt')).toBeNull();
      expect(decodeIdTokenPayload('')).toBeNull();
      expect(decodeIdTokenPayload('a.b')).toBeNull();
      expect(decodeIdTokenPayload(`a.${base64url('not json')}.c`)).toBeNull();
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('exchanges a code for tokens', async () => {
      const fetchMock = mockFetch(200, {
        access_token: 'at-123',
        refresh_token: 'rt-456',
        expires_in: 3600,
        scope: 'drive.file openid email',
        id_token: 'header.payload.signature',
      });
      vi.stubGlobal('fetch', fetchMock);

      const tokens = await exchangeCodeForTokens('auth-code', 'http://x/google/callback');
      expect(tokens.accessToken).toBe('at-123');
      expect(tokens.refreshToken).toBe('rt-456');
      expect(tokens.expiresIn).toBe(3600);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(String(url)).toBe('https://oauth2.googleapis.com/token');
      const body = String(init.body);
      expect(body).toContain('grant_type=authorization_code');
      expect(body).toContain('code=auth-code');
    });

    it('throws on non-OK responses', async () => {
      vi.stubGlobal('fetch', mockFetch(400, { error: 'invalid_grant' }));
      await expect(
        exchangeCodeForTokens('bad-code', 'http://x/google/callback')
      ).rejects.toThrow('Failed to exchange Google authorization code');
    });
  });

  describe('refreshAccessToken', () => {
    it('refreshes using the refresh token grant', async () => {
      const fetchMock = mockFetch(200, {
        access_token: 'new-at',
        expires_in: 3600,
      });
      vi.stubGlobal('fetch', fetchMock);

      const tokens = await refreshAccessToken('rt-456');
      expect(tokens.accessToken).toBe('new-at');
      expect(tokens.expiresIn).toBe(3600);

      const body = String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body);
      expect(body).toContain('grant_type=refresh_token');
      expect(body).toContain('refresh_token=rt-456');
    });

    it('throws on non-OK responses', async () => {
      vi.stubGlobal('fetch', mockFetch(401, { error: 'invalid_grant' }));
      await expect(refreshAccessToken('stale-token')).rejects.toThrow(
        'Failed to refresh Google access token'
      );
    });
  });
});
