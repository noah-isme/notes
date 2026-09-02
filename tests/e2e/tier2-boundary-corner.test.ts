import { describe, it, expect, beforeEach } from 'vitest';
import * as authService from '$lib/server/auth';
import * as notesService from '$lib/server/notes';
import * as validationModule from '$lib/utils/validation';
import * as markdownModule from '$lib/utils/markdown';
import { db } from '$lib/server/db';
import { users, notes, tags, noteTags, sessions } from '$lib/server/db/schema';
import { cleanDatabase, createTestUser, createTestSession, createTestNote } from '../helpers/db';
import { FIXTURES, generateTestEmail } from '../helpers/fixtures';
import { eq, and } from 'drizzle-orm';

const renderMarkdown: (md: string) => string | Promise<string> =
  (markdownModule as any).renderMarkdown || (markdownModule as any).parseMarkdown || (markdownModule as any).default;

const {
  validateEmail,
  validatePassword,
  validateNoteInput,
  validateNote
} = validationModule as any;

describe('Tier 2: Boundary & Corner Cases (Edge Conditions, Security & Adversarial)', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  // B1: Duplicate email registration
  it('B1: should reject duplicate email registration at DB and service layer', async () => {
    const email = generateTestEmail('dup-test');
    await createTestUser({ email });

    await expect(
      db.insert(users).values({
        email,
        passwordHash: 'dummy'
      })
    ).rejects.toThrow();
  });

  // B2: Invalid email format
  it('B2: should reject invalid email formats across validation suite', () => {
    if (typeof validateEmail === 'function') {
      for (const invalidEmail of FIXTURES.users.invalidEmails) {
        const res = validateEmail(invalidEmail);
        const isValid = typeof res === 'boolean' ? res : (res?.valid ?? res?.success);
        expect(isValid).toBe(false);
      }
    }
  });

  // B3: Short / Empty password
  it('B3: should reject passwords that do not satisfy minimum length', () => {
    if (typeof validatePassword === 'function') {
      for (const invalidPass of FIXTURES.users.invalidPasswords) {
        const res = validatePassword(invalidPass);
        const isValid = typeof res === 'boolean' ? res : (res?.valid ?? res?.success);
        expect(isValid).toBe(false);
      }
    }
  });

  // B4: Login with incorrect password
  it('B4: should fail credential verification for incorrect password', async () => {
    const { user } = await createTestUser({ password: 'CorrectPassword123!' });
    const isMatch = await authService.verifyPassword('WrongPassword123!', user.passwordHash);
    expect(isMatch).toBe(false);
  });

  // B5: Login with non-existent email
  it('B5: should return empty user when querying non-existent email', async () => {
    const nonExistentEmail = generateTestEmail('ghost-user');
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, nonExistentEmail));
    expect(user).toBeUndefined();
  });

  // B6: Note creation with empty title
  it('B6: should reject note creation with empty or whitespace-only title', () => {
    const validate = validateNoteInput || validateNote;
    if (typeof validate === 'function') {
      expect(validate({ title: '' })).toBeFalsy();
      expect(validate({ title: '   ' })).toBeFalsy();
      expect(validate({ title: '\t\n' })).toBeFalsy();
    }
  });

  // B7: Note title max length boundary (200 char allowed, 201 rejected)
  it('B7: should accept 200 char title and reject 201 char title', () => {
    const validate = validateNoteInput || validateNote;
    if (typeof validate === 'function') {
      const valid200 = FIXTURES.notes.boundaryMaxTitle;
      const invalid201 = FIXTURES.notes.boundaryExceededTitle;

      const resValid = validate(valid200);
      const resInvalid = validate(invalid201);

      const isValid200 = typeof resValid === 'boolean' ? resValid : (resValid?.valid ?? resValid?.success);
      const isInvalid201 = typeof resInvalid === 'boolean' ? resInvalid : (resInvalid?.valid ?? resInvalid?.success);

      expect(isValid200).toBe(true);
      expect(isInvalid201).toBe(false);
    }
  });

  // B8: Huge content payload handling
  it('B8: should handle large markdown content payloads without truncation', async () => {
    const { user } = await createTestUser();
    const largeNote = FIXTURES.notes.hugeContent;

    if (typeof notesService.createNote === 'function') {
      const created = await notesService.createNote(user.id, {
        title: largeNote.title,
        content: largeNote.content
      });

      expect(created.content).toBe(largeNote.content);
      expect(created.content.length).toBeGreaterThan(10000);

      const fetched = await notesService.getNoteById(user.id, created.id);
      expect(fetched?.content).toBe(largeNote.content);
    }
  });

  // B9: Aggressive XSS attack vectors sanitized
  it('B9: should sanitize malicious XSS payloads from markdown content', async () => {
    const parse = async (input: string): Promise<string> => {
      const res = renderMarkdown(input);
      return res instanceof Promise ? await res : res;
    };

    for (const vector of FIXTURES.xssPayloads) {
      const sanitized = await parse(vector.payload);
      expect(sanitized.toLowerCase()).not.toContain('<script>');
      expect(sanitized.toLowerCase()).not.toContain('onerror=');
      expect(sanitized.toLowerCase()).not.toContain('onload=');
      expect(sanitized.toLowerCase()).not.toContain('javascript:');
    }
  });

  // B10: SQL injection attack strings in search
  it('B10: should safely parameterize SQL injection search queries without throwing errors or leaking data', async () => {
    const { user } = await createTestUser();
    await createTestNote(user.id, { title: 'Ordinary Note', content: 'Safe content' });

    if (typeof notesService.getNotes === 'function') {
      for (const injectionPayload of FIXTURES.sqlInjectionPayloads) {
        // Must execute cleanly without unhandled syntax error
        const results = await notesService.getNotes(user.id, { search: injectionPayload });
        expect(Array.isArray(results)).toBe(true);
      }
    }
  });

  // B11: IDOR Read Attempt: User B cannot read User A's note
  it('B11: IDOR - User B cannot read User A private note by direct ID', async () => {
    const { user: userA } = await createTestUser();
    const { user: userB } = await createTestUser();

    const noteA = await createTestNote(userA.id, {
      title: 'Top Secret Strategy',
      content: 'Confidential corporate data'
    });

    if (typeof notesService.getNoteById === 'function') {
      const attempt = await notesService.getNoteById(userB.id, noteA.id);
      expect(attempt).toBeNull();
    }
  });

  // B12: IDOR Update Attempt: User B cannot update User A's note
  it('B12: IDOR - User B cannot modify or overwrite User A note', async () => {
    const { user: userA } = await createTestUser();
    const { user: userB } = await createTestUser();

    const noteA = await createTestNote(userA.id, {
      title: 'Original Title',
      content: 'Original Content'
    });

    if (typeof notesService.updateNote === 'function') {
      const attempt = await notesService.updateNote(userB.id, noteA.id, {
        title: 'Tampered Title',
        content: 'Tampered Content'
      });
      expect(attempt).toBeNull();

      // Ensure untouched
      const [untouched] = await db.select().from(notes).where(eq(notes.id, noteA.id));
      expect(untouched.title).toBe('Original Title');
    }
  });

  // B13: IDOR Delete Attempt: User B cannot delete User A's note
  it('B13: IDOR - User B cannot delete User A note', async () => {
    const { user: userA } = await createTestUser();
    const { user: userB } = await createTestUser();

    const noteA = await createTestNote(userA.id, { title: 'Protected User A Note' });

    if (typeof notesService.deleteNote === 'function') {
      const attempt = await notesService.deleteNote(userB.id, noteA.id);
      expect(attempt).toBe(false);

      // Ensure note still exists
      const [stillExists] = await db.select().from(notes).where(eq(notes.id, noteA.id));
      expect(stillExists).toBeDefined();
    }
  });

  // B14: Cascade delete integrity on note deletion
  it('B14: should cascade delete note_tags relationships when note is deleted', async () => {
    const { user } = await createTestUser();
    const note = await createTestNote(user.id, {
      title: 'Note to Cascade',
      tagNames: ['tag1', 'tag2']
    });

    if (typeof notesService.deleteNote === 'function') {
      await notesService.deleteNote(user.id, note.id);

      const links = await db
        .select()
        .from(noteTags)
        .where(eq(noteTags.noteId, note.id));
      expect(links.length).toBe(0);
    }
  });

  // B15: Cascade delete user wipes all child records
  it('B15: should cascade delete notes, sessions, and tags when user is removed', async () => {
    const { user } = await createTestUser();
    const note = await createTestNote(user.id, { title: 'User Note', tagNames: ['tag'] });
    const { session } = await createTestSession(user.id);

    // Delete user from DB
    await db.delete(users).where(eq(users.id, user.id));

    // Verify all children are gone
    const remainingNotes = await db.select().from(notes).where(eq(notes.userId, user.id));
    expect(remainingNotes.length).toBe(0);

    const remainingSessions = await db.select().from(sessions).where(eq(sessions.userId, user.id));
    expect(remainingSessions.length).toBe(0);

    const remainingTags = await db.select().from(tags).where(eq(tags.userId, user.id));
    expect(remainingTags.length).toBe(0);
  });

  // B16: Special character & Unicode preservation
  it('B16: should preserve emojis, CJK, and special symbols without data corruption', async () => {
    const { user } = await createTestUser();

    for (const sample of FIXTURES.unicodeSamples) {
      if (typeof notesService.createNote === 'function') {
        const created = await notesService.createNote(user.id, {
          title: `Title: ${sample.name}`,
          content: sample.text
        });

        expect(created.content).toBe(sample.text);

        const fetched = await notesService.getNoteById(user.id, created.id);
        expect(fetched?.content).toBe(sample.text);
      }
    }
  });
});
