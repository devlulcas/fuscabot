import type { DeliverySnapshot } from "../../../../packages/contracts/mod.ts";
import {
  type DeliveryKind,
  DeliveryNotRetryableError,
  type DeliveryRecord,
  DeliveryTargetNotAllowedError,
} from "../domain/durable_delivery.ts";
import { DiscordApiError } from "../integrations/discord_client.ts";

export interface DurableDeliveryStore {
  authorizeTarget(
    workspaceId: string,
    resourceId: string,
    channelId: string,
    kind: DeliveryKind,
  ): Promise<{ discord_channel_id: string; discord_guild_id: string } | null>;
  createPending(
    resourceId: string,
    channelId: string,
    kind: DeliveryKind,
    snapshot: DeliverySnapshot,
    retryOf?: string | null,
  ): Promise<DeliveryRecord>;
  markSent(id: string, messageId: string, url: string): Promise<DeliveryRecord>;
  markFailed(id: string, error: string): Promise<DeliveryRecord>;
  markUnknown(id: string, error: string): Promise<DeliveryRecord>;
  get(workspaceId: string, id: string): Promise<DeliveryRecord | null>;
  history(workspaceId: string, resourceId: string): Promise<DeliveryRecord[]>;
}
export interface DiscordSender {
  createChannelMessage(channelId: string, snapshot: DeliverySnapshot): Promise<{ id: string }>;
}
export class DurableDeliveryCoordinator {
  constructor(
    private readonly store: DurableDeliveryStore,
    private readonly discord: DiscordSender,
  ) {}
  async publish(
    workspaceId: string,
    resourceId: string,
    channelId: string,
    kind: DeliveryKind,
    snapshot: DeliverySnapshot,
    retryOf: string | null = null,
  ) {
    const target = await this.store.authorizeTarget(workspaceId, resourceId, channelId, kind);
    if (!target) throw new DeliveryTargetNotAllowedError();
    const pending = await this.store.createPending(
      resourceId,
      channelId,
      kind,
      structuredClone(snapshot),
      retryOf,
    );
    let message: { id: string };
    try {
      message = await this.discord.createChannelMessage(
        target.discord_channel_id,
        pending.snapshot,
      );
    } catch (cause) {
      if (cause instanceof DiscordApiError && cause.outcome === "unknown") {
        await this.store.markUnknown(pending.id, "Discord delivery outcome is unknown");
      } else {
        await this.store.markFailed(pending.id, "Discord delivery failed");
      }
      throw cause;
    }
    const url =
      `https://discord.com/channels/${target.discord_guild_id}/${target.discord_channel_id}/${message.id}`;
    return await this.store.markSent(pending.id, message.id, url);
  }
  async retry(workspaceId: string, deliveryId: string) {
    const failed = await this.store.get(workspaceId, deliveryId);
    if (!failed || failed.status !== "failed") throw new DeliveryNotRetryableError();
    return await this.publish(
      workspaceId,
      failed.resourceId,
      failed.channelId,
      failed.kind,
      failed.snapshot,
      failed.id,
    );
  }
  history(workspaceId: string, resourceId: string) {
    return this.store.history(workspaceId, resourceId);
  }
}
