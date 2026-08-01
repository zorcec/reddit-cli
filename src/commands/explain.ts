import { Command } from 'commander';
import chalk from 'chalk';
import { getRedditTools } from '../mcp-client.js';
import { cacheGet, cacheSet } from '../cache.js';
import { formatOutput, info } from '../utils/format.js';
import type { OutputFormat } from '../utils/format.js';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour for explanations

export function registerExplainCommand(program: Command): void {
  program
    .command('explain')
    .description('Explain Reddit slang')
    .argument('<term>', 'Reddit term or slang to explain')
    .option('-f, --format <fmt>', 'Output format: table|json|csv', 'table')
    .option('-o, --output <file>', 'Write output to file')
    .option('--no-cache', 'Skip cache, fetch fresh data')
    .action(async (term: string, options: {
      format: OutputFormat;
      output?: string;
      cache: boolean;
    }) => {
      try {
        const tools = await getRedditTools();

        // Build cache key
        const cacheKey = `explain|${term.toLowerCase()}`;

        // Check cache
        if (options.cache !== false) {
          const cached = cacheGet<unknown>('explain', cacheKey, CACHE_TTL_MS);
          if (cached) {
            formatOutput(cached, {
              format: options.format,
              output: options.output,
            }, { source: 'cache' });
            return;
          }
        }

        info(`Explaining "${term}"...`);

        const result = await tools.redditExplain({ term });

        // Cache result
        if (options.cache !== false) {
          cacheSet('explain', cacheKey, result, CACHE_TTL_MS);
        }

        if (options.format === 'json') {
          formatOutput(result, {
            format: options.format,
            output: options.output,
          });
        } else if (options.format === 'csv') {
          const data = result as Record<string, unknown>;
          const examples = Array.isArray(data.examples) ? data.examples : [];
          const related = Array.isArray(data.relatedTerms) ? data.relatedTerms : [];
          formatOutput([{
            term,
            definition: data.definition ?? '',
            examples: examples.join('; '),
            related: related.join('; '),
          }], {
            format: options.format,
            output: options.output,
          });
        } else {
          // Table format
          const data = result as Record<string, unknown>;
          console.log(chalk.bold(`\n  ${term}`));
          console.log('');

          if (data.definition) {
            console.log(`  ${chalk.cyan('Definition')}: ${data.definition}`);
          }

          if (data.usage) {
            console.log(`  ${chalk.cyan('Usage')}: ${data.usage}`);
          }

          if (Array.isArray(data.examples) && data.examples.length > 0) {
            console.log(chalk.bold(`\n  Examples:`));
            for (const ex of data.examples) {
              console.log(`    • ${ex}`);
            }
          }

          if (Array.isArray(data.relatedTerms) && data.relatedTerms.length > 0) {
            console.log(chalk.bold(`\n  Related terms:`));
            console.log(`    ${data.relatedTerms.join(', ')}`);
          }

          if (data.origin) {
            console.log(`\n  ${chalk.cyan('Origin')}: ${data.origin}`);
          }

          console.log('');
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    });
}
