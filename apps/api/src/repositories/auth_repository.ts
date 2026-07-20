import type { QueryExecutor } from "./discord_setup_repository.ts";
import type { AuthPersistence } from "../services/auth_service.ts";

export class PostgresAuthRepository implements AuthPersistence {
  constructor(private readonly sql: QueryExecutor, private readonly workspaceId: string) {}

  async saveState(hash: string, expiresAt: Date): Promise<void> {
    await this.sql.queryObject(
      `INSERT INTO oauth_states(state_hash,code_verifier,expires_at) VALUES($1,'server-oauth', $2)`,
      [hash, expiresAt],
    );
  }

  async consumeState(hash: string, now: Date): Promise<boolean> {
    const result = await this.sql.queryObject<{ id: string }>(
      `UPDATE oauth_states SET consumed_at=$2 WHERE state_hash=$1 AND consumed_at IS NULL AND expires_at>$2 RETURNING id`,
      [hash, now],
    );
    return result.rows.length === 1;
  }

  async createSession(hash: string, expiresAt: Date, guildIds: string[]): Promise<string> {
    const result = await this.sql.queryObject<{ id: string }>(
      `INSERT INTO auth_sessions(workspace_id,refresh_token_hash,expires_at,guild_ids) VALUES($1::uuid,$2,$3,$4::text[]) RETURNING id`,
      [this.workspaceId, hash, expiresAt, guildIds],
    );
    return result.rows[0].id;
  }

  async rotateSession(
    id: string,
    previousHash: string,
    nextHash: string,
    expiresAt: Date,
    now: Date,
  ): Promise<string[] | null> {
    const result = await this.sql.queryObject<{ guild_ids: string[] }>(
      `UPDATE auth_sessions SET refresh_token_hash=$3,expires_at=$4,updated_at=$5 WHERE id=$1::uuid AND refresh_token_hash=$2 AND revoked_at IS NULL AND expires_at>$5 RETURNING guild_ids`,
      [id, previousHash, nextHash, expiresAt, now],
    );
    return result.rows[0]?.guild_ids ?? null;
  }

  async isSessionActive(id: string, now: Date): Promise<boolean> {
    const result = await this.sql.queryObject<{ active: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM auth_sessions WHERE id=$1::uuid AND revoked_at IS NULL AND expires_at>$2) AS active`,
      [id, now],
    );
    return result.rows[0]?.active === true;
  }

  async revokeSession(id: string, now: Date): Promise<void> {
    await this.sql.queryObject(
      `UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,$2),updated_at=$2 WHERE id=$1::uuid`,
      [id, now],
    );
  }
}
