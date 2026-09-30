import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import fs from 'fs'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const db = new Database(path.join(__dirname, '..', 'data', 'hub.db'))
db.pragma('journal_mode = WAL')

// ===== Schéma de base (existant) =====
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titre TEXT NOT NULL, fait INTEGER DEFAULT 0,
    priorite TEXT DEFAULT 'normale', cree INTEGER
  );
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titre TEXT DEFAULT 'Sans titre', contenu TEXT DEFAULT '', maj INTEGER
  );
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titre TEXT NOT NULL, date TEXT NOT NULL, note TEXT DEFAULT ''
  );
`)

// ===== Migrations additives (idempotentes) =====
// Ajoute une colonne si absente (ALTER échoue si elle existe déjà → ignoré)
function addCol(table, col, def) {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`) } catch { /* déjà là */ }
}
addCol('tasks', 'statut', "TEXT DEFAULT 'afaire'")        // kanban : afaire | encours | fait
addCol('tasks', 'recurrence', "TEXT DEFAULT 'none'")      // none | quotidien | hebdo
addCol('tasks', 'echeance', 'TEXT')
addCol('tasks', 'derniere', 'TEXT')                       // date dernière régénération (récurrence)

// ===== Nouvelles tables =====
db.exec(`
  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT, nom TEXT NOT NULL, couleur TEXT DEFAULT '#E0915C'
  );
  CREATE TABLE IF NOT EXISTS item_tags (
    tag_id INTEGER, item_type TEXT, item_id INTEGER,
    UNIQUE(tag_id, item_type, item_id)
  );
  CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    src_type TEXT, src_id INTEGER, dst_type TEXT, dst_id INTEGER, label TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS trash (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT, data TEXT, supprime_le INTEGER
  );
  CREATE TABLE IF NOT EXISTS settings ( cle TEXT PRIMARY KEY, valeur TEXT );

  CREATE TABLE IF NOT EXISTS subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER, titre TEXT, fait INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS pomodoro (
    id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, cree INTEGER
  );
  CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT, nom TEXT, couleur TEXT DEFAULT '#E0915C'
  );
  CREATE TABLE IF NOT EXISTS habit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, habit_id INTEGER, date TEXT, UNIQUE(habit_id, date)
  );

  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT, nom TEXT, couleur TEXT DEFAULT '#9CA0A8'
  );
  CREATE TABLE IF NOT EXISTS schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT, subject_id INTEGER,
    jour INTEGER, debut TEXT, fin TEXT, salle TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS homework (
    id INTEGER PRIMARY KEY AUTOINCREMENT, subject_id INTEGER,
    titre TEXT, echeance TEXT, fait INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT, subject_id INTEGER,
    titre TEXT DEFAULT '', note REAL, sur REAL DEFAULT 20, coef REAL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS flashcards (
    id INTEGER PRIMARY KEY AUTOINCREMENT, subject_id INTEGER,
    question TEXT, reponse TEXT, box INTEGER DEFAULT 1, due TEXT
  );
  CREATE TABLE IF NOT EXISTS revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, subject_id INTEGER,
    titre TEXT, contenu TEXT DEFAULT '', maj INTEGER
  );

  CREATE TABLE IF NOT EXISTS vocab (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    langue TEXT, mot TEXT, traduction TEXT, exemple TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS snippets (
    id INTEGER PRIMARY KEY AUTOINCREMENT, titre TEXT, langage TEXT DEFAULT '', code TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS favoris (
    id INTEGER PRIMARY KEY AUTOINCREMENT, titre TEXT, url TEXT
  );
  CREATE TABLE IF NOT EXISTS flights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    depart TEXT, arrivee TEXT, avion TEXT DEFAULT '', compagnie TEXT DEFAULT '',
    duree INTEGER DEFAULT 0, date TEXT, notes TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS mddocs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, titre TEXT DEFAULT 'Sans titre', contenu TEXT DEFAULT '', maj INTEGER
  );
`)

// ===== Comptes utilisateurs =====
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
    mdp TEXT NOT NULL,               -- hash scrypt "sel:hash"
    notif_connexion INTEGER DEFAULT 1,
    cree INTEGER
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY, user_id INTEGER, cree INTEGER
  );
`)

// ===== Migrations de sécurité (fichiers /migrations, appliqués une fois) =====
// Les CREATE sont idempotents ; les ALTER passent par addCol() qui ignore l'existant.
db.exec(fs.readFileSync(path.join(__dirname, '..', 'migrations', '001_create_messages.sql'), 'utf8'))
db.exec(fs.readFileSync(path.join(__dirname, '..', 'migrations', '002_create_security_logs.sql'), 'utf8'))
db.exec(fs.readFileSync(path.join(__dirname, '..', 'migrations', '003_create_email_tokens.sql'), 'utf8'))
db.exec(fs.readFileSync(path.join(__dirname, '..', 'migrations', '005_create_qr_sessions.sql'), 'utf8'))
db.exec(fs.readFileSync(path.join(__dirname, '..', 'migrations', '006_create_webauthn_credentials.sql'), 'utf8'))
db.exec(fs.readFileSync(path.join(__dirname, '..', 'migrations', '008_create_cerveau.sql'), 'utf8'))
db.exec(fs.readFileSync(path.join(__dirname, '..', 'migrations', '009_create_soir.sql'), 'utf8').split('-- Un bloc')[0])
addCol('plan_blocs', 'partiel', 'INTEGER DEFAULT 0')
db.exec(fs.readFileSync(path.join(__dirname, '..', 'migrations', '010_create_livres.sql'), 'utf8'))
addCol('livres', 'format', "TEXT DEFAULT 'pdf'")
// 004 + 007 : colonnes ajoutées à users
addCol('users', 'public_key', 'TEXT')
addCol('users', 'encrypted_private_key', 'TEXT')
addCol('users', 'email_verified', 'INTEGER DEFAULT 0')
addCol('users', 'qr_login_enabled', 'INTEGER DEFAULT 0')
addCol('users', 'biometric_enabled', 'INTEGER DEFAULT 0')
// Liaison session ↔ contexte (timeout, IP, user-agent, clé privée déverrouillée)
addCol('sessions', 'ip', 'TEXT')
addCol('sessions', 'user_agent', 'TEXT')
addCol('sessions', 'derniere_activite', 'INTEGER')
addCol('sessions', 'csrf', 'TEXT')

// Chaque table de données devient par-utilisateur
export const TABLES_USER = [
  'tasks', 'notes', 'events', 'tags', 'links', 'trash', 'settings',
  'subtasks', 'pomodoro', 'habits', 'habit_logs',
  'subjects', 'schedule', 'homework', 'grades', 'flashcards', 'revisions',
  'vocab', 'snippets', 'favoris', 'flights', 'mddocs'
]
for (const t of TABLES_USER) addCol(t, 'user_id', 'INTEGER')

export default db
