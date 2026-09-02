import { describe, it, expect, beforeEach } from 'vitest';
import {
  GET as getShareStatus,
  POST as toggleShareApi,
  PATCH as regenerateShareApi,
  DELETE as disableShareApi,
} from '../../src/routes/api/notes/[id]/share/+server';
import { actions as appActions } from '../../src/routes/(app)/+page.server';
import { load as publicShareLoad } from '../../src/routes/(public)/share/[token]/+page.server';
import * as notesService from '$lib/server/notes';
import { cleanDatabase, createTestUser, createTestNote } from '../helpers/db';

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

describe('Integration: Public Note Sharing API & Server Actions', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('REST API: /api/notes/[id]/share', () => {
    it('GET should return 401 for unauthenticated request', async () => {
      const event = createMockApiEvent({
        pathname: '/api/notes/some-id/share',
        user: null,
        params: { id: 'some-id' },
      });
      const response = await getShareStatus(event);
      expect(response.status).toBe(401);
    });

    it('POST should enable sharing and return shareUrl for owner', async () => {
      const { user } = await createTestUser();
      const note = await createTestNote(user.id, { title: 'REST API Share Test' });

      const event = createMockApiEvent({
        pathname: `/api/notes/${note.id}/share`,
        method: 'POST',
        user,
        params: { id: note.id },
      });

      const response = await toggleShareApi(event);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.isPublic).toBe(true);
      expect(data.shareToken).toBeDefined();
      expect(data.shareUrl).toContain(`/share/${data.shareToken}`);
    });

    it('PATCH should regenerate share token for owner', async () => {
      const { user } = await createTestUser();
      const note = await createTestNote(user.id, { title: 'Regenerate API Test' });
      const initial = await notesService.enableShare(user.id, note.id);
      const initialToken = initial?.shareToken;

      const event = createMockApiEvent({
        pathname: `/api/notes/${note.id}/share`,
        method: 'PATCH',
        user,
        params: { id: note.id },
      });

      const response = await regenerateShareApi(event);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.isPublic).toBe(true);
      expect(data.shareToken).not.toBe(initialToken);
      expect(data.shareUrl).toContain(`/share/${data.shareToken}`);
    });

    it('DELETE should disable sharing for owner', async () => {
      const { user } = await createTestUser();
      const note = await createTestNote(user.id, { title: 'Disable API Test' });
      await notesService.enableShare(user.id, note.id);

      const event = createMockApiEvent({
        pathname: `/api/notes/${note.id}/share`,
        method: 'DELETE',
        user,
        params: { id: note.id },
      });

      const response = await disableShareApi(event);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.isPublic).toBe(false);
      expect(data.shareUrl).toBeNull();
    });

    it('should return 404 when non-owner attempts to toggle sharing (tenant isolation)', async () => {
      const { user: owner } = await createTestUser();
      const { user: stranger } = await createTestUser();
      const note = await createTestNote(owner.id, { title: 'Private Owner Note' });

      const event = createMockApiEvent({
        pathname: `/api/notes/${note.id}/share`,
        method: 'POST',
        user: stranger,
        params: { id: note.id },
      });

      const response = await toggleShareApi(event);
      expect(response.status).toBe(404);
    });
  });

  describe('Server Actions in (app)/+page.server.ts', () => {
    it('enableShare action: enables public sharing', async () => {
      const { user } = await createTestUser();
      const note = await createTestNote(user.id, { title: 'Action Share Test' });

      const event = createMockActionEvent({
        user,
        formData: { id: note.id },
      });

      const result: any = await appActions.enableShare(event);
      expect(result.success).toBe(true);
      expect(result.note.isPublic).toBe(true);
      expect(result.note.shareToken).toBeDefined();
    });

    it('disableShare action: disables public sharing', async () => {
      const { user } = await createTestUser();
      const note = await createTestNote(user.id, { title: 'Action Disable Test' });
      await notesService.enableShare(user.id, note.id);

      const event = createMockActionEvent({
        user,
        formData: { id: note.id },
      });

      const result: any = await appActions.disableShare(event);
      expect(result.success).toBe(true);
      expect(result.note.isPublic).toBe(false);
    });

    it('regenerateShareToken action: rotates share token', async () => {
      const { user } = await createTestUser();
      const note = await createTestNote(user.id, { title: 'Action Rotate Test' });
      const initial = await notesService.enableShare(user.id, note.id);

      const event = createMockActionEvent({
        user,
        formData: { id: note.id },
      });

      const result: any = await appActions.regenerateShareToken(event);
      expect(result.success).toBe(true);
      expect(result.note.isPublic).toBe(true);
      expect(result.note.shareToken).not.toBe(initial?.shareToken);
    });
  });

  describe('Public Route Server Load: /share/[token]', () => {
    it('should successfully load public note for unauthenticated visitor', async () => {
      const { user } = await createTestUser({ email: 'ada@lovelace.org' });
      const note = await createTestNote(user.id, {
        title: 'Analytical Engine Algorithms',
        content: 'First computer program.',
      });
      const shared = await notesService.enableShare(user.id, note.id);
      const token = shared?.shareToken!;

      const event: any = {
        params: { token },
        locals: { user: null, session: null },
      };

      const data = (await publicShareLoad(event)) as any;
      expect(data).toBeDefined();
      expect(data.note).toBeDefined();
      expect(data.note.id).toBe(note.id);
      expect(data.note.title).toBe('Analytical Engine Algorithms');
      expect(data.note.author.email).toBe('ada@lovelace.org');
    });

    it('should throw 404 error when token does not exist or note is private', async () => {
      const event: any = {
        params: { token: 'nonexistent-token-123' },
        locals: { user: null, session: null },
      };

      await expect(publicShareLoad(event)).rejects.toThrow();
    });
  });
});
