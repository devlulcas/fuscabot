const ERROR_FIELDS = [
  "code",
  "status",
  "statusCode",
  "constraint",
  "detail",
  "hint",
  "table",
  "column",
] as const;

export type LogFields = Record<string, unknown>;

export function logInfo(event: string, fields: LogFields = {}): void {
  console.info(JSON.stringify({ event, ...fields }));
}

export function logWarn(event: string, fields: LogFields = {}): void {
  console.warn(JSON.stringify({ event, ...fields }));
}

export function logError(event: string, cause: unknown, fields: LogFields = {}): void {
  console.error(JSON.stringify({ event, ...fields, error: serializeError(cause) }));
}

/** Serializes useful diagnostics without dumping request bodies, headers, or provider secrets. */
export function serializeError(cause: unknown, depth = 0): Record<string, unknown> {
  if (!(cause instanceof Error)) {
    return { type: "UnknownError", message: safeValue(cause) };
  }

  const serialized: Record<string, unknown> = {
    type: cause.name || "Error",
    message: cause.message || "Unknown error",
  };
  if (cause.stack) serialized.stack = cause.stack;

  const record = cause as unknown as Record<string, unknown>;
  for (const field of ERROR_FIELDS) {
    const value = record[field];
    if (typeof value === "string" || typeof value === "number") serialized[field] = value;
  }
  if (depth < 3 && "cause" in cause && cause.cause !== undefined) {
    serialized.cause = serializeError(cause.cause, depth + 1);
  }
  return serialized;
}

function safeValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).slice(0, 500);
  }
  return Object.prototype.toString.call(value);
}
