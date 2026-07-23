import type { DiscordClient } from "./integrations/discord_client.ts";
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
  get(ownerId: string, resourceId: string): Promise<unknown>;
}

export interface TagCoordinator {
  list(ownerId: string, search?: string): Promise<unknown[]>;
  create(
    ownerId: string,
    input: { slug: string; english: string; portuguese: string; aliases: string[] },
  ): Promise<unknown>;
  merge(ownerId: string, sourceId: string, targetId: string): Promise<unknown>;
  update(
    ownerId: string,
    id: string,
    input: { slug: string; english: string; portuguese: string; aliases: string[] },
  ): Promise<unknown>;
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
