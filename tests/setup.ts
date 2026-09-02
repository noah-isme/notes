// Global Vitest setup file for Notes Application test suite
import * as dotenv from 'dotenv';
dotenv.config();

import { beforeAll, afterAll } from 'vitest';

process.env.NODE_ENV = 'test';

beforeAll(async () => {
  // Global test initialization
});

afterAll(async () => {
  // Global test cleanup
});

