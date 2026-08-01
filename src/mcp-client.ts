import { AuthManager } from 'reddit-mcp-buddy/dist/core/auth.js';
import { CacheManager } from 'reddit-mcp-buddy/dist/core/cache.js';
import { RateLimiter } from 'reddit-mcp-buddy/dist/core/rate-limiter.js';
import { RedditAPI } from 'reddit-mcp-buddy/dist/services/reddit-api.js';
import { RedditTools } from 'reddit-mcp-buddy/dist/tools/index.js';
import { loadConfig, getConfigEnvVars, type RedditConfig } from './config.js';

let toolsInstance: RedditTools | null = null;
let warnedOnce = false;

class BrowserCookieAuthManager extends AuthManager {
  private cookies: Record<string, string>;

  constructor(cookies: Record<string, string>) {
    super();
    this.cookies = cookies;
  }

  override async load() {
    // Don't load from env/file - we have cookies
    return null;
  }

  override isAuthenticated() {
    // Return false so RedditAPI uses www.reddit.com instead of oauth.reddit.com
    // We still include cookies in headers for authentication
    return false;
  }

  override isTokenExpired() {
    return false;
  }

  override async getAccessToken() {
    return null; // No OAuth token for browser cookies
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
    return 100; // Treat as authenticated
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

  // Check if we have browser cookies
  if (config.cookies && Object.keys(config.cookies).length > 0) {
    return createToolsWithCookies(config.cookies);
  }

  // Otherwise, try OAuth
  const envVars = getConfigEnvVars(config);
  for (const [key, value] of Object.entries(envVars)) {
    process.env[key] = value;
  }

  const authManager = new AuthManager();
  await authManager.load();

  if (!authManager.isAuthenticated() && !warnedOnce) {
    warnedOnce = true;
    console.error('Warning: No Reddit API credentials configured.');
    console.error('Reddit requires OAuth for API access.');
    console.error('');
    console.error('Options:');
    console.error('  1. Run "reddit auth login" to configure OAuth credentials');
    console.error('     Get credentials at: https://www.reddit.com/prefs/apps');
    console.error('');
    console.error('  2. Run "reddit auth browser-login" to login via browser');
    console.error('     (Opens Chrome, you log in, cookies are captured)');
    console.error('');
  }

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

function createToolsWithCookies(cookies: Record<string, string>): RedditTools {
  const authManager = new BrowserCookieAuthManager(cookies);
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
}
