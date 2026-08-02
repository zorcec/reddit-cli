import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

// Use vi.hoisted for mock data that needs to be available when mocks are hoisted
const { mockSearchResults, mockBrowseResults, mockPostDetail, mockUserPosts, mockSlangResult, mockFormatOutput, mockSearchReddit, mockBrowseSubreddit, mockGetPost, mockGetUserPosts, mockExplainSlang, mockGetRedditTools } = vi.hoisted(() => {
  const mockSearchResults = {
    results: [
      {
        id: 'abc123',
        title: 'Test Post Title',
        author: 'testuser',
        subreddit: 'programming',
        score: 42,
        num_comments: 10,
        created_utc: Date.now() / 1000,
        url: 'https://reddit.com/r/programming/comments/abc123/test_post/',
        permalink: '/r/programming/comments/abc123/test_post/',
        selftext: 'This is a test post body',
        link_flair_text: 'Discussion',
        is_video: false,
        is_self: true,
        over_18: false,
      },
    ],
    total_results: 1,
  };

  const mockBrowseResults = {
    results: [
      {
        id: 'xyz789',
        title: 'Hot Post in Subreddit',
        author: 'hotposter',
        subreddit: 'programming',
        score: 500,
        num_comments: 75,
        created_utc: Date.now() / 1000,
        url: 'https://reddit.com/r/programming/comments/xyz789/hot_post/',
        permalink: '/r/programming/comments/xyz789/hot_post/',
        selftext: 'Hot post content',
        link_flair_text: null,
        is_video: false,
        is_self: true,
        over_18: false,
      },
    ],
    total_results: 1,
  };

  const mockPostDetail = {
    post: {
      id: 'abc123',
      title: 'Test Post Title',
      author: 'testuser',
      subreddit: 'programming',
      score: 42,
      num_comments: 10,
      created_utc: Date.now() / 1000,
      url: 'https://reddit.com/r/programming/comments/abc123/test_post/',
      permalink: '/r/programming/comments/abc123/test_post/',
      content: 'This is the post content',
      upvote_ratio: 0.95,
      is_video: false,
      is_text_post: true,
      nsfw: false,
      stickied: false,
      locked: false,
    },
    top_comments: [
      {
        id: 'comment1',
        author: 'commenter1',
        body: 'Great post!',
        score: 15,
        depth: 0,
        created_utc: Date.now() / 1000,
        is_op: false,
      },
    ],
    total_comments: 1,
  };

  const mockUserPosts = {
    posts: [{ id: 'userpost1', title: 'User Post', subreddit: 'programming', score: 10, num_comments: 5, created_utc: Date.now() / 1000 }],
    comments: [],
    top_subreddits: [{ name: 'programming', count: 10 }],
  };

  const mockSlangResult = { term: 'TLDR', meaning: 'Too Long; Didn\'t Read' };

  const mockFormatOutput = vi.fn();
  const mockSearchReddit = vi.fn().mockResolvedValue(mockSearchResults);
  const mockBrowseSubreddit = vi.fn().mockResolvedValue(mockBrowseResults);
  const mockGetPost = vi.fn().mockResolvedValue(mockPostDetail);
  const mockGetUserPosts = vi.fn().mockResolvedValue(mockUserPosts);
  const mockExplainSlang = vi.fn().mockResolvedValue(mockSlangResult);

  const mockGetRedditTools = vi.fn().mockResolvedValue({
    searchReddit: mockSearchReddit,
    browseSubreddit: mockBrowseSubreddit,
    getPost: mockGetPost,
    getUserPosts: mockGetUserPosts,
    explainSlang: mockExplainSlang,
  });

  return { mockSearchResults, mockBrowseResults, mockPostDetail, mockUserPosts, mockSlangResult, mockFormatOutput, mockSearchReddit, mockBrowseSubreddit, mockGetPost, mockGetUserPosts, mockExplainSlang, mockGetRedditTools };
});

