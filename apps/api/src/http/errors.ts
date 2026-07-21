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
import { BulkResourceNotFoundError } from "../services/resource_service.ts";
import { TagNotFoundError } from "../services/tag_coordinator.ts";
import { MalformedJsonError, PayloadTooLargeError } from "./json_body.ts";
import { RateLimitExceededError } from "./rate_limit.ts";
import { DiscordApiError } from "../integrations/discord_client.ts";
import { MistralClientError } from "../integrations/mistral_client.ts";

type ApiErrorCode = ApiError["error"]["code"];

export function error(
  c: Context,
  status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500 | 502 | 503,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
  retryable = false,
) {
  return c.json(
    {
      error: {
        code,
        message,
        retryable,
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
  if (cause instanceof PayloadTooLargeError) {
    return error(c, 413, "PAYLOAD_TOO_LARGE", "Request body is too large");
  }
  if (cause instanceof MalformedJsonError) {
    return error(c, 400, "VALIDATION_ERROR", "Request body must be valid JSON");
  }
  if (cause instanceof RateLimitExceededError) {
    c.header("retry-after", String(cause.retryAfterSeconds));
    return error(c, 429, "RATE_LIMITED", "Too many requests");
  }
  if (cause instanceof AuthError) {
    return error(c, cause.status, cause.code, cause.message, undefined, cause.status === 502);
  }
  if (cause instanceof DiscordApiError) {
    return error(
      c,
      cause.status === 429 ? 503 : 502,
      "DEPENDENCY_ERROR",
      cause.outcome === "unknown"
        ? "Discord delivery outcome is unknown"
        : "Discord is temporarily unavailable",
      undefined,
      cause.outcome === "not_sent" || (cause.status >= 500 && cause.outcome !== "unknown"),
    );
  }
  if (cause instanceof MistralClientError) {
    return error(
      c,
      cause.retryable ? 503 : 502,
      "DEPENDENCY_ERROR",
      "AI enrichment is temporarily unavailable",
      undefined,
      cause.retryable,
    );
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
  if (cause instanceof BulkResourceNotFoundError) {
    return error(c, 404, "NOT_FOUND", cause.message);
  }
  if (cause instanceof TagNotFoundError) {
    return error(c, 404, "NOT_FOUND", "Tag not found");
  }
  console.error(JSON.stringify({
    event: "request_error",
    type: cause instanceof Error ? cause.name : "UnknownError",
  }));
  return error(c, 500, "INTERNAL_ERROR", "An unexpected error occurred");
}
