import { Command } from 'commander';
import chalk from 'chalk';
import { getRedditTools } from '../mcp-client.js';
import { cacheGet, cacheSet } from '../cache.js';
import { formatOutput, info } from '../utils/format.js';
import { formatPosts } from '../utils/posts.js';
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
    .option('-f, --format <fmt>', 'Output format: table|json|csv', 'table')
    .option('-o, --output <file>', 'Write output to file')
    .option('--no-cache', 'Skip cache, fetch fresh data')
    .option('--nsfw', 'Include NSFW content')
    .action(async (query: string, options: {
      sort?: string;
      time?: string;
      limit?: string;
      subreddits?: string;
      author?: string;
      flair?: string;
      format: OutputFormat;
      output?: string;
      cache: boolean;
      nsfw?: boolean;
    }) => {
      try {
        const tools = await getRedditTools();

        const limit = Math.min(100, Math.max(1, parseInt(options.limit ?? '25', 10)));
        const sort = (options.sort ?? 'relevance') as 'relevance' | 'hot' | 'top' | 'new' | 'comments';
        const time = (options.time ?? 'all') as 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
        const subreddits = options.subreddits?.split(',').map(s => s.trim()).filter(Boolean);

        // Build cache key
        const cacheKey = `search|${query}|${sort}|${time}|${limit}|${subreddits?.join(',') ?? ''}|${options.author ?? ''}|${options.flair ?? ''}|${options.nsfw ?? false}`;

        // Check cache
        if (options.cache !== false) {
          const cached = cacheGet<unknown>('search', cacheKey, CACHE_TTL_MS);
          if (cached) {
            formatOutput(cached, {
              format: options.format,
              output: options.output,
            }, { source: 'cache' });
            return;
          }
        }

        info(`Searching for "${query}"...`);

        const result = await tools.searchReddit({
          query,
          sort,
          time,
          limit,
          subreddits,
          author: options.author,
          flair: options.flair,
        });

        // Cache result
        if (options.cache !== false) {
          cacheSet('search', cacheKey, result, CACHE_TTL_MS);
        }

        // Extract posts from Reddit listing format
        const posts = formatPosts(result);

        formatOutput(posts, {
          format: options.format,
          output: options.output,
        }, {
          query,
          count: posts.length,
        });
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    });
}
