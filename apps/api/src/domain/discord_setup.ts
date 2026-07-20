export type ImportedTextChannel = {
  discordChannelId: string;
  name: string;
  parentDiscordChannelId: string | null;
  parentName: string | null;
  topic: string | null;
};

export type StoredChannel = ImportedTextChannel & {
  id: string;
  workspaceId: string;
  routingDescription: string | null;
  isActiveForRouting: boolean;
  isReadLater: boolean;
  availability: "available" | "unavailable";
};

export type ChannelPatch = {
  routingDescription?: string | null;
  isActiveForRouting?: boolean;
  isReadLater?: boolean;
};

export class DiscordSetupConflictError extends Error {}
export class ChannelNotFoundError extends Error {}
export class InvalidReadLaterChannelError extends Error {}
