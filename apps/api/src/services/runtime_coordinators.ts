import type { DeliverySnapshot, Resource } from "@fuscabot/contracts";
import type {
  ChannelCoordinator,
  ChannelRecord,
  DeliveryCoordinator,
  EnrichmentCoordinator,
} from "../app.ts";
import { compactEnrichmentInput } from "../domain/enrichment.ts";
import type { StoredChannel } from "../domain/discord_setup.ts";
import type { DiscordClient, DiscordMessagePayload } from "../integrations/discord_client.ts";
import type { ResourceRepository } from "../repositories/resource_repository.ts";
import type { DiscordSetupCoordinator } from "./discord_setup_coordinator.ts";
import type { DurableDeliveryCoordinator } from "./durable_delivery_coordinator.ts";
import type { EnrichmentService } from "./enrichment_service.ts";

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
    const channels = await this.setup.list(this.workspaceId);
    await this.enrichment.prepare(
      resourceId,
      compactEnrichmentInput({
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
      }),
    );
  }

  async retry(ownerId: string, resourceId: string): Promise<unknown> {
    assertOwner(ownerId, this.ownerId);
    await this.requireResource(resourceId);
    return this.enrichment.retry(resourceId);
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
    const channelId = input.channelId ??
      (await this.setup.list(this.workspaceId)).find((channel) =>
        channel.isReadLater && channel.isActiveForRouting && channel.availability === "available"
      )?.id;
    if (!channelId) throw new Error("Configure an active Read Later channel first");
    return this.delivery.publish(
      this.workspaceId,
      resourceId,
      channelId,
      input.kind,
      snapshot(resource, input.kind),
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

function snapshot(resource: Resource, kind: "share" | "read_later"): DeliverySnapshot {
  return {
    title: resource.title.slice(0, 256),
    url: resource.originalUrl,
    summary: resource.summary,
    whyUseful: resource.whyUseful,
    personalNote: resource.personalNote,
    selectedQuote: resource.selectedQuote,
    includeQuote: Boolean(resource.selectedQuote),
    tags: resource.tags.map((tag) => tag.slug).slice(0, 8),
    outputLanguage: resource.outputLanguage,
    ...(kind === "read_later" ? { whyUseful: null, tags: [] } : {}),
  };
}

function snapshotPayload(value: DeliverySnapshot): DiscordMessagePayload {
  const fields: Array<{ name: string; value: string }> = [];
  const useful = value.personalNote ?? value.whyUseful;
  if (useful) fields.push({ name: "Por que é útil", value: useful.slice(0, 1_024) });
  if (value.includeQuote && value.selectedQuote) {
    fields.push({ name: "Contexto", value: `“${value.selectedQuote}”`.slice(0, 1_024) });
  }
  if (value.tags.length) {
    fields.push({ name: "Tags", value: value.tags.join(" · ").slice(0, 1_024) });
  }
  return {
    embeds: [{
      title: value.title,
      url: value.url,
      ...(value.summary ? { description: value.summary.slice(0, 4_096) } : {}),
      ...(fields.length ? { fields } : {}),
    }],
    allowed_mentions: { parse: [] },
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
