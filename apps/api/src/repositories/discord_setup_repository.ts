import type { ChannelPatch, ImportedTextChannel, StoredChannel } from "../domain/discord_setup.ts";

export interface QueryExecutor {
  queryObject<T>(sql: string, args?: unknown[]): Promise<{ rows: T[] }>;
}
export interface TransactionalQuery extends QueryExecutor {
  transaction<T>(work: (sql: QueryExecutor) => Promise<T>): Promise<T>;
}

type WorkspaceRow = { id: string };
type ChannelRow = {
  id: string;
  workspace_id: string;
  discord_channel_id: string;
  name: string;
  parent_discord_channel_id: string | null;
  parent_name: string | null;
  discord_topic: string | null;
  routing_description: string | null;
  is_active_for_routing: boolean;
  is_read_later: boolean;
  availability: "available" | "unavailable";
};

export class PostgresDiscordSetupRepository {
  constructor(private readonly db: TransactionalQuery) {}

  async bootstrapOwner(ownerDiscordUserId: string, name = "Fuscabot"): Promise<string> {
    const result = await this.db.queryObject<WorkspaceRow>(BOOTSTRAP_WORKSPACE_SQL, [
      ownerDiscordUserId,
      name,
    ]);
    return result.rows[0].id;
  }

  async selectGuild(
    workspaceId: string,
    guild: { id: string; name: string; botUserId: string },
  ): Promise<void> {
    await this.db.transaction(async (sql) => {
      await sql.queryObject(DISCONNECT_GUILDS_SQL, [workspaceId, guild.id]);
      await sql.queryObject(SELECT_GUILD_SQL, [workspaceId, guild.id, guild.name, guild.botUserId]);
    });
  }

  async syncChannels(
    workspaceId: string,
    channels: ImportedTextChannel[],
  ): Promise<StoredChannel[]> {
    return await this.db.transaction(async (sql) => {
      const connection = await sql.queryObject<{ id: string }>(ACTIVE_CONNECTION_SQL, [
        workspaceId,
      ]);
      if (!connection.rows[0]) throw new Error("Discord guild is not selected");
      const seen: string[] = [];
      for (const channel of channels) {
        seen.push(channel.discordChannelId);
        await sql.queryObject(UPSERT_CHANNEL_SQL, [
          workspaceId,
          connection.rows[0].id,
          channel.discordChannelId,
          channel.name,
          channel.parentDiscordChannelId,
          channel.parentName,
          channel.topic,
        ]);
      }
      await sql.queryObject(MARK_MISSING_SQL, [workspaceId, seen]);
      await sql.queryObject(CLEAR_UNAVAILABLE_READ_LATER_SQL, [workspaceId]);
      return (await sql.queryObject<ChannelRow>(LIST_CHANNELS_SQL, [workspaceId])).rows.map(
        mapChannel,
      );
    });
  }

  async listChannels(workspaceId: string): Promise<StoredChannel[]> {
    return (await this.db.queryObject<ChannelRow>(LIST_CHANNELS_SQL, [workspaceId])).rows.map(
      mapChannel,
    );
  }

  async updateChannel(
    workspaceId: string,
    channelId: string,
    patch: ChannelPatch,
  ): Promise<StoredChannel | null> {
    return await this.db.transaction(async (sql) => {
      if (patch.isReadLater) await sql.queryObject(CLEAR_READ_LATER_SQL, [workspaceId, channelId]);
      const result = await sql.queryObject<ChannelRow>(UPDATE_CHANNEL_SQL, [
        workspaceId,
        channelId,
        patch.routingDescription ?? null,
        patch.routingDescription !== undefined,
        patch.isActiveForRouting ?? false,
        patch.isActiveForRouting !== undefined,
        patch.isReadLater ?? false,
        patch.isReadLater !== undefined,
      ]);
      const row = result.rows[0];
      if (row?.is_read_later) {
        await sql.queryObject(SET_WORKSPACE_READ_LATER_SQL, [workspaceId, channelId]);
      }
      if (!row?.is_read_later) {
        await sql.queryObject(CLEAR_WORKSPACE_READ_LATER_SQL, [workspaceId, channelId]);
      }
      return row ? mapChannel(row) : null;
    });
  }
}

