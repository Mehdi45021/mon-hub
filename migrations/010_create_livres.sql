-- Bibliothèque : manuels et documents de l'élève, lus et indexés page par page.
-- Strictement personnels (user_id) : aucun partage entre comptes.
CREATE TABLE IF NOT EXISTS livres (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  titre      TEXT NOT NULL,
  subject_id INTEGER,
  fichier    TEXT NOT NULL,
  pages      INTEGER DEFAULT 0,
  statut     TEXT DEFAULT 'lecture',   -- lecture | pret | erreur
  erreur     TEXT,
  cree       INTEGER
);
CREATE TABLE IF NOT EXISTS livre_pages (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  livre_id INTEGER NOT NULL,
  user_id  INTEGER NOT NULL,
  page     INTEGER NOT NULL,
  texte    TEXT
);
CREATE INDEX IF NOT EXISTS idx_livre_pages ON livre_pages(livre_id, page);
CREATE INDEX IF NOT EXISTS idx_livre_user ON livre_pages(user_id);
