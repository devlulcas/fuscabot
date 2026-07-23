import { lt, sql } from "drizzle-orm";
import type { AppDatabase } from "../db/client.ts";
import { rateLimitBuckets } from "../db/schema.ts";
import type { RateLimitInput, RateLimitStore } from "../http/rate_limit.ts";

export class DrizzleRateLimitStore implements RateLimitStore {
  constructor(
    private readonly database: AppDatabase,
    private readonly now: () => number = Date.now,
  ) {}

  async consume(input: RateLimitInput) {
    const now = this.now();
    const windowStart = new Date(Math.floor(now / input.windowMs) * input.windowMs);
    const expiresAt = new Date(windowStart.getTime() + input.windowMs);
    const keyHash = await sha256(input.key);
    const count = await this.database.transaction(async (transaction) => {
      await transaction.delete(rateLimitBuckets).where(
        lt(rateLimitBuckets.expiresAt, new Date(now)),
      );
      const rows = await transaction.insert(rateLimitBuckets).values({
        scope: input.scope,
        keyHash,
        windowStart,
        count: 1,
        expiresAt,
      }).onConflictDoUpdate({
        target: [
          rateLimitBuckets.scope,
          rateLimitBuckets.keyHash,
          rateLimitBuckets.windowStart,
        ],
        set: {
          // Atomic increments require a column expression in an upsert assignment.
          count: sql`${rateLimitBuckets.count} + 1`,
          expiresAt,
        },
      }).returning({ count: rateLimitBuckets.count });
      return rows[0].count;
    });
    return {
      allowed: count <= input.limit,
      remaining: Math.max(0, input.limit - count),
      retryAfterSeconds: Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1_000)),
    };
  }
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
