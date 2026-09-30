-- Cerveau : mémoire de l'IA (faits sur l'utilisateur) + apprentissage comportemental
-- + historique des discussions Chat / Recherche.

-- Historique des discussions (chat et recherche)
CREATE TABLE IF NOT EXISTS ia_conversations (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  mode    TEXT DEFAULT 'chat',                 -- chat | recherche
  titre   TEXT DEFAULT 'Nouvelle discussion',
  cree    INTEGER,
  maj     INTEGER
);
CREATE TABLE IF NOT EXISTS ia_messages (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  conv_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role    TEXT NOT NULL,                       -- user | assistant
  contenu TEXT NOT NULL,
  sources TEXT,                                -- JSON des sources web citées
  cree    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_ia_msg ON ia_messages(conv_id, id);

-- Ce que le cerveau sait de toi (sphère perso / pro)
CREATE TABLE IF NOT EXISTS brain_facts (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER NOT NULL,
  sphere    TEXT DEFAULT 'perso',              -- perso | pro
  categorie TEXT DEFAULT 'général',
  cle       TEXT NOT NULL,
  valeur    TEXT NOT NULL,
  source    TEXT DEFAULT 'manuel',             -- manuel | observation | seed
  poids     REAL DEFAULT 1,
  cree      INTEGER,
  maj       INTEGER
);
CREATE INDEX IF NOT EXISTS idx_facts ON brain_facts(user_id, sphere);

-- Traces de comportement, agrégées pour apprendre tes habitudes de travail
CREATE TABLE IF NOT EXISTS brain_events (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type    TEXT NOT NULL,                       -- section | tache_creee | tache_faite | pomodoro | revision…
  cle     TEXT,
  heure   INTEGER,                             -- 0-23
  jour    INTEGER,                             -- 0 = lundi
  cree    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_events ON brain_events(user_id, type, cree);
