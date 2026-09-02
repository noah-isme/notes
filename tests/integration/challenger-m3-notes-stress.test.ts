import { describe, it, expect, beforeEach } from 'vitest';
import * as notesService from '$lib/server/notes';
import * as validationModule from '$lib/utils/validation';
import { db } from '$lib/server/db';
import { users, notes, tags, noteTags } from '$lib/server/db/schema';
import { cleanDatabase, createTestUser, createTestNote, createTestTag } from '../helpers/db';
import { FIXTURES } from '../helpers/fixtures';
import { eq, and } from 'drizzle-orm';
import { GET as getNotesApi, POST as createNoteApi } from '../../src/routes/api/notes/+server';
import {
  GET as getNoteItemApi,
  PUT as updateNoteApi,
  DELETE as deleteNoteApi,
} from '../../src/routes/api/notes/[id]/+server';
import {
  GET as getTagsApi,
  POST as createTagApi,
  DELETE as deleteTagApi,
} from '../../src/routes/api/tags/+server';

/**
 * Mock RequestEvent generator for API testing
 */
function createMockEvent(options: {
  pathname: string;
  method?: string;
  user?: { id: string; email: string } | null;
  params?: Record<string, string>;
  searchParams?: Record<string, string>;
  body?: any;
}) {
  const url = new URL(`http://localhost:5173${options.pathname}`);
  if (options.searchParams) {
    for (const [k, v] of Object.entries(options.searchParams)) {
      url.searchParams.set(k, v);
    }
  }

  const reqInit: RequestInit = {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
  };

  if (options.body !== undefined) {
    reqInit.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  return {
    url,
    request: new Request(url.toString(), reqInit),
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
  } as any;
}

describe('Challenger M3: Comprehensive Notes CRUD, Boundary & Filter Stress Verification', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  // =========================================================================
  // 1. Full CRUD Operations Verification
  // =========================================================================
  describe('1. Notes CRUD Operations', () => {
    it('1.1: Full lifecycle - Create with all attributes, read back, update fields, delete and verify cascade', async () => {
      const { user } = await createTestUser();

      // Create
      const created = await notesService.createNote(user.id, {
        title: 'Full Lifecycle Note',
        content: '# Heading 1\nDetailed content paragraph.',
        isPinned: false,
        tagNames: ['lifecycle', 'alpha'],
      });

      expect(created).toBeDefined();
      expect(created.id).toBeDefined();
      expect(created.title).toBe('Full Lifecycle Note');
      expect(created.content).toBe('# Heading 1\nDetailed content paragraph.');
      expect(created.isPinned).toBe(false);
      expect(created.tags.length).toBe(2);

      // Read by ID
      const fetched = await notesService.getNoteById(user.id, created.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe(created.id);
      expect(fetched?.title).toBe('Full Lifecycle Note');
      expect(fetched?.tags.map((t) => t.name).sort()).toEqual(['alpha', 'lifecycle']);

      // Update title, pin state, and replace tags
      const updated = await notesService.updateNote(user.id, created.id, {
        title: 'Updated Lifecycle Note',
        isPinned: true,
        tagNames: ['beta', 'gamma'],
      });

      expect(updated).not.toBeNull();
      expect(updated?.title).toBe('Updated Lifecycle Note');
      expect(updated?.isPinned).toBe(true);
      expect(updated?.content).toBe('# Heading 1\nDetailed content paragraph.'); // Unchanged
      expect(updated?.tags.map((t) => t.name).sort()).toEqual(['beta', 'gamma']);

      // Delete
      const deleted = await notesService.deleteNote(user.id, created.id);
      expect(deleted).toBe(true);

      // Verify deletion from notes table
      const postDelete = await notesService.getNoteById(user.id, created.id);
      expect(postDelete).toBeNull();

      // Verify orphaned note_tags links cleaned up
      const remainingLinks = await db
        .select()
        .from(noteTags)
        .where(eq(noteTags.noteId, created.id));
      expect(remainingLinks.length).toBe(0);
    });

    it('1.2: Create note with minimal fields (title only, empty content, default unpinned, no tags)', async () => {
      const { user } = await createTestUser();
      const note = await notesService.createNote(user.id, {
        title: 'Minimalist Note',
      });

      expect(note.title).toBe('Minimalist Note');
      expect(note.content).toBe('');
      expect(note.isPinned).toBe(false);
      expect(note.tags).toEqual([]);
    });

    it('1.3: Update non-existent note returns null safely', async () => {
      const { user } = await createTestUser();
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await notesService.updateNote(user.id, fakeId, { title: 'Ghost' });
      expect(res).toBeNull();
    });

    it('1.4: Delete non-existent note returns false safely', async () => {
      const { user } = await createTestUser();
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await notesService.deleteNote(user.id, fakeId);
      expect(res).toBe(false);
    });

    it('1.5: REST API CRUD: create, get, update, delete via HTTP endpoints', async () => {
      const { user } = await createTestUser();

      // POST /api/notes
      const postRes = await createNoteApi(
        createMockEvent({
          pathname: '/api/notes',
          method: 'POST',
          user,
          body: { title: 'REST Note', content: 'REST Body', isPinned: true, tagNames: ['rest'] },
        })
      );
      expect(postRes.status).toBe(201);
      const postData = await postRes.json();
      const noteId = postData.id;

      // GET /api/notes/:id
      const getRes = await getNoteItemApi(
        createMockEvent({
          pathname: `/api/notes/${noteId}`,
          user,
          params: { id: noteId },
        })
      );
      expect(getRes.status).toBe(200);
      const getData = await getRes.json();
      expect(getData.title).toBe('REST Note');

      // PUT /api/notes/:id
      const putRes = await updateNoteApi(
        createMockEvent({
          pathname: `/api/notes/${noteId}`,
          method: 'PUT',
          user,
          params: { id: noteId },
          body: { title: 'REST Note Modified', isPinned: false },
        })
      );
      expect(putRes.status).toBe(200);
      const putData = await putRes.json();
      expect(putData.title).toBe('REST Note Modified');
      expect(putData.isPinned).toBe(false);

      // DELETE /api/notes/:id
      const delRes = await deleteNoteApi(
        createMockEvent({
          pathname: `/api/notes/${noteId}`,
          method: 'DELETE',
          user,
          params: { id: noteId },
        })
      );
      expect(delRes.status).toBe(200);
    });
  });

  // =========================================================================
  // 2. Boundary & Corner Cases Verification
  // =========================================================================
  describe('2. Boundary & Limits Stress Testing', () => {
    it('2.1: Empty and whitespace-only title rejection', async () => {
      const { user } = await createTestUser();
      const invalidTitles = ['', ' ', '   ', '\t', '\n', '\r\n   \t'];

      for (const title of invalidTitles) {
        expect(validationModule.validateNoteInput({ title })).toBe(false);

        await expect(
          notesService.createNote(user.id, { title, content: 'Some content' })
        ).rejects.toThrow();
      }
    });

    it('2.2: 200 vs 201 character title limit boundary', async () => {
      const { user } = await createTestUser();
      const title1Char = 'X';
      const title200Chars = 'T'.repeat(200);
      const title201Chars = 'T'.repeat(201);
      const title500Chars = 'T'.repeat(500);

      // 1 char: valid
      expect(validationModule.validateNoteInput({ title: title1Char })).toBe(true);
      const note1 = await notesService.createNote(user.id, { title: title1Char });
      expect(note1.title).toBe(title1Char);

      // 200 chars: valid
      expect(validationModule.validateNoteInput({ title: title200Chars })).toBe(true);
      const note200 = await notesService.createNote(user.id, { title: title200Chars });
      expect(note200.title).toBe(title200Chars);

      // 201 chars: rejected
      expect(validationModule.validateNoteInput({ title: title201Chars })).toBe(false);
      await expect(
        notesService.createNote(user.id, { title: title201Chars })
      ).rejects.toThrow();

      // 500 chars: rejected
      expect(validationModule.validateNoteInput({ title: title500Chars })).toBe(false);
      await expect(
        notesService.createNote(user.id, { title: title500Chars })
      ).rejects.toThrow();

      // Test update rejection on 201 chars
      await expect(
        notesService.updateNote(user.id, note200.id, { title: title201Chars })
      ).rejects.toThrow();
    });

    it('2.3: Title leading/trailing whitespace trimming', async () => {
      const { user } = await createTestUser();
      const paddedTitle = '   Spaces Around Title   ';
      const note = await notesService.createNote(user.id, { title: paddedTitle });
      expect(note.title).toBe('Spaces Around Title');

      const updated = await notesService.updateNote(user.id, note.id, {
        title: '   Updated Spaces   ',
      });
      expect(updated?.title).toBe('Updated Spaces');
    });

    it('2.4: Large ~50KB to ~100KB markdown payload preservation without truncation', async () => {
      const { user } = await createTestUser();
      const largePayload =
        '# Mega Document\n\n' +
        'Section with code blocks and paragraphs.\n'.repeat(1300) +
        '\n\n```json\n{"test": true, "key": "value"}\n```\n';

      expect(largePayload.length).toBeGreaterThan(50000);

      const created = await notesService.createNote(user.id, {
        title: 'Large Payload Stress Note',
        content: largePayload,
      });

      expect(created.content).toBe(largePayload);
      expect(created.content.length).toBe(largePayload.length);

      const retrieved = await notesService.getNoteById(user.id, created.id);
      expect(retrieved?.content).toBe(largePayload);
    });

    it('2.5: SQL Injection resilience in search queries', async () => {
      const { user } = await createTestUser();
      await notesService.createNote(user.id, {
        title: 'Ordinary Note',
        content: 'Safe regular text content.',
      });

      const injections = [
        ...FIXTURES.sqlInjectionPayloads,
        "'; DROP TABLE notes CASCADE; --",
        "' OR 1=1 --",
        "admin' /*",
        "' UNION SELECT * FROM users --",
        "'; DELETE FROM users; --",
        "%' OR '1'='1",
        "\\'; DROP TABLE users; --",
      ];

      for (const injection of injections) {
        // Query must execute without syntax error or data corruption
        const results = await notesService.getNotes(user.id, { search: injection });
        expect(Array.isArray(results)).toBe(true);
      }

      // Verify notes table and users table are completely intact
      const remainingNotes = await notesService.getNotes(user.id);
      expect(remainingNotes.length).toBe(1);
    });
  });

  // =========================================================================
  // 3. Search and Filtering Stress Testing
  // =========================================================================
  describe('3. Search and Filtering Capabilities', () => {
    it('3.1: Multi-tag filtering and tag synchronization', async () => {
      const { user } = await createTestUser();

      const n1 = await notesService.createNote(user.id, {
        title: 'Note 1 - Tech Stack',
        tagNames: ['tech', 'svelte', 'typescript'],
      });
      const n2 = await notesService.createNote(user.id, {
        title: 'Note 2 - Database Architecture',
        tagNames: ['tech', 'postgres', 'drizzle'],
      });
      const n3 = await notesService.createNote(user.id, {
        title: 'Note 3 - Personal Goals',
        tagNames: ['personal', 'life'],
      });

      const userTags = await notesService.getUserTags(user.id);
      expect(userTags.length).toBe(7);

      const techTag = userTags.find((t) => t.name === 'tech');
      const svelteTag = userTags.find((t) => t.name === 'svelte');
      const lifeTag = userTags.find((t) => t.name === 'life');

      // Filter by 'tech' tag -> should return Note 1 and Note 2
      const techNotes = await notesService.getNotes(user.id, { tagId: techTag!.id });
      expect(techNotes.length).toBe(2);
      expect(techNotes.map((n) => n.id).sort()).toEqual([n1.id, n2.id].sort());

      // Filter by 'svelte' tag -> should return Note 1 only
      const svelteNotes = await notesService.getNotes(user.id, { tagId: svelteTag!.id });
      expect(svelteNotes.length).toBe(1);
      expect(svelteNotes[0].id).toBe(n1.id);

      // Filter by 'life' tag -> should return Note 3 only
      const lifeNotes = await notesService.getNotes(user.id, { tagId: lifeTag!.id });
      expect(lifeNotes.length).toBe(1);
      expect(lifeNotes[0].id).toBe(n3.id);
    });

    it('3.2: Keyword search across title and content (case-insensitive & substrings)', async () => {
      const { user } = await createTestUser();

      await notesService.createNote(user.id, {
        title: 'Quantum Computing Fundamentals',
        content: 'Superposition and entanglement principles.',
      });
      await notesService.createNote(user.id, {
        title: 'Classical Algorithms',
        content: 'Exploring Dijkstra and Bellman-Ford shortest quantum path alternatives.',
      });
      await notesService.createNote(user.id, {
        title: 'Recipe for Sourdough',
        content: 'Flour, water, salt, active starter.',
      });

      // Search in title: 'quantum' (lower case matching uppercase 'Quantum')
      const titleMatches = await notesService.getNotes(user.id, { search: 'quantum' });
      // Matches note 1 (in title) and note 2 (in content)
      expect(titleMatches.length).toBe(2);

      // Search in content: 'entanglement'
      const contentMatches = await notesService.getNotes(user.id, { search: 'entanglement' });
      expect(contentMatches.length).toBe(1);
      expect(contentMatches[0].title).toBe('Quantum Computing Fundamentals');

      // Search matching nothing
      const noMatches = await notesService.getNotes(user.id, { search: 'astrophysics' });
      expect(noMatches.length).toBe(0);
    });

    it('3.3: Pinned status filtering and pinned-first sort order', async () => {
      const { user } = await createTestUser();

      // Create unpinned note 1
      const note1 = await notesService.createNote(user.id, {
        title: 'Unpinned Note A',
        isPinned: false,
      });

      // Create unpinned note 2
      const note2 = await notesService.createNote(user.id, {
        title: 'Unpinned Note B',
        isPinned: false,
      });

      // Create pinned note 3
      const note3 = await notesService.createNote(user.id, {
        title: 'Pinned Note C',
        isPinned: true,
      });

      // 1. Check default list order: pinned note MUST be first
      const defaultList = await notesService.getNotes(user.id);
      expect(defaultList.length).toBe(3);
      expect(defaultList[0].id).toBe(note3.id);
      expect(defaultList[0].isPinned).toBe(true);

      // 2. Filter isPinned: true
      const pinnedOnly = await notesService.getNotes(user.id, { isPinned: true });
      expect(pinnedOnly.length).toBe(1);
      expect(pinnedOnly[0].id).toBe(note3.id);

      // 3. Filter isPinned: false
      const unpinnedOnly = await notesService.getNotes(user.id, { isPinned: false });
      expect(unpinnedOnly.length).toBe(2);
      expect(unpinnedOnly.every((n) => n.isPinned === false)).toBe(true);

      // 4. Update note1 to be pinned -> now both note3 and note1 are pinned, note1 was updated most recently so note1 should come first
      await notesService.updateNote(user.id, note1.id, { isPinned: true });

      const updatedList = await notesService.getNotes(user.id);
      expect(updatedList.length).toBe(3);
      expect(updatedList[0].isPinned).toBe(true);
      expect(updatedList[1].isPinned).toBe(true);
      expect(updatedList[2].isPinned).toBe(false);
      expect(updatedList[0].id).toBe(note1.id); // note1 was updated most recently
    });

    it('3.4: Cross-tenant tag isolation: user A cannot view notes by user B tagId', async () => {
      const { user: userA } = await createTestUser();
      const { user: userB } = await createTestUser();

      const noteB = await notesService.createNote(userB.id, {
        title: "User B Secret Note",
        tagNames: ['b_confidential'],
      });

      const tagB = noteB.tags[0];
      expect(tagB).toBeDefined();

      // User A queries using User B's tagId -> must return []
      const leaked = await notesService.getNotes(userA.id, { tagId: tagB.id });
      expect(leaked).toEqual([]);
    });

    it('3.5: Combined multi-facet search + tag + pin filtering', async () => {
      const { user } = await createTestUser();

      const target = await notesService.createNote(user.id, {
        title: 'Target Architecture Note',
        content: 'Deep dive into Postgres Drizzle ORM pooling.',
        isPinned: true,
        tagNames: ['target_tag', 'arch'],
      });

      await notesService.createNote(user.id, {
        title: 'Distractor 1',
        content: 'Postgres details but unpinned',
        isPinned: false,
        tagNames: ['target_tag'],
      });

      await notesService.createNote(user.id, {
        title: 'Distractor 2',
        content: 'Postgres details pinned but wrong tag',
        isPinned: true,
        tagNames: ['other_tag'],
      });

      const targetTag = target.tags.find((t) => t.name === 'target_tag');
      expect(targetTag).toBeDefined();

      const matched = await notesService.getNotes(user.id, {
        tagId: targetTag!.id,
        search: 'Postgres',
        isPinned: true,
      });

      expect(matched.length).toBe(1);
      expect(matched[0].id).toBe(target.id);
    });
  });

  // =========================================================================
  // 4. Tag Management Stress Testing
  // =========================================================================
  describe('4. Tag Management & Validation', () => {
    it('4.1: Tag name validation rules (1-50 chars, alphanumeric, hyphens, underscores)', async () => {
      const validNames = ['a', 'a'.repeat(50), 'tag-1', 'tag_2', 'UPPERCASE', 'MixedCase-123_456'];
      for (const name of validNames) {
        expect(validationModule.validateTagName(name)).toBe(true);
      }

      const invalidNames = ['', ' ', '   ', 'a'.repeat(51), 'tag with spaces', 'tag!@#', 'tag.dot', 'tag/slash'];
      for (const name of invalidNames) {
        expect(validationModule.validateTagName(name)).toBe(false);
      }
    });

    it('4.2: Tag creation, duplicate handling, and deletion via API', async () => {
      const { user } = await createTestUser();

      // Create tag
      const createRes = await createTagApi(
        createMockEvent({
          pathname: '/api/tags',
          method: 'POST',
          user,
          body: { name: 'stress_tag_1' },
        })
      );
      expect(createRes.status).toBe(201);
      const createdTag = await createRes.json();
      expect(createdTag.name).toBe('stress_tag_1');

      // Create duplicate tag (idempotent / retrieves existing)
      const duplicateRes = await createTagApi(
        createMockEvent({
          pathname: '/api/tags',
          method: 'POST',
          user,
          body: { name: 'stress_tag_1' },
        })
      );
      expect(duplicateRes.status).toBe(201);
      const duplicateTag = await duplicateRes.json();
      expect(duplicateTag.id).toBe(createdTag.id);

      // Delete tag
      const deleteRes = await deleteTagApi(
        createMockEvent({
          pathname: '/api/tags',
          method: 'DELETE',
          user,
          searchParams: { id: createdTag.id },
        })
      );
      expect(deleteRes.status).toBe(200);

      // Verify tag is deleted
      const userTags = await notesService.getUserTags(user.id);
      expect(userTags.find((t) => t.id === createdTag.id)).toBeUndefined();
    });
  });
});
