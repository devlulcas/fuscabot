export class UpstreamTimeoutError extends Error {
  constructor(readonly outcomeUnknown: boolean) {
    super("Upstream request timed out");
    this.name = "UpstreamTimeoutError";
  }
}

export class UpstreamResponseTooLargeError extends Error {
  constructor() {
    super("Upstream response exceeded the configured limit");
    this.name = "UpstreamResponseTooLargeError";
  }
}

export async function fetchWithTimeout(
  request: typeof fetch,
  input: string | URL | Request,
  init: RequestInit,
  timeoutMs: number,
  outcomeUnknown = false,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await Promise.race([
      request(input, { ...init, signal: controller.signal }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new UpstreamTimeoutError(outcomeUnknown)), timeoutMs)
      ),
    ]);
  } catch (cause) {
    if (cause instanceof UpstreamTimeoutError) throw cause;
    if (
      controller.signal.aborted || (cause instanceof DOMException && cause.name === "AbortError")
    ) {
      throw new UpstreamTimeoutError(outcomeUnknown);
    }
    throw cause;
  } finally {
    clearTimeout(timeout);
  }
}

export async function readBoundedJson(
  response: Response,
  maxBytes = 256 * 1024,
): Promise<unknown> {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new UpstreamResponseTooLargeError();
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (size === 0) return null;
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
