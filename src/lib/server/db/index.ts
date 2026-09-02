import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString =
  process.env.DATABASE_URL || 'postgres://moonday:moonday@localhost:5433/moonday';

// Global singleton declaration to prevent connection exhaustion during development hot-reloads
declare global {
  // eslint-disable-next-line no-var
  var __postgresClient: postgres.Sql | undefined;
}

const maxConnections = process.env.DB_MAX_CONNECTIONS
  ? parseInt(process.env.DB_MAX_CONNECTIONS, 10)
  : 10;

function createClient(): postgres.Sql {
  return postgres(connectionString, {
    prepare: false, // Essential for PgBouncer / serverless transaction pooling
    max: maxConnections,
    idle_timeout: 20, // Disconnect idle clients after 20s
    connect_timeout: 10, // Timeout connection attempts after 10s
    onnotice: () => {}, // Suppress notice messages
  });
}

const client =
  process.env.NODE_ENV === 'production'
    ? createClient()
    : global.__postgresClient ?? (global.__postgresClient = createClient());

export const db = drizzle(client, { schema });
export { client };
export * from './schema';
