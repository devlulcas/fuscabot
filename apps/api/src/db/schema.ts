import {
  type AnyPgColumn,
  boolean,
  check,
  customType,
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
import { relations, sql } from "drizzle-orm";

const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerDiscordUserId: text("owner_discord_user_id").notNull().unique(),
  defaultOutputLanguage: text("default_output_language").$type<"pt-BR" | "en">().notNull().default(
    "pt-BR",
  ),
  readLaterChannelId: uuid("read_later_channel_id").references(
    (): AnyPgColumn => channels.id,
    { onDelete: "set null" },
  ),
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
    status: text("status").$type<"connected" | "disconnected">().notNull().default("connected"),
    connectedAt: timestamp("connected_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (
    t,
  ) => [
    uniqueIndex("discord_connections_workspace_guild_uidx").on(t.workspaceId, t.discordGuildId),
    uniqueIndex("discord_connections_one_connected_per_workspace_uidx").on(t.workspaceId)
      .where(sql`${t.status} = 'connected'`),
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
    availability: text("availability").$type<"available" | "unavailable">().notNull().default(
      "available",
    ),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    ...timestamps,
  },
  (
    t,
  ) => [
    uniqueIndex("channels_workspace_discord_uidx").on(t.workspaceId, t.discordChannelId),
    uniqueIndex("channels_one_read_later_per_workspace").on(t.workspaceId)
      .where(sql`${t.isReadLater}`),
    index("channels_workspace_idx").on(t.workspaceId),
    check("channels_availability_check", sql`${t.availability} in ('available', 'unavailable')`),
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
    outputLanguage: text("output_language").$type<"pt-BR" | "en">().notNull().default("pt-BR"),
    title: text("title").notNull(),
    description: text("description"),
    siteName: text("site_name"),
    author: text("author"),
    publishedAtSource: timestamp("published_at_source", { withTimezone: true }),
    imageUrl: text("image_url"),
    selectedQuote: text("selected_quote"),
    summary: text("summary"),
    personalNote: text("personal_note"),
    enrichmentStatus: text("enrichment_status").$type<"preparing" | "ready" | "failed">().notNull()
      .default("preparing"),
    enrichmentError: text("enrichment_error"),
    publicSlug: text("public_slug"),
    publicPublishedAt: timestamp("public_published_at", { withTimezone: true }),
    searchDocument: tsvector("search_document").generatedAlwaysAs(
      sql`setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('simple', coalesce(source_domain, '') || ' ' ||
            coalesce(original_url, '')), 'B') ||
          setweight(to_tsvector('simple', coalesce(description, '') || ' ' ||
            coalesce(summary, '')), 'C') ||
          setweight(to_tsvector('simple', coalesce(personal_note, '') || ' ' ||
            coalesce(selected_quote, '')), 'D')`,
    ),
    publicSearchDocument: tsvector("public_search_document").generatedAlwaysAs(
      sql`setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('simple', coalesce(summary, '')), 'C') ||
          setweight(to_tsvector('simple', coalesce(source_domain, '') || ' ' ||
            coalesce(selected_quote, '')), 'D')`,
    ),
    ...timestamps,
  },
  (
    t,
  ) => [
    uniqueIndex("resources_workspace_canonical_uidx").on(t.workspaceId, t.canonicalUrlKey),
    index("resources_workspace_created_idx").on(t.workspaceId, t.createdAt),
    index("resources_enrichment_idx").on(t.workspaceId, t.enrichmentStatus),
    uniqueIndex("resources_public_slug_uidx").on(t.publicSlug)
      .where(sql`${t.publicSlug} is not null`),
    index("resources_public_published_idx").on(t.publicPublishedAt.desc(), t.id)
      .where(sql`${t.publicPublishedAt} is not null`),
    index("resources_search_document_idx").using("gin", t.searchDocument),
    index("resources_public_search_document_idx").using("gin", t.publicSearchDocument)
      .where(sql`${t.publicPublishedAt} is not null`),
    check(
      "resources_enrichment_status_check",
      sql`${t.enrichmentStatus} in ('preparing', 'ready', 'failed')`,
    ),
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
  language: text("language").$type<"en" | "pt-BR">().notNull(),
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
  source: text("source").$type<"ai" | "user">().notNull(),
}, (t) => [primaryKey({ columns: [t.resourceId, t.tagId] })]);
export const enrichmentRuns = pgTable("enrichment_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  resourceId: uuid("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  inputSnapshot: jsonb("input_snapshot").notNull(),
  output: jsonb("output"),
  status: text("status").$type<"preparing" | "ready" | "failed">().notNull(),
  error: text("error"),
  retryable: boolean("retryable").notNull().default(false),
  durationMs: integer("duration_ms"),
  ...timestamps,
}, (t) => [
  uniqueIndex("enrichment_runs_one_preparing_per_resource_uidx").on(t.resourceId)
    .where(sql`${t.status} = 'preparing'`),
]);
export const deliveries = pgTable("deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  resourceId: uuid("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
  destinationType: text("destination_type").$type<"discord_channel">().notNull(),
  channelId: uuid("channel_id").references(() => channels.id),
  deliveryKind: text("delivery_kind").$type<"read_later" | "share">().notNull(),
  messageSnapshot: jsonb("message_snapshot").notNull(),
  externalMessageId: text("external_message_id"),
  externalUrl: text("external_url"),
  status: text("status").$type<"pending" | "sent" | "failed" | "unknown">().notNull().default(
    "pending",
  ),
  error: text("error"),
  retryOfDeliveryId: uuid("retry_of_delivery_id").references(
    (): AnyPgColumn => deliveries.id,
    { onDelete: "set null" },
  ),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [
  index("deliveries_resource_idx").on(t.resourceId),
  index("deliveries_retry_idx").on(t.retryOfDeliveryId),
  uniqueIndex("deliveries_success_guard").on(t.resourceId, t.channelId, t.deliveryKind)
    .where(sql`${t.status} in ('pending', 'sent', 'unknown')`),
]);
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
export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    scope: text("scope").notNull(),
    keyHash: text("key_hash").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(1),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (
    table,
  ) => [
    primaryKey({ columns: [table.scope, table.keyHash, table.windowStart] }),
    index("rate_limit_buckets_expiry_idx").on(table.expiresAt),
  ],
);

