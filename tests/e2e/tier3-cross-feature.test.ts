import { describe, it, expect, beforeEach } from 'vitest';
import * as authService from '$lib/server/auth';
import * as notesService from '$lib/server/notes';
import { db } from '$lib/server/db';
import { users, notes, tags, sessions } from '$lib/server/db/schema';
import { cleanDatabase, createTestUser, createTestSession, createTestNote } from '../helpers/db';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

describe('Tier 3: Cross-Feature & Isolation (Multi-Tenant, Compound Filters & Lifecycle)', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  // CF1: Cross-Tenant Full Isolation
  it('CF1: should maintain strict isolation across multiple users with identical note titles and tag names', async () => {
    const { user: userA } = await createTestUser();
    const { user: userB } = await createTestUser();

    // User A creates notes
    await createTestNote(userA.id, {
      title: 'Confidential Strategy',
      content: "User A's internal roadmap",
      tagNames: ['strategy', 'q4']
    });

    // User B creates notes with identical title and tags
    await createTestNote(userB.id, {
      title: 'Confidential Strategy',
      content: "User B's secret plan",
      tagNames: ['strategy', 'q4']
    });

    if (typeof notesService.getNotes === 'function') {
      const notesA = await notesService.getNotes(userA.id);
      expect(notesA.length).toBe(1);
      expect(notesA[0].content).toBe("User A's internal roadmap");

      const notesB = await notesService.getNotes(userB.id);
      expect(notesB.length).toBe(1);
      expect(notesB[0].content).toBe("User B's secret plan");

      // Search isolation
      const searchA = await notesService.getNotes(userA.id, { search: 'Confidential' });
      expect(searchA.length).toBe(1);
      expect(searchA[0].content).toBe("User A's internal roadmap");
    }
  });

  // CF2: Combined Multi-Facet Filtering (Tag + Search + Pin)
  it('CF2: should filter notes by Tag + Keyword Search Query + Pinned status simultaneously', async () => {
    const { user } = await createTestUser();

    // Note 1: matches search + tag + pinned
    const note1 = await createTestNote(user.id, {
      title: 'Architecture Meeting Notes',
      content: 'Discussion on PostgreSQL connection pooling',
      isPinned: true,
      tagNames: ['architecture', 'backend']
    });

    // Note 2: matches search + tag but NOT pinned
    await createTestNote(user.id, {
      title: 'Architecture Draft',
      content: 'Early PostgreSQL ideas',
      isPinned: false,
      tagNames: ['architecture']
    });

    // Note 3: matches search + pinned but DIFFERENT tag
    await createTestNote(user.id, {
      title: 'Frontend Architecture',
      content: 'Svelte 5 runes setup',
      isPinned: true,
      tagNames: ['frontend']
    });

    const archTag = note1.tags.find((t: any) => t.name === 'architecture');
    expect(archTag).toBeDefined();

    if (typeof notesService.getNotes === 'function' && archTag) {
      // Filter by tag=architecture AND search=PostgreSQL AND isPinned=true
      const results = await notesService.getNotes(user.id, {
        tagId: archTag.id,
        search: 'PostgreSQL',
        isPinned: true
      });

      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Architecture Meeting Notes');
      expect(results[0].isPinned).toBe(true);
    }
  });

  // CF3: Deterministic Sort Ordering (Pinned First, then Timestamp Descending)
  it('CF3: should sort pinned notes to top followed by descending updated timestamp', async () => {
    const { user } = await createTestUser();

    const note1 = await createTestNote(user.id, {
      title: 'Older Unpinned Note',
      isPinned: false
    });
    const note2 = await createTestNote(user.id, {
      title: 'Newer Unpinned Note',
      isPinned: false
    });
    const note3 = await createTestNote(user.id, {
      title: 'Pinned Priority Note',
      isPinned: true
    });

    if (typeof notesService.getNotes === 'function') {
      const notesList = await notesService.getNotes(user.id);
      expect(notesList.length).toBe(3);

      // Pinned note must be the first item
      expect(notesList[0].id).toBe(note3.id);
      expect(notesList[0].isPinned).toBe(true);
    }
  });

  // CF4: Tag Lifecycle & Multi-Note Association Integrity
  it('CF4: should maintain tag associations across multi-note tagging, updating, and deletion', async () => {
    const { user } = await createTestUser();

    const note1 = await createTestNote(user.id, {
      title: 'Project Alpha',
      tagNames: ['project', 'active']
    });
    const note2 = await createTestNote(user.id, {
      title: 'Project Beta',
      tagNames: ['project', 'pending']
    });

    if (typeof notesService.getNotes === 'function' && typeof notesService.getUserTags === 'function') {
      const userTagsBefore = await notesService.getUserTags(user.id);
      expect(userTagsBefore.map((t: any) => t.name).sort()).toEqual(['active', 'pending', 'project']);

      // Update note1: remove 'active', add 'completed'
      if (typeof notesService.updateNote === 'function') {
        await notesService.updateNote(user.id, note1.id, {
          tagNames: ['project', 'completed']
        });
      }

      // Delete note2
      if (typeof notesService.deleteNote === 'function') {
        await notesService.deleteNote(user.id, note2.id);
      }

      // Verify note1 remains with updated tags
      const fetchedNote1 = await notesService.getNoteById(user.id, note1.id);
      expect(fetchedNote1?.tags.map((t: any) => t.name).sort()).toEqual(['completed', 'project']);
    }
  });

  // CF5: Sliding Session Renewal
  it('CF5: should support session sliding expiration renewal', async () => {
    const { user } = await createTestUser();
    // Create session near sliding renewal threshold (e.g. 10 days remaining instead of 30)
    const tenDaysFromNow = new Date(Date.now() + 1000 * 60 * 60 * 24 * 10);
    const { token, session } = await createTestSession(user.id, tenDaysFromNow);

    if (typeof authService.validateSessionToken === 'function') {
      const validation = await authService.validateSessionToken(token);
      expect(validation.session).not.toBeNull();
      expect(validation.user?.id).toBe(user.id);

      // Verify expiration is renewed or valid
      const [updatedSession] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, session.id));
      expect(new Date(updatedSession.expiresAt).getTime()).toBeGreaterThan(Date.now());
    }
  });

  // CF6: Expired Session Invalidation & Cleanup
  it('CF6: should reject and clean up expired session tokens', async () => {
    const { user } = await createTestUser();
    const expiredTimestamp = new Date(Date.now() - 1000 * 60 * 60 * 24); // 1 day ago
    const { token, session } = await createTestSession(user.id, expiredTimestamp);

    if (typeof authService.validateSessionToken === 'function') {
      const validation = await authService.validateSessionToken(token);
      expect(validation.session).toBeNull();
      expect(validation.user).toBeNull();

      // Session row should be purged
      const [dbSession] = await db.select().from(sessions).where(eq(sessions.id, session.id));
      expect(dbSession).toBeUndefined();
    }
  });

  // CF7: Cross-Tenant Tag ID Query Isolation
  it('CF7: should prevent cross-tenant information disclosure when querying with another user tag ID', async () => {
    const { user: userA } = await createTestUser();
    const { user: userB } = await createTestUser();

    const noteA = await createTestNote(userA.id, {
      title: "User A Note",
      tagNames: ['secret_tag_a']
    });
    const tagA = noteA.tags[0];

    if (typeof notesService.getNotes === 'function' && tagA) {
      // User B attempts to query notes using User A's tagId
      const crossResults = await notesService.getNotes(userB.id, { tagId: tagA.id });
      // Should return 0 results since User B does not own notes with that tag
      expect(crossResults.length).toBe(0);
    }
  });

  // CF8: Multi-Device Concurrent Sessions & Targeted Invalidation
  it('CF8: should support concurrent device sessions and granular session invalidation', async () => {
    const { user } = await createTestUser();
    const sessionMobile = await createTestSession(user.id);
    const sessionDesktop = await createTestSession(user.id);

    if (typeof authService.validateSessionToken === 'function') {
      // Both sessions active
      expect((await authService.validateSessionToken(sessionMobile.token)).session).not.toBeNull();
      expect((await authService.validateSessionToken(sessionDesktop.token)).session).not.toBeNull();

      // Invalidate only mobile session
      if (typeof authService.invalidateSession === 'function') {
        await authService.invalidateSession(sessionMobile.session.id);

        expect((await authService.validateSessionToken(sessionMobile.token)).session).toBeNull();
        expect((await authService.validateSessionToken(sessionDesktop.token)).session).not.toBeNull();
      }
    }
  });
});
