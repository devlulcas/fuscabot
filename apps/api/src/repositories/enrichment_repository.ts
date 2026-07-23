import { and, count, desc, eq } from "drizzle-orm";
import { type EnrichmentDraft, EnrichmentDraftSchema } from "../../../../packages/contracts/mod.ts";
import type { AppDatabase } from "../db/client.ts";
import { enrichmentRuns, resources } from "../db/schema.ts";
import {
  ENRICHMENT_PROMPT_VERSION,
  type EnrichmentClaim,
  type EnrichmentInput,
  type EnrichmentState,
} from "../domain/enrichment.ts";
import type { EnrichmentStore } from "../services/enrichment_service.ts";

export class PostgresEnrichmentStore implements EnrichmentStore {
  constructor(private readonly db: AppDatabase, private readonly model: string) {}

  async get(resourceId: string): Promise<EnrichmentState | null> {
    const [run, attempts] = await Promise.all([
      this.db.select().from(enrichmentRuns).where(eq(enrichmentRuns.resourceId, resourceId))
        .orderBy(desc(enrichmentRuns.createdAt)).limit(1),
      this.db.select({ value: count() }).from(enrichmentRuns)
        .where(eq(enrichmentRuns.resourceId, resourceId)),
    ]);
    return run[0] ? toState(run[0], attempts[0]?.value ?? 0) : null;
  }

  async claim(resourceId: string, input?: EnrichmentInput): Promise<EnrichmentClaim> {
    const previous = await this.get(resourceId);
    if (previous?.status === "ready") return { state: previous, claimed: false };
    const snapshot = input ?? previous?.input;
    if (!snapshot) throw new Error(`Unknown enrichment resource: ${resourceId}`);
    const claimed = await this.db.transaction(async (tx) => {
      const [resource] = await tx.select({ status: resources.enrichmentStatus }).from(resources)
        .where(eq(resources.id, resourceId)).for("update").limit(1);
      if (!resource || resource.status === "ready") return null;
      const [run] = await tx.insert(enrichmentRuns).values({
        resourceId,
        model: this.model,
        promptVersion: ENRICHMENT_PROMPT_VERSION,
        inputSnapshot: structuredClone(snapshot),
        status: "preparing",
        retryable: false,
      }).onConflictDoNothing().returning();
      if (!run) return null;
      await tx.update(resources).set({
        enrichmentStatus: "preparing",
        enrichmentError: null,
        updatedAt: new Date(),
      }).where(eq(resources.id, resourceId));
      const [attempt] = await tx.select({ value: count() }).from(enrichmentRuns)
        .where(eq(enrichmentRuns.resourceId, resourceId));
      return toState(run, attempt?.value ?? 1);
    });
    if (claimed) return { state: claimed, claimed: true };
    const active = await this.get(resourceId);
    if (!active) throw new Error(`Unknown enrichment resource: ${resourceId}`);
    return { state: active, claimed: false };
  }

  async completeReady(resourceId: string, draft: EnrichmentDraft): Promise<EnrichmentState> {
    const parsed = EnrichmentDraftSchema.parse(draft);
    return await this.complete(resourceId, async (tx, now) => {
      const [current] = await tx.select({
        id: enrichmentRuns.id,
        createdAt: enrichmentRuns.createdAt,
      }).from(enrichmentRuns).where(and(
        eq(enrichmentRuns.resourceId, resourceId),
        eq(enrichmentRuns.status, "preparing"),
      )).for("update").limit(1);
      if (!current) return null;
      const [run] = await tx.update(enrichmentRuns).set({
        status: "ready",
        output: structuredClone(parsed),
        error: null,
        retryable: false,
        durationMs: elapsedMilliseconds(current.createdAt, now),
        updatedAt: now,
      }).where(eq(enrichmentRuns.id, current.id)).returning();
      if (!run) return null;
      await tx.update(resources).set({
        summary: parsed.summary,
        outputLanguage: parsed.outputLanguage,
        enrichmentStatus: "ready",
        enrichmentError: null,
        updatedAt: now,
      }).where(eq(resources.id, resourceId));
      return run;
    });
  }

  async completeFailed(
    resourceId: string,
    error: string,
    retryable: boolean,
  ): Promise<EnrichmentState> {
    const safeError = error.slice(0, 1_000);
    return await this.complete(resourceId, async (tx, now) => {
      const [current] = await tx.select({
        id: enrichmentRuns.id,
        createdAt: enrichmentRuns.createdAt,
      }).from(enrichmentRuns).where(and(
        eq(enrichmentRuns.resourceId, resourceId),
        eq(enrichmentRuns.status, "preparing"),
      )).for("update").limit(1);
      if (!current) return null;
      const [run] = await tx.update(enrichmentRuns).set({
        status: "failed",
        error: safeError,
        retryable,
        durationMs: elapsedMilliseconds(current.createdAt, now),
        updatedAt: now,
      }).where(eq(enrichmentRuns.id, current.id)).returning();
      if (!run) return null;
      await tx.update(resources).set({
        enrichmentStatus: "failed",
        enrichmentError: safeError,
        updatedAt: now,
      }).where(eq(resources.id, resourceId));
      return run;
    });
  }

  private async complete(
    resourceId: string,
    operation: (
      tx: Parameters<Parameters<AppDatabase["transaction"]>[0]>[0],
      now: Date,
    ) => Promise<typeof enrichmentRuns.$inferSelect | null>,
  ): Promise<EnrichmentState> {
    const result = await this.db.transaction(async (tx) => {
      const run = await operation(tx, new Date());
      if (!run) return null;
      const [attempt] = await tx.select({ value: count() }).from(enrichmentRuns)
        .where(eq(enrichmentRuns.resourceId, resourceId));
      return toState(run, attempt?.value ?? 1);
    });
    if (!result) throw new Error("Enrichment claim was lost");
    return result;
  }
}

function elapsedMilliseconds(startedAt: Date, completedAt: Date): number {
  return Math.max(0, completedAt.getTime() - startedAt.getTime());
}

function toState(row: typeof enrichmentRuns.$inferSelect, attempt: number): EnrichmentState {
  return {
    resourceId: row.resourceId,
    input: row.inputSnapshot as EnrichmentInput,
    status: row.status,
    attempt,
    draft: row.output === null ? null : EnrichmentDraftSchema.parse(row.output),
    error: row.error,
    retryable: row.retryable,
    promptVersion: row.promptVersion === ENRICHMENT_PROMPT_VERSION ? row.promptVersion : null,
  };
}
