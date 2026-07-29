import { expect, it } from "vitest";
import { ApiError, authenticatedFetch } from "./hono-client.ts";
import { DEFAULT_API_BASE_URL } from "./types.ts";

type Stored = Record<string, unknown>;

function installChrome(config: Stored): { stored: Stored } {
  const state = { stored: config };
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: {
      storage: {
        local: {
          get: () => Promise.resolve({ extensionConfig: state.stored }),
          set: (items: { extensionConfig: Stored }) => {
            state.stored = items.extensionConfig;
            return Promise.resolve();
          },
        },
      },
    },
  });
  return state;
}

const session = {
  theme: "dark",
  accessToken: "old-access",
  refreshToken: "old-refresh",
  sessionId: "019432f0-7c00-7000-8000-000000000001",
};

it("parallel 401 responses share one rotating refresh", async () => {
  const state = installChrome(session);
  let refreshes = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = String(input);
    if (url.endsWith("/v1/auth/refresh")) {
      refreshes++;
      return Promise.resolve(Response.json({
        data: { accessToken: "new-access", refreshToken: "new-refresh" },
      }));
    }
    const authorization = new Headers(init?.headers).get("authorization");
    return Promise.resolve(
      authorization === "Bearer new-access"
        ? Response.json({ data: "ok" })
        : Response.json({ error: {} }, { status: 401 }),
    );
  };
  try {
    const responses = await Promise.all([
      authenticatedFetch(`${DEFAULT_API_BASE_URL}/v1/test`),
      authenticatedFetch(`${DEFAULT_API_BASE_URL}/v1/test`),
    ]);
    expect(await Promise.all(responses.map((response) => response.json())))
      .toEqual([{ data: "ok" }, { data: "ok" }]);
    expect(refreshes).toBe(1);
    expect(state.stored.refreshToken).toBe("new-refresh");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

it("failed refresh clears all session credentials", async () => {
  const state = installChrome(session);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input) =>
    Promise.resolve(
      String(input).endsWith("/v1/auth/refresh")
        ? Response.json({ error: {} }, { status: 401 })
        : Response.json({ error: {} }, { status: 401 }),
    );
  try {
    await expect(
      authenticatedFetch(`${DEFAULT_API_BASE_URL}/v1/test`),
    ).rejects.toBeInstanceOf(ApiError);
    expect(state.stored.accessToken).toBeUndefined();
    expect(state.stored.refreshToken).toBeUndefined();
    expect(state.stored.sessionId).toBeUndefined();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

it("network failure during refresh preserves session credentials", async () => {
  const state = installChrome(session);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input) => {
    if (String(input).endsWith("/v1/auth/refresh")) {
      return Promise.reject(new TypeError("offline"));
    }
    return Promise.resolve(Response.json({ error: {} }, { status: 401 }));
  };
  try {
    await expect(
      authenticatedFetch(`${DEFAULT_API_BASE_URL}/v1/test`),
    ).rejects.toBeInstanceOf(ApiError);
    expect(state.stored.accessToken).toBe("old-access");
    expect(state.stored.refreshToken).toBe("old-refresh");
    expect(state.stored.sessionId).toBe("019432f0-7c00-7000-8000-000000000001");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

it("preserves Hono request headers and cancellation without cookies", async () => {
  installChrome(session);
  const originalFetch = globalThis.fetch;
  let requestInit: RequestInit | undefined;
  globalThis.fetch = (_input, init) => {
    requestInit = init;
    return Promise.resolve(Response.json({ data: "ok" }));
  };
  try {
    const controller = new AbortController();
    await authenticatedFetch(`${DEFAULT_API_BASE_URL}/v1/test`, {
      method: "POST",
      headers: { "x-request-id": "request-1" },
      body: "{}",
      signal: controller.signal,
    });
    const headers = new Headers(requestInit?.headers);
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("authorization")).toBe("Bearer old-access");
    expect(headers.get("x-request-id")).toBe("request-1");
    expect(requestInit?.signal).toBe(controller.signal);
    expect(requestInit?.credentials).toBeUndefined();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

it("preserves the server retry-after hint on API errors", async () => {
  installChrome({ theme: "botanical" });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.resolve(
      Response.json(
        { error: { message: "Too many requests" } },
        { status: 429, headers: { "retry-after": "7" } },
      ),
    );
  try {
    await expect(
      authenticatedFetch(`${DEFAULT_API_BASE_URL}/v1/test`),
    ).rejects.toMatchObject({ status: 429, retryAfterSeconds: 7 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
