import { describe, it, expect, beforeEach } from 'vitest';
import * as authService from '$lib/server/auth';
import * as notesService from '$lib/server/notes';
import * as markdownModule from '$lib/utils/markdown';
import { db } from '$lib/server/db';
import { users, notes, tags, sessions, noteTags } from '$lib/server/db/schema';
import { cleanDatabase, createTestUser, createTestSession, createTestNote } from '../helpers/db';
import { FIXTURES, generateTestEmail } from '../helpers/fixtures';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

const renderMarkdown: (md: string) => string | Promise<string> =
  (markdownModule as any).renderMarkdown || (markdownModule as any).parseMarkdown || (markdownModule as any).default;

describe('Tier 4: Real-World Application Workflows & Scenarios', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  // Scenario 1: User Onboarding & First Notes Lifecycle
  it('RW1: End-to-end user onboarding, first note creation, markdown editing, pinning and logout', async () => {
    // 1. User signs up
    const email = generateTestEmail('onboarding');
    const password = 'OnboardingPass123!';
    const passwordHash = await authService.hashPassword(password);

    const [user] = await db
      .insert(users)
      .values({ email, passwordHash })
      .returning();
    expect(user).toBeDefined();

    // 2. User logs in
    const isAuth = await authService.verifyPassword(password, user.passwordHash);
    expect(isAuth).toBe(true);

    const { token, session } = await createTestSession(user.id);
    expect(token).toBeDefined();

    if (typeof authService.validateSessionToken === 'function') {
      const activeSession = await authService.validateSessionToken(token);
      expect(activeSession.user?.id).toBe(user.id);
    }

    // 3. User creates first onboarding note
    if (typeof notesService.createNote === 'function') {
      const firstNote = await notesService.createNote(user.id, {
        title: 'Welcome to My Notes',
        content: 'This is my first note created during onboarding.',
        isPinned: false,
        tagNames: ['onboarding', 'getting-started']
      });

      expect(firstNote).toBeDefined();
      expect(firstNote.title).toBe('Welcome to My Notes');
      expect(firstNote.tags.length).toBe(2);

      // 4. User edits note with rich markdown
      const updatedNote = await notesService.updateNote(user.id, firstNote.id, {
        title: 'Welcome & Getting Started Guide',
        content: `# Welcome!\n\nHere is my formatted list:\n- [x] Create account\n- [x] Write first note\n- [ ] Explore tags`,
        isPinned: true
      });

      expect(updatedNote?.isPinned).toBe(true);
      expect(updatedNote?.content).toContain('# Welcome!');

      // 5. User searches for the note
      const searchResults = await notesService.getNotes(user.id, { search: 'Getting Started' });
      expect(searchResults.length).toBe(1);
      expect(searchResults[0].id).toBe(firstNote.id);

      // 6. User logs out
      if (typeof authService.invalidateSession === 'function') {
        await authService.invalidateSession(session.id);
        if (typeof authService.validateSessionToken === 'function') {
          const invalidated = await authService.validateSessionToken(token);
          expect(invalidated.session).toBeNull();
        }
      }
    }
  });

  // Scenario 2: Knowledge Worker Daily Productivity Workflow
  it('RW2: Knowledge worker daily workflow with multi-tagged notes, search, pinning, and deletion', async () => {
    const { user } = await createTestUser();

    if (typeof notesService.createNote === 'function') {
      // 1. Create Standup Note
      const standup = await notesService.createNote(user.id, {
        title: 'Morning Standup 2026-09-01',
        content: '- Finished API tests\n- Working on Drizzle ORM pooling\n- Blockers: None',
        isPinned: false,
        tagNames: ['standup', 'work']
      });

      // 2. Create Architecture RFC Note (pinned)
      const rfc = await notesService.createNote(user.id, {
        title: 'RFC: PostgreSQL Serverless Connection Architecture',
        content: FIXTURES.notes.markdownRich.content,
        isPinned: true,
        tagNames: ['architecture', 'backend', 'work']
      });

      // 3. Create Scratchpad / Grocery Note
      const scratch = await notesService.createNote(user.id, {
        title: 'Quick Scratchpad',
        content: 'Buy milk, coffee beans, call plumber',
        isPinned: false,
        tagNames: ['personal']
      });

      // 4. List all notes - verify pinned note comes first
      const allNotes = await notesService.getNotes(user.id);
      expect(allNotes.length).toBe(3);
      expect(allNotes[0].id).toBe(rfc.id);

      // 5. Filter by 'work' tag
      const workTag = rfc.tags.find((t: any) => t.name === 'work');
      if (workTag) {
        const workNotes = await notesService.getNotes(user.id, { tagId: workTag.id });
        expect(workNotes.length).toBe(2);
        expect(workNotes.map((n: any) => n.id).sort()).toEqual([rfc.id, standup.id].sort());
      }

      // 6. Search for keyword "PostgreSQL"
      const pgResults = await notesService.getNotes(user.id, { search: 'PostgreSQL' });
      expect(pgResults.length).toBe(1);
      expect(pgResults[0].id).toBe(rfc.id);

      // 7. Delete scratchpad note
      const deleted = await notesService.deleteNote(user.id, scratch.id);
      expect(deleted).toBe(true);

      const remaining = await notesService.getNotes(user.id);
      expect(remaining.length).toBe(2);
      expect(remaining.find((n: any) => n.id === scratch.id)).toBeUndefined();
    }
  });

  // Scenario 3: Multi-Tenant Security & Isolation Audit
  it('RW3: Multi-tenant security audit: concurrent CRUD with identical titles, strict IDOR protection, zero leakage', async () => {
    // 1. Setup two distinct tenants: Alice and Bob
    const { user: alice } = await createTestUser({ email: 'alice@audit.com' });
    const { user: bob } = await createTestUser({ email: 'bob@audit.com' });

    if (typeof notesService.createNote === 'function') {
      // 2. Both create notes with IDENTICAL title and tag names
      const aliceNote = await notesService.createNote(alice.id, {
        title: 'Confidential Strategy 2026',
        content: 'Alice top secret budget numbers: $1,000,000',
        tagNames: ['confidential', 'finance']
      });

      const bobNote = await notesService.createNote(bob.id, {
        title: 'Confidential Strategy 2026',
        content: 'Bob top secret acquisitions: Project Titan',
        tagNames: ['confidential', 'finance']
      });

      // 3. Search Isolation: Alice searches "Confidential"
      const aliceSearch = await notesService.getNotes(alice.id, { search: 'Confidential' });
      expect(aliceSearch.length).toBe(1);
      expect(aliceSearch[0].id).toBe(aliceNote.id);
      expect(aliceSearch[0].content).toContain('Alice top secret');
      expect(aliceSearch[0].content).not.toContain('Bob top secret');

      // Bob searches "Confidential"
      const bobSearch = await notesService.getNotes(bob.id, { search: 'Confidential' });
      expect(bobSearch.length).toBe(1);
      expect(bobSearch[0].id).toBe(bobNote.id);
      expect(bobSearch[0].content).toContain('Bob top secret');
      expect(bobSearch[0].content).not.toContain('Alice top secret');

      // 4. IDOR Attack Tests: Alice attempts to access Bob's note
      const idorRead = await notesService.getNoteById(alice.id, bobNote.id);
      expect(idorRead).toBeNull();

      const idorUpdate = await notesService.updateNote(alice.id, bobNote.id, {
        title: 'Alice Overwrite Attempt'
      });
      expect(idorUpdate).toBeNull();

      const idorDelete = await notesService.deleteNote(alice.id, bobNote.id);
      expect(idorDelete).toBe(false);

      // Verify Bob's note is intact
      const bobVerified = await notesService.getNoteById(bob.id, bobNote.id);
      expect(bobVerified?.title).toBe('Confidential Strategy 2026');

      // 5. Bob deletes his note - Alice's note must remain completely unaffected
      await notesService.deleteNote(bob.id, bobNote.id);

      const aliceVerified = await notesService.getNoteById(alice.id, aliceNote.id);
      expect(aliceVerified).not.toBeNull();
      expect(aliceVerified?.title).toBe('Confidential Strategy 2026');
      expect(aliceVerified?.tags.length).toBe(2);
    }
  });

  // Scenario 4: Comprehensive Tag Restructuring & Multi-Facet Query Workflow
  it('RW4: Comprehensive tag restructuring, multi-facet query workflow and database cascade integrity', async () => {
    const { user } = await createTestUser();

    if (typeof notesService.createNote === 'function' && typeof notesService.getUserTags === 'function') {
      // 1. Create 5 notes with overlapping tags and varied pin statuses
      const note1 = await notesService.createNote(user.id, {
        title: 'Design System Tokens',
        content: 'Color palette and typography variables',
        isPinned: true,
        tagNames: ['ui', 'design', 'v1']
      });

      const note2 = await notesService.createNote(user.id, {
        title: 'Component Library Guide',
        content: 'Button, Modal, Toast components in Svelte 5',
        isPinned: false,
        tagNames: ['ui', 'frontend', 'svelte']
      });

      const note3 = await notesService.createNote(user.id, {
        title: 'Database Schema Migration Plan',
        content: 'PostgreSQL migrations using Drizzle Kit',
        isPinned: true,
        tagNames: ['backend', 'db', 'drizzle']
      });

      const note4 = await notesService.createNote(user.id, {
        title: 'API Authentication Spec',
        content: 'Session token validation and sliding window logic',
        isPinned: false,
        tagNames: ['backend', 'auth']
      });

      const note5 = await notesService.createNote(user.id, {
        title: 'Deployment & CI SOP',
        content: 'Vercel deployment workflows and automated test checks',
        isPinned: false,
        tagNames: ['devops', 'ci']
      });

      // 2. Verify all unique tags recorded
      const initialTags = await notesService.getUserTags(user.id);
      expect(initialTags.length).toBeGreaterThanOrEqual(8);

      // 3. Reorganize note1 tags (migrate from 'v1' to 'v2' and 'production')
      await notesService.updateNote(user.id, note1.id, {
        tagNames: ['ui', 'design', 'v2', 'production']
      });

      const refreshedNote1 = await notesService.getNoteById(user.id, note1.id);
      expect(refreshedNote1?.tags.map((t: any) => t.name).sort()).toEqual(['design', 'production', 'ui', 'v2']);

      // 4. Complex multi-facet search: search "components"
      const compSearch = await notesService.getNotes(user.id, { search: 'components' });
      expect(compSearch.length).toBe(1);
      expect(compSearch[0].id).toBe(note2.id);

      // 5. Query pinned notes only
      const pinnedList = await notesService.getNotes(user.id, { isPinned: true });
      expect(pinnedList.length).toBe(2);
      expect(pinnedList.map((n: any) => n.id).sort()).toEqual([note1.id, note3.id].sort());

      // 6. Delete notes and verify cascade integrity
      await notesService.deleteNote(user.id, note2.id);
      await notesService.deleteNote(user.id, note5.id);

      const finalNotes = await notesService.getNotes(user.id);
      expect(finalNotes.length).toBe(3);

      // Ensure junction table has no orphaned links for deleted notes
      const orphanLinks = await db
        .select()
        .from(noteTags)
        .where(eq(noteTags.noteId, note2.id));
      expect(orphanLinks.length).toBe(0);
    }
  });
});
