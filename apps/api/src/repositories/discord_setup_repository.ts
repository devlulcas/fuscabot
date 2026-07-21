import { and, asc, eq, ne, notInArray } from "drizzle-orm";
import type { AppDatabase } from "../db/client.ts";
import { channels, discordConnections, workspaces } from "../db/schema.ts";
import type { ChannelPatch, ImportedTextChannel, StoredChannel } from "../domain/discord_setup.ts";

export class PostgresDiscordSetupRepository {
  constructor(private readonly db: AppDatabase) {}

  async bootstrapOwner(ownerDiscordUserId: string, name = "Fuscabot"): Promise<string> {
    const [row] = await this.db.insert(workspaces).values({ ownerDiscordUserId, name })
      .onConflictDoUpdate({
        target: workspaces.ownerDiscordUserId,
        set: { updatedAt: new Date() },
      }).returning({ id: workspaces.id });
    if (!row) throw new Error("Workspace bootstrap returned no row");
    return row.id;
  }

  async selectGuild(
    workspaceId: string,
    guild: { id: string; name: string; botUserId: string },
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.update(discordConnections).set({ status: "disconnected", updatedAt: new Date() })
        .where(and(
          eq(discordConnections.workspaceId, workspaceId),
          ne(discordConnections.discordGuildId, guild.id),
          eq(discordConnections.status, "connected"),
        ));
      await tx.insert(discordConnections).values({
        workspaceId,
        discordGuildId: guild.id,
        guildName: guild.name,
        botUserId: guild.botUserId,
        status: "connected",
      }).onConflictDoUpdate({
        target: [discordConnections.workspaceId, discordConnections.discordGuildId],
        set: {
          guildName: guild.name,
          botUserId: guild.botUserId,
          status: "connected",
          updatedAt: new Date(),
        },
      });
    });
  }

  async syncChannels(
    workspaceId: string,
    imported: ImportedTextChannel[],
  ): Promise<StoredChannel[]> {
    await this.db.transaction(async (tx) => {
      const [connection] = await tx.select({ id: discordConnections.id }).from(discordConnections)
        .where(and(
          eq(discordConnections.workspaceId, workspaceId),
          eq(discordConnections.status, "connected"),
        )).limit(1);
      if (!connection) throw new Error("Discord guild is not selected");
      const now = new Date();
      for (const channel of imported) {
        await tx.insert(channels).values({
          workspaceId,
          discordConnectionId: connection.id,
          discordChannelId: channel.discordChannelId,
          name: channel.name,
          parentDiscordChannelId: channel.parentDiscordChannelId,
          parentName: channel.parentName,
          discordTopic: channel.topic,
          availability: "available",
          lastSyncedAt: now,
        }).onConflictDoUpdate({
          target: [channels.workspaceId, channels.discordChannelId],
          set: {
            discordConnectionId: connection.id,
            name: channel.name,
            parentDiscordChannelId: channel.parentDiscordChannelId,
            parentName: channel.parentName,
            discordTopic: channel.topic,
            availability: "available",
            lastSyncedAt: now,
            updatedAt: now,
          },
        });
      }
      const seen = imported.map((channel) => channel.discordChannelId);
      await tx.update(channels).set({
        availability: "unavailable",
        isActiveForRouting: false,
        isReadLater: false,
        updatedAt: now,
      }).where(and(
        eq(channels.workspaceId, workspaceId),
        seen.length ? notInArray(channels.discordChannelId, seen) : undefined,
      ));
      const [workspace] = await tx.select({ readLaterChannelId: workspaces.readLaterChannelId })
        .from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
      if (workspace?.readLaterChannelId) {
        const available = await tx.select({ id: channels.id }).from(channels).where(and(
          eq(channels.workspaceId, workspaceId),
          eq(channels.id, workspace.readLaterChannelId),
          eq(channels.availability, "available"),
        )).limit(1);
        if (!available[0]) {
          await tx.update(workspaces).set({ readLaterChannelId: null, updatedAt: now })
            .where(eq(workspaces.id, workspaceId));
        }
      }
    });
    return await this.listChannels(workspaceId);
  }

  async listChannels(workspaceId: string): Promise<StoredChannel[]> {
    const rows = await this.db.select().from(channels).where(eq(channels.workspaceId, workspaceId))
      .orderBy(asc(channels.name));
    return rows.map(mapChannel);
  }

  async updateChannel(
    workspaceId: string,
    channelId: string,
    patch: ChannelPatch,
  ): Promise<StoredChannel | null> {
    return await this.db.transaction(async (tx) => {
      const [current] = await tx.select().from(channels).where(and(
        eq(channels.workspaceId, workspaceId),
        eq(channels.id, channelId),
        eq(channels.availability, "available"),
      )).limit(1);
      if (!current) return null;
      const nextActive = patch.isActiveForRouting ?? current.isActiveForRouting;
      const nextReadLater = patch.isReadLater === undefined
        ? current.isReadLater && nextActive
        : patch.isReadLater && nextActive;
      if (patch.isReadLater && !nextActive) return null;
      if (nextReadLater) {
        await tx.update(channels).set({ isReadLater: false, updatedAt: new Date() }).where(and(
          eq(channels.workspaceId, workspaceId),
          ne(channels.id, channelId),
          eq(channels.isReadLater, true),
        ));
      }
      const [row] = await tx.update(channels).set({
        ...(patch.routingDescription === undefined
          ? {}
          : { routingDescription: patch.routingDescription }),
        isActiveForRouting: nextActive,
        isReadLater: nextReadLater,
        updatedAt: new Date(),
      }).where(and(eq(channels.workspaceId, workspaceId), eq(channels.id, channelId)))
        .returning();
      await tx.update(workspaces).set({
        readLaterChannelId: nextReadLater ? channelId : null,
        updatedAt: new Date(),
      }).where(and(
        eq(workspaces.id, workspaceId),
        nextReadLater ? undefined : eq(workspaces.readLaterChannelId, channelId),
      ));
      return row ? mapChannel(row) : null;
    });
  }
}

function mapChannel(row: typeof channels.$inferSelect): StoredChannel {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    discordChannelId: row.discordChannelId,
    name: row.name,
    parentDiscordChannelId: row.parentDiscordChannelId,
    parentName: row.parentName,
    topic: row.discordTopic,
    routingDescription: row.routingDescription,
    isActiveForRouting: row.isActiveForRouting,
    isReadLater: row.isReadLater,
    availability: row.availability as "available" | "unavailable",
  };
}
