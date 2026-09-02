import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString =
  process.env.DATABASE_URL || 'postgres://moonday:moonday@localhost:5433/moonday';

async function runMigrations() {
  console.log('[Migration] Connecting to database...');
  const migrationClient = postgres(connectionString, {
    max: 1,
    prepare: false,
  });
  const db = drizzle(migrationClient);

  try {
    console.log('[Migration] Ensuring table structures & columns are up to date...');
    await migrationClient.unsafe(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email varchar(255) NOT NULL,
        name varchar(100),
        password_hash text NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS name varchar(100);
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (email);

      CREATE TABLE IF NOT EXISTS sessions (
        id text PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at timestamp with time zone NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
      CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);

      CREATE TABLE IF NOT EXISTS notes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title varchar(255) DEFAULT '' NOT NULL,
        content text DEFAULT '' NOT NULL,
        is_pinned boolean DEFAULT false NOT NULL,
        is_public boolean DEFAULT false NOT NULL,
        share_token varchar(128),
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
      ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false NOT NULL;
      ALTER TABLE notes ADD COLUMN IF NOT EXISTS share_token varchar(128);
      CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes (user_id);
      CREATE INDEX IF NOT EXISTS notes_user_id_pinned_updated_idx ON notes (user_id, is_pinned, updated_at);
      CREATE UNIQUE INDEX IF NOT EXISTS notes_share_token_unique_idx ON notes (share_token);

      CREATE TABLE IF NOT EXISTS tags (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name varchar(50) NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS tags_user_id_idx ON tags (user_id);
      CREATE UNIQUE INDEX IF NOT EXISTS tags_user_id_name_unique_idx ON tags (user_id, name);

      CREATE TABLE IF NOT EXISTS note_tags (
        note_id uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        CONSTRAINT note_tags_pkey PRIMARY KEY(note_id, tag_id)
      );
      CREATE INDEX IF NOT EXISTS note_tags_tag_id_idx ON note_tags (tag_id);
      CREATE INDEX IF NOT EXISTS note_tags_note_id_idx ON note_tags (note_id);
    `);
    console.log('[Migration] Schema synchronized successfully!');
  } catch (error) {
    console.error('[Migration] Migration failed with error:', error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

runMigrations();
