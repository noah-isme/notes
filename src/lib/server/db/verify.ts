import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString =
  process.env.DATABASE_URL || 'postgres://moonday:moonday@localhost:5433/moonday';

async function verifyDatabase() {
  const sanitizedUrl = connectionString.replace(/:[^:@]+@/, ':****@');
  console.log(`[DB Verify] Testing connection to: ${sanitizedUrl}`);

  const sql = postgres(connectionString, {
    max: 1,
    connect_timeout: 5,
    prepare: false,
  });

  try {
    const result = await sql`
      SELECT 
        current_database() as database_name,
        current_user as current_user,
        version() as pg_version,
        NOW() as current_time
    `;
    console.log('[DB Verify] Connection SUCCESSFUL:');
    console.log(JSON.stringify(result[0], null, 2));
  } catch (error) {
    console.error('[DB Verify] Connection FAILED:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

verifyDatabase();
