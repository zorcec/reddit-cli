import type { Command } from 'commander';
import chalk from 'chalk';
import { getRedditTools } from '../mcp-client.js';
import { cacheGet, cacheSet } from '../cache.js';
import { formatOutput, log, debug } from '../utils/format.js';
import { validateResponse, printWarnings } from '../validate.js';
import { ExplainResponseSchema } from '../schemas.js';
import type { OutputFormat } from '../utils/format.js';

const CACHE_TTL_MS = 60 * 60 * 1000;

export function registerExplainCommand(program: Command): void {
  program
    .command('explain')
    .description('Explain Reddit slang')
    .argument('<term>', 'Reddit term or slang to explain')
    .option('-f, --format <fmt>', 'Output format: table|json|compact-json|csv|raw', 'table')
    .option('-o, --output <file>', 'Write output to file')
    .option('--no-cache', 'Skip cache, fetch fresh data')
    .option('--verbose', 'Show debug info')
    .action(async (term: string, options: {
      format: OutputFormat;
      output?: string;
      cache: boolean;
      verbose?: boolean;
    }) => {
      try {
        const tools = await getRedditTools();
        const verbose = options.verbose ?? false;

        const cacheKey = `explain|${term.toLowerCase()}`;

        if (options.cache !== false) {
          const cached = cacheGet<unknown>('explain', cacheKey, CACHE_TTL_MS);
          if (cached) {
            debug('Serving from cache', verbose);
            formatOutput(cached, { format: options.format, output: options.output }, { source: 'cache' });
            return;
          }
        }

        log(`Explaining "${term}"...`);

        const raw = await tools.redditExplain({ term });

        debug(`Raw response keys: ${Object.keys(raw as object).join(', ')}`, verbose);

        const { data, warnings } = validateResponse(ExplainResponseSchema, raw, 'explain');

        if (options.cache !== false) {
          cacheSet('explain', cacheKey, raw, CACHE_TTL_MS);
        }

        if (options.format === 'raw') {
          formatOutput(raw, { format: 'raw', output: options.output });
          printWarnings(warnings);
          return;
        }

        if (options.format === 'json' || options.format === 'compact-json') {
          formatOutput(data, { format: options.format, output: options.output });
        } else if (options.format === 'csv') {
          const examples = Array.isArray((data as any).examples) ? (data as any).examples : [];
          const related = Array.isArray((data as any).relatedTerms) ? (data as any).relatedTerms : [];
          formatOutput([{
            term,
            definition: (data as any).definition ?? '',
            examples: examples.join('; '),
            related: related.join('; '),
          }], { format: options.format, output: options.output });
        } else {
          console.log(chalk.bold(`\n  ${term}`));
          console.log('');

          if ((data as any).definition) {
            console.log(`  ${chalk.cyan('Definition')}: ${(data as any).definition}`);
          }

          if ((data as any).usage) {
            console.log(`  ${chalk.cyan('Usage')}: ${(data as any).usage}`);
          }

          if (Array.isArray((data as any).examples) && (data as any).examples.length > 0) {
            console.log(chalk.bold(`\n  Examples:`));
            for (const ex of (data as any).examples) {
              console.log(`    • ${ex}`);
            }
          }

          if (Array.isArray((data as any).relatedTerms) && (data as any).relatedTerms.length > 0) {
            console.log(chalk.bold(`\n  Related terms:`));
            console.log(`    ${(data as any).relatedTerms.join(', ')}`);
          }

          if ((data as any).origin) {
            console.log(`\n  ${chalk.cyan('Origin')}: ${(data as any).origin}`);
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
