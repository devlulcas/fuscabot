import { Hono } from "hono";
import { z } from "zod";
import type { AppDependencies, AppEnv } from "../app_types.ts";
import { error } from "../http/errors.ts";
import { IdParamSchema, zValidator } from "../http/validation.ts";

const SyncBodySchema = z.object({ guildId: z.string().min(1).optional() });
const ChannelPatchSchema = z.object({
  routingDescription: z.string().trim().max(1_000).nullable().optional(),
  isActiveForRouting: z.boolean().optional(),
  isReadLater: z.boolean().optional(),
}).strict();

export function createDiscordRoutes(deps: AppDependencies) {
  return new Hono<AppEnv>()
    .get("/setup/discord/guilds", async (c) => {
      if (!deps.discord) return error(c, 503, "DEPENDENCY_ERROR", "Discord is not configured");
      const guilds = await Promise.allSettled(
        c.get("session").guildIds.map((guildId) => deps.discord!.getGuild(guildId)),
      );
      return c.json({
        data: guilds.flatMap((result) => result.status === "fulfilled" ? [result.value] : []),
      }, 200);
    })
    .post("/discord/channels/sync", zValidator("json", SyncBodySchema), async (c) => {
      if (!deps.discord) return error(c, 503, "DEPENDENCY_ERROR", "Discord is not configured");
      const body = c.req.valid("json");
      const allowedGuilds = c.get("session").guildIds;
      const guildId = body.guildId ?? (allowedGuilds.length === 1 ? allowedGuilds[0] : undefined);
      if (!guildId) return error(c, 400, "BAD_REQUEST", "Choose a Discord server");
      if (!allowedGuilds.includes(guildId)) {
        return error(c, 403, "FORBIDDEN", "This Discord server is not allowed");
      }
      if (deps.channels) {
        return c.json({ data: await deps.channels.sync(c.get("session").sub, guildId) }, 200);
      }
      return c.json({ data: await deps.discord.listGuildTextChannels(guildId) }, 200);
    })
    .get("/channels", async (c) => {
      if (!deps.channels) {
        return error(c, 503, "DEPENDENCY_ERROR", "Channel storage is unavailable");
      }
      return c.json({ data: await deps.channels.list(c.get("session").sub) }, 200);
    })
    .patch(
      "/channels/:id",
      zValidator("param", IdParamSchema),
      zValidator("json", ChannelPatchSchema),
      async (c) => {
        if (!deps.channels) {
          return error(c, 503, "DEPENDENCY_ERROR", "Channel storage is unavailable");
        }
        const { id } = c.req.valid("param");
        const patch = c.req.valid("json");
        const row = await deps.channels.update(c.get("session").sub, id, patch);
        return row ? c.json({ data: row }, 200) : error(c, 404, "NOT_FOUND", "Channel not found");
      },
    );
}
