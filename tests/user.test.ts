import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

// Mock the mcp-client module
vi.mock('../src/mcp-client.js', () => ({
  getRedditTools: vi.fn().mockResolvedValue({
    userAnalysis: vi.fn().mockResolvedValue({
      username: 'testuser',
      karma: { link: 100, comment: 50, total: 150 },
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

import { registerUserCommand } from '../src/commands/user.js';

describe('user command', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerUserCommand(program);
  });

  it('registers user command', () => {
    const commands = program.commands.map(c => c.name());
    expect(commands).toContain('user');
  });

  it('has correct options', () => {
    const cmd = program.commands.find(c => c.name() === 'user');
    const options = cmd?.options.map(o => o.long);
    expect(options).toContain('--posts-limit');
    expect(options).toContain('--comments-limit');
    expect(options).toContain('--time');
    expect(options).toContain('--top-subreddits');
    expect(options).toContain('--format');
    expect(options).toContain('--output');
    expect(options).toContain('--no-cache');
  });
});
