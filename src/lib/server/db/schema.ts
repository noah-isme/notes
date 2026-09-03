import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  primaryKey,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// 1. Users Table
// ---------------------------------------------------------------------------
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    name: varchar('name', { length: 100 }),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('users_email_unique_idx').on(table.email),
  ]
);

// ---------------------------------------------------------------------------
// 2. Sessions Table
// ---------------------------------------------------------------------------
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(), // 32-byte crypto token / hex string
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_expires_at_idx').on(table.expiresAt),
  ]
);

// ---------------------------------------------------------------------------
// 3. Notes Table
// ---------------------------------------------------------------------------
export const notes = pgTable(
  'notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull().default(''),
    content: text('content').notNull().default(''),
    isPinned: boolean('is_pinned').notNull().default(false),
    isPublic: boolean('is_public').notNull().default(false),
    shareToken: varchar('share_token', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('notes_user_id_idx').on(table.userId),
    index('notes_user_id_pinned_updated_idx').on(
      table.userId,
      table.isPinned,
      table.updatedAt
    ),
    uniqueIndex('notes_share_token_unique_idx').on(table.shareToken),
  ]
);

// ---------------------------------------------------------------------------
// 4. Tags Table
// ---------------------------------------------------------------------------
export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 50 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('tags_user_id_idx').on(table.userId),
    uniqueIndex('tags_user_id_name_unique_idx').on(table.userId, table.name),
  ]
);

// ---------------------------------------------------------------------------
// 5. Note-Tags Junction Table
// ---------------------------------------------------------------------------
export const noteTags = pgTable(
  'note_tags',
  {
    noteId: uuid('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.noteId, table.tagId] }),
    index('note_tags_tag_id_idx').on(table.tagId),
    index('note_tags_note_id_idx').on(table.noteId),
  ]
);

// ---------------------------------------------------------------------------
// 6. Google Connections Table
// ---------------------------------------------------------------------------
export const googleConnections = pgTable(
  'google_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    googleSub: varchar('google_sub', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    scope: text('scope'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('google_connections_user_id_unique').on(table.userId),
  ]
);

// ---------------------------------------------------------------------------
// 7. Drizzle Relations
// ---------------------------------------------------------------------------
export const usersRelations = relations(users, ({ one, many }) => ({
  sessions: many(sessions),
  notes: many(notes),
  tags: many(tags),
  googleConnection: one(googleConnections),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const notesRelations = relations(notes, ({ one, many }) => ({
  user: one(users, {
    fields: [notes.userId],
    references: [users.id],
  }),
  noteTags: many(noteTags),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  user: one(users, {
    fields: [tags.userId],
    references: [users.id],
  }),
  noteTags: many(noteTags),
}));

export const noteTagsRelations = relations(noteTags, ({ one }) => ({
  note: one(notes, {
    fields: [noteTags.noteId],
    references: [notes.id],
  }),
  tag: one(tags, {
    fields: [noteTags.tagId],
    references: [tags.id],
  }),
}));

export const googleConnectionsRelations = relations(
  googleConnections,
  ({ one }) => ({
    user: one(users, {
      fields: [googleConnections.userId],
      references: [users.id],
    }),
  })
);

// ---------------------------------------------------------------------------
// 8. Type Definitions Matching PROJECT.md Contracts
// ---------------------------------------------------------------------------
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;

export type NoteTag = typeof noteTags.$inferSelect;
export type NewNoteTag = typeof noteTags.$inferInsert;

export type GoogleConnection = typeof googleConnections.$inferSelect;
export type NewGoogleConnection = typeof googleConnections.$inferInsert;

export interface NoteWithTags extends Note {
  tags: Tag[];
}

export interface PublicAuthor {
  name: string | null;
  displayName: string;
}

export interface PublicNote {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  isPublic: boolean;
  shareToken: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: PublicAuthor;
  tags: Tag[];
}
