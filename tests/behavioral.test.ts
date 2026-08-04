import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

const mocks = vi.hoisted(() => {
  const searchReddit = vi.fn();
  const browseSubreddit = vi.fn();
  const getPostDetails = vi.fn();
  const userAnalysis = vi.fn();
  const redditExplain = vi.fn();
  const apiGet = vi.fn();
  const getRedditTools = vi.fn();

  const samplePosts = {
    results: [{
      id: 'abc123', title: 'Test Post', author: 'testuser', subreddit: 'programming',
      score: 42, num_comments: 10, created_utc: Date.now() / 1000,
      permalink: '/r/programming/comments/abc123/test/',
    }],
    total_results: 1,
  };

  return {
    searchReddit, browseSubreddit, getPostDetails, userAnalysis, redditExplain, apiGet, getRedditTools,
    samplePosts,
  };
});

function setupToolMocks(): void {
  mocks.searchReddit.mockResolvedValue(mocks.samplePosts);
  mocks.browseSubreddit.mockResolvedValue({
    results: [{
      id: 'xyz789', title: 'Hot Post', author: 'poster', subreddit: 'programming',
      score: 500, num_comments: 75, created_utc: Date.now() / 1000,
      permalink: '/r/programming/comments/xyz789/hot/',
    }],
    total_results: 1,
  });
  mocks.getPostDetails.mockResolvedValue({
    post: { id: 'abc123', title: 'Test Post', author: 'testuser', score: 42, num_comments: 10, permalink: '/r/programming/comments/abc123/test/' },
    top_comments: [{ author: 'c1', body: 'Nice', score: 5, depth: 0 }],
  });
  mocks.userAnalysis.mockResolvedValue({
    username: 'testuser',
    accountAge: '3 years',
    karma: { link: 100, comment: 50 },
    top_subreddits: [{ subreddit: 'programming', post_count: 10, comment_count: 5 }],
    recentPosts: [],
  });
  mocks.redditExplain.mockResolvedValue({
    definition: 'Too Long; Did not Read', usage: 'Use after a long post', examples: ['TLDR: buy it'],
  });
  mocks.apiGet.mockResolvedValue({ data: { children: [] } });
  mocks.getRedditTools.mockResolvedValue({
    searchReddit: mocks.searchReddit,
    browseSubreddit: mocks.browseSubreddit,
    getPostDetails: mocks.getPostDetails,
    userAnalysis: mocks.userAnalysis,
    redditExplain: mocks.redditExplain,
    api: { get: mocks.apiGet },
  });
}

vi.mock('../src/mcp-client.js', () => ({
  getRedditTools: mocks.getRedditTools,
}));

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

vi.mock('../src/utils/format.js', async () => {
  const actual = await vi.importActual<typeof import('../src/utils/format.js')>('../src/utils/format.js');
  return { ...actual, log: vi.fn(), debug: vi.fn(), warn: vi.fn() };
});

import { registerSearchCommand } from '../src/commands/search.js';
import { registerBrowseCommand } from '../src/commands/browse.js';
import { registerPostCommand } from '../src/commands/post.js';
import { registerUserCommand } from '../src/commands/user.js';
import { registerExplainCommand } from '../src/commands/explain.js';

function buildProgram(...register: Array<(p: Command) => void>): Command {
  const program = new Command();
  for (const fn of register) fn(program);
  return program;
}

