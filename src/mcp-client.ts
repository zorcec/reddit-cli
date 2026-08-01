import { AuthManager } from 'reddit-mcp-buddy/dist/core/auth.js';
import { CacheManager } from 'reddit-mcp-buddy/dist/core/cache.js';
import { RateLimiter } from 'reddit-mcp-buddy/dist/core/rate-limiter.js';
import { RedditAPI } from 'reddit-mcp-buddy/dist/services/reddit-api.js';
import { RedditTools } from 'reddit-mcp-buddy/dist/tools/index.js';
import { loadConfig, getConfigEnvVars } from './config.js';
import { warn, debug } from './utils/format.js';
import chalk from 'chalk';

let toolsInstance: RedditTools | null = null;
let warnedOnce = false;

class BrowserCookieAuthManager extends AuthManager {
  private cookies: Record<string, string>;

  constructor(cookies: Record<string, string>) {
    super();
    this.cookies = cookies;
  }

  override async load() {
    return null;
  }

  override isAuthenticated() {
    return false; // Uses www.reddit.com, not oauth.reddit.com
  }

  override isTokenExpired() {
    return false;
  }

  override async getAccessToken() {
    return null;
  }

  override async getHeaders() {
    const cookieHeader = Object.entries(this.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');

    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Cookie': cookieHeader,
    };
  }

  override getRateLimit() {
    return 100;
  }

  override getCacheTTL() {
    return 5 * 60 * 1000;
  }

  override hasFullAuth() {
    return true;
  }

  override getAuthMode() {
    return 'Browser';
  }
}

export async function getRedditTools(): Promise<RedditTools> {
  if (toolsInstance) return toolsInstance;

  const config = loadConfig();

  if (config.cookies && Object.keys(config.cookies).length > 0) {
    // Check for reddit_session cookie presence
    if (!config.cookies['reddit_session']) {
      if (!warnedOnce) {
        warnedOnce = true;
        warn('Cookies found but reddit_session is missing. Session may be invalid.');
        warn('Run "reddit auth browser-login" to re-authenticate.');
      }
    }
    return createToolsWithCookies(config.cookies);
  }

  // OAuth path
  const envVars = getConfigEnvVars(config);
  for (const [key, value] of Object.entries(envVars)) {
    process.env[key] = value;
  }

  const authManager = new AuthManager();
  await authManager.load();

  if (!authManager.isAuthenticated() && !warnedOnce) {
    warnedOnce = true;
    console.error('No Reddit API credentials configured.');
    console.error('');
    console.error('Options:');
    console.error('  1. reddit auth browser-login  (recommended — opens Chrome)');
    console.error('  2. reddit auth login          (needs API key from reddit.com/prefs/apps)');
    console.error('');
  }

  return createTools(authManager);
}

function createToolsWithCookies(cookies: Record<string, string>): RedditTools {
  const authManager = new BrowserCookieAuthManager(cookies);
  return createTools(authManager);
}

function createTools(authManager: AuthManager): RedditTools {
  const rateLimiter = new RateLimiter({ limit: 100, window: 60_000 });
  const cacheManager = new CacheManager({ maxSize: 50 * 1024 * 1024 });

  const api = new RedditAPI({
    authManager,
    rateLimiter,
    cacheManager,
    timeout: 15_000,
  });

  toolsInstance = new RedditTools(api);
  return toolsInstance;
}

export function resetTools(): void {
  toolsInstance = null;
  warnedOnce = false;
}
