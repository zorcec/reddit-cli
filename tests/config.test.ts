import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, unlinkSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Use a temp directory for tests
const TEST_CONFIG_DIR = join(tmpdir(), 'reddit-cli-test-' + process.pid);
const TEST_CONFIG_FILE = join(TEST_CONFIG_DIR, 'config.json');

// Mock config.ts to use test paths
vi.mock('../src/config.js', async () => {
  const actual = await vi.importActual<any>('../src/config.js');
  return {
    ...actual,
    getConfigPath: () => TEST_CONFIG_FILE,
    loadConfig: () => {
      if (!existsSync(TEST_CONFIG_FILE)) return {};
      try {
        return JSON.parse(readFileSync(TEST_CONFIG_FILE, 'utf-8'));
      } catch {
        return {};
      }
    },
    saveConfig: (config: any) => {
      mkdirSync(TEST_CONFIG_DIR, { recursive: true });
      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
    },
    clearConfig: () => {
      try {
        if (existsSync(TEST_CONFIG_FILE)) {
          unlinkSync(TEST_CONFIG_FILE);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
  };
});

import { loadConfig, saveConfig, clearConfig, getAuthTier, getRateLimit, getConfigEnvVars } from '../src/config.js';

describe('config', () => {
  beforeEach(() => {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    try {
      if (existsSync(TEST_CONFIG_FILE)) unlinkSync(TEST_CONFIG_FILE);
    } catch {}
  });

  afterEach(() => {
    try {
      if (existsSync(TEST_CONFIG_FILE)) unlinkSync(TEST_CONFIG_FILE);
    } catch {}
  });

  describe('loadConfig', () => {
    it('returns empty object when no config exists', () => {
      const config = loadConfig();
      expect(config).toEqual({});
    });

    it('loads config from file', () => {
      saveConfig({ clientId: 'test-id', clientSecret: 'test-secret' });
      const config = loadConfig();
      expect(config.clientId).toBe('test-id');
      expect(config.clientSecret).toBe('test-secret');
    });
  });

  describe('saveConfig', () => {
    it('saves config to file', () => {
      saveConfig({ clientId: 'test-id', clientSecret: 'test-secret' });
      expect(existsSync(TEST_CONFIG_FILE)).toBe(true);
    });

    it('overwrites existing config', () => {
      saveConfig({ clientId: 'first' });
      saveConfig({ clientId: 'second' });
      const config = loadConfig();
      expect(config.clientId).toBe('second');
    });
  });

  describe('clearConfig', () => {
    it('removes config file', () => {
      saveConfig({ clientId: 'test' });
      const result = clearConfig();
      expect(result).toBe(true);
      expect(existsSync(TEST_CONFIG_FILE)).toBe(false);
    });

    it('returns false when no config exists', () => {
      const result = clearConfig();
      expect(result).toBe(false);
    });
  });

  describe('getAuthTier', () => {
    it('returns anonymous when no credentials', () => {
      expect(getAuthTier({})).toBe('anonymous');
    });

    it('returns app-only when only client credentials', () => {
      expect(getAuthTier({ clientId: 'id', clientSecret: 'secret' })).toBe('app-only');
    });

    it('returns authenticated when all credentials present', () => {
      expect(getAuthTier({
        clientId: 'id',
        clientSecret: 'secret',
        username: 'user',
        password: 'pass',
      })).toBe('authenticated');
    });

    it('returns browser when cookies present', () => {
      expect(getAuthTier({
        cookies: { reddit_session: 'abc123' },
      })).toBe('browser');
    });

    it('returns anonymous when cookies object is empty', () => {
      expect(getAuthTier({ cookies: {} })).toBe('anonymous');
    });
  });

  describe('getRateLimit', () => {
    it('returns correct limits for each tier', () => {
      expect(getRateLimit('anonymous')).toBe(10);
      expect(getRateLimit('app-only')).toBe(60);
      expect(getRateLimit('authenticated')).toBe(100);
      expect(getRateLimit('browser')).toBe(100);
    });
  });

  describe('getConfigEnvVars', () => {
    it('returns environment variables for config', () => {
      const config = {
        clientId: 'test-id',
        clientSecret: 'test-secret',
        username: 'user',
        password: 'pass',
      };
      const env = getConfigEnvVars(config);
      expect(env.REDDIT_CLIENT_ID).toBe('test-id');
      expect(env.REDDIT_CLIENT_SECRET).toBe('test-secret');
      expect(env.REDDIT_USERNAME).toBe('user');
      expect(env.REDDIT_PASSWORD).toBe('pass');
    });

    it('returns empty object for empty config', () => {
      const env = getConfigEnvVars({});
      expect(Object.keys(env)).toHaveLength(0);
    });
  });
});
