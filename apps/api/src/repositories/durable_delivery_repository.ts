import { and, desc, eq } from "drizzle-orm";
import type { DeliverySnapshot } from "../../../../packages/contracts/mod.ts";
import type { AppDatabase } from "../db/client.ts";
import { channels, deliveries, discordConnections, resources } from "../db/schema.ts";
import {
  DeliveryConflictError,
  type DeliveryKind,
  type DeliveryRecord,
} from "../domain/durable_delivery.ts";

export class PostgresDurableDeliveryRepository {
  constructor(private readonly db: AppDatabase) {}

  async authorizeTarget(
    workspaceId: string,
    resourceId: string,
    channelId: string,
    kind: DeliveryKind,
  ) {
    const [row] = await this.db.select({
      discord_channel_id: channels.discordChannelId,
      discord_guild_id: discordConnections.discordGuildId,
    }).from(resources)
      .innerJoin(channels, eq(channels.workspaceId, resources.workspaceId))
      .innerJoin(discordConnections, eq(discordConnections.id, channels.discordConnectionId))
      .where(and(
        eq(resources.id, resourceId),
        eq(resources.workspaceId, workspaceId),
        eq(channels.id, channelId),
        eq(channels.availability, "available"),
        eq(channels.isActiveForRouting, true),
        eq(discordConnections.status, "connected"),
        kind === "read_later" ? eq(channels.isReadLater, true) : undefined,
      )).limit(1);
    return row ?? null;
  }

  async createPending(
    resourceId: string,
    channelId: string,
    kind: DeliveryKind,
    snapshot: DeliverySnapshot,
    retryOf: string | null = null,
  ) {
    try {
      const [row] = await this.db.insert(deliveries).values({
        resourceId,
        channelId,
        destinationType: "discord_channel",
        deliveryKind: kind,
        messageSnapshot: structuredClone(snapshot),
        status: "pending",
        retryOfDeliveryId: retryOf,
      }).returning();
      if (!row) throw new Error("Pending delivery creation returned no row");
      return map(row, "", "");
    } catch (error) {
      if (isUnique(error)) throw new DeliveryConflictError("A delivery is already active");
      throw error;
    }
  }

  markSent(id: string, messageId: string, url: string) {
    return this.transition(id, {
      status: "sent",
      externalMessageId: messageId,
      externalUrl: url,
      sentAt: new Date(),
      error: null,
    });
  }

  markFailed(id: string, error: string) {
    return this.transition(id, { status: "failed", error: error.slice(0, 500) });
  }

  markUnknown(id: string, error: string) {
    return this.transition(id, { status: "unknown", error: error.slice(0, 500) });
  }

  async get(workspaceId: string, id: string) {
    const rows = await this.joined(and(
      eq(resources.workspaceId, workspaceId),
      eq(deliveries.id, id),
    ));
    return rows[0] ?? null;
  }

  async history(workspaceId: string, resourceId: string) {
    return await this.joined(
      and(
        eq(resources.workspaceId, workspaceId),
        eq(resources.id, resourceId),
      ),
      true,
    );
  }

  private async transition(
    id: string,
    patch: Partial<typeof deliveries.$inferInsert>,
  ): Promise<DeliveryRecord> {
    return await this.db.transaction(async (tx) => {
      const [row] = await tx.update(deliveries).set({ ...patch, updatedAt: new Date() }).where(and(
        eq(deliveries.id, id),
        eq(deliveries.status, "pending"),
      )).returning();
      if (!row) throw new Error("Delivery state transition was lost");
      const [channel] = await tx.select({
        discordChannelId: channels.discordChannelId,
        guildId: discordConnections.discordGuildId,
      }).from(channels)
        .innerJoin(discordConnections, eq(discordConnections.id, channels.discordConnectionId))
        .where(eq(channels.id, row.channelId!)).limit(1);
      if (!channel) throw new Error("Delivery channel could not be loaded");
      return map(row, channel.discordChannelId, channel.guildId);
    });
  }

  private async joined(predicate: ReturnType<typeof and>, newestFirst = false) {
    const query = this.db.select({
      delivery: deliveries,
      discordChannelId: channels.discordChannelId,
      guildId: discordConnections.discordGuildId,
    }).from(deliveries)
      .innerJoin(resources, eq(resources.id, deliveries.resourceId))
      .innerJoin(channels, eq(channels.id, deliveries.channelId))
      .innerJoin(discordConnections, eq(discordConnections.id, channels.discordConnectionId))
      .where(predicate);
    const rows = newestFirst ? await query.orderBy(desc(deliveries.createdAt)) : await query;
    return rows.map((row) => map(row.delivery, row.discordChannelId, row.guildId));
  }
}

function map(
  row: typeof deliveries.$inferSelect,
  discordChannelId: string,
  guildId: string,
): DeliveryRecord {
  return {
    id: row.id,
    resourceId: row.resourceId,
    channelId: row.channelId!,
    discordChannelId,
    guildId,
    kind: row.deliveryKind as DeliveryKind,
    snapshot: row.messageSnapshot as DeliverySnapshot,
    status: row.status as DeliveryRecord["status"],
    externalMessageId: row.externalMessageId,
    externalUrl: row.externalUrl,
    error: row.error,
    retryOfDeliveryId: row.retryOfDeliveryId,
  };
}

function isUnique(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
