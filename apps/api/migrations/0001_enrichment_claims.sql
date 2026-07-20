ALTER TABLE enrichment_runs
  ADD COLUMN retryable boolean NOT NULL DEFAULT false;

-- Keep the newest in-flight attempt if this migration is applied to development data.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY resource_id ORDER BY created_at DESC) AS position
  FROM enrichment_runs
  WHERE status = 'preparing'
)
UPDATE enrichment_runs
SET status = 'failed', error = 'Superseded while enabling durable enrichment claims',
    retryable = true, updated_at = now()
WHERE id IN (SELECT id FROM ranked WHERE position > 1);

CREATE UNIQUE INDEX enrichment_runs_one_preparing_per_resource_uidx
  ON enrichment_runs(resource_id)
  WHERE status = 'preparing';
