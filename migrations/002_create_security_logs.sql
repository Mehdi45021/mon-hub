-- Journal de sécurité + anti-force-brute (5 essais, blocage 15 min).
CREATE TABLE IF NOT EXISTS security_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER,
  action     TEXT NOT NULL,
  ip         TEXT,
  user_agent TEXT,
  details    TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_logs_user ON security_logs(user_id, created_at);

CREATE TABLE IF NOT EXISTS login_attempts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT,
  ip         TEXT,
  reussi     INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts ON login_attempts(email, created_at);
