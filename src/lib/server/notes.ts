import { db } from '$lib/server/db';
import {
  notes,
  tags,
  noteTags,
  type Note,
  type Tag,
  type NoteWithTags,
} from '$lib/server/db/schema';
import { eq, and, or, ilike, desc, asc, inArray } from 'drizzle-orm';
import { validateNoteInput, validateTagName } from '$lib/utils/validation';

export type { Note, Tag, NoteWithTags };

export interface GetNotesOptions {
  search?: string;
  tagId?: string;
  isPinned?: boolean;
}

export interface CreateNoteData {
  title: string;
  content?: string;
  isPinned?: boolean;
  tagNames?: string[];
}

export interface UpdateNoteData {
  title?: string;
  content?: string;
  isPinned?: boolean;
  tagNames?: string[];
}

/**
 * Creates a new note for the authenticated user with optional initial tags and pinned state.
 */
export async function createNote(
  userId: string,
  data: CreateNoteData
): Promise<NoteWithTags> {
  if (!validateNoteInput({ title: data.title, content: data.content })) {
    throw new Error('Invalid note input: title is required and must be 1-200 characters');
  }

  const [newNote] = await db
    .insert(notes)
    .values({
      userId,
      title: data.title.trim(),
      content: data.content ?? '',
      isPinned: data.isPinned ?? false,
    })
    .returning();

  if (data.tagNames && data.tagNames.length > 0) {
    const cleanTagNames = Array.from(
      new Set(
        data.tagNames
          .filter((t): t is string => typeof t === 'string')
          .map((t) => t.trim())
          .filter((t) => t.length > 0 && t.length <= 50)
      )
    );

    for (const tagName of cleanTagNames) {
      let [tag] = await db
        .select()
        .from(tags)
        .where(and(eq(tags.userId, userId), eq(tags.name, tagName)));

      if (!tag) {
        const [inserted] = await db
          .insert(tags)
          .values({ userId, name: tagName })
          .onConflictDoNothing()
          .returning();

        tag =
          inserted ||
          (
            await db
              .select()
              .from(tags)
              .where(and(eq(tags.userId, userId), eq(tags.name, tagName)))
          )[0];
      }

      if (tag) {
        await db
          .insert(noteTags)
          .values({ noteId: newNote.id, tagId: tag.id })
          .onConflictDoNothing();
      }
    }
  }

  const created = await getNoteById(userId, newNote.id);
  if (!created) {
    throw new Error('Failed to retrieve newly created note');
  }

  return created;
}

/**
 * Lists notes for a specific user with multi-facet filtering (search keyword, tagId, isPinned)
 * and deterministic sorting (isPinned DESC, updatedAt DESC, createdAt DESC).
 */
export async function getNotes(
  userId: string,
  options?: GetNotesOptions
): Promise<NoteWithTags[]> {
  const conditions = [eq(notes.userId, userId)];

  if (options?.isPinned !== undefined) {
    conditions.push(eq(notes.isPinned, options.isPinned));
  }

  if (options?.search && options.search.trim().length > 0) {
    const term = `%${options.search.trim()}%`;
    conditions.push(or(ilike(notes.title, term), ilike(notes.content, term))!);
  }

  if (options?.tagId) {
    // Cross-tenant barrier: verify tag ownership first to prevent information disclosure
    const [tagOwnership] = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.id, options.tagId), eq(tags.userId, userId)));

    if (!tagOwnership) {
      return [];
    }

    const taggedNoteIds = db
      .select({ noteId: noteTags.noteId })
      .from(noteTags)
      .where(eq(noteTags.tagId, options.tagId));

    conditions.push(inArray(notes.id, taggedNoteIds));
  }

  const matchingNotes = await db
    .select()
    .from(notes)
    .where(and(...conditions))
    .orderBy(desc(notes.isPinned), desc(notes.updatedAt), desc(notes.createdAt));

  if (matchingNotes.length === 0) {
    return [];
  }

  const noteIds = matchingNotes.map((n) => n.id);
  const tagLinks = await db
    .select({
      noteId: noteTags.noteId,
      id: tags.id,
      userId: tags.userId,
      name: tags.name,
      createdAt: tags.createdAt,
    })
    .from(noteTags)
    .innerJoin(tags, eq(noteTags.tagId, tags.id))
    .where(inArray(noteTags.noteId, noteIds))
    .orderBy(asc(tags.name));

  const tagsByNoteId = new Map<string, Tag[]>();
  for (const link of tagLinks) {
    const list = tagsByNoteId.get(link.noteId) || [];
    list.push({
      id: link.id,
      userId: link.userId,
      name: link.name,
      createdAt: link.createdAt,
    });
    tagsByNoteId.set(link.noteId, list);
  }

  return matchingNotes.map((note) => ({
    ...note,
    tags: tagsByNoteId.get(note.id) || [],
  }));
}

