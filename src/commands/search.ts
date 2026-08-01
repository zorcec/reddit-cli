import { Command } from 'commander';
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
    .description('Search Reddit posts')
    .argument('<query>', 'Search query')
    .option('-s, --sort <sort>', 'Sort: relevance|hot|top|new|comments', 'relevance')
    .option('-t, --time <time>', 'Time filter: hour|day|week|month|year|all', 'all')
    .option('-l, --limit <n>', 'Number of results (1-100)', '25')
    .option('--subreddits <subs>', 'Comma-separated subreddits to search in')
    .option('--author <name>', 'Filter by author')
    .option('--flair <text>', 'Filter by flair')
    .option('-f, --format <fmt>', 'Output format: table|json|compact-json|csv|raw', 'table')
    .option('-o, --output <file>', 'Write output to file')
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
      format: OutputFormat;
      output?: string;
      after?: string;
      cache: boolean;
      nsfw?: boolean;
      verbose?: boolean;
    }) => {
      try {
        const tools = await getRedditTools();
        const verbose = options.verbose ?? false;

        const limit = Math.min(100, Math.max(1, parseInt(options.limit ?? '25', 10)));
        const sort = (options.sort ?? 'relevance') as 'relevance' | 'hot' | 'top' | 'new' | 'comments';
        const time = (options.time ?? 'all') as 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
        const subreddits = options.subreddits?.split(',').map(s => s.trim()).filter(Boolean);

        const cacheKey = `search|${query}|${sort}|${time}|${limit}|${options.after ?? ''}|${subreddits?.join(',') ?? ''}|${options.author ?? ''}|${options.flair ?? ''}|${options.nsfw ?? false}`;

        if (options.cache !== false) {
          const cached = cacheGet<unknown>('search', cacheKey, CACHE_TTL_MS);
          if (cached) {
            debug('Serving from cache', verbose);
            formatOutput(cached, { format: options.format, output: options.output }, { source: 'cache' });
            return;
          }
        }

        log(`Searching for "${query}"...`);

        const raw = await tools.searchReddit({
          query,
          sort,
          time,
          limit,
          subreddits,
          author: options.author,
          flair: options.flair,
        });

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
