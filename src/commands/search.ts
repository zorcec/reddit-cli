import type { Command } from 'commander';
import chalk from 'chalk';
import { getRedditTools } from '../mcp-client.js';
import { cacheGet, cacheSet } from '../cache.js';
import { formatOutput, log, debug } from '../utils/format.js';
import { formatPosts } from '../utils/posts.js';
import { validateResponse, printWarnings } from '../validate.js';
import { ListingResponseSchema } from '../schemas.js';
import type { OutputFormat } from '../utils/format.js';

const CACHE_TTL_MS = 5 * 60 * 1000;

export function registerSearchCommand(program: Command): void {
  program
    .command('search')
    .description('Search Reddit posts and comments')
    .argument('<query>', 'Search query')
    .option('-s, --sort <sort>', 'Sort: relevance|hot|top|new|comments', 'relevance')
    .option('-t, --time <time>', 'Time filter: hour|day|week|month|year|all', 'all')
    .option('-l, --limit <n>', 'Number of results (1-100)', '25')
    .option('--subreddits <subs>', 'Comma-separated subreddits to search in')
    .option('--author <name>', 'Filter by author')
    .option('--flair <text>', 'Filter by flair')
    .option('--in <scope>', 'Search in: title (default), comments, body, all', 'title')
    .option('-f, --format <fmt>', 'Output format: table|json|compact-json|csv|raw', 'table')
    .option('-o, --output <file>', 'Write output to file')
    .option('-q, --quiet', 'Suppress stderr output')
    .option('--after <cursor>', 'Pagination cursor for next page')
    .option('--no-cache', 'Skip cache, fetch fresh data')
    .option('--nsfw', 'Include NSFW content')
    .option('--verbose', 'Show debug info')
    .action(async (query: string, options: {
      sort?: string;
      time?: string;
      limit?: string;
      subreddits?: string;
      author?: string;
      flair?: string;
      in?: string;
      format: OutputFormat;
      output?: string;
      quiet?: boolean;
      after?: string;
      cache: boolean;
      nsfw?: boolean;
      verbose?: boolean;
    }) => {
      try {
        if (options.quiet) {
          (global as any).__quietMode = true;
        }
        
        const tools = await getRedditTools();
        const verbose = options.verbose ?? false;
        const scope = options.in ?? 'title';

        const limit = Math.min(100, Math.max(1, parseInt(options.limit ?? '25', 10)));
        const sort = (options.sort ?? 'relevance') as 'relevance' | 'hot' | 'top' | 'new' | 'comments';
        const time = (options.time ?? 'all') as 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
        const subreddits = options.subreddits?.split(',').map(s => s.trim()).filter(Boolean);

        const cacheKey = `search|${query}|${sort}|${time}|${limit}|${scope}|${options.after ?? ''}|${subreddits?.join(',') ?? ''}|${options.author ?? ''}|${options.flair ?? ''}|${options.nsfw ?? false}`;

        if (options.cache !== false) {
          const cached = cacheGet<unknown>('search', cacheKey, CACHE_TTL_MS);
          if (cached) {
            debug('Serving from cache', verbose);
            formatOutput(cached, { format: options.format, output: options.output }, { source: 'cache' });
            return;
          }
        }

        log(`Searching for "${query}" (in: ${scope})...`);

        let raw: unknown;

        if (scope === 'comments') {
          // Use direct API call for comment search
          debug('Using direct API for comment search', verbose);
          raw = await searchComments(tools, query, {
            subreddit: subreddits?.[0],
            sort,
            time,
            limit,
            after: options.after,
          });
        } else if (scope === 'body') {
          // Search selftext using Reddit's self:true qualifier
          debug('Using self:true qualifier for body search', verbose);
          const bodyQuery = `${query} self:true`;
          raw = await tools.searchReddit({
            query: bodyQuery,
            sort,
            time,
            limit,
            subreddits,
            author: options.author,
            flair: options.flair,
          });
        } else if (scope === 'all') {
          // Search title + body, then merge
          debug('Searching title + body', verbose);
          const [titleResults, bodyResults] = await Promise.all([
            tools.searchReddit({
              query,
              sort,
              time,
              limit: Math.ceil(limit / 2),
              subreddits,
              author: options.author,
              flair: options.flair,
            }),
            tools.searchReddit({
              query: `${query} self:true`,
              sort,
              time,
              limit: Math.ceil(limit / 2),
              subreddits,
              author: options.author,
              flair: options.flair,
            }),
          ]);
          // Merge and deduplicate
          const titlePosts = (titleResults as any).results ?? (titleResults as any).posts ?? [];
          const bodyPosts = (bodyResults as any).results ?? (bodyResults as any).posts ?? [];
          const seen = new Set(titlePosts.map((p: any) => p.id));
          const merged = [...titlePosts];
          for (const p of bodyPosts) {
            if (!seen.has(p.id)) {
              merged.push(p);
              seen.add(p.id);
            }
          }
          raw = { results: merged.slice(0, limit), total_results: merged.length };
        } else {
          // Default: title search
          raw = await tools.searchReddit({
            query,
            sort,
            time,
            limit,
            subreddits,
            author: options.author,
            flair: options.flair,
          });
        }

        debug(`Raw response keys: ${Object.keys(raw as object).join(', ')}`, verbose);

        const { data, warnings } = validateResponse(ListingResponseSchema, raw, 'search');

        if (options.cache !== false) {
          cacheSet('search', cacheKey, raw, CACHE_TTL_MS);
        }

        if (options.format === 'raw') {
          formatOutput(raw, { format: 'raw', output: options.output });
          printWarnings(warnings);
          return;
        }

        const posts = formatPosts(data);

        formatOutput(posts, {
          format: options.format,
          output: options.output,
        }, {
          query,
          scope,
          count: posts.length,
        });

        printWarnings(warnings);
      } catch (err: any) {
        if (err?.message?.includes('403') || err?.message?.includes('forbidden')) {
          console.error(chalk.red('\n  Authentication expired. Run: reddit auth browser-login\n'));
        } else {
          console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
        }
        process.exit(1);
      }
    });
}

async function searchComments(tools: any, query: string, options: {
  subreddit?: string;
  sort?: string;
  time?: string;
  limit?: number;
  after?: string;
}): Promise<unknown> {
  const params = new URLSearchParams({
    q: query,
    sort: options.sort ?? 'relevance',
    t: options.time ?? 'all',
    limit: String(options.limit ?? 25),
    type: 'comment',
    raw_json: '1',
  });

  if (options.after) {
    params.append('after', options.after);
  }

  const endpoint = options.subreddit
    ? `/r/${options.subreddit}/search.json?${params}&restrict_sr=1`
    : `/search.json?${params}`;

  // Access the underlying API
  const api = tools.api;
  return api.get(endpoint);
}
