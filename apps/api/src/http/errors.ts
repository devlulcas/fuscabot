import type { Context } from "@hono/hono";
import type { ApiError } from "@fuscabot/contracts";
import { ZodError } from "zod";

type ApiErrorCode = ApiError["error"]["code"];

export function error(
  c: Context,
  status: 400 | 404 | 409 | 500,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
) {
  return c.json(
    {
      error: {
        code,
        message,
        retryable: false,
        ...(details === undefined ? {} : { details: { validation: details } }),
      },
    },
    status,
  );
}

export function handleError(c: Context, cause: unknown) {
  if (cause instanceof ZodError) {
    return error(c, 400, "VALIDATION_ERROR", "Request validation failed", cause.flatten());
  }
  console.error(cause);
  return error(c, 500, "INTERNAL_ERROR", "An unexpected error occurred");
}
