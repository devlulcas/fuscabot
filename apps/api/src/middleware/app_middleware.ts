import type { MiddlewareHandler } from "@hono/hono";
import type { AppDependencies, AppEnv } from "../app_types.ts";
import { error, handleError } from "../http/errors.ts";
import { assertDeclaredJsonSize, DEFAULT_MAX_JSON_BYTES } from "../http/json_body.ts";
import {
  DEFAULT_RATE_LIMIT_POLICIES,
  RateLimitExceededError,
  type RateLimitPolicies,
  type RateLimitPolicy,
  type RateLimitStore,
} from "../http/rate_limit.ts";
import { logInfo } from "../observability/log.ts";

export function requestLifecycle(deps: AppDependencies): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const requestId = crypto.randomUUID();
    c.set("requestId", requestId);
    const startedAt = performance.now();
    const origin = c.req.header("origin");
    const allowed = origin && deps.allowedOrigins?.includes(origin);
    let response: Response;
    try {
      assertDeclaredJsonSize(c, deps.maxJsonBytes ?? DEFAULT_MAX_JSON_BYTES);
      if (c.req.method !== "OPTIONS" && deps.rateLimits && isPublicAuthPath(c.req.path)) {
        await consumeRateLimit(
          deps.rateLimits,
          "public-auth",
          "anonymous",
          deps.rateLimitPolicies?.publicAuth ?? DEFAULT_RATE_LIMIT_POLICIES.publicAuth,
        );
      }
      if (c.req.method === "OPTIONS") {
        response = new Response(null, { status: 204 });
      } else {
        await next();
        response = c.res;
      }
    } catch (cause) {
      response = handleError(c, cause);
    }
    secureResponse(response, requestId, c.req.path);
    logInfo("request_complete", {
      requestId,
      method: c.req.method,
      path: c.req.path,
      status: response.status,
      durationMs: Math.round(performance.now() - startedAt),
    });
    if (allowed) {
      for (const [name, value] of corsHeaders(origin)) response.headers.set(name, value);
    }
    return response;
  };
}

export function authenticate(deps: AppDependencies): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (isPublicAuthPath(c.req.path)) return next();
    if (!deps.auth) {
      return deps.requireAuth
        ? error(c, 503, "DEPENDENCY_ERROR", "Authentication is not configured")
        : next();
    }
    const authorization = c.req.header("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return error(c, 401, "UNAUTHORIZED", "A valid session is required");
    }
    c.set("session", await deps.auth.verifySession(authorization.slice(7)));
    await next();
  };
}

export function authenticatedRateLimit(deps: AppDependencies): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (c.req.method === "OPTIONS" || isPublicAuthPath(c.req.path) || !deps.rateLimits) {
      return next();
    }
    const session = c.get("session");
    if (!session) return next();
    const selected = authenticatedRatePolicy(c.req.method, c.req.path, deps.rateLimitPolicies);
    await consumeRateLimit(
      deps.rateLimits,
      selected.scope,
      `${session.sid}:${selected.resourceKey}`,
      selected.policy,
    );
    await next();
  };
}

function corsHeaders(origin: string): Headers {
  return new Headers({
    "access-control-allow-origin": origin,
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    vary: "Origin",
  });
}

function secureResponse(response: Response, requestId: string, path: string): void {
  response.headers.set("x-request-id", requestId);
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("referrer-policy", "no-referrer");
  if (path.startsWith("/v1/")) response.headers.set("cache-control", "no-store");
}

async function consumeRateLimit(
  store: RateLimitStore,
  scope: string,
  key: string,
  policy: RateLimitPolicy,
): Promise<void> {
  const result = await store.consume({ scope, key, ...policy });
  if (!result.allowed) throw new RateLimitExceededError(result.retryAfterSeconds);
}

function isPublicAuthPath(path: string): boolean {
  return path === "/v1/auth/discord/start" || path === "/v1/auth/discord/callback" ||
    path === "/v1/auth/refresh";
}

function authenticatedRatePolicy(
  method: string,
  path: string,
  overrides: Partial<RateLimitPolicies> | undefined,
): { scope: string; resourceKey: string; policy: RateLimitPolicy } {
  const policies = { ...DEFAULT_RATE_LIMIT_POLICIES, ...overrides };
  if (method === "GET") return { scope: "reads", resourceKey: "all", policy: policies.reads };
  if (path === "/v1/resources/captures") {
    return { scope: "captures", resourceKey: "all", policy: policies.captures };
  }
  if (path.endsWith("/enrichment/retry")) {
    return { scope: "enrichment-retries", resourceKey: path, policy: policies.enrichmentRetries };
  }
  if (path.includes("/deliveries")) {
    return { scope: "deliveries", resourceKey: path, policy: policies.deliveries };
  }
  return { scope: "writes", resourceKey: "all", policy: policies.writes };
}
