/**
 * Test Database Helper Utilities
 * Provides clean teardown, seeding, and database interaction for integration and E2E tests.
 */
import { db } from '$lib/server/db';
import { users, sessions, notes, tags, noteTags } from '$lib/server/db/schema';
import { hashPassword } from '$lib/server/auth';
import { generateTestEmail } from './fixtures';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Truncates all tables in the database to provide a fresh state for test suites.
 */
export async function cleanDatabase(): Promise<void> {
  try {
    await db.delete(users);
  } catch (error) {
    console.warn('Warning: cleanDatabase encountered an error during table cleanup:', error);
  }
}

/**
 * Helper to seed a test user with a known password.
 */
export async function createTestUser(override?: {
  email?: string;
  password?: string;
}) {
  const email = override?.email || generateTestEmail('user');
  const rawPassword = override?.password || 'TestPassword123!';
  const passwordHash = await hashPassword(rawPassword);

  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash
    })
    .returning();

  return {
    user,
    rawPassword
  };
}

/**
 * Helper to seed a direct database session for a user.
 */
export async function createTestSession(userId: string, customExpiresAt?: Date) {
  const token = crypto.randomBytes(32).toString('hex');
  const sessionId = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = customExpiresAt || new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days

  const [session] = await db
    .insert(sessions)
    .values({
      id: sessionId,
      userId,
      expiresAt
    })
    .returning();

  return {
    token,
    session
  };
}

/**
 * Helper to seed a test note with optional tags directly in the database.
 */
export async function createTestNote(
  userId: string,
  data?: {
    title?: string;
    content?: string;
    isPinned?: boolean;
    tagNames?: string[];
  }
) {
  const title = data?.title || 'Test Note Title';
  const content = data?.content || 'Test note content with **markdown**.';
  const isPinned = data?.isPinned ?? false;

  const [note] = await db
    .insert(notes)
    .values({
      userId,
      title,
      content,
      isPinned
    })
    .returning();

  const assignedTags: (typeof tags.$inferSelect)[] = [];

  if (data?.tagNames && data.tagNames.length > 0) {
    for (const tagName of data.tagNames) {
      // Upsert or insert tag
      let [tag] = await db
        .select()
        .from(tags)
        .where(sql`${tags.userId} = ${userId} AND ${tags.name} = ${tagName}`);

      if (!tag) {
        [tag] = await db
          .insert(tags)
          .values({
            userId,
            name: tagName
          })
          .returning();
      }

      assignedTags.push(tag);

      await db
        .insert(noteTags)
        .values({
          noteId: note.id,
          tagId: tag.id
        })
        .onConflictDoNothing();
    }
  }

  return {
    ...note,
    tags: assignedTags
  };
}

/**
 * Helper to seed a test tag.
 */
export async function createTestTag(userId: string, name: string) {
  const [tag] = await db
    .insert(tags)
    .values({
      userId,
      name
    })
    .returning();

  return tag;
}