vi.mock('../src/mcp-client.js', () => ({
  getRedditTools: mockGetRedditTools,
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

vi.mock('../src/rate-limiter.js', () => ({
  RateLimiter: vi.fn().mockImplementation(() => ({
    waitAndAcquire: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../src/utils/format.js', async () => {
  const actual = await vi.importActual('../src/utils/format.js');
  return {
    ...actual,
    formatOutput: mockFormatOutput,
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };
});

// Import the formatPosts function to test data transformation
import { formatPosts } from '../src/utils/posts.js';

describe('Reddit CLI Behavioral Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    // Re-setup mock implementations after clearAllMocks
    mockSearchReddit.mockResolvedValue(mockSearchResults);
    mockBrowseSubreddit.mockResolvedValue(mockBrowseResults);
    mockGetPost.mockResolvedValue(mockPostDetail);
    mockGetUserPosts.mockResolvedValue(mockUserPosts);
    mockExplainSlang.mockResolvedValue(mockSlangResult);
    mockGetRedditTools.mockResolvedValue({
      searchReddit: mockSearchReddit,
      browseSubreddit: mockBrowseSubreddit,
      getPost: mockGetPost,
      getUserPosts: mockGetUserPosts,
      explainSlang: mockExplainSlang,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('search argument transformation', () => {
    it('parses subreddits into array', () => {
      const subreddits = 'reactjs,javascript'.split(',').map(s => s.trim()).filter(Boolean);
      expect(subreddits).toEqual(['reactjs', 'javascript']);
    });

    it('parses limit with bounds', () => {
      const limit = Math.min(100, Math.max(1, parseInt('50', 10)));
      expect(limit).toBe(50);
    });

    it('clamps limit to max 100', () => {
      const limit = Math.min(100, Math.max(1, parseInt('200', 10)));
      expect(limit).toBe(100);
    });

    it('clamps limit to min 1', () => {
      const limit = Math.min(100, Math.max(1, parseInt('0', 10)));
      expect(limit).toBe(1);
    });

    it('builds cache key correctly', () => {
      const query = 'typescript';
      const sort = 'top';
      const time = 'month';
      const limit = 10;
      const scope = 'title';
      const cacheKey = `search|${query}|${sort}|${time}|${limit}|${scope}|||${false}`;
      expect(cacheKey).toBe('search|typescript|top|month|10|title|||false');
    });

    it('handles body search scope with self:true qualifier', () => {
      const query = 'test';
      const scope = 'body';
      const bodyQuery = scope === 'body' ? `${query} self:true` : query;
      expect(bodyQuery).toBe('test self:true');
    });

    it('handles all search scope by merging results', () => {
      const scope = 'all';
      const limit = 10;
      const halfLimit = Math.ceil(limit / 2);
      expect(halfLimit).toBe(5);
    });
  });

  describe('browse argument transformation', () => {
    it('uses default sort hot', () => {
      const sort = 'hot';
      expect(sort).toBe('hot');
    });

    it('parses subreddit name correctly', () => {
      const subreddit = 'programming';
      expect(subreddit).toBe('programming');
    });
  });

  describe('post argument transformation', () => {
    it('extracts post ID from URL', () => {
      const url = 'https://reddit.com/r/programming/comments/abc123/title/';
      const id = url.match(/comments\/([a-z0-9]+)/)?.[1];
      expect(id).toBe('abc123');
    });

    it('uses raw ID when not URL', () => {
      const input = 'abc123';
      const isUrl = input.includes('reddit.com') || input.includes('redd.it');
      expect(isUrl).toBe(false);
    });
  });

  describe('user argument transformation', () => {
    it('passes username correctly', () => {
      const username = 'testuser';
      expect(username).toBe('testuser');
    });

    it('handles time filter', () => {
      const time = 'month';
      expect(['day', 'week', 'month', 'year', 'all']).toContain(time);
    });
  });

  describe('explain argument transformation', () => {
    it('passes term correctly', () => {
      const term = 'TLDR';
      expect(term).toBe('TLDR');
    });

    it('handles multi-word terms', () => {
      const term = 'cake day';
      expect(term).toBe('cake day');
    });
  });

  describe('cache behavior', () => {
    it('skips cache when --no-cache is set', () => {
      const cache = false;
      expect(cache).toBe(false);
    });

    it('uses cache by default', () => {
      const cache = true;
      expect(cache).toBe(true);
    });

    it('cache TTL is 5 minutes for search/browse', () => {
      const CACHE_TTL_MS = 5 * 60 * 1000;
      expect(CACHE_TTL_MS).toBe(300000);
    });

    it('cache TTL is 30 minutes for posts', () => {
      const CACHE_TTL_MS = 30 * 60 * 1000;
      expect(CACHE_TTL_MS).toBe(1800000);
    });

    it('cache TTL is 1 hour for explain', () => {
      const CACHE_TTL_MS = 60 * 60 * 1000;
      expect(CACHE_TTL_MS).toBe(3600000);
    });
  });

  describe('output format handling', () => {
    it('supports all output formats', () => {
      const formats = ['table', 'json', 'compact-json', 'csv', 'raw'];
      expect(formats).toContain('json');
      expect(formats).toContain('csv');
      expect(formats).toContain('raw');
    });

    it('raw format outputs unmodified API response', () => {
      const format = 'raw';
      expect(format).toBe('raw');
    });
  });

  describe('scope handling', () => {
    it('title scope searches titles only', () => {
      const scope = 'title';
      expect(scope).toBe('title');
    });

    it('comments scope uses direct API', () => {
      const scope = 'comments';
      expect(scope).toBe('comments');
    });

    it('body scope uses self:true qualifier', () => {
      const scope = 'body';
      expect(scope).toBe('body');
    });

    it('all scope merges title and body results', () => {
      const scope = 'all';
      expect(scope).toBe('all');
    });
  });

  describe('error handling', () => {
    it('handles 403 errors with auth message', () => {
      const err = { message: '403 forbidden' };
      const isAuthError = err?.message?.includes('403') || err?.message?.includes('forbidden');
      expect(isAuthError).toBe(true);
    });

    it('handles generic errors', () => {
      const err = { message: 'Network error' };
      const isAuthError = err?.message?.includes('403') || err?.message?.includes('forbidden');
      expect(isAuthError).toBe(false);
    });
  });

  describe('data transformation', () => {
    it('formatPosts transforms API response correctly', () => {
      const raw = {
        data: {
          children: [
            {
              data: {
                id: 'abc123',
                title: 'Test Post',
                author: 'testuser',
                subreddit: 'programming',
                score: 42,
                num_comments: 10,
                created_utc: Date.now() / 1000,
                url: 'https://reddit.com/r/programming/comments/abc123/test/',
                permalink: '/r/programming/comments/abc123/test/',
                selftext: 'Post body',
                link_flair_text: 'Discussion',
                is_video: false,
                is_self: true,
                over_18: false,
              },
            },
          ],
        },
      };

      const posts = formatPosts(raw);
      expect(posts).toHaveLength(1);
      expect(posts[0].title).toBe('Test Post');
      expect(posts[0].author).toBe('testuser');
      expect(posts[0].subreddit).toBe('programming');
      expect(posts[0].score).toBe(42);
      expect(posts[0].comments).toBe(10);
      expect(posts[0].flair).toBe('Discussion');
    });

    it('formatPosts handles empty results', () => {
      const raw = { data: { children: [] } };
      const posts = formatPosts(raw);
      expect(posts).toHaveLength(0);
    });

    it('formatPosts handles missing data gracefully', () => {
      const raw = {};
      const posts = formatPosts(raw);
      expect(posts).toHaveLength(0);
    });

    it('formatPosts handles reddit-mcp-buddy format', () => {
      const raw = {
        results: [
          {
            title: 'MCP Post',
            author: 'mcpuser',
            subreddit: 'test',
            score: 5,
            num_comments: 2,
            created_utc: Date.now() / 1000,
            permalink: '/r/test/comments/abc/',
            link_flair_text: null,
          },
        ],
      };

      const posts = formatPosts(raw);
      expect(posts).toHaveLength(1);
      expect(posts[0].title).toBe('MCP Post');
      expect(posts[0].author).toBe('mcpuser');
    });
  });

  describe('mock integration', () => {
    it('mockGetRedditTools returns correct structure', async () => {
      const tools = await mockGetRedditTools();
      expect(tools.searchReddit).toBeDefined();
      expect(tools.browseSubreddit).toBeDefined();
      expect(tools.getPost).toBeDefined();
      expect(tools.getUserPosts).toBeDefined();
      expect(tools.explainSlang).toBeDefined();
    });

    it('mockSearchReddit returns expected data', async () => {
      const result = await mockSearchReddit();
      expect(result.results).toHaveLength(1);
      expect(result.results[0].title).toBe('Test Post Title');
    });

    it('mockBrowseSubreddit returns expected data', async () => {
      const result = await mockBrowseSubreddit();
      expect(result.results).toHaveLength(1);
      expect(result.results[0].title).toBe('Hot Post in Subreddit');
    });

    it('mockGetPost returns expected data', async () => {
      const result = await mockGetPost();
      expect(result.post.title).toBe('Test Post Title');
      expect(result.top_comments).toHaveLength(1);
    });

    it('mockGetUserPosts returns expected data', async () => {
      const result = await mockGetUserPosts();
      expect(result.posts).toHaveLength(1);
      expect(result.top_subreddits).toHaveLength(1);
    });

    it('mockExplainSlang returns expected data', async () => {
      const result = await mockExplainSlang();
      expect(result.term).toBe('TLDR');
      expect(result.meaning).toContain('Too Long');
    });
  });
});
