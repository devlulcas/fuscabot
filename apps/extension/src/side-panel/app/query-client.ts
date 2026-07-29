import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../../shared/hono-client.ts";

const DAY = 24 * 60 * 60 * 1_000;

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: DAY,
        refetchOnWindowFocus: true,
        retry: (count, error) => count < 2 && isRetryableRead(error),
        retryDelay: (attempt, error) => {
          if (error instanceof ApiError && error.status === 429) {
            if (error.retryAfterSeconds !== undefined) {
              return Math.min(error.retryAfterSeconds * 1_000, 30_000);
            }
          }
          return Math.min(500 * 2 ** attempt, 4_000);
        },
      },
      mutations: { retry: false },
    },
  });
}

export function isRetryableRead(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  return error.status === 408 || error.status === 429 || error.status >= 500;
}
