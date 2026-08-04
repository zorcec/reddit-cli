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

export function registerBrowseCommand(program: Command): void {
  program
    .command('browse')
    .description('Browse posts from a subreddit')
    .argument('<subreddit>', 'Subreddit name (without r/ prefix)')
    .option('-s, --sort <sort>', 'Sort: hot|new|top|rising|controversial', 'hot')
    .option('-t, --time <time>', 'Time filter for top/controversial: hour|day|week|month|year|all', 'day')
    .option('-l, --limit <n>', 'Number of results (1-100)', '25')
    .option('-f, --format <fmt>', 'Output format: table|json|compact-json|csv|raw', 'table')
    .option('-o, --output <file>', 'Write output to file')
    .option('--after <cursor>', 'Pagination cursor for next page')
    .option('--no-cache', 'Skip cache, fetch fresh data')
    .option('--nsfw', 'Include NSFW content')
    .option('--verbose', 'Show debug info')
    .action(async (subreddit: string, options: {
      sort?: string;
      time?: string;
      limit?: string;
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
        const sort = (options.sort ?? 'hot') as 'hot' | 'new' | 'top' | 'rising' | 'controversial';
        const time = options.time as 'hour' | 'day' | 'week' | 'month' | 'year' | 'all' | undefined;

        const cacheKey = `${subreddit}|${sort}|${time}|${limit}|${options.after ?? ''}|${options.nsfw ?? false}`;

        if (options.cache !== false) {
          const cached = cacheGet<unknown>('browse', cacheKey, CACHE_TTL_MS);
          if (cached) {
            debug('Serving from cache', verbose);
            formatOutput(cached, { format: options.format, output: options.output }, { source: 'cache' });
            return;
          }
        }

        log(`Browsing r/${subreddit} (${sort})...`);

        const raw = await tools.browseSubreddit({
          subreddit,
          sort,
          time,
          limit,
          include_nsfw: options.nsfw ?? false,
          include_subreddit_info: false,
        });

        debug(`Raw response keys: ${Object.keys(raw as object).join(', ')}`, verbose);

        // Validate response
        const { data, warnings } = validateResponse(ListingResponseSchema, raw, 'browse');

        if (options.cache !== false) {
          cacheSet('browse', cacheKey, raw, CACHE_TTL_MS);
        }

        // Raw mode: output unmodified API response
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
          subreddit,
          sort,
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
