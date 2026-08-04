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
    } catch {
      // Candidate not found — try the next one
    }
  }

  throw new Error('Chrome/Chromium not found. Install it or pass --chrome-path');
}

interface PuppeteerCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly?: boolean;
  secure?: boolean;
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
  let allCookies: PuppeteerCookie[] = [];
  while (true) {
    try {
      const cookies = await page.cookies();
      allCookies = cookies;
      const hasSession = cookies.some(c => c.name === 'reddit_session' && c.domain.includes('reddit.com'));
      if (hasSession) break;
    } catch {
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  await browser.close();

  const redditCookies = allCookies.filter(c => c.domain.includes('reddit.com'));

  if (!redditCookies.some(c => c.name === 'reddit_session')) {
    console.error(chalk.red('\n  No reddit_session cookie found.'));
    console.error(chalk.dim('  Make sure you logged in before closing.'));
    process.exit(1);
  }

  // Store cookies with expiry info
  const cookiesMap: Record<string, string> = {};
  const cookieMeta: Record<string, { value: string; expires: number; domain: string }> = {};

  for (const c of redditCookies) {
    cookiesMap[c.name] = c.value;
    cookieMeta[c.name] = {
      value: c.value,
      expires: c.expires,
      domain: c.domain,
    };
  }

  const existing = loadConfig();
  saveConfig({
    ...existing,
    cookies: cookiesMap,
    cookieMeta,
  });

  console.error(chalk.green('\n  Login successful!'));
  console.error(chalk.dim(`  ${redditCookies.length} cookies saved to ${getConfigPath()}\n`));
}

main().catch(err => {
  console.error(chalk.red(`\n  Error: ${err.message}\n`));
  process.exit(1);
});
