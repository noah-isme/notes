import { describe, it, expect, beforeEach } from 'vitest';
import * as authService from '$lib/server/auth';
import { handle } from '../../src/hooks.server';
import { db } from '$lib/server/db';
import { users, sessions } from '$lib/server/db/schema';
import { cleanDatabase, createTestUser, createTestSession } from '../helpers/db';
import { generateTestEmail } from '../helpers/fixtures';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Helper to construct a mock SvelteKit RequestEvent for hooks testing.
 */
function createMockEvent(options: {
  pathname: string;
  cookies?: Record<string, string>;
  method?: string;
}) {
  const cookieStore: Record<string, { value: string; opts?: any }> = {};
  if (options.cookies) {
    for (const [k, v] of Object.entries(options.cookies)) {
      cookieStore[k] = { value: v };
    }
  }

  const deletedCookies: string[] = [];
  const setCookies: Record<string, { value: string; opts?: any }> = {};

  const url = new URL(`http://localhost:5173${options.pathname}`);

  const event: any = {
    url,
    request: new Request(url.toString(), {
      method: options.method || 'GET',
    }),
    cookies: {
      get: (name: string) => cookieStore[name]?.value,
      set: (name: string, value: string, opts?: any) => {
        cookieStore[name] = { value, opts };
        setCookies[name] = { value, opts };
      },
      delete: (name: string, opts?: any) => {
        delete cookieStore[name];
        deletedCookies.push(name);
      },
      getAll: () => Object.entries(cookieStore).map(([name, { value }]) => ({ name, value })),
    },
    locals: {
      user: null,
      session: null,
    },
    isDataRequest: false,
    isSubRequest: false,
    route: { id: options.pathname },
    params: {},
    platform: {},
    setHeaders: () => {},
    getClientAddress: () => '127.0.0.1',
    fetch: globalThis.fetch,
  };

  const resolve = async (evt: RequestEvent) => {
    return new Response('OK', { status: 200 });
  };

  return { event, resolve, deletedCookies, setCookies };
}

