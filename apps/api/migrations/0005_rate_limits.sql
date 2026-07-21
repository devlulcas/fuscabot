CREATE TABLE rate_limit_buckets (
  scope text NOT NULL,
  key_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 1 CHECK (count > 0),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (scope, key_hash, window_start)
);

CREATE INDEX rate_limit_buckets_expiry_idx ON rate_limit_buckets(expires_at);
