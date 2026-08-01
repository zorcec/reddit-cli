import { beforeAll, afterAll } from 'vitest';

// Setup for tests
beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  // Cleanup
  delete process.env.NODE_ENV;
});
