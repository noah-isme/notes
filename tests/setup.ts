// Global Vitest setup file for Notes Application test suite
import { beforeAll, afterAll } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://moonday:moonday@localhost:5433/moonday';

beforeAll(async () => {
  // Global test initialization
});

afterAll(async () => {
  // Global test cleanup
});
