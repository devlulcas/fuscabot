CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"guild_ids" text[] DEFAULT '{}' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_sessions_refresh_token_hash_unique" UNIQUE("refresh_token_hash")
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"discord_connection_id" uuid NOT NULL,
	"discord_channel_id" text NOT NULL,
	"name" text NOT NULL,
	"parent_discord_channel_id" text,
	"parent_name" text,
	"discord_topic" text,
	"routing_description" text,
	"is_active_for_routing" boolean DEFAULT true NOT NULL,
	"is_read_later" boolean DEFAULT false NOT NULL,
	"availability" text DEFAULT 'available' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channels_availability_check" CHECK ("channels"."availability" in ('available', 'unavailable'))
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"destination_type" text NOT NULL,
	"channel_id" uuid,
	"delivery_kind" text NOT NULL,
	"message_snapshot" jsonb NOT NULL,
	"external_message_id" text,
	"external_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"retry_of_delivery_id" uuid,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discord_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"discord_guild_id" text NOT NULL,
	"guild_name" text NOT NULL,
	"bot_user_id" text NOT NULL,
	"status" text DEFAULT 'connected' NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrichment_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"input_snapshot" jsonb NOT NULL,
	"output" jsonb,
	"status" text NOT NULL,
	"error" text,
	"retryable" boolean DEFAULT false NOT NULL,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_hash" text NOT NULL,
	"code_verifier" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_states_state_hash_unique" UNIQUE("state_hash")
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"scope" text NOT NULL,
	"key_hash" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "rate_limit_buckets_scope_key_hash_window_start_pk" PRIMARY KEY("scope","key_hash","window_start")
);
--> statement-breakpoint
CREATE TABLE "resource_tags" (
	"resource_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "resource_tags_resource_id_tag_id_pk" PRIMARY KEY("resource_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"original_url" text NOT NULL,
	"normalized_url" text NOT NULL,
	"canonical_url" text,
	"canonical_url_key" text NOT NULL,
	"source_domain" text NOT NULL,
	"source_language" text DEFAULT 'unknown' NOT NULL,
	"output_language" text DEFAULT 'pt-BR' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"site_name" text,
	"author" text,
	"published_at_source" timestamp with time zone,
	"image_url" text,
	"selected_quote" text,
	"summary" text,
	"personal_note" text,
	"enrichment_status" text DEFAULT 'preparing' NOT NULL,
	"enrichment_error" text,
	"public_slug" text,
	"public_published_at" timestamp with time zone,
	"search_document" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('simple', coalesce(source_domain, '') || ' ' ||
            coalesce(original_url, '')), 'B') ||
          setweight(to_tsvector('simple', coalesce(description, '') || ' ' ||
            coalesce(summary, '')), 'C') ||
          setweight(to_tsvector('simple', coalesce(personal_note, '') || ' ' ||
            coalesce(selected_quote, '')), 'D')) STORED,
	"public_search_document" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('simple', coalesce(summary, '')), 'C') ||
          setweight(to_tsvector('simple', coalesce(source_domain, '') || ' ' ||
            coalesce(selected_quote, '')), 'D')) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resources_enrichment_status_check" CHECK ("resources"."enrichment_status" in ('preparing', 'ready', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "tag_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"alias_normalized" text NOT NULL,
	"language" text
);
--> statement-breakpoint
CREATE TABLE "tag_labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tag_id" uuid NOT NULL,
	"language" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_discord_user_id" text NOT NULL,
	"default_output_language" text DEFAULT 'pt-BR' NOT NULL,
	"read_later_channel_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_owner_discord_user_id_unique" UNIQUE("owner_discord_user_id")
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_discord_connection_id_discord_connections_id_fk" FOREIGN KEY ("discord_connection_id") REFERENCES "public"."discord_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_retry_of_delivery_id_deliveries_id_fk" FOREIGN KEY ("retry_of_delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_connections" ADD CONSTRAINT "discord_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_runs" ADD CONSTRAINT "enrichment_runs_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_tags" ADD CONSTRAINT "resource_tags_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_tags" ADD CONSTRAINT "resource_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_aliases" ADD CONSTRAINT "tag_aliases_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_aliases" ADD CONSTRAINT "tag_aliases_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_labels" ADD CONSTRAINT "tag_labels_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_read_later_channel_id_channels_id_fk" FOREIGN KEY ("read_later_channel_id") REFERENCES "public"."channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channels_workspace_discord_uidx" ON "channels" USING btree ("workspace_id","discord_channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "channels_one_read_later_per_workspace" ON "channels" USING btree ("workspace_id") WHERE "channels"."is_read_later";--> statement-breakpoint
CREATE INDEX "channels_workspace_idx" ON "channels" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "deliveries_resource_idx" ON "deliveries" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "deliveries_retry_idx" ON "deliveries" USING btree ("retry_of_delivery_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deliveries_success_guard" ON "deliveries" USING btree ("resource_id","channel_id","delivery_kind") WHERE "deliveries"."status" in ('pending', 'sent', 'unknown');--> statement-breakpoint
CREATE UNIQUE INDEX "discord_connections_workspace_guild_uidx" ON "discord_connections" USING btree ("workspace_id","discord_guild_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discord_connections_one_connected_per_workspace_uidx" ON "discord_connections" USING btree ("workspace_id") WHERE "discord_connections"."status" = 'connected';--> statement-breakpoint
CREATE UNIQUE INDEX "enrichment_runs_one_preparing_per_resource_uidx" ON "enrichment_runs" USING btree ("resource_id") WHERE "enrichment_runs"."status" = 'preparing';--> statement-breakpoint
CREATE INDEX "rate_limit_buckets_expiry_idx" ON "rate_limit_buckets" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "resources_workspace_canonical_uidx" ON "resources" USING btree ("workspace_id","canonical_url_key");--> statement-breakpoint
CREATE INDEX "resources_workspace_created_idx" ON "resources" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "resources_enrichment_idx" ON "resources" USING btree ("workspace_id","enrichment_status");--> statement-breakpoint
CREATE UNIQUE INDEX "resources_public_slug_uidx" ON "resources" USING btree ("public_slug") WHERE "resources"."public_slug" is not null;--> statement-breakpoint
CREATE INDEX "resources_public_published_idx" ON "resources" USING btree ("public_published_at" DESC NULLS LAST,"id") WHERE "resources"."public_published_at" is not null;--> statement-breakpoint
CREATE INDEX "resources_search_document_idx" ON "resources" USING gin ("search_document");--> statement-breakpoint
CREATE INDEX "resources_public_search_document_idx" ON "resources" USING gin ("public_search_document") WHERE "resources"."public_published_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "tag_aliases_workspace_alias_uidx" ON "tag_aliases" USING btree ("workspace_id","alias_normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_labels_tag_language_uidx" ON "tag_labels" USING btree ("tag_id","language");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_workspace_slug_uidx" ON "tags" USING btree ("workspace_id","slug");