export class RateLimiter {
  private timestamps: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number = 60_000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  private prune(): void {
    const cutoff = Date.now() - this.windowMs;
    this.timestamps = this.timestamps.filter(t => t > cutoff);
  }

  get remaining(): number {
    this.prune();
    return Math.max(0, this.maxRequests - this.timestamps.length);
  }

  get waitMs(): number {
    this.prune();
    if (this.timestamps.length < this.maxRequests) return 0;
    const oldest = this.timestamps[0];
    return Math.max(0, oldest + this.windowMs - Date.now());
  }

  acquire(): { allowed: boolean; waitMs: number } {
    this.prune();
    if (this.timestamps.length >= this.maxRequests) {
      const wait = this.timestamps[0] + this.windowMs - Date.now();
      return { allowed: false, waitMs: Math.max(0, wait) };
    }
    this.timestamps.push(Date.now());
    return { allowed: true, waitMs: 0 };
  }

  async waitAndAcquire(onWait?: (ms: number) => void): Promise<void> {
    while (true) {
      const { allowed, waitMs } = this.acquire();
      if (allowed) return;
      if (onWait) onWait(waitMs);
      await new Promise(r => setTimeout(r, Math.min(waitMs, 1000)));
    }
  }
}
