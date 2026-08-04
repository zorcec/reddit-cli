import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
import { saveConfig, loadConfig, clearConfig, getAuthTier } from '../src/config.js';

describe('auth command', () => {
  let program: Command;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    program = new Command();
    registerAuthCommand(program);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    errSpy.mockRestore();
  });

  async function runAuth(args: string[]): Promise<void> {
    await program.parseAsync(['node', 'test', 'auth', ...args], { from: 'node' });
  }

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

  it('login saves credentials and prints the auth tier', async () => {
    vi.mocked(getAuthTier).mockReturnValueOnce('app-only');
    await runAuth(['login', '--client-id', 'cid', '--client-secret', 'secret']);

    expect(saveConfig).toHaveBeenCalledWith(expect.objectContaining({
      clientId: 'cid', clientSecret: 'secret',
    }));
    expect(errSpy.mock.calls.some(c => c[0].includes('app-only'))).toBe(true);
  });

  it('login exits 1 when client secret is missing', async () => {
    vi.mocked(loadConfig).mockReturnValueOnce({ clientId: 'cid' });
    await runAuth(['login', '--client-id', 'cid']);

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('whoami reports anonymous status when unauthenticated', async () => {
    vi.mocked(getAuthTier).mockReturnValue('anonymous');
    await runAuth(['whoami']);

    expect(errSpy.mock.calls.some(c => c[0].includes('Not authenticated'))).toBe(true);
  });

  it('whoami shows cookie status for browser auth', async () => {
    vi.mocked(loadConfig).mockReturnValue({
      cookies: { reddit_session: 'abc', csrf_token: 'xyz' },
      cookieMeta: { reddit_session: { value: 'abc', expires: 0, domain: '.reddit.com' } },
    });
    vi.mocked(getAuthTier).mockReturnValue('browser');
    await runAuth(['whoami']);

    expect(errSpy.mock.calls.some(c => c[0].includes('Session cookies'))).toBe(true);
  });

  it('logout clears credentials', async () => {
    await runAuth(['logout']);
    expect(clearConfig).toHaveBeenCalled();
  });
});
