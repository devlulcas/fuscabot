import type { Context } from "@hono/hono";
import { ZodError } from "zod";

export function error(
  c: Context,
  status: 400 | 404 | 409 | 500,
  code: string,
  message: string,
  details?: unknown,
) {
  return c.json(
    { error: { code, message, ...(details === undefined ? {} : { details }) } },
    status,
  );
}

export function handleError(c: Context, cause: unknown) {
  if (cause instanceof ZodError) {
    return error(c, 400, "validation_error", "Request validation failed", cause.flatten());
  }
  console.error(cause);
  return error(c, 500, "internal_error", "An unexpected error occurred");
}
