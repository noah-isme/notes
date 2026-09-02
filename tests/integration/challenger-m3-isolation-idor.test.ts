import { describe, it, expect, beforeEach } from 'vitest';
import * as authService from '$lib/server/auth';
import * as notesService from '$lib/server/notes';
import { GET as getNotesList, POST as createNoteEndpoint } from '../../src/routes/api/notes/+server';
import {
  GET as getNoteItem,
  PUT as updateNoteEndpoint,
  PATCH as patchNoteEndpoint,
  DELETE as deleteNoteEndpoint,
} from '../../src/routes/api/notes/[id]/+server';
import {
  GET as getTagsList,
  POST as createTagEndpoint,
  DELETE as deleteTagEndpoint,
} from '../../src/routes/api/tags/+server';
import { actions as appActions, load as appPageLoad } from '../../src/routes/(app)/+page.server';
import { db } from '$lib/server/db';
import { users, sessions, notes, tags, noteTags } from '$lib/server/db/schema';
import { cleanDatabase, createTestUser, createTestSession, createTestNote, createTestTag } from '../helpers/db';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Creates a mock SvelteKit RequestEvent for API handler testing.
 */
function createMockApiEvent(options: {
  pathname: string;
  method?: string;
  user?: { id: string; email: string } | null;
  params?: Record<string, string>;
  searchParams?: Record<string, string>;
  body?: any;
}) {
  const url = new URL(`http://localhost:5173${options.pathname}`);
  if (options.searchParams) {
    for (const [key, val] of Object.entries(options.searchParams)) {
      url.searchParams.set(key, val);
    }
  }

  const reqInit: RequestInit = {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
  };

  if (options.body !== undefined) {
    reqInit.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  const request = new Request(url.toString(), reqInit);

  const event: any = {
    url,
    request,
    params: options.params || {},
    locals: {
      user: options.user !== undefined ? options.user : null,
      session: null,
    },
    cookies: {
      get: () => undefined,
      set: () => {},
      delete: () => {},
      getAll: () => [],
    },
    setHeaders: () => {},
    getClientAddress: () => '127.0.0.1',
    fetch: globalThis.fetch,
  };

  return event;
}

/**
 * Creates a mock SvelteKit RequestEvent for Form Action testing.
 */
function createMockActionEvent(options: {
  user?: { id: string; email: string } | null;
  formData: Record<string, string>;
}) {
  const data = new FormData();
  for (const [key, val] of Object.entries(options.formData)) {
    data.append(key, val);
  }

  const url = new URL('http://localhost:5173/');
  const request = {
    formData: async () => data,
  };

  const event: any = {
    url,
    request,
    params: {},
    locals: {
      user: options.user !== undefined ? options.user : null,
      session: null,
    },
    cookies: {
      get: () => undefined,
      set: () => {},
      delete: () => {},
      getAll: () => [],
    },
  };

  return event;
}

describe('Challenger M3: Multi-Tenant Data Isolation & IDOR Verification Suite', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  // =========================================================================
  // 1. User Registration & Setup Verification
  // =========================================================================
  describe('Step 1: User Registration & Base Setup', () => {
    it('CH3-01: should successfully register User A and User B with isolated credentials and user records', async () => {
      const userAData = await createTestUser({ email: 'tenant_a@notes.internal', password: 'PasswordUserA123!' });
      const userBData = await createTestUser({ email: 'tenant_b@notes.internal', password: 'PasswordUserB123!' });
      const sessionA = await createTestSession(userAData.user.id);
      const sessionB = await createTestSession(userBData.user.id);

      expect(userAData.user.id).toBeDefined();
      expect(userBData.user.id).toBeDefined();
      expect(userAData.user.id).not.toBe(userBData.user.id);
      expect(userAData.user.email).toBe('tenant_a@notes.internal');
      expect(userBData.user.email).toBe('tenant_b@notes.internal');

      // Verify sessions are created independently
      expect(sessionA.session.userId).toBe(userAData.user.id);
      expect(sessionB.session.userId).toBe(userBData.user.id);

      // Verify DB persistence
      const [dbA] = await db.select().from(users).where(eq(users.id, userAData.user.id));
      const [dbB] = await db.select().from(users).where(eq(users.id, userBData.user.id));
      expect(dbA).toBeDefined();
      expect(dbB).toBeDefined();
      expect(dbA.email).toBe('tenant_a@notes.internal');
      expect(dbB.email).toBe('tenant_b@notes.internal');
    });
  });

  // =========================================================================
  // 2. Note Creation (Pinned, Tagged, Unpinned) by User A
  // =========================================================================
  describe('Step 2: User A Creates Pinned and Tagged Notes', () => {
    it('CH3-02: should create pinned, tagged, and unpinned notes properly assigned to User A', async () => {
      const { user: userA } = await createTestUser({ email: 'alice@isolation.test' });

      // Create Note 1: Pinned + Tagged
      const noteA1 = await notesService.createNote(userA.id, {
        title: 'Alice Confidential Roadmap',
        content: 'Confidential strategic roadmap for 2026.',
        isPinned: true,
        tagNames: ['confidential', 'roadmap'],
      });

      // Create Note 2: Unpinned + Tagged
      const noteA2 = await notesService.createNote(userA.id, {
        title: 'Alice Meeting Notes',
        content: 'Action items from Q3 sync.',
        isPinned: false,
        tagNames: ['meetings', 'confidential'],
      });

      // Create Note 3: Unpinned + Untagged
      const noteA3 = await notesService.createNote(userA.id, {
        title: 'Alice Personal Ideas',
        content: 'Random thoughts and drafts.',
        isPinned: false,
      });

      expect(noteA1.userId).toBe(userA.id);
      expect(noteA1.isPinned).toBe(true);
      expect(noteA1.tags.map((t) => t.name).sort()).toEqual(['confidential', 'roadmap']);

      expect(noteA2.userId).toBe(userA.id);
      expect(noteA2.isPinned).toBe(false);
      expect(noteA2.tags.map((t) => t.name).sort()).toEqual(['confidential', 'meetings']);

      expect(noteA3.userId).toBe(userA.id);
      expect(noteA3.isPinned).toBe(false);
      expect(noteA3.tags.length).toBe(0);

      // Verify User A notes count
      const allUserANotes = await notesService.getNotes(userA.id);
      expect(allUserANotes.length).toBe(3);
    });
  });

  // =========================================================================
  // 3. IDOR Defense Verification: User B Attempts Access to User A's Notes
  // =========================================================================
  describe('Step 3: User B IDOR Attempts (GET, PUT, PATCH, DELETE)', () => {
    it('CH3-03: User B attempts GET /api/notes/:id on User A note -> MUST return 404 Not Found', async () => {
      const { user: userA } = await createTestUser({ email: 'victim_a@tenant.test' });
      const { user: userB } = await createTestUser({ email: 'attacker_b@tenant.test' });

      const noteA = await notesService.createNote(userA.id, {
        title: 'Top Secret Plan',
        content: 'Secret credentials and vault keys.',
        isPinned: true,
        tagNames: ['secret'],
      });

      // User B attempts REST GET
      const event = createMockApiEvent({
        pathname: `/api/notes/${noteA.id}`,
        user: userB,
        params: { id: noteA.id },
      });

      const response = await getNoteItem(event);
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Note not found');

      // Verify Service Layer also returns null
      const serviceResult = await notesService.getNoteById(userB.id, noteA.id);
      expect(serviceResult).toBeNull();
    });

    it('CH3-04: User B attempts PUT /api/notes/:id on User A note -> MUST return 404 and leave data unmodified', async () => {
      const { user: userA } = await createTestUser({ email: 'victim_a@tenant.test' });
      const { user: userB } = await createTestUser({ email: 'attacker_b@tenant.test' });

      const noteA = await notesService.createNote(userA.id, {
        title: 'Original Title',
        content: 'Original Content',
        isPinned: true,
        tagNames: ['original_tag'],
      });

      // User B attempts REST PUT
      const event = createMockApiEvent({
        pathname: `/api/notes/${noteA.id}`,
        method: 'PUT',
        user: userB,
        params: { id: noteA.id },
        body: {
          title: 'Hacked by User B',
          content: 'Compromised content',
          isPinned: false,
          tagNames: ['hacked'],
        },
      });

      const response = await updateNoteEndpoint(event);
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Note not found');

      // Verify in DB that User A's note is 100% intact
      const persistedNote = await notesService.getNoteById(userA.id, noteA.id);
      expect(persistedNote).not.toBeNull();
      expect(persistedNote?.title).toBe('Original Title');
      expect(persistedNote?.content).toBe('Original Content');
      expect(persistedNote?.isPinned).toBe(true);
      expect(persistedNote?.tags.map((t) => t.name)).toEqual(['original_tag']);

      // Verify Service Layer direct update attempt also returns null
      const serviceUpdate = await notesService.updateNote(userB.id, noteA.id, {
        title: 'Service Hack Attempt',
      });
      expect(serviceUpdate).toBeNull();
    });

    it('CH3-05: User B attempts PATCH /api/notes/:id on User A note -> MUST return 404 and leave data unmodified', async () => {
      const { user: userA } = await createTestUser({ email: 'victim_a@tenant.test' });
      const { user: userB } = await createTestUser({ email: 'attacker_b@tenant.test' });

      const noteA = await notesService.createNote(userA.id, {
        title: 'Unchanged Title',
        content: 'Unchanged Content',
        isPinned: true,
      });

      // User B attempts REST PATCH
      const event = createMockApiEvent({
        pathname: `/api/notes/${noteA.id}`,
        method: 'PATCH',
        user: userB,
        params: { id: noteA.id },
        body: {
          content: 'Injected Content',
        },
      });

      const response = await patchNoteEndpoint(event);
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Note not found');

      // Verify in DB that User A's note is unchanged
      const persistedNote = await notesService.getNoteById(userA.id, noteA.id);
      expect(persistedNote?.content).toBe('Unchanged Content');
    });

    it('CH3-06: User B attempts DELETE /api/notes/:id on User A note -> MUST return 404 and NOT delete the note', async () => {
      const { user: userA } = await createTestUser({ email: 'victim_a@tenant.test' });
      const { user: userB } = await createTestUser({ email: 'attacker_b@tenant.test' });

      const noteA = await notesService.createNote(userA.id, {
        title: 'Do Not Delete Me',
        content: 'Crucial User A note.',
        tagNames: ['critical'],
      });

      // User B attempts REST DELETE
      const event = createMockApiEvent({
        pathname: `/api/notes/${noteA.id}`,
        method: 'DELETE',
        user: userB,
        params: { id: noteA.id },
      });

      const response = await deleteNoteEndpoint(event);
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Note not found');

      // Verify in DB that User A's note still exists
      const persistedNote = await notesService.getNoteById(userA.id, noteA.id);
      expect(persistedNote).not.toBeNull();
      expect(persistedNote?.title).toBe('Do Not Delete Me');

      // Verify Service Layer direct delete attempt returns false
      const serviceDelete = await notesService.deleteNote(userB.id, noteA.id);
      expect(serviceDelete).toBe(false);

      const [dbNote] = await db.select().from(notes).where(eq(notes.id, noteA.id));
      expect(dbNote).toBeDefined();
    });

    it('CH3-07: User B attempts Form Actions (update, togglePin, delete) on User A note -> MUST be blocked', async () => {
      const { user: userA } = await createTestUser();
      const { user: userB } = await createTestUser();

      const noteA = await notesService.createNote(userA.id, {
        title: 'Original Form Action Target',
        content: 'Original Body',
        isPinned: false,
      });

      // Form Action 1: Update
      const updateEvt = createMockActionEvent({
        user: userB,
        formData: {
          id: noteA.id,
          title: 'Tampered by Form Action',
        },
      });
      const updateRes: any = await appActions.update(updateEvt);
      expect(updateRes.status).toBe(404);

      // Form Action 2: Toggle Pin
      const pinEvt = createMockActionEvent({
        user: userB,
        formData: {
          id: noteA.id,
          isPinned: 'true',
        },
      });
      const pinRes: any = await appActions.togglePin(pinEvt);
      expect(pinRes.status).toBe(404);

      // Form Action 3: Delete
      const delEvt = createMockActionEvent({
        user: userB,
        formData: {
          id: noteA.id,
        },
      });
      const delRes: any = await appActions.delete(delEvt);
      expect(delRes.status).toBe(404);

      // Confirm User A's note is unchanged
      const persistedNote = await notesService.getNoteById(userA.id, noteA.id);
      expect(persistedNote?.title).toBe('Original Form Action Target');
      expect(persistedNote?.isPinned).toBe(false);
    });
  });

  // =========================================================================
  // 4. Cross-Tenant Tag ID Query & Information Leakage Defense
  // =========================================================================
  describe('Step 4: Tag ID Querying & Cross-Tenant Leakage Defense', () => {
    it('CH3-08: User B queries notes using User A tagId -> MUST return empty array [] without disclosing notes or metadata', async () => {
      const { user: userA } = await createTestUser({ email: 'tag_owner_a@tenant.test' });
      const { user: userB } = await createTestUser({ email: 'tag_snooper_b@tenant.test' });

      const noteA = await notesService.createNote(userA.id, {
        title: 'Alice Top Secret Tagged Note',
        content: 'Internal secret details.',
        tagNames: ['super_secret_tag'],
      });

      const tagA = noteA.tags.find((t) => t.name === 'super_secret_tag');
      expect(tagA).toBeDefined();

      // REST API query by User B using tagA.id
      const apiEvent = createMockApiEvent({
        pathname: '/api/notes',
        user: userB,
        searchParams: { tagId: tagA!.id },
      });

      const apiResponse = await getNotesList(apiEvent);
      expect(apiResponse.status).toBe(200);
      const apiData = await apiResponse.json();
      expect(Array.isArray(apiData)).toBe(true);
      expect(apiData.length).toBe(0);

      // Service Layer query by User B using tagA.id
      const serviceData = await notesService.getNotes(userB.id, { tagId: tagA!.id });
      expect(serviceData).toEqual([]);

      // App Dashboard Load query by User B using tagA.id
      const loadUrl = new URL(`http://localhost:5173/?tagId=${tagA!.id}`);
      const loadEvent: any = {
        url: loadUrl,
        locals: { user: userB, session: null },
      };
      const pageData: any = await appPageLoad(loadEvent);
      expect(pageData.notes).toEqual([]);
    });

    it('CH3-09: User B querying tags list (/api/tags) -> MUST only return User B tags and never User A tags', async () => {
      const { user: userA } = await createTestUser();
      const { user: userB } = await createTestUser();

      await createTestTag(userA.id, 'alpha_tag_a');
      await createTestTag(userA.id, 'beta_tag_a');
      await createTestTag(userB.id, 'gamma_tag_b');

      // User B fetches tags via REST
      const eventB = createMockApiEvent({ pathname: '/api/tags', user: userB });
      const responseB = await getTagsList(eventB);
      expect(responseB.status).toBe(200);
      const tagsB = await responseB.json();
      expect(tagsB.length).toBe(1);
      expect(tagsB[0].name).toBe('gamma_tag_b');

      // User B tries to delete User A's tag
      const [tagA] = await db.select().from(tags).where(eq(tags.name, 'alpha_tag_a'));
      const deleteEvt = createMockApiEvent({
        pathname: '/api/tags',
        method: 'DELETE',
        user: userB,
        searchParams: { id: tagA.id },
      });
      const delResponse = await deleteTagEndpoint(deleteEvt);
      expect(delResponse.status).toBe(404);

      // Verify User A tag still exists
      const [persistedTagA] = await db.select().from(tags).where(eq(tags.id, tagA.id));
      expect(persistedTagA).toBeDefined();
    });

    it('CH3-10: Identical tag names across users must have isolated tag IDs and note associations', async () => {
      const { user: userA } = await createTestUser();
      const { user: userB } = await createTestUser();

      const noteA = await notesService.createNote(userA.id, {
        title: 'Note A Work',
        tagNames: ['work'],
      });

      const noteB = await notesService.createNote(userB.id, {
        title: 'Note B Work',
        tagNames: ['work'],
      });

      const tagA = noteA.tags.find((t) => t.name === 'work')!;
      const tagB = noteB.tags.find((t) => t.name === 'work')!;

      // Distinct IDs in DB
      expect(tagA.id).not.toBe(tagB.id);
      expect(tagA.userId).toBe(userA.id);
      expect(tagB.userId).toBe(userB.id);

      // Filtering by User A tagId returns only User A note for User A
      const notesA = await notesService.getNotes(userA.id, { tagId: tagA.id });
      expect(notesA.length).toBe(1);
      expect(notesA[0].id).toBe(noteA.id);

      // Filtering by User A tagId for User B returns empty array
      const notesBWithTagA = await notesService.getNotes(userB.id, { tagId: tagA.id });
      expect(notesBWithTagA.length).toBe(0);

      // Filtering by User B tagId for User B returns only User B note
      const notesBWithTagB = await notesService.getNotes(userB.id, { tagId: tagB.id });
      expect(notesBWithTagB.length).toBe(1);
      expect(notesBWithTagB[0].id).toBe(noteB.id);
    });
  });

  // =========================================================================
  // 5. Account & Data Deletion Isolation
  // =========================================================================
  describe('Step 5: User B Deletes Account/Notes -> User A Intact Verification', () => {
    it('CH3-11: Deleting User B notes and tags must leave User A notes, tags, and note_tags completely intact', async () => {
      const { user: userA } = await createTestUser({ email: 'user_a_stable@notes.test' });
      const { user: userB } = await createTestUser({ email: 'user_b_ephemeral@notes.test' });

      // User A creates 3 notes with tags
      const noteA1 = await notesService.createNote(userA.id, {
        title: 'User A Note 1',
        content: 'Content A1',
        isPinned: true,
        tagNames: ['shared_name', 'tag_a_only'],
      });
      const noteA2 = await notesService.createNote(userA.id, {
        title: 'User A Note 2',
        content: 'Content A2',
        isPinned: false,
        tagNames: ['tag_a_only'],
      });

      // User B creates 2 notes with tags
      const noteB1 = await notesService.createNote(userB.id, {
        title: 'User B Note 1',
        content: 'Content B1',
        tagNames: ['shared_name', 'tag_b_only'],
      });
      const noteB2 = await notesService.createNote(userB.id, {
        title: 'User B Note 2',
        content: 'Content B2',
        tagNames: ['tag_b_only'],
      });

      // User B deletes their notes
      await notesService.deleteNote(userB.id, noteB1.id);
      await notesService.deleteNote(userB.id, noteB2.id);

      // User B deletes their tags
      const tagsB = await notesService.getUserTags(userB.id);
      for (const t of tagsB) {
        await notesService.deleteTag(userB.id, t.id);
      }

      // Verify User B has 0 notes and 0 tags
      expect((await notesService.getNotes(userB.id)).length).toBe(0);
      expect((await notesService.getUserTags(userB.id)).length).toBe(0);

      // Verify User A notes are completely intact
      const userANotesAfter = await notesService.getNotes(userA.id);
      expect(userANotesAfter.length).toBe(2);

      const fetchedA1 = await notesService.getNoteById(userA.id, noteA1.id);
      expect(fetchedA1).not.toBeNull();
      expect(fetchedA1?.title).toBe('User A Note 1');
      expect(fetchedA1?.isPinned).toBe(true);
      expect(fetchedA1?.tags.map((t) => t.name).sort()).toEqual(['shared_name', 'tag_a_only']);

      const fetchedA2 = await notesService.getNoteById(userA.id, noteA2.id);
      expect(fetchedA2).not.toBeNull();
      expect(fetchedA2?.title).toBe('User A Note 2');
      expect(fetchedA2?.tags.map((t) => t.name)).toEqual(['tag_a_only']);

      const tagsA = await notesService.getUserTags(userA.id);
      expect(tagsA.map((t) => t.name).sort()).toEqual(['shared_name', 'tag_a_only']);
    });

    it('CH3-12: Cascading User B account deletion must not affect User A notes, tags, or active sessions', async () => {
      const { user: userA } = await createTestUser({ email: 'surviving_a@notes.test' });
      const { user: userB } = await createTestUser({ email: 'deleted_b@notes.test' });

      // Sessions
      const sessionA1 = await createTestSession(userA.id);
      const sessionA2 = await createTestSession(userA.id);
      const sessionB = await createTestSession(userB.id);

      // Notes
      const noteA = await notesService.createNote(userA.id, {
        title: 'Surviving Note A',
        content: 'Content that must survive User B deletion',
        isPinned: true,
        tagNames: ['permanent'],
      });

      await notesService.createNote(userB.id, {
        title: 'Doomed Note B',
        content: 'Will be deleted',
        tagNames: ['temporary', 'permanent'],
      });

      // Complete User B account deletion (simulating account termination)
      await db.delete(users).where(eq(users.id, userB.id));

      // Verify User B is gone along with sessions, notes, tags
      const userBCheck = await db.select().from(users).where(eq(users.id, userB.id));
      expect(userBCheck.length).toBe(0);

      const userBSessions = await db.select().from(sessions).where(eq(sessions.userId, userB.id));
      expect(userBSessions.length).toBe(0);

      const userBNotes = await db.select().from(notes).where(eq(notes.userId, userB.id));
      expect(userBNotes.length).toBe(0);

      // Verify User A sessions remain completely valid
      const valA1 = await authService.validateSessionToken(sessionA1.token);
      expect(valA1.session).not.toBeNull();
      expect(valA1.user?.id).toBe(userA.id);

      const valA2 = await authService.validateSessionToken(sessionA2.token);
      expect(valA2.session).not.toBeNull();
      expect(valA2.user?.id).toBe(userA.id);

      // Verify User A notes, tags, and junction entries are 100% intact
      const notesA = await notesService.getNotes(userA.id);
      expect(notesA.length).toBe(1);
      expect(notesA[0].id).toBe(noteA.id);
      expect(notesA[0].title).toBe('Surviving Note A');
      expect(notesA[0].isPinned).toBe(true);
      expect(notesA[0].tags.length).toBe(1);
      expect(notesA[0].tags[0].name).toBe('permanent');
    });
  });

  // =========================================================================
  // 6. Adversarial Malformed IDs & Edge Case Stress Testing
  // =========================================================================
  describe('Step 6: Adversarial IDOR, UUID Fuzzing & Stress Tests', () => {
    it('CH3-13: should handle malformed, non-existent, and malicious UUID strings gracefully without SQL injection or unhandled errors', async () => {
      const { user } = await createTestUser();

      const maliciousIds = [
        '00000000-0000-0000-0000-000000000000',
        'non-existent-uuid-string',
        "' OR '1'='1",
        "'; DROP TABLE notes; --",
        '12345',
        'undefined',
        'null',
        '../etc/passwd',
        '{}',
        'a'.repeat(256),
      ];

      for (const malformedId of maliciousIds) {
        // GET
        const getEvt = createMockApiEvent({
          pathname: `/api/notes/${malformedId}`,
          user,
          params: { id: malformedId },
        });
        const getRes = await getNoteItem(getEvt);
        // Either 404 Not Found or 400/500 handled error, never 200 or uncaught crash
        expect([400, 404, 500]).toContain(getRes.status);

        // PUT
        const putEvt = createMockApiEvent({
          pathname: `/api/notes/${malformedId}`,
          method: 'PUT',
          user,
          params: { id: malformedId },
          body: { title: 'Test' },
        });
        const putRes = await updateNoteEndpoint(putEvt);
        expect([400, 404, 500]).toContain(putRes.status);

        // DELETE
        const delEvt = createMockApiEvent({
          pathname: `/api/notes/${malformedId}`,
          method: 'DELETE',
          user,
          params: { id: malformedId },
        });
        const delRes = await deleteNoteEndpoint(delEvt);
        expect([400, 404, 500]).toContain(delRes.status);
      }
    });

    it('CH3-14: should handle concurrent cross-tenant operations with 20 simultaneous read/write requests without cross-talk', async () => {
      const { user: userA } = await createTestUser({ email: 'concurrent_a@notes.test' });
      const { user: userB } = await createTestUser({ email: 'concurrent_b@notes.test' });

      // Pre-create 10 notes for User A
      const notesA = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          notesService.createNote(userA.id, {
            title: `Alice Note ${i}`,
            content: `Content for note ${i}`,
            tagNames: [`tag_a_${i % 3}`],
          })
        )
      );

      // Concurrently:
      // - User A performs updates and reads on their notes
      // - User B attempts IDOR reads and updates on all of User A's notes
      const tasks: Promise<any>[] = [];

      // User A valid reads
      for (const note of notesA) {
        tasks.push(
          notesService.getNoteById(userA.id, note.id).then((res) => {
            expect(res).not.toBeNull();
            expect(res?.userId).toBe(userA.id);
          })
        );
      }

      // User B IDOR read attempts (must all return null / 404)
      for (const note of notesA) {
        tasks.push(
          notesService.getNoteById(userB.id, note.id).then((res) => {
            expect(res).toBeNull();
          })
        );
        tasks.push(
          Promise.resolve(
            getNoteItem(
              createMockApiEvent({
                pathname: `/api/notes/${note.id}`,
                user: userB,
                params: { id: note.id },
              })
            )
          ).then(async (res: Response) => {
            expect(res.status).toBe(404);
          })
        );
        tasks.push(
          Promise.resolve(
            updateNoteEndpoint(
              createMockApiEvent({
                pathname: `/api/notes/${note.id}`,
                method: 'PUT',
                user: userB,
                params: { id: note.id },
                body: { title: 'Concurrent Hack Attempt' },
              })
            )
          ).then(async (res: Response) => {
            expect(res.status).toBe(404);
          })
        );
      }

      await Promise.all(tasks);

      // Verify User A notes remained completely untouched
      const finalNotesA = await notesService.getNotes(userA.id);
      expect(finalNotesA.length).toBe(10);
      for (const n of finalNotesA) {
        expect(n.title).not.toContain('Concurrent Hack Attempt');
      }
    });
  });
});
