import type { DiscordClient } from "./integrations/discord_client.ts";
import type { DeliveryRecord } from "./domain/durable_delivery.ts";
import type { EnrichmentState } from "./domain/enrichment.ts";
import type { TagRecord } from "./services/tag_coordinator.ts";
import type { RateLimitPolicies, RateLimitStore } from "./http/rate_limit.ts";
import type { AuthService, SessionClaims } from "./services/auth_service.ts";
import type { PublicationCoordinator } from "./services/publication_coordinator.ts";
import type { ResourceService } from "./services/resource_service.ts";

export type AppVariables = {
  session: SessionClaims;
  requestId: string;
};

export type AppEnv = { Variables: AppVariables };

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
  ): Promise<DeliveryRecord>;
  list(ownerId: string, resourceId: string): Promise<DeliveryRecord[]>;
  retry(ownerId: string, deliveryId: string): Promise<DeliveryRecord>;
}

export interface EnrichmentCoordinator {
  prepare(ownerId: string, resourceId: string): Promise<void>;
  retry(ownerId: string, resourceId: string): Promise<EnrichmentState>;
  get(ownerId: string, resourceId: string): Promise<EnrichmentState>;
}

export interface TagCoordinator {
  list(ownerId: string, search?: string): Promise<TagRecord[]>;
  create(
    ownerId: string,
    input: { slug: string; english: string; portuguese: string; aliases: string[] },
  ): Promise<TagRecord>;
  merge(ownerId: string, sourceId: string, targetId: string): Promise<TagRecord>;
  update(
    ownerId: string,
    id: string,
    input: { slug: string; english: string; portuguese: string; aliases: string[] },
  ): Promise<TagRecord>;
}

export type AppDependencies = {
  resources: ResourceService;
  auth?: AuthService;
  discord?: DiscordClient;
  channels?: ChannelCoordinator;
  deliveries?: DeliveryCoordinator;
  enrichment?: EnrichmentCoordinator;
  tags?: TagCoordinator;
  publications?: PublicationCoordinator;
  allowedOrigins?: string[];
  requireAuth?: boolean;
  maxJsonBytes?: number;
  rateLimits?: RateLimitStore;
  rateLimitPolicies?: Partial<RateLimitPolicies>;
};
