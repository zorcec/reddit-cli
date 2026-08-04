import type { Command } from 'commander';
import chalk from 'chalk';
import { fork } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { saveConfig, loadConfig, clearConfig, getConfigPath, getAuthTier } from '../config.js';

const CRITICAL_COOKIES = ['reddit_session', 'csrf_token', 'loid', 'token_v2'];

function formatExpiry(expires: number): string {
  if (expires <= 0) return 'session';
  const date = new Date(expires * 1000);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffMs < 0) return chalk.red('expired');
  if (diffHours < 24) return chalk.yellow(`expires in ${diffHours}h`);
  return `expires in ${diffDays}d`;
}

export function registerAuthCommand(program: Command): void {
  const auth = program
    .command('auth')
    .description('Manage Reddit API authentication');

  auth
    .command('login')
    .description('Configure Reddit API credentials')
    .option('--client-id <id>', 'Reddit API client ID')
    .option('--client-secret <secret>', 'Reddit API client secret')
    .option('--username <user>', 'Reddit username')
    .option('--password <pass>', 'Reddit password')
    .action(async (options: {
      clientId?: string;
      clientSecret?: string;
      username?: string;
      password?: string;
    }) => {
      const existing = loadConfig();

      const config = {
        clientId: options.clientId ?? existing.clientId,
        clientSecret: options.clientSecret ?? existing.clientSecret,
        username: options.username ?? existing.username,
        password: options.password ?? existing.password,
      };

      if (!config.clientId) {
        const readline = await import('node:readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stderr,
        });

        const prompt = (question: string): Promise<string> => {
          return new Promise((resolve) => {
            rl.question(chalk.dim(question), (answer) => {
              resolve(answer.trim());
            });
          });
        };

        try {
          console.error(chalk.bold('\n  Reddit API Credentials Setup\n'));
          console.error(chalk.dim('  Get your credentials at: https://www.reddit.com/prefs/apps'));
          console.error(chalk.dim('  Create a "script" type application\n'));

          config.clientId = await prompt('  Client ID: ');
          config.clientSecret = await prompt('  Client Secret: ');
          config.username = await prompt('  Reddit Username (optional): ');
          config.password = await prompt('  Reddit Password (optional): ');
        } finally {
          rl.close();
        }
      }

      if (!config.clientId || !config.clientSecret) {
        console.error(chalk.red('Client ID and Client Secret are required.'));
        process.exit(1);
      }

      saveConfig(config);
      const tier = getAuthTier(config);

      console.error(chalk.green(`\n  Credentials saved to ${getConfigPath()}`));
      console.error(chalk.dim(`  Auth tier: ${tier}`));
      console.error('');
    });

  auth
    .command('browser-login')
    .description('Login via browser (opens Chrome, captures cookies)')
    .option('--chrome-path <path>', 'Path to Chrome/Chromium binary')
    .action(async () => {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const scriptPath = join(__dirname, '..', 'browser-login.js');

      if (!existsSync(scriptPath)) {
        console.error(chalk.red('\n  browser-login.js not found. Run npm run build first.'));
        process.exit(1);
      }

      const child = fork(scriptPath, process.argv.slice(3), {
        stdio: 'inherit',
      });

      child.on('exit', (code) => {
        process.exit(code ?? 0);
      });
    });

  auth
    .command('whoami')
    .description('Show current auth status with cookie details')
    .option('--verbose', 'Show all cookies including non-critical ones')
    .action(async (options: { verbose?: boolean }) => {
      const config = loadConfig();
      const tier = getAuthTier(config);

      console.error(chalk.bold('\n  Auth Status\n'));

      if (tier === 'anonymous') {
        console.error(chalk.yellow('  Not authenticated'));
        console.error(chalk.dim('  Running as anonymous (10 requests/min)'));
        console.error(chalk.dim('  Run "reddit auth login" or "reddit auth browser-login"'));
        console.error('');
        return;
      }

      console.error(chalk.green(`  Auth tier: ${tier}`));

      if (tier === 'browser') {
        const cookies = config.cookies ?? {};
        const meta = config.cookieMeta ?? {};
        const cookieCount = Object.keys(cookies).length;

        console.error(chalk.dim(`  Cookies: ${cookieCount} captured`));
        console.error('');

        // Show critical cookies
        console.error(chalk.bold('  Session cookies:'));
        for (const name of CRITICAL_COOKIES) {
          const present = !!cookies[name];
          const metaInfo = meta[name];
          const icon = present ? chalk.green('✓') : chalk.red('✗');
          const label = name.padEnd(16);

          if (present && metaInfo) {
            const expiry = formatExpiry(metaInfo.expires);
            console.error(`    ${icon} ${label} ${expiry}`);
          } else if (present) {
            console.error(`    ${icon} ${label} ${chalk.dim('present')}`);
          } else {
            console.error(`    ${icon} ${label} ${chalk.red('missing')}`);
          }
        }

        // Show extra cookies in verbose mode
        if (options.verbose) {
          const extraCookies = Object.keys(cookies).filter(n => !CRITICAL_COOKIES.includes(n));
          if (extraCookies.length > 0) {
            console.error('');
            console.error(chalk.bold('  Other cookies:'));
            for (const name of extraCookies) {
              const metaInfo = meta[name];
              if (metaInfo) {
                console.error(`    ${chalk.dim('•')} ${name.padEnd(16)} ${formatExpiry(metaInfo.expires)}`);
              } else {
                console.error(`    ${chalk.dim('•')} ${name}`);
              }
            }
          }
        }

        // Check for expiring soon
        const now = Date.now();
        const expiringSoon = Object.entries(meta).filter(([, m]) => {
          if (m.expires <= 0) return false;
          const diffMs = m.expires * 1000 - now;
          return diffMs > 0 && diffMs < 24 * 60 * 60 * 1000;
        });

        if (expiringSoon.length > 0) {
          console.error('');
          console.error(chalk.yellow(`  ⚠ ${expiringSoon.length} cookie(s) expire within 24h — consider re-login`));
        }

        // Check for expired
        const expired = Object.entries(meta).filter(([_, m]) => m.expires > 0 && m.expires * 1000 < now);
        if (expired.length > 0) {
          console.error('');
          console.error(chalk.red(`  ✗ ${expired.length} cookie(s) expired — run "reddit auth browser-login"`));
        }
      } else {
        if (config.clientId) {
          console.error(chalk.dim(`  Client ID: ${config.clientId.slice(0, 8)}...`));
        }
        if (config.username) {
          console.error(chalk.dim(`  Username: ${config.username}`));
        }
      }

      console.error('');
    });

  auth
    .command('logout')
    .description('Clear saved credentials')
    .action(() => {
      const configPath = getConfigPath();
      const success = clearConfig();

      if (success) {
        console.error(chalk.green(`  Credentials cleared from ${configPath}`));
      } else {
        console.error(chalk.yellow('  No credentials found'));
      }

      console.error('');
    });
}
