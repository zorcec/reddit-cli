import { mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

const CACHE_DIR = join(homedir(), '.cache', 'reddit-cli');
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

function ensureCacheDir(): void {
  mkdirSync(CACHE_DIR, { recursive: true });
}

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

export interface CacheEntry<T = unknown> {
  data: T;
  ts: number;
  ttl: number;
}

export function cacheGet<T = unknown>(namespace: string, key: string, ttlMs: number = DEFAULT_TTL_MS): T | null {
  ensureCacheDir();
  const fileName = `${namespace}-${hashKey(key)}.json`;
  const filePath = join(CACHE_DIR, fileName);

  try {
    const raw = readFileSync(filePath, 'utf-8');
    const entry: CacheEntry<T> = JSON.parse(raw);
    const effectiveTtl = entry.ttl ?? ttlMs;
    if (Date.now() - entry.ts > effectiveTtl) {
      unlinkSync(filePath);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function cacheSet<T = unknown>(namespace: string, key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  ensureCacheDir();
  const fileName = `${namespace}-${hashKey(key)}.json`;
  const filePath = join(CACHE_DIR, fileName);
  const entry: CacheEntry<T> = { data, ts: Date.now(), ttl: ttlMs };
  writeFileSync(filePath, JSON.stringify(entry));
}

export function cacheClear(): number {
  ensureCacheDir();
  const files = readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
  for (const f of files) {
    unlinkSync(join(CACHE_DIR, f));
  }
  return files.length;
}

export function cacheStats(): { files: number; totalSizeBytes: number } {
  ensureCacheDir();
  const files = readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
  let totalSize = 0;
  for (const f of files) {
    totalSize += statSync(join(CACHE_DIR, f)).size;
  }
  return { files: files.length, totalSizeBytes: totalSize };
}
