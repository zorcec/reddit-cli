import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cacheGet, cacheSet, cacheClear, cacheStats } from '../src/cache.js';
import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CACHE_DIR = join(homedir(), '.cache', 'reddit-cli');

describe('cache', () => {
  beforeEach(() => {
    // Ensure cache dir exists
    const { mkdirSync } = require('node:fs');
    mkdirSync(CACHE_DIR, { recursive: true });
  });

  afterEach(() => {
    // Clean up test cache files
    try {
      const files = readdirSync(CACHE_DIR).filter(f => f.startsWith('test-'));
      for (const file of files) {
        rmSync(join(CACHE_DIR, file), { force: true });
      }
    } catch {
      // Ignore
    }
  });

  describe('cacheSet and cacheGet', () => {
    it('stores and retrieves data', () => {
      const key = `test-key-${Date.now()}`;
      const data = { foo: 'bar' };

      cacheSet('test', key, data, 60000);
      const retrieved = cacheGet<typeof data>('test', key, 60000);

      expect(retrieved).toEqual(data);
    });

    it('returns null for expired entries', async () => {
      const key = `test-expired-${Date.now()}`;
      const data = { foo: 'bar' };

      // Set with 0ms TTL (already expired)
      cacheSet('test', key, data, 0);

      // Wait to ensure file system operations complete
      await new Promise(resolve => setTimeout(resolve, 50));

      const retrieved = cacheGet<typeof data>('test', key, 60000);
      expect(retrieved).toBeNull();
    });

    it('returns null for non-existent keys', () => {
      const retrieved = cacheGet('test', 'nonexistent-key', 60000);
      expect(retrieved).toBeNull();
    });

    it('handles different namespaces', () => {
      const key = `test-ns-${Date.now()}`;

      cacheSet('ns1', key, { a: 1 }, 60000);
      cacheSet('ns2', key, { b: 2 }, 60000);

      expect(cacheGet('ns1', key, 60000)).toEqual({ a: 1 });
      expect(cacheGet('ns2', key, 60000)).toEqual({ b: 2 });
    });
  });

  describe('cacheClear', () => {
    it('clears all cache files', () => {
      const key = `test-clear-${Date.now()}`;
      cacheSet('test', key, { data: 1 }, 60000);

      const removed = cacheClear();
      expect(removed).toBeGreaterThanOrEqual(1);
    });
  });

  describe('cacheStats', () => {
    it('returns cache statistics', () => {
      const stats = cacheStats();
      expect(stats.files).toBeGreaterThanOrEqual(0);
      expect(stats.totalSizeBytes).toBeGreaterThanOrEqual(0);
    });
  });
});