/**
 * Retrieves a single note by ID with its attached tags, strictly scoped to the owner.
 */
export async function getNoteById(
  userId: string,
  noteId: string
): Promise<NoteWithTags | null> {
  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.userId, userId)));

  if (!note) return null;

  const attachedTags = await db
    .select({
      id: tags.id,
      userId: tags.userId,
      name: tags.name,
      createdAt: tags.createdAt,
    })
    .from(noteTags)
    .innerJoin(tags, eq(noteTags.tagId, tags.id))
    .where(eq(noteTags.noteId, noteId))
    .orderBy(asc(tags.name));

  return {
    ...note,
    tags: attachedTags,
  };
}

/**
 * Updates a note's title, content, pinned status, and/or synchronizes tags with strict tenant isolation.
 */
export async function updateNote(
  userId: string,
  noteId: string,
  data: UpdateNoteData
): Promise<NoteWithTags | null> {
  const [existing] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.userId, userId)));

  if (!existing) return null;

  if (data.title !== undefined) {
    if (
      typeof data.title !== 'string' ||
      data.title.trim().length === 0 ||
      data.title.length > 200
    ) {
      throw new Error('Invalid note input: title must be between 1 and 200 characters');
    }
  }

  const updates: Partial<typeof notes.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (data.title !== undefined) updates.title = data.title.trim();
  if (data.content !== undefined) updates.content = data.content;
  if (data.isPinned !== undefined) updates.isPinned = data.isPinned;

  await db
    .update(notes)
    .set(updates)
    .where(and(eq(notes.id, noteId), eq(notes.userId, userId)));

  if (data.tagNames !== undefined) {
    await db.delete(noteTags).where(eq(noteTags.noteId, noteId));

    const cleanTagNames = Array.from(
      new Set(
        data.tagNames
          .filter((t): t is string => typeof t === 'string')
          .map((t) => t.trim())
          .filter((t) => t.length > 0 && t.length <= 50)
      )
    );

    for (const tagName of cleanTagNames) {
      let [tag] = await db
        .select()
        .from(tags)
        .where(and(eq(tags.userId, userId), eq(tags.name, tagName)));

      if (!tag) {
        const [inserted] = await db
          .insert(tags)
          .values({ userId, name: tagName })
          .onConflictDoNothing()
          .returning();

        tag =
          inserted ||
          (
            await db
              .select()
              .from(tags)
              .where(and(eq(tags.userId, userId), eq(tags.name, tagName)))
          )[0];
      }

      if (tag) {
        await db
          .insert(noteTags)
          .values({ noteId, tagId: tag.id })
          .onConflictDoNothing();
      }
    }
  }

  return getNoteById(userId, noteId);
}

/**
 * Deletes a note owned by the user, cascading note_tags deletions.
 */
export async function deleteNote(userId: string, noteId: string): Promise<boolean> {
  const deleted = await db
    .delete(notes)
    .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
    .returning({ id: notes.id });

  return deleted.length > 0;
}

/**
 * Retrieves all distinct tags created by the user, sorted alphabetically.
 */
export async function getUserTags(userId: string): Promise<Tag[]> {
  return db
    .select()
    .from(tags)
    .where(eq(tags.userId, userId))
    .orderBy(asc(tags.name));
}

/**
 * Creates or retrieves a tag for the specified user.
 */
export async function createTag(userId: string, name: string): Promise<Tag> {
  const trimmed = name.trim();
  if (!validateTagName(trimmed)) {
    throw new Error(
      'Invalid tag name: must be 1-50 alphanumeric characters, hyphens or underscores'
    );
  }

  const [existing] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.userId, userId), eq(tags.name, trimmed)));

  if (existing) return existing;

  const [inserted] = await db
    .insert(tags)
    .values({ userId, name: trimmed })
    .onConflictDoNothing()
    .returning();

  if (inserted) return inserted;

  const [found] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.userId, userId), eq(tags.name, trimmed)));

  return found;
}

/**
 * Deletes a tag owned by the user. Associated note_tags relations cascade delete automatically.
 */
export async function deleteTag(userId: string, tagId: string): Promise<boolean> {
  const deleted = await db
    .delete(tags)
    .where(and(eq(tags.id, tagId), eq(tags.userId, userId)))
    .returning({ id: tags.id });

  return deleted.length > 0;
}
