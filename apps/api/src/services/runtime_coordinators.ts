import type { DeliverySnapshot, Resource } from "@fuscabot/contracts";
import type {
  ChannelCoordinator,
  ChannelRecord,
  DeliveryCoordinator,
  EnrichmentCoordinator,
} from "../app.ts";
import { compactEnrichmentInput } from "../domain/enrichment.ts";
import type { StoredChannel } from "../domain/discord_setup.ts";
import { EnrichmentPreparingError } from "../domain/durable_delivery.ts";
import type { DiscordClient } from "../integrations/discord_client.ts";
import type { ResourceRepository } from "../repositories/resource_repository.ts";
import type { DiscordSetupCoordinator } from "./discord_setup_coordinator.ts";
import type { DurableDeliveryCoordinator } from "./durable_delivery_coordinator.ts";
import type { EnrichmentService } from "./enrichment_service.ts";
import { formatDiscordSnapshot, snapshotPayload } from "./message_formatter.ts";

function assertOwner(actual: string, expected: string): void {
  if (actual !== expected) throw new Error("Workspace access denied");
}

export class RuntimeChannelCoordinator implements ChannelCoordinator {
  constructor(
    private readonly ownerId: string,
    private readonly workspaceId: string,
    private readonly setup: DiscordSetupCoordinator,
    private readonly discord: DiscordClient,
  ) {}

  async selectGuild(ownerId: string, guildId: string): Promise<ChannelRecord[]> {
    assertOwner(ownerId, this.ownerId);
    const guild = await this.discord.getGuild(guildId);
    await this.setup.selectGuild(this.workspaceId, {
      id: guild.id,
      name: guild.name,
      botUserId: "discord-bot",
    });
    return this.sync(ownerId, guildId);
  }

  async sync(ownerId: string, guildId?: string): Promise<ChannelRecord[]> {
    assertOwner(ownerId, this.ownerId);
    if (guildId) {
      const guild = await this.discord.getGuild(guildId);
      await this.setup.selectGuild(this.workspaceId, {
        id: guild.id,
        name: guild.name,
        botUserId: "discord-bot",
      });
    }
    const channels = guildId ? await this.discord.listGuildTextChannels(guildId) : [];
    return (await this.setup.sync(
      this.workspaceId,
      channels.map((channel) => ({
        discordChannelId: channel.id,
        name: channel.name,
        parentDiscordChannelId: channel.parent_id,
        parentName: null,
        topic: channel.topic,
      })),
    )).map(toChannelRecord);
  }

  async list(ownerId: string): Promise<ChannelRecord[]> {
    assertOwner(ownerId, this.ownerId);
    return (await this.setup.list(this.workspaceId)).map(toChannelRecord);
  }

  async update(
    ownerId: string,
    channelId: string,
    patch: {
      routingDescription?: string | null;
      isActiveForRouting?: boolean;
      isReadLater?: boolean;
    },
  ): Promise<ChannelRecord | null> {
    assertOwner(ownerId, this.ownerId);
    return toChannelRecord(await this.setup.update(this.workspaceId, channelId, patch));
  }
}

export class RuntimeEnrichmentCoordinator implements EnrichmentCoordinator {
  constructor(
    private readonly ownerId: string,
    private readonly workspaceId: string,
    private readonly resources: ResourceRepository,
    private readonly setup: DiscordSetupCoordinator,
    private readonly enrichment: EnrichmentService,
  ) {}

  async prepare(ownerId: string, resourceId: string): Promise<void> {
    assertOwner(ownerId, this.ownerId);
    const resource = await this.requireResource(resourceId);
    await this.enrichment.prepare(resourceId, await this.inputFor(resource));
  }

  async retry(ownerId: string, resourceId: string): Promise<unknown> {
    assertOwner(ownerId, this.ownerId);
    const resource = await this.requireResource(resourceId);
    return this.enrichment.prepare(resourceId, await this.inputFor(resource));
  }

  async get(ownerId: string, resourceId: string): Promise<unknown> {
    assertOwner(ownerId, this.ownerId);
    await this.requireResource(resourceId);
    return this.enrichment.requireState(resourceId);
  }

  private async requireResource(id: string): Promise<Resource> {
    const resource = await this.resources.findById(this.workspaceId, id);
    if (!resource) throw new Error("Resource not found");
    return resource;
  }

  private async inputFor(resource: Resource) {
    const channels = await this.setup.list(this.workspaceId);
    return compactEnrichmentInput({
      title: resource.title,
      url: resource.originalUrl,
      description: resource.description,
      selectedQuote: resource.selectedQuote,
      sourceLanguage: resource.sourceLanguage,
      outputLanguage: resource.outputLanguage,
      availableTags: resource.tags.map((tag) => ({
        slug: tag.slug,
        english: tag.labels.find((label) => label.language === "en")?.name ?? tag.slug,
        portuguese: tag.labels.find((label) => label.language === "pt-BR")?.name ?? tag.slug,
      })),
      availableChannels: channels.filter((channel) =>
        channel.availability === "available" && channel.isActiveForRouting
      ).map((channel) => ({
        id: channel.id,
        name: channel.name,
        routingDescription: channel.routingDescription,
      })),
    });
  }
}

export class RuntimeDeliveryCoordinator implements DeliveryCoordinator {
  constructor(
    private readonly ownerId: string,
    private readonly workspaceId: string,
    private readonly resources: ResourceRepository,
    private readonly setup: DiscordSetupCoordinator,
    private readonly delivery: DurableDeliveryCoordinator,
  ) {}

  async publish(
    ownerId: string,
    resourceId: string,
    input: { channelId?: string; kind: "share" | "read_later" },
  ): Promise<unknown> {
    assertOwner(ownerId, this.ownerId);
    const resource = await this.resources.findById(this.workspaceId, resourceId);
    if (!resource) throw new Error("Resource not found");
    if (resource.enrichmentStatus === "preparing") throw new EnrichmentPreparingError();
    const channels = await this.setup.list(this.workspaceId);
    const channel = input.channelId
      ? channels.find((candidate) => candidate.id === input.channelId)
      : channels.find((candidate) =>
        candidate.isReadLater && candidate.isActiveForRouting &&
        candidate.availability === "available"
      );
    const channelId = input.channelId ?? channel?.id;
    if (!channelId) throw new Error("Configure an active Read Later channel first");
    return this.delivery.publish(
      this.workspaceId,
      resourceId,
      channelId,
      input.kind,
      formatDiscordSnapshot(resource, input.kind, channel ? `#${channel.name}` : null),
    );
  }

  list(ownerId: string, resourceId: string): Promise<unknown[]> {
    assertOwner(ownerId, this.ownerId);
    return this.delivery.history(this.workspaceId, resourceId);
  }

  retry(ownerId: string, deliveryId: string): Promise<unknown> {
    assertOwner(ownerId, this.ownerId);
    return this.delivery.retry(this.workspaceId, deliveryId);
  }
}

export function discordSnapshotSender(discord: DiscordClient) {
  return {
    createChannelMessage(channelId: string, value: DeliverySnapshot) {
      return discord.createChannelMessage(channelId, snapshotPayload(value));
    },
  };
}

function toChannelRecord(channel: StoredChannel): ChannelRecord {
  return {
    id: channel.id,
    discordChannelId: channel.discordChannelId,
    name: channel.name,
    parentName: channel.parentName,
    discordTopic: channel.topic,
    routingDescription: channel.routingDescription,
    isActiveForRouting: channel.isActiveForRouting,
    isReadLater: channel.isReadLater,
    availability: channel.availability,
    lastSyncedAt: null,
  };
}
