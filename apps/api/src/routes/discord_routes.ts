import { Hono } from "@hono/hono";
import { z } from "zod";
import type { AppDependencies, AppEnv } from "../app_types.ts";
import { error } from "../http/errors.ts";
import { readJsonBody } from "../http/json_body.ts";

export function createDiscordRoutes(deps: AppDependencies) {
  const app = new Hono<AppEnv>();

  app.get("/setup/discord/guilds", async (c) => {
    if (!deps.discord) return error(c, 503, "DEPENDENCY_ERROR", "Discord is not configured");
    const guilds = await Promise.allSettled(
      c.get("session").guildIds.map((guildId) => deps.discord!.getGuild(guildId)),
    );
    return c.json({
      data: guilds.flatMap((result) => result.status === "fulfilled" ? [result.value] : []),
    });
  });
  app.post("/discord/channels/sync", async (c) => {
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
  app.post("/setup/discord/guild", async (c) => {
    if (!deps.channels) {
      return error(c, 503, "DEPENDENCY_ERROR", "Channel storage is unavailable");
    }
    const { guildId } = z.object({ guildId: z.string().min(1) }).parse(
      await readJsonBody(c, { maxBytes: deps.maxJsonBytes }),
    );
    if (!c.get("session").guildIds.includes(guildId)) {
      return error(c, 403, "FORBIDDEN", "This Discord server is not allowed");
    }
    return c.json({ data: await deps.channels.selectGuild(c.get("session").sub, guildId) });
  });
  app.get("/channels", async (c) => {
    if (!deps.channels) {
      return error(c, 503, "DEPENDENCY_ERROR", "Channel storage is unavailable");
    }
    return c.json({ data: await deps.channels.list(c.get("session").sub) });
  });
  app.patch("/channels/:id", async (c) => {
    if (!deps.channels) {
      return error(c, 503, "DEPENDENCY_ERROR", "Channel storage is unavailable");
    }
    const patch = z.object({
      routingDescription: z.string().trim().max(1_000).nullable().optional(),
      isActiveForRouting: z.boolean().optional(),
      isReadLater: z.boolean().optional(),
    }).strict().parse(await readJsonBody(c, { maxBytes: deps.maxJsonBytes }));
    const row = await deps.channels.update(c.get("session").sub, c.req.param("id"), patch);
    return row ? c.json({ data: row }) : error(c, 404, "NOT_FOUND", "Channel not found");
  });

  return app;
}
