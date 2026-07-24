import type { channels } from "../db/schema.ts";

type ChannelRow = typeof channels.$inferSelect;

export type ImportedTextChannel = {
  discordChannelId: ChannelRow["discordChannelId"];
  name: ChannelRow["name"];
  parentDiscordChannelId: ChannelRow["parentDiscordChannelId"];
  parentName: ChannelRow["parentName"];
  topic: ChannelRow["discordTopic"];
};

export type StoredChannel = ImportedTextChannel & {
  id: ChannelRow["id"];
  workspaceId: ChannelRow["workspaceId"];
  routingDescription: ChannelRow["routingDescription"];
  isActiveForRouting: ChannelRow["isActiveForRouting"];
  isReadLater: ChannelRow["isReadLater"];
  availability: ChannelRow["availability"];
  lastSyncedAt: ChannelRow["lastSyncedAt"];
};

export type ChannelPatch = {
  routingDescription?: ChannelRow["routingDescription"];
  isActiveForRouting?: ChannelRow["isActiveForRouting"];
  isReadLater?: ChannelRow["isReadLater"];
};

export class DiscordSetupConflictError extends Error {}
export class ChannelNotFoundError extends Error {}
export class InvalidReadLaterChannelError extends Error {}
