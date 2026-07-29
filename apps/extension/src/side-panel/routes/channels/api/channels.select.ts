import type { InferResponseType } from "@hono/hono/client";
import type { apiClient } from "../../../../shared/hono-client.ts";

export type DiscordSession = InferResponseType<
  typeof apiClient.v1.auth.session.$get,
  200
>["data"];
export type DiscordGuild = InferResponseType<
  typeof apiClient.v1.setup.discord.guilds.$get,
  200
>["data"][number];
export type DiscordChannel = InferResponseType<
  typeof apiClient.v1.channels.$get,
  200
>["data"][number];

export function selectSyncedChannels(
  response: InferResponseType<
    typeof apiClient.v1.discord.channels.sync.$post,
    200
  >,
): DiscordChannel[] {
  return response.data.map((channel) =>
    "discordChannelId" in channel ? channel : {
      id: channel.id,
      discordChannelId: channel.id,
      name: channel.name,
      parentName: null,
      discordTopic: channel.topic,
      routingDescription: null,
      isActiveForRouting: false,
      isReadLater: false,
      availability: "available",
      lastSyncedAt: null,
    }
  );
}
