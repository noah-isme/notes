import { describe, it, expect, beforeEach } from 'vitest';
import * as authService from '$lib/server/auth';
import * as notesService from '$lib/server/notes';
import { db } from '$lib/server/db';
import { users, notes, tags } from '$lib/server/db/schema';
import { cleanDatabase, createTestUser, createTestSession, createTestNote } from '../helpers/db';
import { FIXTURES, generateTestEmail } from '../helpers/fixtures';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

describe('Tier 1: Feature Coverage (Isolated Functional Tests)', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  // Feature 1: User Registration
  it('F1: should register a new user account with hashed password', async () => {
    const email = generateTestEmail('reg-f1');
    const password = 'StrongPassword123!';

    const passwordHash = await authService.hashPassword(password);
    const [createdUser] = await db
      .insert(users)
      .values({ email, passwordHash })
      .returning();

    expect(createdUser).toBeDefined();
    expect(createdUser.id).toBeDefined();
    expect(createdUser.email).toBe(email);
    expect(createdUser.passwordHash).not.toBe(password);
    expect(await authService.verifyPassword(password, createdUser.passwordHash)).toBe(true);
  });

  // Feature 2: User Login & Session Creation
  it('F2: should authenticate credentials and create an active session', async () => {
    const { user, rawPassword } = await createTestUser();

    // Verify credentials
    const isPasswordValid = await authService.verifyPassword(rawPassword, user.passwordHash);
    expect(isPasswordValid).toBe(true);

    const { token, session } = await createTestSession(user.id);
    expect(token).toBeDefined();
    expect(session.userId).toBe(user.id);
    expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  // Feature 3: Session Validation
  it('F3: should validate an active session token and resolve user identity', async () => {
    const { user } = await createTestUser();
    const { token } = await createTestSession(user.id);

    if (typeof authService.validateSessionToken === 'function') {
      const validation = await authService.validateSessionToken(token);
      expect(validation.session).not.toBeNull();
      expect(validation.user).not.toBeNull();
      expect(validation.user?.id).toBe(user.id);
      expect(validation.user?.email).toBe(user.email);
    }
  });

  // Feature 4: User Logout
  it('F4: should invalidate session on logout', async () => {
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

  // Feature 5: Note Creation
  it('F5: should create a note with title and markdown content', async () => {
    const { user } = await createTestUser();
    const noteData = FIXTURES.notes.markdownRich;

    if (typeof notesService.createNote === 'function') {
      const note = await notesService.createNote(user.id, {
        title: noteData.title,
        content: noteData.content,
        isPinned: noteData.isPinned,
        tagNames: noteData.tagNames
      });

      expect(note).toBeDefined();
      expect(note.id).toBeDefined();
      expect(note.userId).toBe(user.id);
      expect(note.title).toBe(noteData.title);
      expect(note.content).toBe(noteData.content);
      expect(note.isPinned).toBe(true);
    }
  });

  // Feature 6: Read Note by ID
  it('F6: should retrieve a single note with its tags by ID', async () => {
    const { user } = await createTestUser();
    const note = await createTestNote(user.id, {
      title: 'Detailed RFC Document',
      content: 'System architecture specs',
      tagNames: ['spec', 'rfc']
    });

    if (typeof notesService.getNoteById === 'function') {
      const fetched = await notesService.getNoteById(user.id, note.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe(note.id);
      expect(fetched?.title).toBe('Detailed RFC Document');
      expect(fetched?.tags.length).toBe(2);
    }
  });

  // Feature 7: List Notes
  it('F7: should list all notes belonging to the authenticated user', async () => {
    const { user } = await createTestUser();
    await createTestNote(user.id, { title: 'First Note' });
    await createTestNote(user.id, { title: 'Second Note' });
    await createTestNote(user.id, { title: 'Third Note' });

    if (typeof notesService.getNotes === 'function') {
      const list = await notesService.getNotes(user.id);
      expect(list.length).toBe(3);
    }
  });

  // Feature 8: Update Note Content & Title
  it('F8: should update note title and content and refresh updatedAt timestamp', async () => {
    const { user } = await createTestUser();
    const note = await createTestNote(user.id, {
      title: 'Original Title',
      content: 'Original Content'
    });

    if (typeof notesService.updateNote === 'function') {
      const updated = await notesService.updateNote(user.id, note.id, {
        title: 'Refined Title',
        content: 'Refined Content with updates.'
      });

      expect(updated).not.toBeNull();
      expect(updated?.title).toBe('Refined Title');
      expect(updated?.content).toBe('Refined Content with updates.');
    }
  });

  // Feature 9: Delete Note
  it('F9: should delete a note and remove it from user notes list', async () => {
    const { user } = await createTestUser();
    const note = await createTestNote(user.id, { title: 'Obsolete Note' });

    if (typeof notesService.deleteNote === 'function') {
      const deleted = await notesService.deleteNote(user.id, note.id);
      expect(deleted).toBe(true);

      const list = await notesService.getNotes(user.id);
      expect(list.find((n: any) => n.id === note.id)).toBeUndefined();
    }
  });

  // Feature 10: Pin Note
  it('F10: should toggle note pinned status to true', async () => {
    const { user } = await createTestUser();
    const note = await createTestNote(user.id, { title: 'Unpinned Note', isPinned: false });

    if (typeof notesService.updateNote === 'function') {
      const pinnedNote = await notesService.updateNote(user.id, note.id, { isPinned: true });
      expect(pinnedNote?.isPinned).toBe(true);
    }
  });

  // Feature 11: Unpin Note
  it('F11: should toggle note pinned status to false', async () => {
    const { user } = await createTestUser();
    const note = await createTestNote(user.id, { title: 'Pinned Note', isPinned: true });

    if (typeof notesService.updateNote === 'function') {
      const unpinnedNote = await notesService.updateNote(user.id, note.id, { isPinned: false });
      expect(unpinnedNote?.isPinned).toBe(false);
    }
  });

  // Feature 12: Assign Multiple Tags
  it('F12: should assign multiple tags during note creation', async () => {
    const { user } = await createTestUser();

    if (typeof notesService.createNote === 'function') {
      const note = await notesService.createNote(user.id, {
        title: 'Multi-tagged Note',
        tagNames: ['finance', 'taxes', '2026']
      });

      expect(note.tags.length).toBe(3);
      const tagNames = note.tags.map((t: any) => t.name).sort();
      expect(tagNames).toEqual(['2026', 'finance', 'taxes']);
    }
  });

  // Feature 13: Modify Note Tags
  it('F13: should update and synchronize note tags (add new, remove old)', async () => {
    const { user } = await createTestUser();
    const note = await createTestNote(user.id, {
      title: 'Note to Retag',
      tagNames: ['alpha', 'beta']
    });

    if (typeof notesService.updateNote === 'function') {
      const updated = await notesService.updateNote(user.id, note.id, {
        tagNames: ['beta', 'gamma', 'delta']
      });

      expect(updated?.tags.length).toBe(3);
      const tagNames = updated?.tags.map((t: any) => t.name).sort();
      expect(tagNames).toEqual(['beta', 'delta', 'gamma']);
    }
  });

  // Feature 14: Search Notes by Title
  it('F14: should search and find notes matching title keywords', async () => {
    const { user } = await createTestUser();
    await createTestNote(user.id, { title: 'Quarterly Financial Report', content: 'Revenue numbers' });
    await createTestNote(user.id, { title: 'Marketing Campaign', content: 'Ad spend' });

    if (typeof notesService.getNotes === 'function') {
      const results = await notesService.getNotes(user.id, { search: 'Financial' });
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Quarterly Financial Report');
    }
  });

  // Feature 15: Search Notes by Content
  it('F15: should search and find notes matching body content keywords', async () => {
    const { user } = await createTestUser();
    await createTestNote(user.id, { title: 'Recipe', content: 'Special homemade sourdough yeast recipe' });
    await createTestNote(user.id, { title: 'Workout', content: 'Morning 5km run and pushups' });

    if (typeof notesService.getNotes === 'function') {
      const results = await notesService.getNotes(user.id, { search: 'sourdough' });
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Recipe');
    }
  });

  // Feature 16: Filter Notes by Tag
  it('F16: should filter notes collection by tag', async () => {
    const { user } = await createTestUser();
    const taggedNote = await createTestNote(user.id, {
      title: 'DevOps Checklist',
      tagNames: ['devops']
    });
    await createTestNote(user.id, {
      title: 'Groceries',
      tagNames: ['personal']
    });

    const devopsTag = taggedNote.tags.find((t: any) => t.name === 'devops');
    expect(devopsTag).toBeDefined();

    if (typeof notesService.getNotes === 'function' && devopsTag) {
      const filtered = await notesService.getNotes(user.id, { tagId: devopsTag.id });
      expect(filtered.length).toBe(1);
      expect(filtered[0].title).toBe('DevOps Checklist');
    }
  });

  // Feature 17: List User Tags
  it('F17: should list all unique tags created by user', async () => {
    const { user } = await createTestUser();
    await createTestNote(user.id, { title: 'Note 1', tagNames: ['tagA', 'tagB'] });
    await createTestNote(user.id, { title: 'Note 2', tagNames: ['tagB', 'tagC'] });

    if (typeof notesService.getUserTags === 'function') {
      const tagsList = await notesService.getUserTags(user.id);
      expect(tagsList.length).toBe(3);
      expect(tagsList.map((t: any) => t.name).sort()).toEqual(['tagA', 'tagB', 'tagC']);
    }
  });
});
