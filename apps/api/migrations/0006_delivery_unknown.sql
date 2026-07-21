DROP INDEX IF EXISTS deliveries_success_guard;

CREATE UNIQUE INDEX deliveries_success_guard
  ON deliveries (resource_id, channel_id, delivery_kind)
  WHERE status IN ('pending', 'sent', 'unknown');
