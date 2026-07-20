import type { Context } from "@hono/hono";
import type { ApiError } from "@fuscabot/contracts";
import { ZodError } from "zod";
import { AuthError } from "../services/auth_service.ts";
import { ChannelNotFoundError, InvalidReadLaterChannelError } from "../domain/discord_setup.ts";
import {
  DeliveryConflictError,
  DeliveryNotRetryableError,
  DeliveryTargetNotAllowedError,
} from "../domain/durable_delivery.ts";

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
  if (cause instanceof ChannelNotFoundError) {
    return error(c, 404, "NOT_FOUND", "Channel not found");
  }
  if (cause instanceof InvalidReadLaterChannelError) {
    return error(c, 400, "BAD_REQUEST", cause.message);
  }
  if (cause instanceof DeliveryConflictError || cause instanceof DeliveryNotRetryableError) {
    return error(c, 409, "CONFLICT", "Delivery is already active or cannot be retried");
  }
  if (cause instanceof DeliveryTargetNotAllowedError) {
    return error(c, 403, "FORBIDDEN", "Discord destination is not available");
  }
  console.error(JSON.stringify({
    event: "request_error",
    type: cause instanceof Error ? cause.name : "UnknownError",
  }));
  return error(c, 500, "INTERNAL_ERROR", "An unexpected error occurred");
}
