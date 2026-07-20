import type { DeliverySnapshot } from "../../../../packages/contracts/mod.ts";
import {
  DeliveryConflictError,
  type DeliveryKind,
  type DeliveryRecord,
} from "../domain/durable_delivery.ts";
import type { QueryExecutor } from "./discord_setup_repository.ts";

type Row = {
  id: string;
  resource_id: string;
  channel_id: string;
  discord_channel_id: string;
  discord_guild_id: string;
  delivery_kind: DeliveryKind;
  message_snapshot: DeliverySnapshot;
  status: DeliveryRecord["status"];
  external_message_id: string | null;
  external_url: string | null;
  error: string | null;
  retry_of_delivery_id: string | null;
};
export class PostgresDurableDeliveryRepository {
  constructor(private readonly sql: QueryExecutor) {}
  async authorizeTarget(
    workspaceId: string,
    resourceId: string,
    channelId: string,
    kind: DeliveryKind,
  ) {
    const result = await this.sql.queryObject<
      { discord_channel_id: string; discord_guild_id: string }
    >(AUTHORIZE_TARGET_SQL, [workspaceId, resourceId, channelId, kind]);
    return result.rows[0] ?? null;
  }
  async createPending(
    resourceId: string,
    channelId: string,
    kind: DeliveryKind,
    snapshot: DeliverySnapshot,
    retryOf: string | null = null,
  ) {
    try {
      const result = await this.sql.queryObject<Row>(CREATE_PENDING_SQL, [
        resourceId,
        channelId,
        kind,
        JSON.stringify(snapshot),
        retryOf,
      ]);
      return map(result.rows[0]);
    } catch (error) {
      if (isUnique(error)) throw new DeliveryConflictError("A delivery is already pending or sent");
      throw error;
    }
  }
  async markSent(id: string, messageId: string, url: string) {
    return map((await this.sql.queryObject<Row>(MARK_SENT_SQL, [id, messageId, url])).rows[0]);
  }
  async markFailed(id: string, error: string) {
    return map(
      (await this.sql.queryObject<Row>(MARK_FAILED_SQL, [id, error.slice(0, 500)])).rows[0],
    );
  }
  async get(id: string) {
    const row = (await this.sql.queryObject<Row>(GET_DELIVERY_SQL, [id])).rows[0];
    return row ? map(row) : null;
  }
  async history(workspaceId: string, resourceId: string) {
    return (await this.sql.queryObject<Row>(HISTORY_SQL, [workspaceId, resourceId])).rows.map(map);
  }
}
const COLUMNS =
  `d.id,d.resource_id,d.channel_id,c.discord_channel_id,dc.discord_guild_id,d.delivery_kind,d.message_snapshot,d.status,d.external_message_id,d.external_url,d.error,d.retry_of_delivery_id`;
export const AUTHORIZE_TARGET_SQL =
  `SELECT c.discord_channel_id,dc.discord_guild_id FROM resources r JOIN channels c ON c.workspace_id=r.workspace_id JOIN discord_connections dc ON dc.id=c.discord_connection_id WHERE r.id=$2::uuid AND r.workspace_id=$1::uuid AND c.id=$3::uuid AND c.availability='available' AND c.is_active_for_routing AND dc.status='connected' AND ($4<>'read_later' OR c.is_read_later)`;
export const CREATE_PENDING_SQL =
  `INSERT INTO deliveries(resource_id,channel_id,destination_type,delivery_kind,message_snapshot,status,retry_of_delivery_id) VALUES($1::uuid,$2::uuid,'discord_channel',$3,$4::jsonb,'pending',$5::uuid) RETURNING id,resource_id,channel_id,'' AS discord_channel_id,'' AS discord_guild_id,delivery_kind,message_snapshot,status,external_message_id,external_url,error,retry_of_delivery_id`;
export const MARK_SENT_SQL =
  `UPDATE deliveries d SET status='sent',external_message_id=$2,external_url=$3,sent_at=now(),error=NULL,updated_at=now() FROM channels c JOIN discord_connections dc ON dc.id=c.discord_connection_id WHERE d.id=$1::uuid AND d.channel_id=c.id AND d.status='pending' RETURNING ${COLUMNS}`;
export const MARK_FAILED_SQL =
  `UPDATE deliveries d SET status='failed',error=$2,updated_at=now() FROM channels c JOIN discord_connections dc ON dc.id=c.discord_connection_id WHERE d.id=$1::uuid AND d.channel_id=c.id AND d.status='pending' RETURNING ${COLUMNS}`;
export const GET_DELIVERY_SQL =
  `SELECT ${COLUMNS} FROM deliveries d JOIN channels c ON c.id=d.channel_id JOIN discord_connections dc ON dc.id=c.discord_connection_id WHERE d.id=$1::uuid`;
export const HISTORY_SQL =
  `SELECT ${COLUMNS} FROM deliveries d JOIN resources r ON r.id=d.resource_id JOIN channels c ON c.id=d.channel_id JOIN discord_connections dc ON dc.id=c.discord_connection_id WHERE r.workspace_id=$1::uuid AND r.id=$2::uuid ORDER BY d.created_at DESC`;
function map(row: Row | undefined): DeliveryRecord {
  if (!row) throw new Error("Delivery state transition was lost");
  return {
    id: row.id,
    resourceId: row.resource_id,
    channelId: row.channel_id,
    discordChannelId: row.discord_channel_id,
    guildId: row.discord_guild_id,
    kind: row.delivery_kind,
    snapshot: row.message_snapshot,
    status: row.status,
    externalMessageId: row.external_message_id,
    externalUrl: row.external_url,
    error: row.error,
    retryOfDeliveryId: row.retry_of_delivery_id,
  };
}
function isUnique(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
