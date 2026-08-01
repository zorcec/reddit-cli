import { Command } from 'commander';
import chalk from 'chalk';
import { getRedditTools } from '../mcp-client.js';
import { cacheGet, cacheSet } from '../cache.js';
import { formatOutput, info } from '../utils/format.js';
import { formatPosts } from '../utils/posts.js';
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
    .option('-f, --format <fmt>', 'Output format: table|json|csv', 'table')
    .option('-o, --output <file>', 'Write output to file')
    .option('--no-cache', 'Skip cache, fetch fresh data')
    .option('--nsfw', 'Include NSFW content')
    .action(async (subreddit: string, options: {
      sort?: string;
      time?: string;
      limit?: string;
      format: OutputFormat;
      output?: string;
      cache: boolean;
      nsfw?: boolean;
    }) => {
      try {
        const tools = await getRedditTools();

        const limit = Math.min(100, Math.max(1, parseInt(options.limit ?? '25', 10)));
        const sort = (options.sort ?? 'hot') as 'hot' | 'new' | 'top' | 'rising' | 'controversial';
        const time = options.time as 'hour' | 'day' | 'week' | 'month' | 'year' | 'all' | undefined;

        // Build cache key
        const cacheKey = `${subreddit}|${sort}|${time}|${limit}|${options.nsfw ?? false}`;

        // Check cache
        if (options.cache !== false) {
          const cached = cacheGet<unknown>('browse', cacheKey, CACHE_TTL_MS);
          if (cached) {
            formatOutput(cached, {
              format: options.format,
              output: options.output,
            }, { source: 'cache' });
            return;
          }
        }

        info(`Browsing r/${subreddit} (${sort})...`);

        const result = await tools.browseSubreddit({
          subreddit,
          sort,
          time,
          limit,
          include_nsfw: options.nsfw ?? false,
          include_subreddit_info: false,
        });

        // Cache result
        if (options.cache !== false) {
          cacheSet('browse', cacheKey, result, CACHE_TTL_MS);
        }

        // Extract posts from Reddit listing format
        const posts = formatPosts(result);

        formatOutput(posts, {
          format: options.format,
          output: options.output,
        }, {
          subreddit,
          sort,
          count: posts.length,
        });
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    });
}
