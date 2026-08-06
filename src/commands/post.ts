import type { Command } from 'commander';
import chalk from 'chalk';
import { getRedditTools } from '../mcp-client.js';
import { cacheGet, cacheSet } from '../cache.js';
import { formatOutput, log, debug } from '../utils/format.js';
import { validateResponse, printWarnings } from '../validate.js';
import { PostDetailResponseSchema } from '../schemas.js';
import type { OutputFormat } from '../utils/format.js';

const CACHE_TTL_MS = 30 * 60 * 1000;

export function registerPostCommand(program: Command): void {
  program
    .command('post')
    .description('Get post with comments')
    .argument('<url_or_id>', 'Reddit post URL or ID')
    .option('-s, --subreddit <sub>', 'Subreddit name (required if using post ID)')
    .option('--comment-limit <n>', 'Max comments (1-500)', '100')
    .option('--comment-sort <sort>', 'Comment sort: best|top|new|controversial|qa', 'best')
    .option('--comment-depth <n>', 'Comment depth (1-10)', '3')
    .option('--max-top-comments <n>', 'Max top-level comments (1-20)', '10')
    .option('--extract-links', 'Extract URLs from comments')
    .option('-f, --format <fmt>', 'Output format: table|json|compact-json|csv|raw', 'table')
    .option('-o, --output <file>', 'Write output to file')
    .option('-q, --quiet', 'Suppress stderr output')
    .option('--no-cache', 'Skip cache, fetch fresh data')
    .option('--verbose', 'Show debug info')
    .action(async (urlOrId: string, options: {
      subreddit?: string;
      commentLimit?: string;
      commentSort?: string;
      commentDepth?: string;
      maxTopComments?: string;
      extractLinks?: boolean;
      format: OutputFormat;
      output?: string;
      quiet?: boolean;
      cache: boolean;
      verbose?: boolean;
    }) => {
      try {
        if (options.quiet) {
          (global as any).__quietMode = true;
        }
        
        const tools = await getRedditTools();
        const verbose = options.verbose ?? false;

        const isUrl = urlOrId.startsWith('http');
        const cacheKey = `post|${urlOrId}|${options.commentSort ?? 'best'}|${options.commentLimit ?? '100'}`;

        if (options.cache !== false) {
          const cached = cacheGet<unknown>('post', cacheKey, CACHE_TTL_MS);
          if (cached) {
            debug('Serving from cache', verbose);
            formatOutput(cached, { format: options.format, output: options.output }, { source: 'cache' });
            return;
          }
        }

        log(`Fetching post details...`);

        const raw = await tools.getPostDetails({
          url: isUrl ? urlOrId : undefined,
          post_id: isUrl ? undefined : urlOrId,
          subreddit: options.subreddit,
          comment_limit: Math.min(500, Math.max(1, parseInt(options.commentLimit ?? '100', 10))),
          comment_sort: (options.commentSort ?? 'best') as 'best' | 'top' | 'new' | 'controversial' | 'qa',
          comment_depth: Math.min(10, Math.max(1, parseInt(options.commentDepth ?? '3', 10))),
          max_top_comments: Math.min(20, Math.max(1, parseInt(options.maxTopComments ?? '10', 10))),
          extract_links: options.extractLinks ?? false,
        });

        debug(`Raw response keys: ${Object.keys(raw as object).join(', ')}`, verbose);

        const { data, warnings } = validateResponse(PostDetailResponseSchema, raw, 'post');

        if (options.cache !== false) {
          cacheSet('post', cacheKey, raw, CACHE_TTL_MS);
        }

        if (options.format === 'raw') {
          formatOutput(raw, { format: 'raw', output: options.output });
          printWarnings(warnings);
          return;
        }

        if (options.format === 'json' || options.format === 'compact-json') {
          formatOutput(data, { format: options.format, output: options.output });
        } else if (options.format === 'csv') {
          const comments = (data as any).top_comments ?? [];
          const flatComments = comments.map((c: any) => ({
            author: c.author ?? '',
            body: String(c.body ?? '').slice(0, 200),
            score: c.score ?? 0,
            depth: c.depth ?? 0,
            created: c.created_utc ? new Date(c.created_utc * 1000).toLocaleDateString() : '',
          }));
          formatOutput(flatComments, { format: options.format, output: options.output });
        } else {
          const post = (data as any).post ?? data;
          console.log(chalk.bold(`\n  ${(post as any).title ?? 'Post'}`));
          console.log(chalk.dim(`  by u/${(post as any).author ?? 'unknown'} | ${(post as any).score ?? 0} points | ${(post as any).num_comments ?? 0} comments\n`));

          if ((post as any).content) {
            console.log(String((post as any).content).slice(0, 500));
            console.log('');
          }

          const comments = (data as any).top_comments ?? [];
          if (Array.isArray(comments) && comments.length > 0) {
            console.log(chalk.bold(`  Comments (${comments.length}):`));
            console.log('');
            for (const c of comments.slice(0, parseInt(options.maxTopComments ?? '10', 10))) {
              const indent = '  '.repeat((c.depth ?? 0) + 1);
              console.log(`${indent}${chalk.cyan('u/' + (c.author ?? 'unknown'))} ${chalk.dim(`(${c.score ?? 0} pts)`)}`);
              console.log(`${indent}${String(c.body ?? '').slice(0, 300)}`);
              console.log('');
            }
          }
        }

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
