import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

// Mock the mcp-client module
vi.mock('../src/mcp-client.js', () => ({
  getRedditTools: vi.fn().mockResolvedValue({
    redditExplain: vi.fn().mockResolvedValue({
      definition: 'Test definition',
      origin: 'Test origin',
      usage: 'Test usage',
      examples: ['Example 1'],
    }),
  }),
}));

// Mock other dependencies
vi.mock('../src/cache.js', () => ({
  cacheGet: vi.fn().mockReturnValue(null),
  cacheSet: vi.fn(),
}));

vi.mock('../src/utils/format.js', () => ({
  formatOutput: vi.fn(),
  info: vi.fn(),
}));

import { registerExplainCommand } from '../src/commands/explain.js';

describe('explain command', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerExplainCommand(program);
  });

  it('registers explain command', () => {
    const commands = program.commands.map(c => c.name());
    expect(commands).toContain('explain');
  });

  it('has correct options', () => {
    const cmd = program.commands.find(c => c.name() === 'explain');
    const options = cmd?.options.map(o => o.long);
    expect(options).toContain('--format');
    expect(options).toContain('--output');
    expect(options).toContain('--no-cache');
  });
});
