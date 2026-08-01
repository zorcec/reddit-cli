import { Command } from 'commander';
import chalk from 'chalk';
import { getRedditTools } from '../mcp-client.js';
import { cacheGet, cacheSet } from '../cache.js';
import { formatOutput, info } from '../utils/format.js';
import type { OutputFormat } from '../utils/format.js';

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes for user data

export function registerUserCommand(program: Command): void {
  program
    .command('user')
    .description('Analyze a user\'s profile')
    .argument('<username>', 'Reddit username')
    .option('--posts-limit <n>', 'Max posts to fetch (0-100)', '25')
    .option('--comments-limit <n>', 'Max comments to fetch (0-100)', '25')
    .option('-t, --time <time>', 'Time range: day|week|month|year|all', 'all')
    .option('--top-subreddits <n>', 'Number of top subreddits (1-50)', '10')
    .option('-f, --format <fmt>', 'Output format: table|json|csv', 'table')
    .option('-o, --output <file>', 'Write output to file')
    .option('--no-cache', 'Skip cache, fetch fresh data')
    .action(async (username: string, options: {
      postsLimit?: string;
      commentsLimit?: string;
      time?: string;
      topSubreddits?: string;
      format: OutputFormat;
      output?: string;
      cache: boolean;
    }) => {
      try {
        const tools = await getRedditTools();

        const postsLimit = Math.min(100, Math.max(0, parseInt(options.postsLimit ?? '25', 10)));
        const commentsLimit = Math.min(100, Math.max(0, parseInt(options.commentsLimit ?? '25', 10)));
        const timeRange = (options.time ?? 'all') as 'day' | 'week' | 'month' | 'year' | 'all';
        const topSubredditsLimit = Math.min(50, Math.max(1, parseInt(options.topSubreddits ?? '10', 10)));

        // Build cache key
        const cacheKey = `user|${username}|${postsLimit}|${commentsLimit}|${timeRange}|${topSubredditsLimit}`;

        // Check cache
        if (options.cache !== false) {
          const cached = cacheGet<unknown>('user', cacheKey, CACHE_TTL_MS);
          if (cached) {
            formatOutput(cached, {
              format: options.format,
              output: options.output,
            }, { source: 'cache' });
            return;
          }
        }

        info(`Analyzing u/${username}...`);

        const result = await tools.userAnalysis({
          username,
          posts_limit: postsLimit,
          comments_limit: commentsLimit,
          time_range: timeRange,
          top_subreddits_limit: topSubredditsLimit,
        });

        // Cache result
        if (options.cache !== false) {
          cacheSet('user', cacheKey, result, CACHE_TTL_MS);
        }

        if (options.format === 'json') {
          formatOutput(result, {
            format: options.format,
            output: options.output,
          });
        } else if (options.format === 'csv') {
          const data = result as any;
          const subs = data.top_subreddits ?? data.topSubreddits ?? [];
          const subreddits = subs.map((s: any) => ({
            subreddit: s.subreddit ?? s.name ?? '',
            posts: s.post_count ?? s.posts ?? 0,
            comments: s.comment_count ?? s.comments ?? 0,
            karma: s.karma ?? 0,
          }));
          formatOutput(subreddits, {
            format: options.format,
            output: options.output,
          });
        } else {
          // Table format - show user overview
          const data = result as any;
          console.log(chalk.bold(`\n  User: u/${username}`));
          console.log('');

          if (data.accountAge) {
            console.log(`  ${chalk.cyan('Account age')}: ${data.accountAge}`);
          }
          if (data.karma) {
            console.log(`  ${chalk.cyan('Link karma')}: ${data.karma.link ?? 0}`);
            console.log(`  ${chalk.cyan('Comment karma')}: ${data.karma.comment ?? 0}`);
          }

          // Show top subreddits
          const subs = data.top_subreddits ?? data.topSubreddits ?? [];
          if (Array.isArray(subs) && subs.length > 0) {
            console.log(chalk.bold(`\n  Top Subreddits:`));
            for (const s of subs.slice(0, topSubredditsLimit)) {
              console.log(`    r/${s.subreddit ?? s.name ?? 'unknown'}: ${s.post_count ?? s.posts ?? 0} posts, ${s.comment_count ?? s.comments ?? 0} comments`);
            }
          }

          // Show recent activity
          const posts = data.recentPosts ?? data.posts ?? [];
          if (Array.isArray(posts) && posts.length > 0) {
            console.log(chalk.bold(`\n  Recent Posts:`));
            for (const p of posts.slice(0, 5)) {
              console.log(`    ${p.score ?? 0} pts | ${String(p.title ?? '').slice(0, 60)}`);
            }
          }

          console.log('');
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    });
}