export const workspaceRelations = relations(workspaces, ({ many, one }) => ({
  discordConnections: many(discordConnections),
  channels: many(channels),
  resources: many(resources),
  tags: many(tags),
  authSessions: many(authSessions),
  readLaterChannel: one(channels, {
    fields: [workspaces.readLaterChannelId],
    references: [channels.id],
    relationName: "workspaceReadLaterChannel",
  }),
}));

export const discordConnectionRelations = relations(discordConnections, ({ many, one }) => ({
  workspace: one(workspaces, {
    fields: [discordConnections.workspaceId],
    references: [workspaces.id],
  }),
  channels: many(channels),
}));

export const channelRelations = relations(channels, ({ many, one }) => ({
  workspace: one(workspaces, {
    fields: [channels.workspaceId],
    references: [workspaces.id],
  }),
  discordConnection: one(discordConnections, {
    fields: [channels.discordConnectionId],
    references: [discordConnections.id],
  }),
  deliveries: many(deliveries),
  readLaterForWorkspace: one(workspaces, {
    fields: [channels.id],
    references: [workspaces.readLaterChannelId],
    relationName: "workspaceReadLaterChannel",
  }),
}));

export const resourceRelations = relations(resources, ({ many }) => ({
  resourceTags: many(resourceTags),
  enrichmentRuns: many(enrichmentRuns),
  deliveries: many(deliveries),
}));

export const tagRelations = relations(tags, ({ many, one }) => ({
  workspace: one(workspaces, {
    fields: [tags.workspaceId],
    references: [workspaces.id],
  }),
  labels: many(tagLabels),
  aliases: many(tagAliases),
  resourceTags: many(resourceTags),
}));

export const tagLabelRelations = relations(tagLabels, ({ one }) => ({
  tag: one(tags, {
    fields: [tagLabels.tagId],
    references: [tags.id],
  }),
}));

export const tagAliasRelations = relations(tagAliases, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [tagAliases.workspaceId],
    references: [workspaces.id],
  }),
  tag: one(tags, {
    fields: [tagAliases.tagId],
    references: [tags.id],
  }),
}));

export const resourceTagRelations = relations(resourceTags, ({ one }) => ({
  resource: one(resources, {
    fields: [resourceTags.resourceId],
    references: [resources.id],
  }),
  tag: one(tags, {
    fields: [resourceTags.tagId],
    references: [tags.id],
  }),
}));

export const enrichmentRunRelations = relations(enrichmentRuns, ({ one }) => ({
  resource: one(resources, {
    fields: [enrichmentRuns.resourceId],
    references: [resources.id],
  }),
}));

export const deliveryRelations = relations(deliveries, ({ one }) => ({
  resource: one(resources, {
    fields: [deliveries.resourceId],
    references: [resources.id],
  }),
  channel: one(channels, {
    fields: [deliveries.channelId],
    references: [channels.id],
  }),
}));

export const authSessionRelations = relations(authSessions, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [authSessions.workspaceId],
    references: [workspaces.id],
  }),
}));
