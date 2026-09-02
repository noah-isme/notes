import { describe, it, expect, beforeEach } from 'vitest';
import { GET as getNotesList, POST as createNoteEndpoint } from '../../src/routes/api/notes/+server';
import {
  GET as getNoteItem,
  PUT as updateNoteEndpoint,
  DELETE as deleteNoteEndpoint,
} from '../../src/routes/api/notes/[id]/+server';
import {
  GET as getTagsList,
  POST as createTagEndpoint,
  DELETE as deleteTagEndpoint,
} from '../../src/routes/api/tags/+server';
import { actions, load as appPageLoad } from '../../src/routes/(app)/+page.server';
import { db } from '$lib/server/db';
import { notes, tags, noteTags } from '$lib/server/db/schema';
import { cleanDatabase, createTestUser, createTestNote, createTestTag } from '../helpers/db';
import { eq } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';

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

describe('Integration: Notes & Tags REST API Endpoints and Form Actions', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  // =========================================================================
  // 1. /api/notes (Collection Endpoint)
  // =========================================================================
  describe('GET /api/notes', () => {
    it('should return 401 when unauthenticated', async () => {
      const event = createMockApiEvent({ pathname: '/api/notes', user: null });
      const response = await getNotesList(event);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 200 with list of notes for authenticated user', async () => {
      const { user } = await createTestUser();
      await createTestNote(user.id, { title: 'First Note' });
      await createTestNote(user.id, { title: 'Second Note', tagNames: ['work'] });

      const event = createMockApiEvent({ pathname: '/api/notes', user });
      const response = await getNotesList(event);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(2);
      expect(data[0].userId).toBe(user.id);
    });

    it('should filter notes by search query and tagId', async () => {
      const { user } = await createTestUser();
      const n1 = await createTestNote(user.id, { title: 'PostgreSQL Database', content: 'Drizzle ORM', tagNames: ['db'] });
      await createTestNote(user.id, { title: 'React Frontend', content: 'UI components', tagNames: ['frontend'] });

      const dbTag = n1.tags.find((t: any) => t.name === 'db');
      expect(dbTag).toBeDefined();

      const event = createMockApiEvent({
        pathname: '/api/notes',
        user,
        searchParams: { search: 'PostgreSQL', tagId: dbTag!.id },
      });

      const response = await getNotesList(event);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.length).toBe(1);
      expect(data[0].title).toBe('PostgreSQL Database');
    });
  });

  describe('POST /api/notes', () => {
    it('should return 401 when unauthenticated', async () => {
      const event = createMockApiEvent({
        pathname: '/api/notes',
        method: 'POST',
        user: null,
        body: { title: 'Unauthorized Note' },
      });
      const response = await createNoteEndpoint(event);
      expect(response.status).toBe(401);
    });

    it('should create a new note and return 201 with attached tags', async () => {
      const { user } = await createTestUser();
      const event = createMockApiEvent({
        pathname: '/api/notes',
        method: 'POST',
        user,
        body: {
          title: 'API Created Note',
          content: 'Content created via REST API',
          isPinned: true,
          tagNames: ['api', 'v1'],
        },
      });

      const response = await createNoteEndpoint(event);
      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.title).toBe('API Created Note');
      expect(data.content).toBe('Content created via REST API');
      expect(data.isPinned).toBe(true);
      expect(data.tags.length).toBe(2);
    });

    it('should return 400 when title is missing or empty', async () => {
      const { user } = await createTestUser();
      const event = createMockApiEvent({
        pathname: '/api/notes',
        method: 'POST',
        user,
        body: { title: '   ', content: 'No title' },
      });

      const response = await createNoteEndpoint(event);
      expect(response.status).toBe(400);
    });

    it('should return 400 when body is invalid JSON', async () => {
      const { user } = await createTestUser();
      const event = createMockApiEvent({
        pathname: '/api/notes',
        method: 'POST',
        user,
        body: 'invalid-json{',
      });

      const response = await createNoteEndpoint(event);
      expect(response.status).toBe(400);
    });
  });

  // =========================================================================
  // 2. /api/notes/:id (Item Endpoint)
  // =========================================================================
  describe('GET /api/notes/:id', () => {
    it('should return 200 with note details for owner', async () => {
      const { user } = await createTestUser();
      const note = await createTestNote(user.id, { title: 'Inspect Me' });

      const event = createMockApiEvent({
        pathname: `/api/notes/${note.id}`,
        user,
        params: { id: note.id },
      });

      const response = await getNoteItem(event);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBe(note.id);
      expect(data.title).toBe('Inspect Me');
    });

    it('should return 404 when non-owner attempts to read note (tenant isolation)', async () => {
      const { user: owner } = await createTestUser();
      const { user: stranger } = await createTestUser();
      const note = await createTestNote(owner.id, { title: 'Private Note' });

      const event = createMockApiEvent({
        pathname: `/api/notes/${note.id}`,
        user: stranger,
        params: { id: note.id },
      });

      const response = await getNoteItem(event);
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/notes/:id', () => {
    it('should update note title, content, pin, and tags for owner', async () => {
      const { user } = await createTestUser();
      const note = await createTestNote(user.id, { title: 'Before Update', tagNames: ['old'] });

      const event = createMockApiEvent({
        pathname: `/api/notes/${note.id}`,
        method: 'PUT',
        user,
        params: { id: note.id },
        body: {
          title: 'After Update',
          content: 'New content',
          isPinned: true,
          tagNames: ['new', 'updated'],
        },
      });

      const response = await updateNoteEndpoint(event);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.title).toBe('After Update');
      expect(data.content).toBe('New content');
      expect(data.isPinned).toBe(true);
      expect(data.tags.map((t: any) => t.name).sort()).toEqual(['new', 'updated']);
    });

    it('should return 404 when non-owner attempts to update note', async () => {
      const { user: owner } = await createTestUser();
      const { user: stranger } = await createTestUser();
      const note = await createTestNote(owner.id, { title: 'Owner Note' });

      const event = createMockApiEvent({
        pathname: `/api/notes/${note.id}`,
        method: 'PUT',
        user: stranger,
        params: { id: note.id },
        body: { title: 'Hacked Title' },
      });

      const response = await updateNoteEndpoint(event);
      expect(response.status).toBe(404);
    });

    it('should return 400 when update title is invalid', async () => {
      const { user } = await createTestUser();
      const note = await createTestNote(user.id, { title: 'Valid' });

      const event = createMockApiEvent({
        pathname: `/api/notes/${note.id}`,
        method: 'PUT',
        user,
        params: { id: note.id },
        body: { title: '' },
      });

      const response = await updateNoteEndpoint(event);
      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/notes/:id', () => {
    it('should delete note for owner and return 200', async () => {
      const { user } = await createTestUser();
      const note = await createTestNote(user.id, { title: 'To Delete' });

      const event = createMockApiEvent({
        pathname: `/api/notes/${note.id}`,
        method: 'DELETE',
        user,
        params: { id: note.id },
      });

      const response = await deleteNoteEndpoint(event);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      const [persisted] = await db.select().from(notes).where(eq(notes.id, note.id));
      expect(persisted).toBeUndefined();
    });

    it('should return 404 when non-owner attempts to delete note', async () => {
      const { user: owner } = await createTestUser();
      const { user: stranger } = await createTestUser();
      const note = await createTestNote(owner.id, { title: 'Protected Note' });

      const event = createMockApiEvent({
        pathname: `/api/notes/${note.id}`,
        method: 'DELETE',
        user: stranger,
        params: { id: note.id },
      });

      const response = await deleteNoteEndpoint(event);
      expect(response.status).toBe(404);

      const [persisted] = await db.select().from(notes).where(eq(notes.id, note.id));
      expect(persisted).toBeDefined();
    });
  });

  // =========================================================================
  // 3. /api/tags (Tags Management Endpoint)
  // =========================================================================
  describe('Tags API (/api/tags)', () => {
    it('GET: should return 200 with list of user tags', async () => {
      const { user } = await createTestUser();
      await createTestTag(user.id, 'tag1');
      await createTestTag(user.id, 'tag2');

      const event = createMockApiEvent({ pathname: '/api/tags', user });
      const response = await getTagsList(event);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.length).toBe(2);
      expect(data.map((t: any) => t.name).sort()).toEqual(['tag1', 'tag2']);
    });

    it('POST: should create a new tag and return 201', async () => {
      const { user } = await createTestUser();
      const event = createMockApiEvent({
        pathname: '/api/tags',
        method: 'POST',
        user,
        body: { name: 'productivity_2026' },
      });

      const response = await createTagEndpoint(event);
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.name).toBe('productivity_2026');
      expect(data.userId).toBe(user.id);
    });

    it('POST: should return 400 for invalid tag name (spaces/special symbols)', async () => {
      const { user } = await createTestUser();
      const event = createMockApiEvent({
        pathname: '/api/tags',
        method: 'POST',
        user,
        body: { name: 'invalid tag with spaces!' },
      });

      const response = await createTagEndpoint(event);
      expect(response.status).toBe(400);
    });

    it('DELETE: should delete tag by id and return 200', async () => {
      const { user } = await createTestUser();
      const tag = await createTestTag(user.id, 'obsolete_tag');

      const event = createMockApiEvent({
        pathname: '/api/tags',
        method: 'DELETE',
        user,
        searchParams: { id: tag.id },
      });

      const response = await deleteTagEndpoint(event);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      const [persisted] = await db.select().from(tags).where(eq(tags.id, tag.id));
      expect(persisted).toBeUndefined();
    });

    it('DELETE: should return 404 when trying to delete another user tag', async () => {
      const { user: userA } = await createTestUser();
      const { user: userB } = await createTestUser();
      const tagA = await createTestTag(userA.id, 'user_a_tag');

      const event = createMockApiEvent({
        pathname: '/api/tags',
        method: 'DELETE',
        user: userB,
        searchParams: { id: tagA.id },
      });

      const response = await deleteTagEndpoint(event);
      expect(response.status).toBe(404);
    });
  });

  // =========================================================================
  // 4. Form Actions in (app)/+page.server.ts
  // =========================================================================
  describe('App Form Actions', () => {
    it('create action: should create note from form data', async () => {
      const { user } = await createTestUser();
      const event = createMockActionEvent({
        user,
        formData: {
          title: 'Form Action Note',
          content: 'Submitted from dashboard form',
          isPinned: 'true',
          tags: 'dashboard, form',
        },
      });

      const result: any = await actions.create(event);
      expect(result.success).toBe(true);
      expect(result.note.title).toBe('Form Action Note');
      expect(result.note.tags.length).toBe(2);
    });

    it('update action: should update existing note', async () => {
      const { user } = await createTestUser();
      const note = await createTestNote(user.id, { title: 'Initial' });

      const event = createMockActionEvent({
        user,
        formData: {
          id: note.id,
          title: 'Updated from Action',
          content: 'New content',
          isPinned: 'false',
        },
      });

      const result: any = await actions.update(event);
      expect(result.success).toBe(true);
      expect(result.note.title).toBe('Updated from Action');
    });

    it('togglePin action: should toggle pin status', async () => {
      const { user } = await createTestUser();
      const note = await createTestNote(user.id, { title: 'Toggle Pin Note', isPinned: false });

      const event = createMockActionEvent({
        user,
        formData: {
          id: note.id,
          isPinned: 'true',
        },
      });

      const result: any = await actions.togglePin(event);
      expect(result.success).toBe(true);
      expect(result.note.isPinned).toBe(true);
    });

    it('delete action: should delete note from database', async () => {
      const { user } = await createTestUser();
      const note = await createTestNote(user.id, { title: 'Action Delete Note' });

      const event = createMockActionEvent({
        user,
        formData: { id: note.id },
      });

      const result: any = await actions.delete(event);
      expect(result.success).toBe(true);

      const [persisted] = await db.select().from(notes).where(eq(notes.id, note.id));
      expect(persisted).toBeUndefined();
    });
  });

  // =========================================================================
  // 5. Dashboard Load Function
  // =========================================================================
  describe('Dashboard Load Function', () => {
    it('should load notes, tags, and filters for authenticated user', async () => {
      const { user } = await createTestUser();
      await createTestNote(user.id, { title: 'Loaded Note 1', isPinned: true });
      await createTestNote(user.id, { title: 'Loaded Note 2', tagNames: ['sample'] });

      const url = new URL('http://localhost:5173/?search=Loaded');
      const event: any = {
        url,
        locals: { user, session: null },
      };

      const data: any = await appPageLoad(event);
      expect(data.notes.length).toBe(2);
      expect(data.tags.length).toBe(1);
      expect(data.filters.search).toBe('Loaded');
    });
  });
});
