import { hc } from "@hono/hono/client";
import type { AppType } from "@fuscabot/api";
import { getConfig, saveConfig } from "./config.ts";
import { DEFAULT_API_BASE_URL } from "./types.ts";

export const API_BASE_URL = DEFAULT_API_BASE_URL;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let refreshInFlight: Promise<{ accessToken: string } | null> | undefined;
let sessionInvalidated: (() => Promise<void> | void) | undefined;

export function onSessionInvalidated(
  handler: () => Promise<void> | void,
): void {
  sessionInvalidated = handler;
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const config = await getConfig();
  const headers = new Headers(
    input instanceof Request ? input.headers : undefined,
  );
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  headers.set("accept", "application/json");
  if (config.accessToken) {
    headers.set("authorization", `Bearer ${config.accessToken}`);
  }

  let response = await fetch(input, { ...init, headers });
  if (response.status === 401 && config.refreshToken && config.sessionId) {
    const refreshed = await refreshSession(config);
    if (refreshed) {
      headers.set("authorization", `Bearer ${refreshed.accessToken}`);
      response = await fetch(input, { ...init, headers });
    }
  }
  if (!response.ok) {
    const body = response.status === 204
      ? undefined
      : await response.json().catch(() => undefined);
    throw new ApiError(
      errorMessage(body) ?? `Request failed (${response.status})`,
      response.status,
      body,
      retryAfterSeconds(response),
    );
  }
  return response;
}

export const apiClient = hc<AppType>(API_BASE_URL, {
  fetch: authenticatedFetch,
});

async function refreshSession(
  config: Awaited<ReturnType<typeof getConfig>>,
): Promise<{ accessToken: string } | null> {
  if (refreshInFlight) return await refreshInFlight;
  const operation = (async (): Promise<{ accessToken: string } | null> => {
    let refresh: Response;
    try {
      refresh = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          sessionId: config.sessionId,
          refreshToken: config.refreshToken,
        }),
      });
    } catch {
      // Keep the rotating refresh token when the server may never have
      // received the request. A later request can safely try again.
      return null;
    }
    try {
      const refreshed = await refresh.json().catch(() => undefined);
      const data = isRecord(refreshed) && isRecord(refreshed.data)
        ? refreshed.data
        : undefined;
      if (
        !refresh.ok || !data || typeof data.accessToken !== "string" ||
        typeof data.refreshToken !== "string"
      ) throw new Error("Session refresh failed");
      await saveConfig({
        ...config,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      return { accessToken: data.accessToken };
    } catch {
      await saveConfig({
        ...config,
        accessToken: undefined,
        refreshToken: undefined,
        sessionId: undefined,
      });
      await sessionInvalidated?.();
      return null;
    }
  })();
  refreshInFlight = operation;
  try {
    return await operation;
  } finally {
    if (refreshInFlight === operation) refreshInFlight = undefined;
  }
}

function errorMessage(value: unknown): string | undefined {
  if (!isRecord(value) || !isRecord(value.error)) return undefined;
  return typeof value.error.message === "string"
    ? value.error.message
    : undefined;
}

function retryAfterSeconds(response: Response): number | undefined {
  const value = Number(response.headers.get("retry-after"));
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
