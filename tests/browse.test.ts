import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

// Mock the mcp-client module
vi.mock('../src/mcp-client.js', () => ({
  getRedditTools: vi.fn().mockResolvedValue({
    browseSubreddit: vi.fn().mockResolvedValue({
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

import { registerBrowseCommand } from '../src/commands/browse.js';

describe('browse command', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerBrowseCommand(program);
  });

  it('registers browse command', () => {
    const commands = program.commands.map(c => c.name());
    expect(commands).toContain('browse');
  });

  it('has correct options', () => {
    const cmd = program.commands.find(c => c.name() === 'browse');
    const options = cmd?.options.map(o => o.long);
    expect(options).toContain('--sort');
    expect(options).toContain('--time');
    expect(options).toContain('--limit');
    expect(options).toContain('--format');
    expect(options).toContain('--output');
    expect(options).toContain('--no-cache');
    expect(options).toContain('--nsfw');
  });
});
