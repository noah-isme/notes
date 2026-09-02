import { describe, it, expect, beforeEach } from 'vitest';
import * as notesService from '$lib/server/notes';
import { db } from '$lib/server/db';
import { notes } from '$lib/server/db/schema';
import { cleanDatabase, createTestUser, createTestNote } from '../helpers/db';
import { eq } from 'drizzle-orm';

describe('Integration: Public Note Sharing Service Layer', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('enableShare', () => {
    it('should generate a URL-safe token and set isPublic to true for owner', async () => {
      const { user } = await createTestUser();
      const note = await createTestNote(user.id, {
        title: 'Shareable Note',
        content: 'Public content',
      });

      const shared = await notesService.enableShare(user.id, note.id);
      expect(shared).not.toBeNull();
      expect(shared?.isPublic).toBe(true);
      expect(shared?.shareToken).toBeDefined();
      expect(typeof shared?.shareToken).toBe('string');
      expect(shared?.shareToken!.length).toBeGreaterThanOrEqual(32);

      // Verify persisted state in DB
      const [persisted] = await db
        .select()
        .from(notes)
        .where(eq(notes.id, note.id));
      expect(persisted.isPublic).toBe(true);
      expect(persisted.shareToken).toBe(shared?.shareToken);
    });

    it('should reuse existing token when enabling share if token already exists', async () => {
      const { user } = await createTestUser();
      const note = await createTestNote(user.id, { title: 'Reuse Token Note' });

      const shared1 = await notesService.enableShare(user.id, note.id);
      const token1 = shared1?.shareToken;
      expect(token1).toBeDefined();

      // Disable share
      await notesService.disableShare(user.id, note.id);

      // Re-enable share
      const shared2 = await notesService.enableShare(user.id, note.id);
      expect(shared2?.isPublic).toBe(true);
      expect(shared2?.shareToken).toBe(token1);
    });

    it('should return null when unauthorized user attempts to enable share', async () => {
      const { user: owner } = await createTestUser();
      const { user: stranger } = await createTestUser();
      const note = await createTestNote(owner.id, { title: 'Owner Private Note' });

      const result = await notesService.enableShare(stranger.id, note.id);
      expect(result).toBeNull();

      // Verify DB note remains private
      const [persisted] = await db
        .select()
        .from(notes)
        .where(eq(notes.id, note.id));
      expect(persisted.isPublic).toBe(false);
      expect(persisted.shareToken).toBeNull();
    });
  });

  describe('disableShare', () => {
    it('should set isPublic to false and immediately revoke public access', async () => {
      const { user } = await createTestUser();
      const note = await createTestNote(user.id, { title: 'Revoke Note' });

      const shared = await notesService.enableShare(user.id, note.id);
      const token = shared?.shareToken;
      expect(token).toBeDefined();

      // Verify public access works
      const publicBefore = await notesService.getPublicNoteByToken(token!);
      expect(publicBefore).not.toBeNull();
      expect(publicBefore?.title).toBe('Revoke Note');

      // Disable share
      const disabled = await notesService.disableShare(user.id, note.id);
      expect(disabled).not.toBeNull();
      expect(disabled?.isPublic).toBe(false);

      // Verify public access immediately returns null
      const publicAfter = await notesService.getPublicNoteByToken(token!);
      expect(publicAfter).toBeNull();
    });

    it('should prevent unauthorized user from disabling share on another user note', async () => {
      const { user: owner } = await createTestUser();
      const { user: stranger } = await createTestUser();
      const note = await createTestNote(owner.id, { title: 'Owner Note' });
      await notesService.enableShare(owner.id, note.id);

      const result = await notesService.disableShare(stranger.id, note.id);
      expect(result).toBeNull();

      // Verify still public
      const [persisted] = await db
        .select()
        .from(notes)
        .where(eq(notes.id, note.id));
      expect(persisted.isPublic).toBe(true);
    });
  });

  describe('regenerateShareToken', () => {
    it('should rotate the token and invalidate previous links immediately', async () => {
      const { user } = await createTestUser();
      const note = await createTestNote(user.id, { title: 'Rotate Token Note' });

      const firstShare = await notesService.enableShare(user.id, note.id);
      const firstToken = firstShare?.shareToken!;
      expect(firstToken).toBeDefined();

      // Verify first token resolves note
      const fetchWithFirstToken = await notesService.getPublicNoteByToken(firstToken);
      expect(fetchWithFirstToken).not.toBeNull();

      // Regenerate token
      const regenerated = await notesService.regenerateShareToken(user.id, note.id);
      const secondToken = regenerated?.shareToken!;
      expect(secondToken).toBeDefined();
      expect(secondToken).not.toEqual(firstToken);
      expect(regenerated?.isPublic).toBe(true);

      // Old token MUST immediately return null
      const fetchWithOldToken = await notesService.getPublicNoteByToken(firstToken);
      expect(fetchWithOldToken).toBeNull();

      // New token MUST return the note
      const fetchWithNewToken = await notesService.getPublicNoteByToken(secondToken);
      expect(fetchWithNewToken).not.toBeNull();
      expect(fetchWithNewToken?.id).toBe(note.id);
    });

    it('should return null when unauthorized user attempts to rotate share token', async () => {
      const { user: owner } = await createTestUser();
      const { user: stranger } = await createTestUser();
      const note = await createTestNote(owner.id, { title: 'Owner Note' });
      const shared = await notesService.enableShare(owner.id, note.id);
      const originalToken = shared?.shareToken;

      const result = await notesService.regenerateShareToken(stranger.id, note.id);
      expect(result).toBeNull();

      // Verify original token is unchanged
      const [persisted] = await db
        .select()
        .from(notes)
        .where(eq(notes.id, note.id));
      expect(persisted.shareToken).toBe(originalToken);
    });
  });

  describe('getPublicNoteByToken', () => {
    it('should retrieve public note with author attribution and tags when isPublic is true', async () => {
      const { user } = await createTestUser({ email: 'grace@hopper.org' });
      const note = await createTestNote(user.id, {
        title: 'Compiler Design',
        content: '# Nanoseconds\n\n```mermaid\ngraph LR\nA --> B\n```',
        tagNames: ['cs', 'hardware'],
      });

      const shared = await notesService.enableShare(user.id, note.id);
      const token = shared?.shareToken!;

      const publicNote = await notesService.getPublicNoteByToken(token);
      expect(publicNote).not.toBeNull();
      expect(publicNote?.id).toBe(note.id);
      expect(publicNote?.title).toBe('Compiler Design');
      expect(publicNote?.author).toBeDefined();
      expect(publicNote?.author.displayName).toBe('grace');
      expect((publicNote?.author as any).email).toBeUndefined();
      expect((publicNote?.author as any).id).toBeUndefined();
      expect(publicNote?.tags.length).toBe(2);
      expect(publicNote?.tags.map((t) => t.name).sort()).toEqual(['cs', 'hardware']);
    });

    it('should return null when token does not exist', async () => {
      const nonExistent = await notesService.getPublicNoteByToken('non-existent-token-xyz-12345');
      expect(nonExistent).toBeNull();
    });

    it('should return null when token is empty or whitespace', async () => {
      expect(await notesService.getPublicNoteByToken('')).toBeNull();
      expect(await notesService.getPublicNoteByToken('   ')).toBeNull();
      expect(await notesService.getPublicNoteByToken(null as any)).toBeNull();
    });

    it('should return null when note exists with token but isPublic is false', async () => {
      const { user } = await createTestUser();
      const note = await createTestNote(user.id, { title: 'Draft Note' });
      const shared = await notesService.enableShare(user.id, note.id);
      const token = shared?.shareToken!;

      await notesService.disableShare(user.id, note.id);

      const result = await notesService.getPublicNoteByToken(token);
      expect(result).toBeNull();
    });

    it('should immediately reflect updated note content and tags on public fetch', async () => {
      const { user } = await createTestUser();
      const note = await createTestNote(user.id, {
        title: 'Initial Title',
        content: 'Initial Content',
        tagNames: ['v1'],
      });

      const shared = await notesService.enableShare(user.id, note.id);
      const token = shared?.shareToken!;

      // Verify v1
      const v1 = await notesService.getPublicNoteByToken(token);
      expect(v1?.title).toBe('Initial Title');
      expect(v1?.content).toBe('Initial Content');
      expect(v1?.tags.map((t) => t.name)).toEqual(['v1']);

      // Update note content and tags
      await notesService.updateNote(user.id, note.id, {
        title: 'Updated Title',
        content: 'Updated Content with **bold**',
        tagNames: ['v2', 'reviewed'],
      });

      // Fetch with same token should immediately reflect v2
      const v2 = await notesService.getPublicNoteByToken(token);
      expect(v2?.title).toBe('Updated Title');
      expect(v2?.content).toBe('Updated Content with **bold**');
      expect(v2?.tags.map((t) => t.name).sort()).toEqual(['reviewed', 'v2']);
    });

    it('should immediately invalidate public access when the note is deleted by owner', async () => {
      const { user } = await createTestUser();
      const note = await createTestNote(user.id, { title: 'To Be Deleted Note' });
      const shared = await notesService.enableShare(user.id, note.id);
      const token = shared?.shareToken!;

      expect(await notesService.getPublicNoteByToken(token)).not.toBeNull();

      // Delete note
      await notesService.deleteNote(user.id, note.id);

      // Verify public access returns null
      expect(await notesService.getPublicNoteByToken(token)).toBeNull();
    });

    it('should handle adversarial token inputs (SQLi, special characters, unicode) safely', async () => {
      const adversarialTokens = [
        "' OR '1'='1",
        "'; DROP TABLE notes; --",
        '<script>alert(1)</script>',
        '../../etc/passwd',
        '\\x00\\x01',
        '🚀🔥🌟',
        'a'.repeat(500),
      ];

      for (const token of adversarialTokens) {
        const result = await notesService.getPublicNoteByToken(token);
        expect(result).toBeNull();
      }
    });
  });
});