describe('Reddit CLI command flows (real action code)', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    setupToolMocks();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrSpy.mockRestore();
  });

  it('search runs title search and formats results', async () => {
    const program = buildProgram(registerSearchCommand);
    await program.parseAsync(['node', 'test', 'search', 'typescript', '--format', 'json'], { from: 'node' });

    expect(mocks.searchReddit).toHaveBeenCalledWith(expect.objectContaining({
      query: 'typescript', sort: 'relevance', time: 'all', limit: 25,
    }));
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('search --in comments uses the direct API', async () => {
    const program = buildProgram(registerSearchCommand);
    await program.parseAsync(['node', 'test', 'search', 'typescript', '--in', 'comments'], { from: 'node' });

    expect(mocks.apiGet).toHaveBeenCalledWith(expect.stringContaining('/search.json?'));
    expect(mocks.apiGet.mock.calls[0][0]).toContain('type=comment');
  });

  it('search --in body appends self:true', async () => {
    const program = buildProgram(registerSearchCommand);
    await program.parseAsync(['node', 'test', 'search', 'foo', '--in', 'body'], { from: 'node' });

    expect(mocks.searchReddit).toHaveBeenCalledWith(expect.objectContaining({ query: 'foo self:true' }));
  });

  it('search --in all merges title and body results', async () => {
    const program = buildProgram(registerSearchCommand);
    await program.parseAsync(['node', 'test', 'search', 'foo', '--in', 'all'], { from: 'node' });

    expect(mocks.searchReddit).toHaveBeenCalledTimes(2);
  });

  it('search caches the raw response', async () => {
    const { cacheSet } = await import('../src/cache.js');
    const program = buildProgram(registerSearchCommand);
    await program.parseAsync(['node', 'test', 'search', 'foo', '--format', 'json'], { from: 'node' });

    expect(cacheSet).toHaveBeenCalled();
  });

  it('search serves from cache when a cached entry exists', async () => {
    const { cacheSet, cacheGet } = await import('../src/cache.js');
    (cacheGet as ReturnType<typeof vi.fn>).mockReturnValueOnce({ results: [{ id: 'cached1', title: 'Cached', author: 'x', score: 1, num_comments: 0 }] });
    const program = buildProgram(registerSearchCommand);
    await program.parseAsync(['node', 'test', 'search', 'foo', '--format', 'json'], { from: 'node' });

    expect(mocks.searchReddit).not.toHaveBeenCalled();
    expect(cacheSet).not.toHaveBeenCalled();
  });

  it('browse calls browseSubreddit with sort and limit', async () => {
    const program = buildProgram(registerBrowseCommand);
    await program.parseAsync(['node', 'test', 'browse', 'programming', '--sort', 'top', '--limit', '10'], { from: 'node' });

    expect(mocks.browseSubreddit).toHaveBeenCalledWith(expect.objectContaining({
      subreddit: 'programming', sort: 'top', limit: 10,
    }));
  });

  it('post calls getPostDetails for a URL', async () => {
    const program = buildProgram(registerPostCommand);
    await program.parseAsync([
      'node', 'test', 'post', 'https://reddit.com/r/programming/comments/abc123/test/',
      '--comment-limit', '50', '--format', 'json',
    ], { from: 'node' });

    expect(mocks.getPostDetails).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://reddit.com/r/programming/comments/abc123/test/',
      post_id: undefined,
    }));
  });

  it('user calls userAnalysis with limits', async () => {
    const program = buildProgram(registerUserCommand);
    await program.parseAsync(['node', 'test', 'user', 'testuser', '--posts-limit', '5', '--format', 'json'], { from: 'node' });

    expect(mocks.userAnalysis).toHaveBeenCalledWith(expect.objectContaining({
      username: 'testuser', posts_limit: 5,
    }));
  });

  it('explain calls redditExplain with the term', async () => {
    const program = buildProgram(registerExplainCommand);
    await program.parseAsync(['node', 'test', 'explain', 'TLDR', '--format', 'json'], { from: 'node' });

    expect(mocks.redditExplain).toHaveBeenCalledWith({ term: 'TLDR' });
  });

  it('maps 403 errors to an auth-expired message and exit(1)', async () => {
    mocks.searchReddit.mockRejectedValueOnce(new Error('403 Forbidden'));
    const program = buildProgram(registerSearchCommand);
    await program.parseAsync(['node', 'test', 'search', 'foo'], { from: 'node' });

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('clamps out-of-range limits', async () => {
    const program = buildProgram(registerSearchCommand);
    await program.parseAsync(['node', 'test', 'search', 'foo', '--limit', '5000'], { from: 'node' });

    expect(mocks.searchReddit).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
  });
});
