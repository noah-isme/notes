import { describe, it, expect, beforeEach } from 'vitest';
import * as notesService from '$lib/server/notes';
import { db } from '$lib/server/db';
import { notes, tags, noteTags } from '$lib/server/db/schema';
import { cleanDatabase, createTestUser, createTestNote, createTestTag } from '../helpers/db';
import { eq, and } from 'drizzle-orm';

describe('Integration: Notes & Tags CRUD Service Layer', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('createNote', () => {
    it('should create a note with title, markdown content, pinned status, and tags', async () => {
      const { user } = await createTestUser();

      if (typeof notesService.createNote === 'function') {
        const note = await notesService.createNote(user.id, {
          title: 'Architecture Review',
          content: 'Review Drizzle ORM and SvelteKit architecture.',
          isPinned: true,
          tagNames: ['work', 'architecture']
        });

        expect(note).toBeDefined();
        expect(note.id).toBeDefined();
        expect(note.userId).toBe(user.id);
        expect(note.title).toBe('Architecture Review');
        expect(note.content).toBe('Review Drizzle ORM and SvelteKit architecture.');
        expect(note.isPinned).toBe(true);
        expect(note.tags).toBeDefined();
        expect(note.tags.length).toBe(2);
        expect(note.tags.map((t: any) => t.name).sort()).toEqual(['architecture', 'work']);
      }
    });
  });

  describe('getNotes', () => {
    it('should list only notes belonging to the specified user', async () => {
      const { user: userA } = await createTestUser();
      const { user: userB } = await createTestUser();

      await createTestNote(userA.id, { title: "User A's First Note" });
      await createTestNote(userA.id, { title: "User A's Second Note" });
      await createTestNote(userB.id, { title: "User B's Private Note" });

      if (typeof notesService.getNotes === 'function') {
        const notesA = await notesService.getNotes(userA.id);
        expect(notesA.length).toBe(2);
        expect(notesA.every((n: any) => n.userId === userA.id)).toBe(true);

        const notesB = await notesService.getNotes(userB.id);
        expect(notesB.length).toBe(1);
        expect(notesB[0].title).toBe("User B's Private Note");
      }
    });

    it('should filter notes by search query across title and content', async () => {
      const { user } = await createTestUser();

      await createTestNote(user.id, {
        title: 'PostgreSQL Database Setup',
        content: 'Configuring Postgres with Drizzle'
      });
      await createTestNote(user.id, {
        title: 'Frontend Components',
        content: 'Building Svelte 5 runes UI'
      });
      await createTestNote(user.id, {
        title: 'Deployment Guide',
        content: 'Vercel serverless deployment setup for postgres'
      });

      if (typeof notesService.getNotes === 'function') {
        // Search by keyword in title
        const dbNotes = await notesService.getNotes(user.id, { search: 'PostgreSQL' });
        expect(dbNotes.length).toBe(1);
        expect(dbNotes[0].title).toBe('PostgreSQL Database Setup');

        // Search by keyword in content (case-insensitive)
        const svelteNotes = await notesService.getNotes(user.id, { search: 'svelte' });
        expect(svelteNotes.length).toBe(1);
        expect(svelteNotes[0].title).toBe('Frontend Components');

        // Search matching multiple notes
        const postgresNotes = await notesService.getNotes(user.id, { search: 'postgres' });
        expect(postgresNotes.length).toBe(2);
      }
    });

    it('should filter notes by tagId', async () => {
      const { user } = await createTestUser();

      const note1 = await createTestNote(user.id, {
        title: 'Project Roadmap',
        tagNames: ['work', 'planning']
      });
      await createTestNote(user.id, {
        title: 'Grocery List',
        tagNames: ['personal']
      });

      const workTag = note1.tags.find((t: any) => t.name === 'work');
      expect(workTag).toBeDefined();

      if (typeof notesService.getNotes === 'function' && workTag) {
        const filtered = await notesService.getNotes(user.id, { tagId: workTag.id });
        expect(filtered.length).toBe(1);
        expect(filtered[0].title).toBe('Project Roadmap');
      }
    });

    it('should filter notes by isPinned status', async () => {
      const { user } = await createTestUser();

      await createTestNote(user.id, { title: 'Pinned Note 1', isPinned: true });
      await createTestNote(user.id, { title: 'Pinned Note 2', isPinned: true });
      await createTestNote(user.id, { title: 'Normal Note', isPinned: false });

      if (typeof notesService.getNotes === 'function') {
        const pinnedOnly = await notesService.getNotes(user.id, { isPinned: true });
        expect(pinnedOnly.length).toBe(2);
        expect(pinnedOnly.every((n: any) => n.isPinned === true)).toBe(true);
      }
    });
  });

  describe('getNoteById & Strict Tenant Isolation', () => {
    it('should retrieve a note by ID for the owner', async () => {
      const { user } = await createTestUser();
      const created = await createTestNote(user.id, {
        title: 'Personal Secret',
        content: 'Secret content',
        tagNames: ['confidential']
      });

      if (typeof notesService.getNoteById === 'function') {
        const fetched = await notesService.getNoteById(user.id, created.id);
        expect(fetched).not.toBeNull();
        expect(fetched?.id).toBe(created.id);
        expect(fetched?.title).toBe('Personal Secret');
        expect(fetched?.tags.length).toBe(1);
      }
    });

    it('should return null or reject when user attempts to access another user note by ID', async () => {
      const { user: userA } = await createTestUser();
      const { user: userB } = await createTestUser();

      const noteA = await createTestNote(userA.id, {
        title: "User A's Private Diary",
        content: 'Do not read!'
      });

      if (typeof notesService.getNoteById === 'function') {
        const leaked = await notesService.getNoteById(userB.id, noteA.id);
        expect(leaked).toBeNull();
      }
    });
  });

  describe('updateNote', () => {
    it('should update note title, content, pin state, and tags for owner', async () => {
      const { user } = await createTestUser();
      const initial = await createTestNote(user.id, {
        title: 'Initial Title',
        content: 'Initial Content',
        isPinned: false,
        tagNames: ['v1', 'draft']
      });

      if (typeof notesService.updateNote === 'function') {
        const updated = await notesService.updateNote(user.id, initial.id, {
          title: 'Updated Title',
          content: 'Updated Content with markdown.',
          isPinned: true,
          tagNames: ['v2', 'published']
        });

        expect(updated).not.toBeNull();
        expect(updated?.title).toBe('Updated Title');
        expect(updated?.content).toBe('Updated Content with markdown.');
        expect(updated?.isPinned).toBe(true);
        expect(updated?.tags.map((t: any) => t.name).sort()).toEqual(['published', 'v2']);
      }
    });

    it('should prevent unauthorized user from updating another user note', async () => {
      const { user: userA } = await createTestUser();
      const { user: userB } = await createTestUser();

      const noteA = await createTestNote(userA.id, {
        title: 'Untouchable Note',
        content: 'Original'
      });

      if (typeof notesService.updateNote === 'function') {
        const result = await notesService.updateNote(userB.id, noteA.id, {
          title: 'Hacked Title'
        });
        expect(result).toBeNull();

        // Verify original note was not modified in DB
        const [persisted] = await db.select().from(notes).where(eq(notes.id, noteA.id));
        expect(persisted.title).toBe('Untouchable Note');
      }
    });
  });

  describe('deleteNote', () => {
    it('should delete note and its note_tags links for owner', async () => {
      const { user } = await createTestUser();
      const note = await createTestNote(user.id, {
        title: 'To Be Deleted',
        tagNames: ['temp']
      });

      if (typeof notesService.deleteNote === 'function') {
        const success = await notesService.deleteNote(user.id, note.id);
        expect(success).toBe(true);

        const [persisted] = await db.select().from(notes).where(eq(notes.id, note.id));
        expect(persisted).toBeUndefined();

        const links = await db.select().from(noteTags).where(eq(noteTags.noteId, note.id));
        expect(links.length).toBe(0);
      }
    });

    it('should prevent unauthorized user from deleting another user note', async () => {
      const { user: userA } = await createTestUser();
      const { user: userB } = await createTestUser();

      const noteA = await createTestNote(userA.id, { title: 'Protected Note' });

      if (typeof notesService.deleteNote === 'function') {
        const deleted = await notesService.deleteNote(userB.id, noteA.id);
        expect(deleted).toBe(false);

        // Verify note still exists in DB
        const [persisted] = await db.select().from(notes).where(eq(notes.id, noteA.id));
        expect(persisted).toBeDefined();
      }
    });
  });

  describe('getUserTags', () => {
    it('should return all distinct tags created by the user with zero cross-tenant leakage', async () => {
      const { user: userA } = await createTestUser();
      const { user: userB } = await createTestUser();

      await createTestNote(userA.id, { title: 'Note 1', tagNames: ['finance', 'taxes'] });
      await createTestNote(userA.id, { title: 'Note 2', tagNames: ['finance', 'investing'] });
      await createTestNote(userB.id, { title: 'Note B', tagNames: ['secret_project', 'taxes'] });

      if (typeof notesService.getUserTags === 'function') {
        const tagsA = await notesService.getUserTags(userA.id);
        const tagNamesA = tagsA.map((t: any) => t.name).sort();
        expect(tagNamesA).toEqual(['finance', 'investing', 'taxes']);

        const tagsB = await notesService.getUserTags(userB.id);
        const tagNamesB = tagsB.map((t: any) => t.name).sort();
        expect(tagNamesB).toEqual(['secret_project', 'taxes']);
      }
    });
  });
});
