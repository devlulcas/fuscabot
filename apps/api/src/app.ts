import { type Context, Hono } from "@hono/hono";
import { z } from "zod";
import type { DiscordClient } from "./integrations/discord_client.ts";
import { BulkResourceActionSchema } from "@fuscabot/contracts";
import { CaptureSchema, ResourcePatchSchema } from "./domain/resource.ts";
import { error, handleError } from "./http/errors.ts";
import { assertDeclaredJsonSize, DEFAULT_MAX_JSON_BYTES, readJsonBody } from "./http/json_body.ts";
import {
  DEFAULT_RATE_LIMIT_POLICIES,
  RateLimitExceededError,
  type RateLimitPolicies,
  type RateLimitPolicy,
  type RateLimitStore,
} from "./http/rate_limit.ts";
import { InMemoryResourceRepository } from "./repositories/resource_repository.ts";
import type { AuthService, SessionClaims } from "./services/auth_service.ts";
import { ResourceService } from "./services/resource_service.ts";

export type ChannelRecord = {
  id: string;
  discordChannelId: string;
  name: string;
  parentName: string | null;
  discordTopic: string | null;
  routingDescription: string | null;
  isActiveForRouting: boolean;
  isReadLater: boolean;
  availability: "available" | "unavailable";
  lastSyncedAt: string | null;
};

export interface ChannelCoordinator {
  selectGuild(ownerId: string, guildId: string): Promise<ChannelRecord[]>;
  sync(ownerId: string, guildId?: string): Promise<ChannelRecord[]>;
  list(ownerId: string): Promise<ChannelRecord[]>;
  update(
    ownerId: string,
    channelId: string,
    patch: {
      routingDescription?: string | null;
      isActiveForRouting?: boolean;
      isReadLater?: boolean;
    },
  ): Promise<ChannelRecord | null>;
}

export interface DeliveryCoordinator {
  publish(
    ownerId: string,
    resourceId: string,
    input: { channelId?: string; kind: "share" | "read_later" },
  ): Promise<unknown>;
  list(ownerId: string, resourceId: string): Promise<unknown[]>;
  retry(ownerId: string, deliveryId: string): Promise<unknown>;
}

export interface EnrichmentCoordinator {
  prepare(ownerId: string, resourceId: string): Promise<void>;
  retry(ownerId: string, resourceId: string): Promise<unknown>;
  get(ownerId: string, resourceId: string): Promise<unknown>;
}

export interface TagCoordinator {
  list(ownerId: string, search?: string): Promise<unknown[]>;
  create(
    ownerId: string,
    input: { slug: string; english: string; portuguese: string; aliases: string[] },
  ): Promise<unknown>;
  merge(ownerId: string, sourceId: string, targetId: string): Promise<unknown>;
  update(
    ownerId: string,
    id: string,
    input: { slug: string; english: string; portuguese: string; aliases: string[] },
  ): Promise<unknown>;
}

export type AppDependencies = {
  resources: ResourceService;
  auth?: AuthService;
  discord?: DiscordClient;
  channels?: ChannelCoordinator;
  deliveries?: DeliveryCoordinator;
  enrichment?: EnrichmentCoordinator;
  tags?: TagCoordinator;
  allowedOrigins?: string[];
  requireAuth?: boolean;
  maxJsonBytes?: number;
  rateLimits?: RateLimitStore;
  rateLimitPolicies?: Partial<RateLimitPolicies>;
};

