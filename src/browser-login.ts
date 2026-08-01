#!/usr/bin/env node

import puppeteer from 'puppeteer-core';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import chalk from 'chalk';
import { saveConfig, loadConfig, getConfigPath } from './config.js';

function findChrome(): string {
  const candidates = [
    'google-chrome-stable',
    'google-chrome',
    'chromium',
    'chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];

  for (const candidate of candidates) {
    try {
      const resolved = execSync(`readlink -f $(which ${candidate} 2>/dev/null) 2>/dev/null`, { encoding: 'utf-8' }).trim();
      if (resolved && existsSync(resolved)) return resolved;
    } catch {}
  }

  throw new Error('Chrome/Chromium not found. Install it or pass --chrome-path');
}

async function main() {
  const chromePath = process.argv.includes('--chrome-path')
    ? process.argv[process.argv.indexOf('--chrome-path') + 1]
    : findChrome();

  const userDataDir = join(homedir(), '.config', 'reddit-cli', 'chrome-profile');
  mkdirSync(userDataDir, { recursive: true });

  console.error(chalk.bold('\n  Browser Login\n'));
  console.error(chalk.dim('  Opening Chrome...'));
  console.error(chalk.dim('  Log in to Reddit — this will close automatically once logged in.\n'));

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: false,
    defaultViewport: null,
    userDataDir,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1200,800',
    ],
  });

  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    delete (navigator as any).webdriver;
  });

  await page.goto('https://www.reddit.com/login', { waitUntil: 'domcontentloaded' });

  console.error(chalk.dim('  Waiting for login...'));

  // Poll until reddit_session cookie appears
  let redditCookies: Record<string, string> = {};
  while (true) {
    try {
      const cookies = await page.cookies();
      redditCookies = {};
      for (const cookie of cookies) {
        if (cookie.domain.includes('reddit.com')) {
          redditCookies[cookie.name] = cookie.value;
        }
      }
      if (redditCookies['reddit_session']) break;
    } catch {
      // browser closed by user before login
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  await browser.close();

  if (!redditCookies['reddit_session']) {
    console.error(chalk.red('\n  No reddit_session cookie found.'));
    console.error(chalk.dim('  Make sure you logged in before closing.'));
    process.exit(1);
  }

  const existing = loadConfig();
  saveConfig({ ...existing, cookies: redditCookies });

  console.error(chalk.green('\n  Login successful!'));
  console.error(chalk.dim(`  ${Object.keys(redditCookies).length} cookies saved to ${getConfigPath()}\n`));
}

main().catch(err => {
  console.error(chalk.red(`\n  Error: ${err.message}\n`));
  process.exit(1);
});
