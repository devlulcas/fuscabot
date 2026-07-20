import { Hono } from "@hono/hono";
import { z } from "zod";
import type { DiscordClient } from "./integrations/discord_client.ts";
import { CaptureSchema, ResourcePatchSchema } from "./domain/resource.ts";
import { error, handleError } from "./http/errors.ts";
import { InMemoryResourceRepository } from "./repositories/resource_repository.ts";
import type { AuthService, SessionClaims } from "./services/auth_service.ts";
import { ResourceService } from "./services/resource_service.ts";

export type AppDependencies = {
  resources: ResourceService;
  auth?: AuthService;
  discord?: DiscordClient;
  allowedOrigins?: string[];
  requireAuth?: boolean;
};

export function createApp(
  deps: AppDependencies = { resources: new ResourceService(new InMemoryResourceRepository()) },
) {
  const app = new Hono<{ Variables: { session: SessionClaims } }>();
  app.onError((cause, c) => handleError(c, cause));
  app.notFound((c) => error(c, 404, "NOT_FOUND", "Route not found"));
  app.use("*", async (c, next) => {
    const origin = c.req.header("origin");
    const allowed = origin && deps.allowedOrigins?.includes(origin);
    if (c.req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: allowed ? corsHeaders(origin) : undefined,
      });
    }
    await next();
    if (allowed) {
      for (const [name, value] of corsHeaders(origin)) c.res.headers.set(name, value);
    }
  });
  app.get("/health", (c) =>
    c.json({
      status: "ok",
      services: { auth: Boolean(deps.auth), discord: Boolean(deps.discord) },
    }));
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
    destination.hash = new URLSearchParams({ access_token: result.accessToken }).toString();
    return c.redirect(destination.href);
  });
  app.use("/v1/*", async (c, next) => {
    if (
      c.req.path === "/v1/auth/discord/start" ||
      c.req.path === "/v1/auth/discord/callback"
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
      await c.req.json().catch(() => ({})),
    );
    const allowedGuilds = c.get("session").guildIds;
    const guildId = body.guildId ?? (allowedGuilds.length === 1 ? allowedGuilds[0] : undefined);
    if (!guildId) return error(c, 400, "BAD_REQUEST", "Choose a Discord server");
    if (!allowedGuilds.includes(guildId)) {
      return error(c, 403, "FORBIDDEN", "This Discord server is not allowed");
    }
    return c.json({ data: await deps.discord.listGuildTextChannels(guildId) });
  });
  app.post("/v1/resources/captures", async (c) => {
    const input = CaptureSchema.parse(await c.req.json());
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
      limit: z.coerce.number().int().min(1).max(100).default(25),
      offset: z.coerce.number().int().min(0).default(0),
    }).parse(c.req.query());
    return c.json({
      data: await deps.resources.list(query),
      meta: { limit: query.limit, offset: query.offset },
    });
  });
  app.get("/v1/resources/:id", async (c) => {
    const row = await deps.resources.get(c.req.param("id"));
    return row ? c.json({ data: row }) : error(c, 404, "NOT_FOUND", "Resource not found");
  });
  app.patch("/v1/resources/:id", async (c) => {
    const row = await deps.resources.patch(
      c.req.param("id"),
      ResourcePatchSchema.parse(await c.req.json()),
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

export const app = createApp();
