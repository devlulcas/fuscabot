import { assertEquals, assertRejects } from "@std/assert";
import { ApiError, apiRequest } from "./api.ts";
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
  apiBaseUrl: DEFAULT_API_BASE_URL,
  theme: "dark",
  accessToken: "old-access",
  refreshToken: "old-refresh",
  sessionId: "019432f0-7c00-7000-8000-000000000001",
};

Deno.test("parallel 401 responses share one rotating refresh", async () => {
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
      apiRequest<{ data: string }>("/v1/test"),
      apiRequest<{ data: string }>("/v1/test"),
    ]);
    assertEquals(responses, [{ data: "ok" }, { data: "ok" }]);
    assertEquals(refreshes, 1);
    assertEquals(state.stored.refreshToken, "new-refresh");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("failed refresh clears all session credentials", async () => {
  const state = installChrome(session);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input) =>
    Promise.resolve(
      String(input).endsWith("/v1/auth/refresh")
        ? Response.json({ error: {} }, { status: 401 })
        : Response.json({ error: {} }, { status: 401 }),
    );
  try {
    await assertRejects(() => apiRequest("/v1/test"), ApiError);
    assertEquals(state.stored.accessToken, undefined);
    assertEquals(state.stored.refreshToken, undefined);
    assertEquals(state.stored.sessionId, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("network failure during refresh preserves session credentials", async () => {
  const state = installChrome(session);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input) => {
    if (String(input).endsWith("/v1/auth/refresh")) {
      return Promise.reject(new TypeError("offline"));
    }
    return Promise.resolve(Response.json({ error: {} }, { status: 401 }));
  };
  try {
    await assertRejects(() => apiRequest("/v1/test"), ApiError);
    assertEquals(state.stored.accessToken, "old-access");
    assertEquals(state.stored.refreshToken, "old-refresh");
    assertEquals(
      state.stored.sessionId,
      "019432f0-7c00-7000-8000-000000000001",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