describe('Challenger M2: Session Isolation & Route Guard Empirical Suite', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  // =========================================================================
  // 1. Multi-Session Handling & Multi-Device Invalidation
  // =========================================================================
  describe('Multi-Session Handling & Invalidation', () => {
    it('CH-01: should support multiple concurrent sessions across different devices for a single user', async () => {
      const { user } = await createTestUser();
      const sessionCount = 5;
      const deviceSessions: { token: string; session: any }[] = [];

      for (let i = 0; i < sessionCount; i++) {
        const token = authService.generateSessionToken();
        const session = await authService.createSession(token, user.id);
        deviceSessions.push({ token, session });
      }

      // Verify all 5 sessions exist in DB for this user
      const dbSessions = await db.select().from(sessions).where(eq(sessions.userId, user.id));
      expect(dbSessions.length).toBe(sessionCount);

      // Verify each individual token validates independently to the same user
      for (const dev of deviceSessions) {
        const validation = await authService.validateSessionToken(dev.token);
        expect(validation.session).not.toBeNull();
        expect(validation.session?.id).toBe(dev.session.id);
        expect(validation.user).not.toBeNull();
        expect(validation.user?.id).toBe(user.id);
        expect(validation.user?.email).toBe(user.email);
      }
    });

    it('CH-02: should invalidate only the targeted session upon single-device logout, leaving other device sessions active', async () => {
      const { user } = await createTestUser();
      const mobileToken = authService.generateSessionToken();
      const mobileSession = await authService.createSession(mobileToken, user.id);

      const laptopToken = authService.generateSessionToken();
      const laptopSession = await authService.createSession(laptopToken, user.id);

      const tabletToken = authService.generateSessionToken();
      const tabletSession = await authService.createSession(tabletToken, user.id);

      // Invalidate only the mobile session
      await authService.invalidateSession(mobileSession.id);

      // Mobile token must be invalid
      const mobileVal = await authService.validateSessionToken(mobileToken);
      expect(mobileVal.session).toBeNull();
      expect(mobileVal.user).toBeNull();

      // Laptop and Tablet tokens must remain completely valid
      const laptopVal = await authService.validateSessionToken(laptopToken);
      expect(laptopVal.session).not.toBeNull();
      expect(laptopVal.user?.id).toBe(user.id);

      const tabletVal = await authService.validateSessionToken(tabletToken);
      expect(tabletVal.session).not.toBeNull();
      expect(tabletVal.user?.id).toBe(user.id);

      // Verify DB count is now 2
      const remainingSessions = await db.select().from(sessions).where(eq(sessions.userId, user.id));
      expect(remainingSessions.length).toBe(2);
      expect(remainingSessions.map((s) => s.id).sort()).toEqual(
        [laptopSession.id, tabletSession.id].sort()
      );
    });

    it('CH-03: should invalidate all active sessions for a user across all devices upon multi-device logout', async () => {
      const { user: targetUser } = await createTestUser({ email: 'target@device.com' });
      const { user: otherUser } = await createTestUser({ email: 'other@device.com' });

      // Target user creates 3 sessions
      const targetTokens = [
        authService.generateSessionToken(),
        authService.generateSessionToken(),
        authService.generateSessionToken(),
      ];
      for (const t of targetTokens) {
        await authService.createSession(t, targetUser.id);
      }

      // Other user creates 2 sessions
      const otherTokens = [
        authService.generateSessionToken(),
        authService.generateSessionToken(),
      ];
      for (const t of otherTokens) {
        await authService.createSession(t, otherUser.id);
      }

      // Invalidate all sessions for targetUser
      await authService.invalidateUserSessions(targetUser.id);

      // Verify all targetUser sessions are purged
      const targetDbSessions = await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, targetUser.id));
      expect(targetDbSessions.length).toBe(0);

      for (const t of targetTokens) {
        const val = await authService.validateSessionToken(t);
        expect(val.session).toBeNull();
        expect(val.user).toBeNull();
      }

      // Verify otherUser sessions are completely unaffected
      const otherDbSessions = await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, otherUser.id));
      expect(otherDbSessions.length).toBe(2);

      for (const t of otherTokens) {
        const val = await authService.validateSessionToken(t);
        expect(val.session).not.toBeNull();
        expect(val.user?.id).toBe(otherUser.id);
      }
    });
  });

  // =========================================================================
  // 2. Protected Route Guards & Hooks Behavior
  // =========================================================================
  describe('Protected Route Guards & Request Interception', () => {
    it('CH-04: should block unauthenticated requests to protected /api/* endpoints with HTTP 401 JSON', async () => {
      const protectedApiRoutes = [
        '/api/notes',
        '/api/notes/12345',
        '/api/tags',
        '/api/auth/me',
        '/api/settings',
        '/api/v1/notes',
      ];

      for (const pathname of protectedApiRoutes) {
        const { event, resolve } = createMockEvent({ pathname });
        const response = await handle({ event, resolve });

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body).toEqual({ error: 'Unauthorized' });
      }
    });

    it('CH-05: should redirect unauthenticated requests to protected app views (/notes, /tags, /settings) with HTTP 302 to /login', async () => {
      const protectedAppRoutes = [
        '/notes',
        '/notes/new',
        '/notes/00000000-0000-0000-0000-000000000000',
        '/tags',
        '/tags/work',
        '/settings',
        '/settings/profile',
      ];

      for (const pathname of protectedAppRoutes) {
        const { event, resolve } = createMockEvent({ pathname });

        let redirected = false;
        try {
          await handle({ event, resolve });
        } catch (err: any) {
          if (err?.status === 302 && err?.location === '/login') {
            redirected = true;
          }
        }
        expect(redirected).toBe(true);
      }
    });

    it('CH-06: should allow unauthenticated access to public routes (/, /login, /register, /api/health)', async () => {
      const publicRoutes = ['/', '/login', '/register', '/api/health'];

      for (const pathname of publicRoutes) {
        const { event, resolve } = createMockEvent({ pathname });
        const response = await handle({ event, resolve });

        expect(response.status).toBe(200);
        expect(event.locals.user).toBeNull();
        expect(event.locals.session).toBeNull();
      }
    });

    it('CH-07: should redirect already authenticated users accessing /login or /register with HTTP 302 to /', async () => {
      const { user } = await createTestUser();
      const token = authService.generateSessionToken();
      await authService.createSession(token, user.id);

      for (const pathname of ['/login', '/register']) {
        const { event, resolve } = createMockEvent({
          pathname,
          cookies: { [authService.SESSION_COOKIE_NAME]: token },
        });

        let redirected = false;
        try {
          await handle({ event, resolve });
        } catch (err: any) {
          if (err?.status === 302 && err?.location === '/') {
            redirected = true;
          }
        }
        expect(redirected).toBe(true);
      }
    });

    it('CH-08: should allow authenticated users to access protected routes and populate locals.user and locals.session', async () => {
      const { user } = await createTestUser();
      const token = authService.generateSessionToken();
      const session = await authService.createSession(token, user.id);

      const protectedRoutes = ['/notes', '/tags', '/settings', '/api/notes'];

      for (const pathname of protectedRoutes) {
        const { event, resolve } = createMockEvent({
          pathname,
          cookies: { [authService.SESSION_COOKIE_NAME]: token },
        });

        const response = await handle({ event, resolve });
        expect(response.status).toBe(200);
        expect(event.locals.user).not.toBeNull();
        expect(event.locals.user.id).toBe(user.id);
        expect(event.locals.user.email).toBe(user.email);
        expect(event.locals.session).not.toBeNull();
        expect(event.locals.session.id).toBe(session.id);
      }
    });

    it('CH-09: should delete cookie and reject request when provided with invalid or forged session token', async () => {
      const forgedToken = crypto.randomBytes(32).toString('hex');
      const { event, resolve, deletedCookies } = createMockEvent({
        pathname: '/notes',
        cookies: { [authService.SESSION_COOKIE_NAME]: forgedToken },
      });

      let redirected = false;
      try {
        await handle({ event, resolve });
      } catch (err: any) {
        if (err?.status === 302 && err?.location === '/login') {
          redirected = true;
        }
      }

      expect(redirected).toBe(true);
      expect(deletedCookies).toContain(authService.SESSION_COOKIE_NAME);
      expect(event.locals.user).toBeNull();
      expect(event.locals.session).toBeNull();
    });

    it('CH-10: should delete cookie, purge DB row, and reject request when session is expired', async () => {
      const { user } = await createTestUser();
      const expiredDate = new Date(Date.now() - 1000 * 60 * 60 * 24); // 1 day ago
      const { token, session } = await createTestSession(user.id, expiredDate);

      const { event, resolve, deletedCookies } = createMockEvent({
        pathname: '/api/notes',
        cookies: { [authService.SESSION_COOKIE_NAME]: token },
      });

      const response = await handle({ event, resolve });
      expect(response.status).toBe(401);
      expect(deletedCookies).toContain(authService.SESSION_COOKIE_NAME);
      expect(event.locals.user).toBeNull();

      // Ensure purged from DB
      const [dbRow] = await db.select().from(sessions).where(eq(sessions.id, session.id));
      expect(dbRow).toBeUndefined();
    });
  });

  // =========================================================================
  // 3. Cross-User Session Isolation & Boundaries
  // =========================================================================
  describe('Cross-User Session Isolation', () => {
    it('CH-11: should guarantee that User A token resolves strictly to User A and never User B', async () => {
      const { user: userA } = await createTestUser({ email: 'user_a@iso.com' });
      const { user: userB } = await createTestUser({ email: 'user_b@iso.com' });

      const tokenA = authService.generateSessionToken();
      await authService.createSession(tokenA, userA.id);

      const tokenB = authService.generateSessionToken();
      await authService.createSession(tokenB, userB.id);

      const valA = await authService.validateSessionToken(tokenA);
      expect(valA.user?.id).toBe(userA.id);
      expect(valA.user?.email).toBe('user_a@iso.com');
      expect(valA.user?.id).not.toBe(userB.id);

      const valB = await authService.validateSessionToken(tokenB);
      expect(valB.user?.id).toBe(userB.id);
      expect(valB.user?.email).toBe('user_b@iso.com');
      expect(valB.user?.id).not.toBe(userA.id);
    });

    it('CH-12: should prevent session ID collision or token guessing', async () => {
      const { user } = await createTestUser();
      const token = authService.generateSessionToken();
      const session = await authService.createSession(token, user.id);

      // Attempt validation with the SHA-256 session.id directly instead of the raw token
      const attemptWithSessionId = await authService.validateSessionToken(session.id);
      expect(attemptWithSessionId.session).toBeNull();
      expect(attemptWithSessionId.user).toBeNull();

      // Attempt validation with slight modification of token (off by one byte)
      const tamperedToken =
        token.slice(0, -2) + (token.slice(-2) === 'aa' ? 'bb' : 'aa');
      const attemptWithTampered = await authService.validateSessionToken(tamperedToken);
      expect(attemptWithTampered.session).toBeNull();
      expect(attemptWithTampered.user).toBeNull();
    });

    it('CH-13: should ensure cascade delete on user removes all sessions without affecting other users', async () => {
      const { user: userA } = await createTestUser({ email: 'delete_a@iso.com' });
      const { user: userB } = await createTestUser({ email: 'stay_b@iso.com' });

      const sessionA1 = await createTestSession(userA.id);
      const sessionA2 = await createTestSession(userA.id);
      const sessionB1 = await createTestSession(userB.id);

      // Delete User A
      await db.delete(users).where(eq(users.id, userA.id));

      // User A sessions should be gone
      const remainingA = await db.select().from(sessions).where(eq(sessions.userId, userA.id));
      expect(remainingA.length).toBe(0);
      expect((await authService.validateSessionToken(sessionA1.token)).session).toBeNull();
      expect((await authService.validateSessionToken(sessionA2.token)).session).toBeNull();

      // User B session should be intact
      const remainingB = await db.select().from(sessions).where(eq(sessions.userId, userB.id));
      expect(remainingB.length).toBe(1);
      expect((await authService.validateSessionToken(sessionB1.token)).session).not.toBeNull();
      expect((await authService.validateSessionToken(sessionB1.token)).user?.id).toBe(userB.id);
    });
  });

  // =========================================================================
  // 4. Sliding Window Expiry & Token Security
  // =========================================================================
  describe('Sliding Window Expiry & Cryptographic Properties', () => {
    it('CH-14: should NOT update session expiry when more than 15 days remain', async () => {
      const { user } = await createTestUser();
      const initialExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 20); // 20 days
      const { token, session } = await createTestSession(user.id, initialExpiresAt);

      const val = await authService.validateSessionToken(token);
      expect(val.session).not.toBeNull();

      // DB expiresAt should be unchanged (within 1 second tolerance)
      const [dbSession] = await db.select().from(sessions).where(eq(sessions.id, session.id));
      expect(Math.abs(dbSession.expiresAt.getTime() - initialExpiresAt.getTime())).toBeLessThan(1000);
    });

    it('CH-15: should extend session expiry by 30 days when less than 15 days remain (sliding renewal)', async () => {
      const { user } = await createTestUser();
      const nearThresholdExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 10); // 10 days
      const { token, session } = await createTestSession(user.id, nearThresholdExpiresAt);

      const val = await authService.validateSessionToken(token);
      expect(val.session).not.toBeNull();

      // Should be extended to ~30 days from now
      const [dbSession] = await db.select().from(sessions).where(eq(sessions.id, session.id));
      const expectedMinExpires = Date.now() + 1000 * 60 * 60 * 24 * 29; // at least 29 days
      expect(dbSession.expiresAt.getTime()).toBeGreaterThan(expectedMinExpires);
    });

    it('CH-16: should verify tokens are hashed in DB using SHA-256 and raw token is not stored', async () => {
      const { user } = await createTestUser();
      const token = authService.generateSessionToken();
      const session = await authService.createSession(token, user.id);

      const expectedDigest = crypto.createHash('sha256').update(token).digest('hex');
      expect(session.id).toBe(expectedDigest);
      expect(session.id).not.toBe(token);

      const [dbSession] = await db.select().from(sessions).where(eq(sessions.id, expectedDigest));
      expect(dbSession).toBeDefined();
    });

    it('CH-17: should handle adversarial/malformed token inputs without uncaught exceptions', async () => {
      const adversarialInputs = [
        '',
        '   ',
        'null',
        'undefined',
        'invalid-non-hex-token!@#$%^&*()',
        'a'.repeat(100000), // Huge string
        '0'.repeat(63), // 63 chars (short)
        '0'.repeat(65), // 65 chars (long)
        "'; DROP TABLE sessions; --",
        '{"id": "admin"}',
        null as any,
        undefined as any,
        12345 as any,
        {} as any,
        [] as any,
      ];

      for (const input of adversarialInputs) {
        const val = await authService.validateSessionToken(input);
        expect(val.session).toBeNull();
        expect(val.user).toBeNull();
      }
    });

    it('CH-18: should handle adversarial password verification inputs without crashing', async () => {
      const adversarialHashes = [
        '',
        'invalidhash',
        'salt_without_colon',
        'salt:with:three:colons',
        'nothex_salt:nothex_key',
        ':empty_salt',
        'empty_key:',
        '00:ff', // Length mismatch
        null as any,
        undefined as any,
        123 as any,
        {} as any,
      ];

      for (const hash of adversarialHashes) {
        const result = await authService.verifyPassword('TestPass123!', hash);
        expect(result).toBe(false);
      }
    });
  });

  // =========================================================================
  // 5. Concurrency & Stress Scenarios
  // =========================================================================
  describe('Concurrency & Stress Tests', () => {
    it('CH-19: should handle 25 concurrent session creations and validations for the same user', async () => {
      const { user } = await createTestUser();
      const concurrency = 25;

      // Concurrent session creation
      const tokens = Array.from({ length: concurrency }, () => authService.generateSessionToken());
      const sessionPromises = tokens.map((token) => authService.createSession(token, user.id));
      const createdSessions = await Promise.all(sessionPromises);

      expect(createdSessions.length).toBe(concurrency);

      // Verify all exist in DB
      const dbRows = await db.select().from(sessions).where(eq(sessions.userId, user.id));
      expect(dbRows.length).toBe(concurrency);

      // Concurrent validation
      const validationPromises = tokens.map((token) => authService.validateSessionToken(token));
      const validationResults = await Promise.all(validationPromises);

      for (const val of validationResults) {
        expect(val.session).not.toBeNull();
        expect(val.user?.id).toBe(user.id);
      }
    });

    it('CH-20: should handle concurrent multi-device invalidation and validation without deadlocks', async () => {
      const { user } = await createTestUser();
      const tokens = Array.from({ length: 10 }, () => authService.generateSessionToken());
      await Promise.all(tokens.map((token) => authService.createSession(token, user.id)));

      // Trigger concurrent invalidation and validation
      await Promise.all([
        authService.invalidateUserSessions(user.id),
        ...tokens.map((token) => authService.validateSessionToken(token)),
      ]);

      // Verify DB is clean
      const remaining = await db.select().from(sessions).where(eq(sessions.userId, user.id));
      expect(remaining.length).toBe(0);
    });
  });
});
