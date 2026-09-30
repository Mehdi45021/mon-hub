-- « Ce soir » : le plan quotidien qui décide à la place de l'élève,
-- s'adapte à son énergie, et déclare la journée finie.

CREATE TABLE IF NOT EXISTS plan_soir (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  INTEGER NOT NULL,
  date     TEXT NOT NULL,              -- AAAA-MM-JJ
  energie  TEXT DEFAULT 'moyen',       -- cuit | moyen | forme
  statut   TEXT DEFAULT 'en_cours',    -- en_cours | fini
  minutes  INTEGER DEFAULT 0,          -- total prévu
  fini_le  INTEGER,
  cree     INTEGER,
  UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS plan_blocs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id     INTEGER NOT NULL,
  user_id     INTEGER NOT NULL,
  titre       TEXT NOT NULL,
  detail      TEXT,                    -- ex. « exercices 3 à 7 p.142 »
  matiere     TEXT,
  source_type TEXT,                    -- homework | task | eval | libre
  source_id   INTEGER,
  minutes     INTEGER DEFAULT 20,
  ordre       INTEGER DEFAULT 0,
  statut      TEXT DEFAULT 'a_faire',  -- a_faire | fait | reporte
  pourquoi    TEXT,                    -- « c'est pour demain et c'est court »
  gain        TEXT,                    -- « fait ce soir = mercredi libre »
  reporte_au  TEXT,
  fait_le     INTEGER
);
CREATE INDEX IF NOT EXISTS idx_blocs ON plan_blocs(plan_id, ordre);

-- Un bloc « partiel » n'est qu'une entame : cocher ne clôt pas le devoir source.
ALTER TABLE plan_blocs ADD COLUMN partiel INTEGER DEFAULT 0;
