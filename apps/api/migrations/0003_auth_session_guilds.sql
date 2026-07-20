ALTER TABLE auth_sessions
  ADD COLUMN IF NOT EXISTS guild_ids text[] NOT NULL DEFAULT '{}';
