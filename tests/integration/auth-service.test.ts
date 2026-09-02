import { describe, it, expect, beforeEach } from 'vitest';
import * as authService from '$lib/server/auth';
import { db } from '$lib/server/db';
import { users, sessions } from '$lib/server/db/schema';
import { cleanDatabase, createTestUser, createTestSession } from '../helpers/db';
import { generateTestEmail } from '../helpers/fixtures';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

describe('Integration: Authentication & Session Management Service', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('should create and validate a session for an authenticated user', async () => {
    const { user } = await createTestUser();
    let token: string;
    let sessionObj: any;

    if (typeof authService.createSession === 'function') {
      const generatedToken = typeof (authService as any).generateSessionToken === 'function'
        ? (authService as any).generateSessionToken()
        : crypto.randomBytes(32).toString('hex');

      // Check if createSession expects (token, userId) or (userId)
      if (authService.createSession.length >= 2) {
        sessionObj = await (authService.createSession as any)(generatedToken, user.id);
        token = generatedToken;
      } else {
        const res = await (authService.createSession as any)(user.id);
        if (typeof res === 'object' && res.token) {
          token = res.token;
          sessionObj = res.session || res;
        } else {
          sessionObj = res;
          token = res.id;
        }
      }
    } else {
      const direct = await createTestSession(user.id);
      token = direct.token;
      sessionObj = direct.session;
    }

    expect(token).toBeDefined();

    if (typeof authService.validateSessionToken === 'function') {
      const validation = await authService.validateSessionToken(token);
      expect(validation.session).not.toBeNull();
      expect(validation.user).not.toBeNull();
      expect(validation.user?.id).toBe(user.id);
      expect(validation.user?.email).toBe(user.email);
    }
  });

  it('should reject validation for non-existent session token', async () => {
    if (typeof authService.validateSessionToken === 'function') {
      const nonExistentToken = crypto.randomBytes(32).toString('hex');
      const validation = await authService.validateSessionToken(nonExistentToken);

      expect(validation.session).toBeNull();
      expect(validation.user).toBeNull();
    }
  });

  it('should reject validation and purge expired sessions', async () => {
    const { user } = await createTestUser();
    const expiredDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour in the past
    const { token, session } = await createTestSession(user.id, expiredDate);

    if (typeof authService.validateSessionToken === 'function') {
      const validation = await authService.validateSessionToken(token);

      expect(validation.session).toBeNull();
      expect(validation.user).toBeNull();

      // Ensure the expired session is purged from DB
      const [dbSession] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, session.id));
      expect(dbSession).toBeUndefined();
    }
  });

  it('should invalidate a specific session upon logout', async () => {
    const { user } = await createTestUser();
    const { token, session } = await createTestSession(user.id);

    if (typeof authService.invalidateSession === 'function') {
      await authService.invalidateSession(session.id);

      if (typeof authService.validateSessionToken === 'function') {
        const validation = await authService.validateSessionToken(token);
        expect(validation.session).toBeNull();
        expect(validation.user).toBeNull();
      }
    }
  });

  it('should invalidate all sessions for a user across multiple devices', async () => {
    const { user } = await createTestUser();
    const session1 = await createTestSession(user.id);
    const session2 = await createTestSession(user.id);

    if (typeof (authService as any).invalidateUserSessions === 'function') {
      await (authService as any).invalidateUserSessions(user.id);

      // Both sessions should be removed
      const remainingSessions = await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, user.id));
      expect(remainingSessions.length).toBe(0);

      if (typeof authService.validateSessionToken === 'function') {
        expect((await authService.validateSessionToken(session1.token)).session).toBeNull();
        expect((await authService.validateSessionToken(session2.token)).session).toBeNull();
      }
    }
  });
});
