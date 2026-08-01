import { Command } from 'commander';
import chalk from 'chalk';
import { getRedditTools } from '../mcp-client.js';
import { cacheGet, cacheSet } from '../cache.js';
import { formatOutput, log, debug } from '../utils/format.js';
import { validateResponse, printWarnings } from '../validate.js';
import { UserResponseSchema } from '../schemas.js';
import type { OutputFormat } from '../utils/format.js';

const CACHE_TTL_MS = 30 * 60 * 1000;

export function registerUserCommand(program: Command): void {
  program
    .command('user')
    .description('Analyze a user\'s profile')
    .argument('<username>', 'Reddit username')
    .option('--posts-limit <n>', 'Max posts to fetch (0-100)', '25')
    .option('--comments-limit <n>', 'Max comments to fetch (0-100)', '25')
    .option('-t, --time <time>', 'Time range: day|week|month|year|all', 'all')
    .option('--top-subreddits <n>', 'Number of top subreddits (1-50)', '10')
    .option('-f, --format <fmt>', 'Output format: table|json|compact-json|csv|raw', 'table')
    .option('-o, --output <file>', 'Write output to file')
    .option('--no-cache', 'Skip cache, fetch fresh data')
    .option('--verbose', 'Show debug info')
    .action(async (username: string, options: {
      postsLimit?: string;
      commentsLimit?: string;
      time?: string;
      topSubreddits?: string;
      format: OutputFormat;
      output?: string;
      cache: boolean;
      verbose?: boolean;
    }) => {
      try {
        const tools = await getRedditTools();
        const verbose = options.verbose ?? false;

        const postsLimit = Math.min(100, Math.max(0, parseInt(options.postsLimit ?? '25', 10)));
        const commentsLimit = Math.min(100, Math.max(0, parseInt(options.commentsLimit ?? '25', 10)));
        const timeRange = (options.time ?? 'all') as 'day' | 'week' | 'month' | 'year' | 'all';
        const topSubredditsLimit = Math.min(50, Math.max(1, parseInt(options.topSubreddits ?? '10', 10)));

        const cacheKey = `user|${username}|${postsLimit}|${commentsLimit}|${timeRange}|${topSubredditsLimit}`;

        if (options.cache !== false) {
          const cached = cacheGet<unknown>('user', cacheKey, CACHE_TTL_MS);
          if (cached) {
            debug('Serving from cache', verbose);
            formatOutput(cached, { format: options.format, output: options.output }, { source: 'cache' });
            return;
          }
        }

        log(`Analyzing u/${username}...`);

        const raw = await tools.userAnalysis({
          username,
          posts_limit: postsLimit,
          comments_limit: commentsLimit,
          time_range: timeRange,
          top_subreddits_limit: topSubredditsLimit,
        });

        debug(`Raw response keys: ${Object.keys(raw as object).join(', ')}`, verbose);

        const { data, warnings } = validateResponse(UserResponseSchema, raw, 'user');

        if (options.cache !== false) {
          cacheSet('user', cacheKey, raw, CACHE_TTL_MS);
        }

        if (options.format === 'raw') {
          formatOutput(raw, { format: 'raw', output: options.output });
          printWarnings(warnings);
          return;
        }

        if (options.format === 'json' || options.format === 'compact-json') {
          formatOutput(data, { format: options.format, output: options.output });
        } else if (options.format === 'csv') {
          const subs = (data as any).top_subreddits ?? (data as any).topSubreddits ?? [];
          const subreddits = subs.map((s: any) => ({
            subreddit: s.subreddit ?? s.name ?? '',
            posts: s.post_count ?? s.posts ?? 0,
            comments: s.comment_count ?? s.comments ?? 0,
            karma: s.karma ?? 0,
          }));
          formatOutput(subreddits, { format: options.format, output: options.output });
        } else {
          console.log(chalk.bold(`\n  User: u/${username}`));
          console.log('');

          if ((data as any).accountAge) {
            console.log(`  ${chalk.cyan('Account age')}: ${(data as any).accountAge}`);
          }
          if ((data as any).karma) {
            console.log(`  ${chalk.cyan('Link karma')}: ${(data as any).karma.link ?? 0}`);
            console.log(`  ${chalk.cyan('Comment karma')}: ${(data as any).karma.comment ?? 0}`);
          }

          const subs = (data as any).top_subreddits ?? (data as any).topSubreddits ?? [];
          if (Array.isArray(subs) && subs.length > 0) {
            console.log(chalk.bold(`\n  Top Subreddits:`));
            for (const s of subs.slice(0, topSubredditsLimit)) {
              console.log(`    r/${s.subreddit ?? s.name ?? 'unknown'}: ${s.post_count ?? s.posts ?? 0} posts, ${s.comment_count ?? s.comments ?? 0} comments`);
            }
          }

          const posts = (data as any).recentPosts ?? (data as any).posts ?? [];
          if (Array.isArray(posts) && posts.length > 0) {
            console.log(chalk.bold(`\n  Recent Posts:`));
            for (const p of posts.slice(0, 5)) {
              console.log(`    ${p.score ?? 0} pts | ${String(p.title ?? '').slice(0, 60)}`);
            }
          }

          console.log('');
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
