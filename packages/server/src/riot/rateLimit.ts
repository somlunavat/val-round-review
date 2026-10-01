/**
 * Token buckets for Riot's per-key limits. A request proceeds only when every
 * bucket has a token, e.g. dev keys: 20 per 1 s and 100 per 2 min.
 */
export type BucketSpec = { tokens: number; perMs: number };

type Bucket = BucketSpec & { available: number; updatedAt: number };

export type Clock = { now: () => number; sleep: (ms: number) => Promise<void> };

export const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export class RateLimiter {
  private readonly buckets: Bucket[];
  private queue: Promise<void> = Promise.resolve();

  constructor(
    specs: readonly BucketSpec[],
    private readonly clock: Clock = realClock,
  ) {
    const now = clock.now();
    this.buckets = specs.map((s) => ({ ...s, available: s.tokens, updatedAt: now }));
  }

  /** Resolves when a request may be sent. Calls are served in order. */
  take(): Promise<void> {
    const next = this.queue.then(() => this.waitForToken());
    this.queue = next.catch(() => undefined);
    return next;
  }

  private refill(now: number) {
    for (const b of this.buckets) {
      const gained = ((now - b.updatedAt) / b.perMs) * b.tokens;
      b.available = Math.min(b.tokens, b.available + gained);
      b.updatedAt = now;
    }
  }

  private async waitForToken(): Promise<void> {
    for (;;) {
      this.refill(this.clock.now());
      const waits = this.buckets.map((b) =>
        b.available >= 1 ? 0 : ((1 - b.available) / b.tokens) * b.perMs,
      );
      const wait = Math.max(...waits, 0);
      if (wait === 0) {
        for (const b of this.buckets) b.available -= 1;
        return;
      }
      await this.clock.sleep(Math.ceil(wait));
    }
  }
}

/** Parses Riot's "20:1,100:120" style limit headers/env into bucket specs. */
export function parseLimits(spec: string): BucketSpec[] {
  return spec
    .split(",")
    .map((part) => part.trim().split(":").map(Number))
    .filter((pair): pair is [number, number] => pair.length === 2 && pair.every((n) => n > 0))
    .map(([tokens, seconds]) => ({ tokens, perMs: seconds * 1000 }));
}
