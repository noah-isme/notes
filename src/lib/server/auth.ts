import { db } from '$lib/server/db';
import { users, sessions, type User, type Session } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { promisify } from 'util';
import type { RequestEvent, Cookies } from '@sveltejs/kit';

const scryptAsync = promisify(crypto.scrypt);

export const SESSION_COOKIE_NAME = 'session';
export const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
export const SESSION_RENEWAL_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 15; // 15 days

export interface SessionValidationResult {
  session: Session | null;
  user: {
    id: string;
    email: string;
  } | null;
}

/**
 * Generates a salted hash for a plaintext password using crypto.scrypt.
 * Returns formatted string: `${salt}:${derivedKeyHex}`
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verifies a plaintext password against a stored salted hash using constant-time comparison.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!password || !storedHash || typeof password !== 'string' || typeof storedHash !== 'string') {
    return false;
  }

  const parts = storedHash.split(':');
  if (parts.length !== 2) {
    return false;
  }

  const [salt, keyHex] = parts;
  if (!salt || !keyHex || !/^[0-9a-fA-F]+$/.test(salt) || !/^[0-9a-fA-F]+$/.test(keyHex)) {
    return false;
  }

  try {
    const storedKeyBuffer = Buffer.from(keyHex, 'hex');
    const derivedKeyBuffer = (await scryptAsync(password, salt, storedKeyBuffer.length)) as Buffer;

    if (storedKeyBuffer.length !== derivedKeyBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(storedKeyBuffer, derivedKeyBuffer);
  } catch {
    return false;
  }
}

/**
 * Generates a cryptographically secure 32-byte session token (64 hex characters).
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Creates a new session in the database for a user using a given session token.
 * Stores the SHA-256 hash of the token as the session primary key.
 */
export async function createSession(token: string, userId: string): Promise<Session> {
  const sessionId = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  const [session] = await db
    .insert(sessions)
    .values({
      id: sessionId,
      userId,
      expiresAt,
    })
    .returning();

  return session;
}

/**
 * Validates a session token, handling expiration purge and sliding window renewal.
 */
export async function validateSessionToken(token: string): Promise<SessionValidationResult> {
  if (!token || typeof token !== 'string') {
    return { session: null, user: null };
  }

  const sessionId = crypto.createHash('sha256').update(token).digest('hex');

  const [result] = await db
    .select({
      user: {
        id: users.id,
        email: users.email,
      },
      session: sessions,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId));

  if (!result) {
    return { session: null, user: null };
  }

  const now = Date.now();
  if (now >= result.session.expiresAt.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, result.session.id));
    return { session: null, user: null };
  }

  // Sliding window renewal: extend expiry by 30 days if less than 15 days remain
  if (now >= result.session.expiresAt.getTime() - SESSION_RENEWAL_THRESHOLD_MS) {
    result.session.expiresAt = new Date(now + SESSION_DURATION_MS);
    await db
      .update(sessions)
      .set({ expiresAt: result.session.expiresAt })
      .where(eq(sessions.id, result.session.id));
  }

  return {
    session: result.session,
    user: result.user,
  };
}

/**
 * Invalidates a single session by its database session ID.
 */
export async function invalidateSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/**
 * Invalidates all active sessions for a specific user (global logout / multi-device).
 */
export async function invalidateUserSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * Sets the session token cookie on the response.
 */
export function setSessionTokenCookie(
  event: { cookies: Cookies } | RequestEvent,
  token: string,
  expiresAt: Date
): void {
  event.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  });
}

/**
 * Deletes the session token cookie.
 */
export function deleteSessionTokenCookie(event: { cookies: Cookies } | RequestEvent): void {
  event.cookies.delete(SESSION_COOKIE_NAME, {
    path: '/',
  });
}
