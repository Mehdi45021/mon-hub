-- Clés biométriques WebAuthn (Face ID / Touch ID / Windows Hello / Android).
-- Aucune donnée biométrique n'est stockée : uniquement une clé publique.
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key    TEXT NOT NULL,
  sign_count    INTEGER DEFAULT 0,   -- compteur anti-rejeu / anti-clonage
  device_name   TEXT DEFAULT 'Mon appareil',
  aaguid        TEXT,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  last_used_at  TEXT
);
