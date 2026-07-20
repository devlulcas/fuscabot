WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY workspace_id ORDER BY updated_at DESC) AS position
  FROM discord_connections WHERE status = 'connected'
)
UPDATE discord_connections SET status = 'disconnected', updated_at = now()
WHERE id IN (SELECT id FROM ranked WHERE position > 1);

CREATE UNIQUE INDEX discord_connections_one_connected_per_workspace_uidx
  ON discord_connections(workspace_id) WHERE status = 'connected';

ALTER TABLE deliveries
  ADD COLUMN retry_of_delivery_id uuid REFERENCES deliveries(id) ON DELETE SET NULL;
CREATE INDEX deliveries_retry_idx ON deliveries(retry_of_delivery_id);
