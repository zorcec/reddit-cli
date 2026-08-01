import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

// Mock the mcp-client module
vi.mock('../src/mcp-client.js', () => ({
  getRedditTools: vi.fn().mockResolvedValue({
    searchReddit: vi.fn().mockResolvedValue({
      data: { children: [] },
    }),
  }),
}));

// Mock other dependencies
vi.mock('../src/cache.js', () => ({
  cacheGet: vi.fn().mockReturnValue(null),
  cacheSet: vi.fn(),
}));

vi.mock('../src/config.js', () => ({
  loadConfig: vi.fn().mockReturnValue({}),
  getAuthTier: vi.fn().mockReturnValue('anonymous'),
  getRateLimit: vi.fn().mockReturnValue(10),
  getConfigEnvVars: vi.fn().mockReturnValue({}),
}));

vi.mock('../src/rate-limiter.js', () => ({
  RateLimiter: vi.fn().mockImplementation(() => ({
    waitAndAcquire: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../src/utils/format.js', () => ({
  formatOutput: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

import { registerSearchCommand } from '../src/commands/search.js';

describe('search command', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerSearchCommand(program);
  });

  it('registers search command', () => {
    const commands = program.commands.map(c => c.name());
    expect(commands).toContain('search');
  });

  it('has correct options', () => {
    const cmd = program.commands.find(c => c.name() === 'search');
    const options = cmd?.options.map(o => o.long);
    expect(options).toContain('--sort');
    expect(options).toContain('--time');
    expect(options).toContain('--limit');
    expect(options).toContain('--subreddits');
    expect(options).toContain('--author');
    expect(options).toContain('--flair');
    expect(options).toContain('--format');
    expect(options).toContain('--output');
    expect(options).toContain('--no-cache');
    expect(options).toContain('--nsfw');
  });
});
