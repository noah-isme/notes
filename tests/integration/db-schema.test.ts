import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '$lib/server/db';
import { users, sessions, notes, tags, noteTags } from '$lib/server/db/schema';
import { cleanDatabase, createTestUser, createTestSession, createTestNote } from '../helpers/db';
import { generateTestEmail } from '../helpers/fixtures';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

describe('Integration: PostgreSQL DB Schema & Drizzle ORM Relations', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('should enforce unique email constraint on users table', async () => {
    const email = generateTestEmail('unique-email');
    await createTestUser({ email });

    // Attempting to insert another user with the same email should fail
    await expect(
      db.insert(users).values({
        email,
        passwordHash: 'dummyhash'
      })
    ).rejects.toThrow();
  });

  it('should cascade delete sessions when parent user is deleted', async () => {
    const { user } = await createTestUser();
    const { session } = await createTestSession(user.id);

    // Verify session exists
    const [fetchedSession] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(fetchedSession).toBeDefined();

    // Delete user
    await db.delete(users).where(eq(users.id, user.id));

    // Verify session was cascaded
    const [deletedSession] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(deletedSession).toBeUndefined();
  });

  it('should cascade delete notes when parent user is deleted', async () => {
    const { user } = await createTestUser();
    const note = await createTestNote(user.id, { title: 'Cascade Note' });

    // Delete user
    await db.delete(users).where(eq(users.id, user.id));

    // Verify note was cascaded
    const [deletedNote] = await db
      .select()
      .from(notes)
      .where(eq(notes.id, note.id));
    expect(deletedNote).toBeUndefined();
  });

  it('should enforce compound uniqueness on (userId, tag name) while allowing distinct users to share tag names', async () => {
    const { user: userA } = await createTestUser();
    const { user: userB } = await createTestUser();

    // Insert tag 'project' for userA
    const [tagA] = await db
      .insert(tags)
      .values({
        userId: userA.id,
        name: 'project'
      })
      .returning();
    expect(tagA).toBeDefined();

    // Inserting identical tag name for userB should succeed
    const [tagB] = await db
      .insert(tags)
      .values({
        userId: userB.id,
        name: 'project'
      })
      .returning();
    expect(tagB).toBeDefined();
    expect(tagB.id).not.toBe(tagA.id);

    // Inserting duplicate tag 'project' for userA should fail unique constraint
    await expect(
      db.insert(tags).values({
        userId: userA.id,
        name: 'project'
      })
    ).rejects.toThrow();
  });

  it('should cascade delete note_tags junction records when note is deleted without deleting the tag', async () => {
    const { user } = await createTestUser();
    const note = await createTestNote(user.id, {
      title: 'Note with Tag',
      tagNames: ['work']
    });

    expect(note.tags.length).toBe(1);
    const tagId = note.tags[0].id;

    // Verify note_tags record exists
    const [linkBefore] = await db
      .select()
      .from(noteTags)
      .where(and(eq(noteTags.noteId, note.id), eq(noteTags.tagId, tagId)));
    expect(linkBefore).toBeDefined();

    // Delete note
    await db.delete(notes).where(eq(notes.id, note.id));

    // Verify note_tags record was deleted
    const [linkAfter] = await db
      .select()
      .from(noteTags)
      .where(and(eq(noteTags.noteId, note.id), eq(noteTags.tagId, tagId)));
    expect(linkAfter).toBeUndefined();

    // Verify tag itself still exists
    const [tagStillExists] = await db
      .select()
      .from(tags)
      .where(eq(tags.id, tagId));
    expect(tagStillExists).toBeDefined();
  });

  it('should cascade delete note_tags junction records when tag is deleted without deleting the note', async () => {
    const { user } = await createTestUser();
    const note = await createTestNote(user.id, {
      title: 'Note with Tag to Remove',
      tagNames: ['temporary']
    });

    const tagId = note.tags[0].id;

    // Delete tag
    await db.delete(tags).where(eq(tags.id, tagId));

    // Verify note_tags record was deleted
    const [linkAfter] = await db
      .select()
      .from(noteTags)
      .where(and(eq(noteTags.noteId, note.id), eq(noteTags.tagId, tagId)));
    expect(linkAfter).toBeUndefined();

    // Verify note itself still exists
    const [noteStillExists] = await db
      .select()
      .from(notes)
      .where(eq(notes.id, note.id));
    expect(noteStillExists).toBeDefined();
  });

  it('should apply schema defaults: isPinned defaults to false and timestamps are auto-populated', async () => {
    const { user } = await createTestUser();

    const [note] = await db
      .insert(notes)
      .values({
        userId: user.id,
        title: 'Default Props Note'
      })
      .returning();

    expect(note.isPinned).toBe(false);
    expect(note.createdAt).toBeInstanceOf(Date);
    expect(note.updatedAt).toBeInstanceOf(Date);
  });
});
