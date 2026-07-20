import { type Context, Hono } from "@hono/hono";
import { z } from "zod";
import type { DiscordClient } from "./integrations/discord_client.ts";
import { CaptureSchema, ResourcePatchSchema } from "./domain/resource.ts";
import { error, handleError } from "./http/errors.ts";
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
}

export type AppDependencies = {
  resources: ResourceService;
  auth?: AuthService;
  discord?: DiscordClient;
  channels?: ChannelCoordinator;
  deliveries?: DeliveryCoordinator;
  enrichment?: EnrichmentCoordinator;
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
    if (deps.channels) {
      return c.json({ data: await deps.channels.sync(c.get("session").sub, guildId) });
    }
    return c.json({ data: await deps.discord.listGuildTextChannels(guildId) });
  });
  app.post("/v1/setup/discord/guild", async (c) => {
    if (!deps.channels) return error(c, 503, "DEPENDENCY_ERROR", "Channel storage is unavailable");
    const { guildId } = z.object({ guildId: z.string().min(1) }).parse(await c.req.json());
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
    }).strict().parse(await c.req.json());
    const row = await deps.channels.update(c.get("session").sub, c.req.param("id"), patch);
    return row ? c.json({ data: row }) : error(c, 404, "NOT_FOUND", "Channel not found");
  });
  app.post("/v1/resources/captures", async (c) => {
    const input = CaptureSchema.parse(await c.req.json());
    const result = await deps.resources.capture(input);
    if (result.created && deps.enrichment) {
      deps.enrichment.prepare(c.get("session")?.sub ?? "", result.resource.id).catch((cause) =>
        console.error(
          "Background enrichment failed",
          cause instanceof Error ? cause.message : cause,
        )
      );
    }
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
  app.post("/v1/resources/:id/enrichment/retry", async (c) => {
    if (!deps.enrichment) return error(c, 503, "DEPENDENCY_ERROR", "Enrichment is unavailable");
    return c.json({ data: await deps.enrichment.retry(c.get("session").sub, c.req.param("id")) });
  });
  app.get("/v1/resources/:id/deliveries", async (c) => {
    if (!deps.deliveries) return error(c, 503, "DEPENDENCY_ERROR", "Delivery is unavailable");
    return c.json({ data: await deps.deliveries.list(c.get("session").sub, c.req.param("id")) });
  });
  const publish = async (
    c: Context<{ Variables: { session: SessionClaims } }>,
    kind: "share" | "read_later",
  ) => {
    if (!deps.deliveries) return error(c, 503, "DEPENDENCY_ERROR", "Delivery is unavailable");
    const body = kind === "share"
      ? z.object({ channelId: z.string().uuid() }).parse(await c.req.json())
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
