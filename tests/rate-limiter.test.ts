import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../src/rate-limiter.js';

describe('RateLimiter', () => {
  describe('acquire', () => {
    it('allows requests within limit', () => {
      const limiter = new RateLimiter(5, 60_000);

      const result1 = limiter.acquire();
      expect(result1.allowed).toBe(true);
      expect(result1.waitMs).toBe(0);

      const result2 = limiter.acquire();
      expect(result2.allowed).toBe(true);
      expect(result2.waitMs).toBe(0);
    });

    it('blocks requests over limit', () => {
      const limiter = new RateLimiter(2, 60_000);

      limiter.acquire();
      limiter.acquire();

      const result = limiter.acquire();
      expect(result.allowed).toBe(false);
      expect(result.waitMs).toBeGreaterThan(0);
    });

    it('prunes old timestamps', () => {
      const limiter = new RateLimiter(2, 1); // 1ms window

      limiter.acquire();
      limiter.acquire();

      // Wait for window to expire
      const start = Date.now();
      while (Date.now() - start < 5) {
        // Busy wait
      }

      const result = limiter.acquire();
      expect(result.allowed).toBe(true);
    });
  });

  describe('remaining', () => {
    it('returns correct remaining count', () => {
      const limiter = new RateLimiter(3, 60_000);

      expect(limiter.remaining).toBe(3);

      limiter.acquire();
      expect(limiter.remaining).toBe(2);

      limiter.acquire();
      expect(limiter.remaining).toBe(1);

      limiter.acquire();
      expect(limiter.remaining).toBe(0);
    });
  });

  describe('waitMs', () => {
    it('returns 0 when under limit', () => {
      const limiter = new RateLimiter(5, 60_000);
      expect(limiter.waitMs).toBe(0);
    });

    it('returns positive when at limit', () => {
      const limiter = new RateLimiter(1, 60_000);
      limiter.acquire();
      expect(limiter.waitMs).toBeGreaterThan(0);
    });
  });

  describe('waitAndAcquire', () => {
    it('waits and acquires when rate limited', async () => {
      const limiter = new RateLimiter(2, 100); // 100ms window

      limiter.acquire();
      limiter.acquire();

      const start = Date.now();
      await limiter.waitAndAcquire();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(50); // Should have waited
    });

    it('calls onWait callback', async () => {
      const limiter = new RateLimiter(1, 100);
      limiter.acquire();

      let waitMs = 0;
      await limiter.waitAndAcquire((ms) => {
        waitMs = ms;
      });

      expect(waitMs).toBeGreaterThan(0);
    });
  });
});
