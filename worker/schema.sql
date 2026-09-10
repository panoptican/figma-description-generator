CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT 'free',
  lifetime_count INTEGER NOT NULL DEFAULT 0,
  period TEXT NOT NULL DEFAULT '',
  period_count INTEGER NOT NULL DEFAULT 0,
  free_limit_override INTEGER,
  pro_limit_override INTEGER,
  first_seen_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS token_cache (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