export function createApp(
  deps: AppDependencies = { resources: new ResourceService(new InMemoryResourceRepository()) },
) {
  const app = new Hono<{ Variables: { session: SessionClaims; requestId: string } }>();
  app.onError((cause, c) => handleError(c, cause));
  app.notFound((c) => error(c, 404, "NOT_FOUND", "Route not found"));
  app.use("*", async (c, next) => {
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
    console.info(JSON.stringify({
      event: "request_complete",
      requestId,
      method: c.req.method,
      path: c.req.path,
      status: response.status,
      durationMs: Math.round(performance.now() - startedAt),
    }));
    if (allowed) {
      for (const [name, value] of corsHeaders(origin)) response.headers.set(name, value);
    }
    return response;
  });
  const liveness = (c: Context) => c.json({ status: "ok" });
  app.get("/health", liveness);
  app.get("/healthz", liveness);
  app.get("/v1/auth/discord/start", async (c) => {
    if (!deps.auth) {
      return error(c, 503, "DEPENDENCY_ERROR", "Authentication is not configured");
    }
    const query = z.object({ extension_redirect: z.url() }).parse(c.req.query());
    return c.redirect(await deps.auth.authorizationUrl(query.extension_redirect));
  });
  app.get("/v1/auth/discord/callback", async (c) => {
    if (!deps.auth) {
      return error(c, 503, "DEPENDENCY_ERROR", "Authentication is not configured");
    }
    const query = z.object({ code: z.string().min(1), state: z.string().min(1) }).parse(
      c.req.query(),
    );
    const result = await deps.auth.complete(query.code, query.state);
    const destination = new URL(result.extensionRedirect);
    destination.hash = new URLSearchParams({
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      session_id: result.sessionId,
    }).toString();
    return c.redirect(destination.href);
  });
  app.use("/v1/*", async (c, next) => {
    if (
      c.req.path === "/v1/auth/discord/start" ||
      c.req.path === "/v1/auth/discord/callback" ||
      c.req.path === "/v1/auth/refresh"
    ) return next();
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
  });
  app.use("/v1/*", async (c, next) => {
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
  });
  app.post("/v1/auth/refresh", async (c) => {
    if (!deps.auth) return error(c, 503, "DEPENDENCY_ERROR", "Authentication is not configured");
    const body = z.object({
      sessionId: z.uuid(),
      refreshToken: z.string().min(32),
    }).parse(await readJsonBody(c, { maxBytes: deps.maxJsonBytes }));
    return c.json({ data: await deps.auth.refresh(body.sessionId, body.refreshToken) });
  });
  app.post("/v1/auth/logout", async (c) => {
    if (!deps.auth) return error(c, 503, "DEPENDENCY_ERROR", "Authentication is not configured");
    await deps.auth.revoke(c.get("session").sid);
    return c.body(null, 204);
  });
  app.get("/v1/auth/session", (c) => {
    const session = c.get("session");
    return c.json({
      data: {
        discordUserId: session.sub,
        guildIds: session.guildIds,
        expiresAt: new Date(session.exp).toISOString(),
      },
    });
  });
  app.get("/v1/setup/discord/guilds", async (c) => {
    if (!deps.discord) return error(c, 503, "DEPENDENCY_ERROR", "Discord is not configured");
    const guilds = await Promise.allSettled(
      c.get("session").guildIds.map((guildId) => deps.discord!.getGuild(guildId)),
    );
    return c.json({
      data: guilds.flatMap((result) => result.status === "fulfilled" ? [result.value] : []),
    });
  });
  app.post("/v1/discord/channels/sync", async (c) => {
    if (!deps.discord) return error(c, 503, "DEPENDENCY_ERROR", "Discord is not configured");
    const body = z.object({ guildId: z.string().min(1).optional() }).parse(
      await readJsonBody(c, { maxBytes: deps.maxJsonBytes, emptyValue: {} }),
    );
    const allowedGuilds = c.get("session").guildIds;
    const guildId = body.guildId ?? (allowedGuilds.length === 1 ? allowedGuilds[0] : undefined);
    if (!guildId) return error(c, 400, "BAD_REQUEST", "Choose a Discord server");
    if (!allowedGuilds.includes(guildId)) {
      return error(c, 403, "FORBIDDEN", "This Discord server is not allowed");
    }
    if (deps.channels) {
      return c.json({ data: await deps.channels.sync(c.get("session").sub, guildId) });
    }
    return c.json({ data: await deps.discord.listGuildTextChannels(guildId) });
  });
  app.post("/v1/setup/discord/guild", async (c) => {
    if (!deps.channels) return error(c, 503, "DEPENDENCY_ERROR", "Channel storage is unavailable");
    const { guildId } = z.object({ guildId: z.string().min(1) }).parse(
      await readJsonBody(c, { maxBytes: deps.maxJsonBytes }),
    );
    if (!c.get("session").guildIds.includes(guildId)) {
      return error(c, 403, "FORBIDDEN", "This Discord server is not allowed");
    }
    return c.json({ data: await deps.channels.selectGuild(c.get("session").sub, guildId) });
  });
  app.get("/v1/channels", async (c) => {
    if (!deps.channels) return error(c, 503, "DEPENDENCY_ERROR", "Channel storage is unavailable");
    return c.json({ data: await deps.channels.list(c.get("session").sub) });
  });
  app.patch("/v1/channels/:id", async (c) => {
    if (!deps.channels) return error(c, 503, "DEPENDENCY_ERROR", "Channel storage is unavailable");
    const patch = z.object({
      routingDescription: z.string().trim().max(1_000).nullable().optional(),
      isActiveForRouting: z.boolean().optional(),
      isReadLater: z.boolean().optional(),
    }).strict().parse(await readJsonBody(c, { maxBytes: deps.maxJsonBytes }));
    const row = await deps.channels.update(c.get("session").sub, c.req.param("id"), patch);
    return row ? c.json({ data: row }) : error(c, 404, "NOT_FOUND", "Channel not found");
  });
  app.post("/v1/resources/captures", async (c) => {
    const input = CaptureSchema.parse(await readJsonBody(c, { maxBytes: deps.maxJsonBytes }));
    const result = await deps.resources.capture(input);
    return c.json(
      { data: result.resource, meta: { created: result.created } },
      result.created ? 201 : 200,
    );
  });
  app.get("/v1/resources", async (c) => {
    const query = z.object({
      search: z.string().optional(),
      archived: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
      domain: z.string().trim().min(1).optional(),
      enrichmentStatus: z.enum(["preparing", "ready", "failed"]).optional(),
      tag: z.string().trim().min(1).optional(),
      state: z.enum(["inbox", "read_later", "shared", "archived"]).optional(),
      sort: z.enum(["newest", "oldest", "updated"]).default("newest"),
      limit: z.coerce.number().int().min(1).max(100).default(25),
      offset: z.coerce.number().int().min(0).default(0),
    }).parse(c.req.query());
    const rows = await deps.resources.list({ ...query, limit: query.limit + 1 });
    return c.json({
      data: rows.slice(0, query.limit),
      meta: {
        limit: query.limit,
        offset: query.offset,
        hasMore: rows.length > query.limit,
      },
    });
  });
  app.post("/v1/resources/bulk-actions", async (c) => {
    const input = BulkResourceActionSchema.parse(
      await readJsonBody(c, { maxBytes: deps.maxJsonBytes }),
    );
    return c.json({
      data: {
        action: input.action,
        affectedIds: await deps.resources.bulkAction(input.ids, input.action),
      },
    });
  });
  app.get("/v1/resources/:id", async (c) => {
    const row = await deps.resources.get(c.req.param("id"));
    if (!row) return error(c, 404, "NOT_FOUND", "Resource not found");
    const ownerId = c.get("session")?.sub;
    const [enrichment, deliveries] = ownerId
      ? await Promise.all([
        deps.enrichment?.get(ownerId, row.id).catch(() => null),
        deps.deliveries?.list(ownerId, row.id).catch(() => []),
      ])
      : [undefined, undefined];
    return c.json({ data: { ...row, enrichment, deliveries } });
  });
  app.patch("/v1/resources/:id", async (c) => {
    const row = await deps.resources.patch(
      c.req.param("id"),
      ResourcePatchSchema.parse(await readJsonBody(c, { maxBytes: deps.maxJsonBytes })),
    );
    return row ? c.json({ data: row }) : error(c, 404, "NOT_FOUND", "Resource not found");
  });
  app.delete(
    "/v1/resources/:id",
    async (c) =>
      (await deps.resources.delete(c.req.param("id")))
        ? c.body(null, 204)
        : error(c, 404, "NOT_FOUND", "Resource not found"),
  );
  app.post("/v1/resources/:id/enrichment/retry", async (c) => {
    if (!deps.enrichment) return error(c, 503, "DEPENDENCY_ERROR", "Enrichment is unavailable");
    return c.json({ data: await deps.enrichment.retry(c.get("session").sub, c.req.param("id")) });
  });
  app.get("/v1/resources/:id/deliveries", async (c) => {
    if (!deps.deliveries) return error(c, 503, "DEPENDENCY_ERROR", "Delivery is unavailable");
    return c.json({ data: await deps.deliveries.list(c.get("session").sub, c.req.param("id")) });
  });
  const publish = async (
    c: Context<{ Variables: { session: SessionClaims; requestId: string } }>,
    kind: "share" | "read_later",
  ) => {
    if (!deps.deliveries) return error(c, 503, "DEPENDENCY_ERROR", "Delivery is unavailable");
    const body = kind === "share"
      ? z.object({ channelId: z.string().uuid() }).parse(
        await readJsonBody(c, { maxBytes: deps.maxJsonBytes }),
      )
      : {};
    return c.json({
      data: await deps.deliveries.publish(c.get("session").sub, c.req.param("id")!, {
        ...body,
        kind,
      }),
    }, 201);
  };
  app.post("/v1/resources/:id/deliveries", (c) => publish(c, "share"));
  app.post("/v1/resources/:id/deliveries/discord", (c) => publish(c, "share"));
  app.post("/v1/resources/:id/deliveries/read-later", (c) => publish(c, "read_later"));
  app.post("/v1/deliveries/:id/retry", async (c) => {
    if (!deps.deliveries) return error(c, 503, "DEPENDENCY_ERROR", "Delivery is unavailable");
    return c.json({ data: await deps.deliveries.retry(c.get("session").sub, c.req.param("id")) });
  });
  app.get("/v1/tags", async (c) => {
    if (!deps.tags) return error(c, 503, "DEPENDENCY_ERROR", "Tag storage is unavailable");
    return c.json({ data: await deps.tags.list(c.get("session").sub, c.req.query("search")) });
  });
  app.post("/v1/tags", async (c) => {
    if (!deps.tags) return error(c, 503, "DEPENDENCY_ERROR", "Tag storage is unavailable");
    const input = z.object({
      slug: z.string().trim().min(1).max(80),
      english: z.string().trim().min(1).max(80),
      portuguese: z.string().trim().min(1).max(80),
      aliases: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    }).parse(await readJsonBody(c, { maxBytes: deps.maxJsonBytes }));
    return c.json({ data: await deps.tags.create(c.get("session").sub, input) }, 201);
  });
  app.post("/v1/tags/:id/merge", async (c) => {
    if (!deps.tags) return error(c, 503, "DEPENDENCY_ERROR", "Tag storage is unavailable");
    const { targetId } = z.object({ targetId: z.uuid() }).parse(
      await readJsonBody(c, { maxBytes: deps.maxJsonBytes }),
    );
    return c.json({
      data: await deps.tags.merge(c.get("session").sub, c.req.param("id"), targetId),
    });
  });
  app.patch("/v1/tags/:id", async (c) => {
    if (!deps.tags) return error(c, 503, "DEPENDENCY_ERROR", "Tag storage is unavailable");
    const input = z.object({
      slug: z.string().trim().min(1).max(80),
      english: z.string().trim().min(1).max(80),
      portuguese: z.string().trim().min(1).max(80),
      aliases: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    }).parse(await readJsonBody(c, { maxBytes: deps.maxJsonBytes }));
    return c.json({ data: await deps.tags.update(c.get("session").sub, c.req.param("id"), input) });
  });
  return app;
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
  if (
    path === "/v1/auth/discord/callback" || path === "/v1/auth/refresh" ||
    path === "/v1/auth/session" || path === "/v1/auth/logout"
  ) response.headers.set("cache-control", "no-store");
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

export const app = createApp();
