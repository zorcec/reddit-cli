import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

// Mock the mcp-client module
vi.mock('../src/mcp-client.js', () => ({
  getRedditTools: vi.fn().mockResolvedValue({
    getPostDetails: vi.fn().mockResolvedValue({
      post: { title: 'Test Post', author: 'test', score: 100 },
      top_comments: [],
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

import { registerPostCommand } from '../src/commands/post.js';

describe('post command', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerPostCommand(program);
  });

  it('registers post command', () => {
    const commands = program.commands.map(c => c.name());
    expect(commands).toContain('post');
  });

  it('has correct options', () => {
    const cmd = program.commands.find(c => c.name() === 'post');
    const options = cmd?.options.map(o => o.long);
    expect(options).toContain('--subreddit');
    expect(options).toContain('--comment-limit');
    expect(options).toContain('--comment-sort');
    expect(options).toContain('--comment-depth');
    expect(options).toContain('--max-top-comments');
    expect(options).toContain('--extract-links');
    expect(options).toContain('--format');
    expect(options).toContain('--output');
    expect(options).toContain('--no-cache');
  });
});
