import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the config module
vi.mock('../src/config.js', () => ({
  loadConfig: vi.fn().mockReturnValue({}),
  getConfigEnvVars: vi.fn().mockReturnValue({}),
}));

// Mock the reddit-mcp-buddy modules
vi.mock('reddit-mcp-buddy/dist/core/auth.js', () => ({
  AuthManager: vi.fn().mockImplementation(() => ({
    load: vi.fn().mockResolvedValue(null),
    isAuthenticated: vi.fn().mockReturnValue(false),
  })),
}));

vi.mock('reddit-mcp-buddy/dist/core/cache.js', () => ({
  CacheManager: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('reddit-mcp-buddy/dist/core/rate-limiter.js', () => ({
  RateLimiter: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('reddit-mcp-buddy/dist/services/reddit-api.js', () => ({
  RedditAPI: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('reddit-mcp-buddy/dist/tools/index.js', () => ({
  RedditTools: vi.fn().mockImplementation(() => ({
    browseSubreddit: vi.fn().mockResolvedValue({
      data: { children: [] },
    }),
    searchReddit: vi.fn().mockResolvedValue({
      data: { children: [] },
    }),
    getPostDetails: vi.fn().mockResolvedValue({
      post: { title: 'Test Post', author: 'test', score: 100 },
      top_comments: [],
    }),
    userAnalysis: vi.fn().mockResolvedValue({
      username: 'testuser',
      karma: { link: 100, comment: 50, total: 150 },
    }),
    redditExplain: vi.fn().mockResolvedValue({
      definition: 'Test definition',
      origin: 'Test origin',
      usage: 'Test usage',
      examples: ['Example 1'],
    }),
  })),
}));

import { getRedditTools, resetTools } from '../src/mcp-client.js';
import { loadConfig } from '../src/config.js';

describe('mcp-client', () => {
  beforeEach(() => {
    resetTools();
    vi.mocked(loadConfig).mockReturnValue({});
  });

  it('creates tools instance', async () => {
    const tools = await getRedditTools();
    expect(tools).toBeDefined();
  });

  it('reuses tools instance', async () => {
    const tools1 = await getRedditTools();
    const tools2 = await getRedditTools();
    expect(tools1).toBe(tools2);
  });

  it('resetTools clears instance', async () => {
    const tools1 = await getRedditTools();
    resetTools();
    const tools2 = await getRedditTools();
    expect(tools1).not.toBe(tools2);
  });

  it('uses browser cookie auth when cookies configured', async () => {
    vi.mocked(loadConfig).mockReturnValue({
      cookies: { reddit_session: 'test-session-value' },
    });
    const tools = await getRedditTools();
    expect(tools).toBeDefined();
  });
});
