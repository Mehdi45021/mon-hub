-- Liens e-mail sécurisés : jeton stocké HACHÉ (SHA-256), expirable, usage unique.
CREATE TABLE IF NOT EXISTS email_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  token      TEXT NOT NULL,   -- haché
  type       TEXT NOT NULL CHECK (type IN ('verify_email','reset_password')),
  expires_at INTEGER NOT NULL,
  used_at    INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tokens ON email_tokens(token, type);
