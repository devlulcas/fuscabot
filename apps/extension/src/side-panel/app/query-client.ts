import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../../shared/api.ts";

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
            const retryAfter = readRetryAfter(error.body);
            if (retryAfter !== undefined) return retryAfter;
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

function readRetryAfter(value: unknown): number | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const seconds = (value as { retryAfterSeconds?: unknown }).retryAfterSeconds;
  return typeof seconds === "number"
    ? Math.min(seconds * 1_000, 30_000)
    : undefined;
}
