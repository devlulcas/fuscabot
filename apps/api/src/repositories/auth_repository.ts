import { and, eq, gt, isNull } from "drizzle-orm";
import type { AppDatabase } from "../db/client.ts";
import { authSessions, oauthStates } from "../db/schema.ts";
import type { AuthPersistence } from "../services/auth_service.ts";

export class PostgresAuthRepository implements AuthPersistence {
  constructor(private readonly db: AppDatabase, private readonly workspaceId: string) {}

  async saveState(hash: string, expiresAt: Date): Promise<void> {
    await this.db.insert(oauthStates).values({
      stateHash: hash,
      codeVerifier: "server-oauth",
      expiresAt,
    });
  }

  async consumeState(hash: string, now: Date): Promise<boolean> {
    const rows = await this.db.update(oauthStates).set({ consumedAt: now }).where(and(
      eq(oauthStates.stateHash, hash),
      isNull(oauthStates.consumedAt),
      gt(oauthStates.expiresAt, now),
    )).returning({ id: oauthStates.id });
    return rows.length === 1;
  }

  async createSession(hash: string, expiresAt: Date, guildIds: string[]): Promise<string> {
    const [row] = await this.db.insert(authSessions).values({
      workspaceId: this.workspaceId,
      refreshTokenHash: hash,
      expiresAt,
      guildIds,
    }).returning({ id: authSessions.id });
    if (!row) throw new Error("Session creation returned no row");
    return row.id;
  }

  async rotateSession(
    id: string,
    previousHash: string,
    nextHash: string,
    expiresAt: Date,
    now: Date,
  ): Promise<string[] | null> {
    const [row] = await this.db.update(authSessions).set({
      refreshTokenHash: nextHash,
      expiresAt,
      updatedAt: now,
    }).where(and(
      eq(authSessions.id, id),
      eq(authSessions.refreshTokenHash, previousHash),
      isNull(authSessions.revokedAt),
      gt(authSessions.expiresAt, now),
    )).returning({ guildIds: authSessions.guildIds });
    return row?.guildIds ?? null;
  }

  async isSessionActive(id: string, now: Date): Promise<boolean> {
    const row = await this.db.select({ id: authSessions.id }).from(authSessions).where(and(
      eq(authSessions.id, id),
      isNull(authSessions.revokedAt),
      gt(authSessions.expiresAt, now),
    )).limit(1);
    return row.length === 1;
  }

  async revokeSession(id: string, now: Date): Promise<void> {
    await this.db.update(authSessions).set({ revokedAt: now, updatedAt: now }).where(and(
      eq(authSessions.id, id),
      isNull(authSessions.revokedAt),
    ));
  }
}
