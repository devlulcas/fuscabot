import type { Context } from "@hono/hono";

export const DEFAULT_MAX_JSON_BYTES = 128 * 1_024;

export class PayloadTooLargeError extends Error {}
export class MalformedJsonError extends Error {}

export function assertDeclaredJsonSize(c: Context, maxBytes = DEFAULT_MAX_JSON_BYTES): void {
  if (!expectsJsonBody(c.req.method, c.req.header("content-type"))) return;
  const value = c.req.header("content-length");
  if (value === undefined) return;
  const length = Number(value);
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new MalformedJsonError("Invalid Content-Length");
  }
  if (length > maxBytes) throw new PayloadTooLargeError("JSON body is too large");
}

export async function readJsonBody(
  c: Context,
  options: { maxBytes?: number; emptyValue?: unknown } = {},
): Promise<unknown> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_JSON_BYTES;
  const reader = c.req.raw.body?.getReader();
  if (!reader) {
    if ("emptyValue" in options) return options.emptyValue;
    throw new MalformedJsonError("JSON body is required");
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new PayloadTooLargeError("JSON body is too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (total === 0 && "emptyValue" in options) return options.emptyValue;
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new MalformedJsonError("Malformed JSON body");
  }
}

function expectsJsonBody(method: string, contentType?: string): boolean {
  return ["POST", "PUT", "PATCH"].includes(method) &&
    (contentType === undefined || contentType.split(";", 1)[0].trim() === "application/json");
}
