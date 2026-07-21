export type RateLimitInput = {
  scope: string;
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export interface RateLimitStore {
  consume(input: RateLimitInput): Promise<RateLimitResult>;
}

export class RateLimitExceededError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Rate limit exceeded");
  }
}

export type RateLimitPolicy = { limit: number; windowMs: number };

export type RateLimitPolicies = {
  publicAuth: RateLimitPolicy;
  reads: RateLimitPolicy;
  captures: RateLimitPolicy;
  enrichmentRetries: RateLimitPolicy;
  deliveries: RateLimitPolicy;
  writes: RateLimitPolicy;
};

export const DEFAULT_RATE_LIMIT_POLICIES: RateLimitPolicies = {
  publicAuth: { limit: 10, windowMs: 10 * 60_000 },
  reads: { limit: 120, windowMs: 60_000 },
  captures: { limit: 30, windowMs: 60_000 },
  enrichmentRetries: { limit: 5, windowMs: 5 * 60_000 },
  deliveries: { limit: 10, windowMs: 60_000 },
  writes: { limit: 30, windowMs: 60_000 },
};

export class InMemoryRateLimitStore implements RateLimitStore {
  readonly #buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  consume(input: RateLimitInput): Promise<RateLimitResult> {
    const now = this.now();
    const start = Math.floor(now / input.windowMs) * input.windowMs;
    const resetAt = start + input.windowMs;
    const id = `${input.scope}:${input.key}:${start}`;
    const current = this.#buckets.get(id);
    const count = (current?.count ?? 0) + 1;
    this.#buckets.set(id, { count, resetAt });
    for (const [key, bucket] of this.#buckets) {
      if (bucket.resetAt <= now) this.#buckets.delete(key);
    }
    return Promise.resolve({
      allowed: count <= input.limit,
      remaining: Math.max(0, input.limit - count),
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1_000)),
    });
  }
}
