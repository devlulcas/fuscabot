import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerDiscordUserId: text("owner_discord_user_id").notNull().unique(),
  defaultOutputLanguage: text("default_output_language").notNull().default("pt-BR"),
  readLaterChannelId: uuid("read_later_channel_id"),
  ...timestamps,
});
export const discordConnections = pgTable(
  "discord_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    discordGuildId: text("discord_guild_id").notNull(),
    guildName: text("guild_name").notNull(),
    botUserId: text("bot_user_id").notNull(),
    status: text("status").notNull().default("connected"),
    connectedAt: timestamp("connected_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (
    t,
  ) => [
    uniqueIndex("discord_connections_workspace_guild_uidx").on(t.workspaceId, t.discordGuildId),
  ],
);
export const channels = pgTable(
  "channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    discordConnectionId: uuid("discord_connection_id").notNull().references(
      () => discordConnections.id,
      { onDelete: "cascade" },
    ),
    discordChannelId: text("discord_channel_id").notNull(),
    name: text("name").notNull(),
    parentDiscordChannelId: text("parent_discord_channel_id"),
    parentName: text("parent_name"),
    discordTopic: text("discord_topic"),
    routingDescription: text("routing_description"),
    isActiveForRouting: boolean("is_active_for_routing").notNull().default(true),
    isReadLater: boolean("is_read_later").notNull().default(false),
    availability: text("availability").notNull().default("available"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    ...timestamps,
  },
  (
    t,
  ) => [
    uniqueIndex("channels_workspace_discord_uidx").on(t.workspaceId, t.discordChannelId),
    index("channels_workspace_idx").on(t.workspaceId),
  ],
);
export const resources = pgTable(
  "resources",
  {
    id: uuid("id").primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    originalUrl: text("original_url").notNull(),
    normalizedUrl: text("normalized_url").notNull(),
    canonicalUrl: text("canonical_url"),
    canonicalUrlKey: text("canonical_url_key").notNull(),
    sourceDomain: text("source_domain").notNull(),
    sourceLanguage: text("source_language").notNull().default("unknown"),
    outputLanguage: text("output_language").notNull().default("pt-BR"),
    title: text("title").notNull(),
    description: text("description"),
    siteName: text("site_name"),
    author: text("author"),
    publishedAtSource: timestamp("published_at_source", { withTimezone: true }),
    imageUrl: text("image_url"),
    selectedQuote: text("selected_quote"),
    summary: text("summary"),
    whyUseful: text("why_useful"),
    personalNote: text("personal_note"),
    enrichmentStatus: text("enrichment_status").notNull().default("preparing"),
    enrichmentError: text("enrichment_error"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (
    t,
  ) => [
    uniqueIndex("resources_workspace_canonical_uidx").on(t.workspaceId, t.canonicalUrlKey),
    index("resources_workspace_created_idx").on(t.workspaceId, t.createdAt),
    index("resources_enrichment_idx").on(t.workspaceId, t.enrichmentStatus),
  ],
);
export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, {
    onDelete: "cascade",
  }),
  slug: text("slug").notNull(),
  ...timestamps,
}, (t) => [uniqueIndex("tags_workspace_slug_uidx").on(t.workspaceId, t.slug)]);
export const tagLabels = pgTable("tag_labels", {
  id: uuid("id").primaryKey().defaultRandom(),
  tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  language: text("language").notNull(),
  name: text("name").notNull(),
}, (t) => [uniqueIndex("tag_labels_tag_language_uidx").on(t.tagId, t.language)]);
export const tagAliases = pgTable("tag_aliases", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, {
    onDelete: "cascade",
  }),
  tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  aliasNormalized: text("alias_normalized").notNull(),
  language: text("language"),
}, (t) => [uniqueIndex("tag_aliases_workspace_alias_uidx").on(t.workspaceId, t.aliasNormalized)]);
export const resourceTags = pgTable("resource_tags", {
  resourceId: uuid("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
}, (t) => [primaryKey({ columns: [t.resourceId, t.tagId] })]);
export const enrichmentRuns = pgTable("enrichment_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  resourceId: uuid("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  inputSnapshot: jsonb("input_snapshot").notNull(),
  output: jsonb("output"),
  status: text("status").notNull(),
  error: text("error"),
  retryable: boolean("retryable").notNull().default(false),
  durationMs: integer("duration_ms"),
  ...timestamps,
});
export const deliveries = pgTable("deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  resourceId: uuid("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
  destinationType: text("destination_type").notNull(),
  channelId: uuid("channel_id").references(() => channels.id),
  deliveryKind: text("delivery_kind").notNull(),
  messageSnapshot: jsonb("message_snapshot").notNull(),
  externalMessageId: text("external_message_id"),
  externalUrl: text("external_url"),
  status: text("status").notNull().default("pending"),
  error: text("error"),
  retryOfDeliveryId: uuid("retry_of_delivery_id"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [index("deliveries_resource_idx").on(t.resourceId)]);
export const authSessions = pgTable("auth_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, {
    onDelete: "cascade",
  }),
  refreshTokenHash: text("refresh_token_hash").notNull().unique(),
  guildIds: text("guild_ids").array().notNull().default([]),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  ...timestamps,
});
export const oauthStates = pgTable("oauth_states", {
  id: uuid("id").primaryKey().defaultRandom(),
  stateHash: text("state_hash").notNull().unique(),
  codeVerifier: text("code_verifier").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
