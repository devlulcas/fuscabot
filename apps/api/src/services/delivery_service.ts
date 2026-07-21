import type { DeliveryKind } from "../domain/delivery.ts";
import type { DiscordClient } from "../integrations/discord_client.ts";
import type { DeliveryRepository } from "../repositories/delivery_repository.ts";
import type { ResourceRepository } from "../repositories/resource_repository.ts";
import { formatDiscordSnapshot } from "./message_formatter.ts";

export type DeliveryTarget = {
  workspaceId: string;
  channelId: string;
  discordChannelId: string;
  guildId: string;
};

export class DeliveryService {
  constructor(
    private resources: ResourceRepository,
    private deliveries: DeliveryRepository,
    private discord: Pick<DiscordClient, "createChannelMessage">,
  ) {}
  async publish(
    resourceId: string,
    target: DeliveryTarget,
    kind: DeliveryKind,
  ) {
    const resource = await this.resources.findById(target.workspaceId, resourceId);
    if (!resource) throw new ResourceForDeliveryNotFoundError();
    const snapshot = formatDiscordSnapshot(resource, kind, null);
    const pending = await this.deliveries.createPending({
      resourceId,
      channelId: target.channelId,
      discordChannelId: target.discordChannelId,
      kind,
      snapshot,
    });
    try {
      const message = await this.discord.createChannelMessage(
        target.discordChannelId,
        snapshot.payload,
      );
      const url =
        `https://discord.com/channels/${target.guildId}/${target.discordChannelId}/${message.id}`;
      return await this.deliveries.markSent(pending.id, message.id, url);
    } catch (cause) {
      const safe = cause instanceof Error ? cause.message.slice(0, 500) : "Discord delivery failed";
      await this.deliveries.markFailed(pending.id, safe);
      throw new DeliveryFailedError(pending.id, safe);
    }
  }
}
export class ResourceForDeliveryNotFoundError extends Error {}
export class DeliveryFailedError extends Error {
  constructor(readonly deliveryId: string, message: string) {
    super(message);
  }
}
