import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface CookieMeta {
  value: string;
  expires: number;
  domain: string;
}

export interface RedditConfig {
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
  cookies?: Record<string, string>;
  cookieMeta?: Record<string, CookieMeta>;
}

const CONFIG_DIR = join(homedir(), '.config', 'reddit-cli');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function loadConfig(): RedditConfig {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

export function saveConfig(config: RedditConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
}

export function clearConfig(): boolean {
  try {
    if (existsSync(CONFIG_FILE)) {
      unlinkSync(CONFIG_FILE);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function getAuthTier(config: RedditConfig): 'anonymous' | 'app-only' | 'authenticated' | 'browser' {
  if (config.cookies && Object.keys(config.cookies).length > 0) {
    return 'browser';
  }
  if (config.clientId && config.clientSecret && config.username && config.password) {
    return 'authenticated';
  }
  if (config.clientId && config.clientSecret) {
    return 'app-only';
  }
  return 'anonymous';
}

export function getRateLimit(tier: 'anonymous' | 'app-only' | 'authenticated' | 'browser'): number {
  switch (tier) {
    case 'authenticated':
    case 'browser':
      return 100;
    case 'app-only':
      return 60;
    case 'anonymous':
      return 10;
  }
}

export function getConfigEnvVars(config: RedditConfig): Record<string, string> {
  const env: Record<string, string> = {};
  if (config.clientId) env.REDDIT_CLIENT_ID = config.clientId;
  if (config.clientSecret) env.REDDIT_CLIENT_SECRET = config.clientSecret;
  if (config.username) env.REDDIT_USERNAME = config.username;
  if (config.password) env.REDDIT_PASSWORD = config.password;
  return env;
}
