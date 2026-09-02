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
    console.log('[Migration] Applying migrations from ./drizzle folder...');
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('[Migration] Database migrations applied successfully!');
  } catch (error) {
    console.error('[Migration] Migration failed with error:', error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

runMigrations();
