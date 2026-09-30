-- Messagerie privée E2EE : le serveur stocke uniquement des contenus chiffrés.
CREATE TABLE IF NOT EXISTS messages (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id           INTEGER NOT NULL REFERENCES users(id),
  receiver_id         INTEGER NOT NULL REFERENCES users(id),
  subject             TEXT,               -- chiffré
  body                TEXT NOT NULL,      -- chiffré (crypto_box)
  is_read             INTEGER DEFAULT 0,
  created_at          TEXT DEFAULT CURRENT_TIMESTAMP,
  deleted_by_sender   INTEGER DEFAULT 0,
  deleted_by_receiver INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages(sender_id, receiver_id);

CREATE TABLE IF NOT EXISTS conversations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user1_id        INTEGER NOT NULL,
  user2_id        INTEGER NOT NULL,
  last_message_at TEXT,
  UNIQUE (user1_id, user2_id)
);
