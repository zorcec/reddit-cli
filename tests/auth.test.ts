import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

// Mock the config module
vi.mock('../src/config.js', () => ({
  saveConfig: vi.fn(),
  loadConfig: vi.fn().mockReturnValue({}),
  clearConfig: vi.fn().mockReturnValue(true),
  getConfigPath: vi.fn().mockReturnValue('/test/config.json'),
  getAuthTier: vi.fn().mockReturnValue('anonymous'),
}));

vi.mock('../src/utils/format.js', () => ({
  info: vi.fn(),
  warn: vi.fn(),
}));

import { registerAuthCommand } from '../src/commands/auth.js';

describe('auth command', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerAuthCommand(program);
  });

  it('registers auth command', () => {
    const commands = program.commands.map(c => c.name());
    expect(commands).toContain('auth');
  });

  it('has login subcommand', () => {
    const authCmd = program.commands.find(c => c.name() === 'auth');
    const subcommands = authCmd?.commands.map(c => c.name());
    expect(subcommands).toContain('login');
  });

  it('has whoami subcommand', () => {
    const authCmd = program.commands.find(c => c.name() === 'auth');
    const subcommands = authCmd?.commands.map(c => c.name());
    expect(subcommands).toContain('whoami');
  });

  it('has logout subcommand', () => {
    const authCmd = program.commands.find(c => c.name() === 'auth');
    const subcommands = authCmd?.commands.map(c => c.name());
    expect(subcommands).toContain('logout');
  });

  it('has browser-login subcommand', () => {
    const authCmd = program.commands.find(c => c.name() === 'auth');
    const subcommands = authCmd?.commands.map(c => c.name());
    expect(subcommands).toContain('browser-login');
  });
});