export const BOOTSTRAP_WORKSPACE_SQL =
  `INSERT INTO workspaces (owner_discord_user_id, name) VALUES ($1,$2) ON CONFLICT (owner_discord_user_id) DO UPDATE SET updated_at=now() RETURNING id`;
export const DISCONNECT_GUILDS_SQL =
  `UPDATE discord_connections SET status='disconnected', updated_at=now() WHERE workspace_id=$1::uuid AND discord_guild_id<>$2 AND status='connected'`;
export const SELECT_GUILD_SQL =
  `INSERT INTO discord_connections (workspace_id,discord_guild_id,guild_name,bot_user_id,status) VALUES ($1::uuid,$2,$3,$4,'connected') ON CONFLICT (workspace_id,discord_guild_id) DO UPDATE SET guild_name=excluded.guild_name,bot_user_id=excluded.bot_user_id,status='connected',updated_at=now()`;
export const ACTIVE_CONNECTION_SQL =
  `SELECT id FROM discord_connections WHERE workspace_id=$1::uuid AND status='connected' LIMIT 1`;
export const UPSERT_CHANNEL_SQL =
  `INSERT INTO channels (workspace_id,discord_connection_id,discord_channel_id,name,parent_discord_channel_id,parent_name,discord_topic,availability,last_synced_at) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,'available',now()) ON CONFLICT (workspace_id,discord_channel_id) DO UPDATE SET discord_connection_id=excluded.discord_connection_id,name=excluded.name,parent_discord_channel_id=excluded.parent_discord_channel_id,parent_name=excluded.parent_name,discord_topic=excluded.discord_topic,availability='available',last_synced_at=now(),updated_at=now()`;
export const MARK_MISSING_SQL =
  `UPDATE channels SET availability='unavailable',is_active_for_routing=false,is_read_later=false,updated_at=now() WHERE workspace_id=$1::uuid AND NOT (discord_channel_id=ANY($2::text[]))`;
export const CLEAR_UNAVAILABLE_READ_LATER_SQL =
  `UPDATE workspaces w SET read_later_channel_id=NULL,updated_at=now() WHERE w.id=$1::uuid AND EXISTS (SELECT 1 FROM channels c WHERE c.id=w.read_later_channel_id AND c.availability='unavailable')`;
export const LIST_CHANNELS_SQL =
  `SELECT id,workspace_id,discord_channel_id,name,parent_discord_channel_id,parent_name,discord_topic,routing_description,is_active_for_routing,is_read_later,availability FROM channels WHERE workspace_id=$1::uuid ORDER BY name`;
export const CLEAR_READ_LATER_SQL =
  `UPDATE channels SET is_read_later=false,updated_at=now() WHERE workspace_id=$1::uuid AND id<>$2::uuid AND is_read_later`;
export const UPDATE_CHANNEL_SQL =
  `UPDATE channels SET routing_description=CASE WHEN $4 THEN $3 ELSE routing_description END,is_active_for_routing=CASE WHEN $6 THEN $5 ELSE is_active_for_routing END,is_read_later=CASE WHEN $6 AND NOT $5 THEN false WHEN $8 THEN $7 ELSE is_read_later END,updated_at=now() WHERE workspace_id=$1::uuid AND id=$2::uuid AND availability='available' AND (NOT $7 OR ($5 OR (NOT $6 AND is_active_for_routing))) RETURNING id,workspace_id,discord_channel_id,name,parent_discord_channel_id,parent_name,discord_topic,routing_description,is_active_for_routing,is_read_later,availability`;
export const SET_WORKSPACE_READ_LATER_SQL =
  `UPDATE workspaces SET read_later_channel_id=$2::uuid,updated_at=now() WHERE id=$1::uuid`;
export const CLEAR_WORKSPACE_READ_LATER_SQL =
  `UPDATE workspaces SET read_later_channel_id=NULL,updated_at=now() WHERE id=$1::uuid AND read_later_channel_id=$2::uuid`;

function mapChannel(row: ChannelRow): StoredChannel {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    discordChannelId: row.discord_channel_id,
    name: row.name,
    parentDiscordChannelId: row.parent_discord_channel_id,
    parentName: row.parent_name,
    topic: row.discord_topic,
    routingDescription: row.routing_description,
    isActiveForRouting: row.is_active_for_routing,
    isReadLater: row.is_read_later,
    availability: row.availability,
  };
}
