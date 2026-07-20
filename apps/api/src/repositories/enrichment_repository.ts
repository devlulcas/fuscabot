import { type EnrichmentDraft, EnrichmentDraftSchema } from "../../../../packages/contracts/mod.ts";
import {
  ENRICHMENT_PROMPT_VERSION,
  type EnrichmentClaim,
  type EnrichmentInput,
  type EnrichmentState,
} from "../domain/enrichment.ts";
import type { EnrichmentStore } from "../services/enrichment_service.ts";

export interface SqlQuery {
  queryObject<T>(sql: string, args?: unknown[]): Promise<{ rows: T[] }>;
}

type RunRow = {
  resource_id: string;
  input_snapshot: EnrichmentInput;
  output: unknown;
  status: "preparing" | "ready" | "failed";
  error: string | null;
  retryable: boolean;
  prompt_version: string;
  attempt: number;
  claimed?: boolean;
};

/** PostgreSQL implementation. Each mutating statement atomically updates the run and resource. */
export class PostgresEnrichmentStore implements EnrichmentStore {
  constructor(private readonly sql: SqlQuery, private readonly model: string) {}

  async get(resourceId: string): Promise<EnrichmentState | null> {
    const result = await this.sql.queryObject<RunRow>(LATEST_RUN_SQL, [resourceId]);
    return result.rows[0] ? toState(result.rows[0]) : null;
  }

  async claim(resourceId: string, input?: EnrichmentInput): Promise<EnrichmentClaim> {
    const previous = await this.get(resourceId);
    if (previous?.status === "ready") return { state: previous, claimed: false };
    const snapshot = input ?? previous?.input;
    if (!snapshot) throw new Error(`Unknown enrichment resource: ${resourceId}`);
    const result = await this.sql.queryObject<RunRow>(CLAIM_RUN_SQL, [
      resourceId,
      this.model,
      ENRICHMENT_PROMPT_VERSION,
      JSON.stringify(snapshot),
    ]);
    const row = result.rows[0];
    if (row) return { state: toState({ ...row, claimed: true }), claimed: true };
    const active = await this.get(resourceId);
    if (!active) throw new Error(`Unknown enrichment resource: ${resourceId}`);
    return { state: active, claimed: false };
  }

  async completeReady(resourceId: string, draft: EnrichmentDraft): Promise<EnrichmentState> {
    const parsed = EnrichmentDraftSchema.parse(draft);
    const result = await this.sql.queryObject<RunRow>(COMPLETE_READY_SQL, [
      resourceId,
      JSON.stringify(parsed),
      parsed.summary,
      parsed.whyUseful,
      parsed.outputLanguage,
    ]);
    return completed(result.rows[0]);
  }

  async completeFailed(
    resourceId: string,
    error: string,
    retryable: boolean,
  ): Promise<EnrichmentState> {
    const safeError = error.slice(0, 1_000);
    const result = await this.sql.queryObject<RunRow>(COMPLETE_FAILED_SQL, [
      resourceId,
      safeError,
      retryable,
    ]);
    return completed(result.rows[0]);
  }
}

export const LATEST_RUN_SQL = `
SELECT er.resource_id, er.input_snapshot, er.output, er.status, er.error,
       er.retryable, er.prompt_version,
       count(*) OVER (PARTITION BY er.resource_id)::int AS attempt
FROM enrichment_runs er
WHERE er.resource_id = $1
ORDER BY er.created_at DESC
LIMIT 1`;

export const CLAIM_RUN_SQL = `
WITH claimed AS (
  INSERT INTO enrichment_runs
    (resource_id, model, prompt_version, input_snapshot, status, retryable)
  SELECT $1::uuid, $2, $3, $4::jsonb, 'preparing', false
  WHERE EXISTS (SELECT 1 FROM resources WHERE id = $1::uuid AND enrichment_status <> 'ready')
  ON CONFLICT DO NOTHING
  RETURNING *
), resource_update AS (
  UPDATE resources SET enrichment_status = 'preparing', enrichment_error = NULL, updated_at = now()
  WHERE id IN (SELECT resource_id FROM claimed)
)
SELECT claimed.resource_id, claimed.input_snapshot, claimed.output, claimed.status,
       claimed.error, claimed.retryable, claimed.prompt_version,
       (SELECT count(*)::int FROM enrichment_runs WHERE resource_id = claimed.resource_id) AS attempt
FROM claimed`;

export const COMPLETE_READY_SQL = `
WITH finished AS (
  UPDATE enrichment_runs SET status = 'ready', output = $2::jsonb, error = NULL,
    retryable = false, duration_ms = (extract(epoch FROM (now() - created_at)) * 1000)::int,
    updated_at = now()
  WHERE resource_id = $1::uuid AND status = 'preparing'
  RETURNING *
), resource_update AS (
  UPDATE resources SET summary = $3, why_useful = $4, output_language = $5,
    enrichment_status = 'ready', enrichment_error = NULL, updated_at = now()
  WHERE id IN (SELECT resource_id FROM finished)
)
SELECT finished.resource_id, finished.input_snapshot, finished.output, finished.status,
       finished.error, finished.retryable, finished.prompt_version,
       (SELECT count(*)::int FROM enrichment_runs WHERE resource_id = finished.resource_id) AS attempt
FROM finished`;

export const COMPLETE_FAILED_SQL = `
WITH finished AS (
  UPDATE enrichment_runs SET status = 'failed', error = $2, retryable = $3,
    duration_ms = (extract(epoch FROM (now() - created_at)) * 1000)::int, updated_at = now()
  WHERE resource_id = $1::uuid AND status = 'preparing'
  RETURNING *
), resource_update AS (
  UPDATE resources SET enrichment_status = 'failed', enrichment_error = $2, updated_at = now()
  WHERE id IN (SELECT resource_id FROM finished)
)
SELECT finished.resource_id, finished.input_snapshot, finished.output, finished.status,
       finished.error, finished.retryable, finished.prompt_version,
       (SELECT count(*)::int FROM enrichment_runs WHERE resource_id = finished.resource_id) AS attempt
FROM finished`;

function completed(row: RunRow | undefined): EnrichmentState {
  if (!row) throw new Error("Enrichment claim was lost");
  return toState(row);
}

function toState(row: RunRow): EnrichmentState {
  return {
    resourceId: row.resource_id,
    input: row.input_snapshot,
    status: row.status,
    attempt: row.attempt,
    draft: row.output === null ? null : EnrichmentDraftSchema.parse(row.output),
    error: row.error,
    retryable: row.retryable,
    promptVersion: row.prompt_version === ENRICHMENT_PROMPT_VERSION ? row.prompt_version : null,
  };
}
