import type { Context } from "@hono/hono";
import type { ApiError } from "@fuscabot/contracts";
import { ZodError } from "zod";
import { AuthError } from "../services/auth_service.ts";

type ApiErrorCode = ApiError["error"]["code"];

export function error(
  c: Context,
  status: 400 | 401 | 403 | 404 | 409 | 429 | 500 | 502 | 503,
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
  if (cause instanceof AuthError) {
    return error(c, cause.status, cause.code, cause.message);
  }
  console.error(cause);
  return error(c, 500, "INTERNAL_ERROR", "An unexpected error occurred");
}
