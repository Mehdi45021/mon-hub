import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import 'dotenv/config'
import db from './db.js'
import { crud, versCorbeille } from './crud.js'
import filesRouter, { chercherFichiers } from './files.js'
import transversal from './transversal.js'
import chatRouter from './chat.js'
import aiRouter from './airoutes.js'
import authRouter, { exiger } from './auth.js'
import messagesRouter from './messages.js'
import qrRouter from './qrlogin.js'
import webauthnRouter, { contexteSur, RP_ID } from './webauthn.js'
import { headers, validateCsrf, logEvent } from './security.js'
import { adresseLan, baseUrl } from './reseau.js'
import cerveauRouter, { observer } from './cerveau.js'
import rechercheRouter from './recherche.js'
import soirRouter from './soir.js'
import livresRouter from './livres.js'
import mascotteRouter from './mascotte.js'
import profilRouter from './profil.js'
import { amorcerCerveau } from './seed_cerveau.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.disable('x-powered-by')
app.use(headers)                    // BLOC 2A — en-têtes de sécurité sur toutes les réponses
app.use(cors())
app.use(express.json({ limit: '20mb' }))

const today = () => new Date().toISOString().slice(0, 10)
function semaine(d = new Date()) {
  const t = new Date(d); t.setHours(0, 0, 0, 0)
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7))
  const j1 = new Date(t.getFullYear(), 0, 4)
  return t.getFullYear() + '-' + Math.round(((t - j1) / 86400000 - 3 + ((j1.getDay() + 6) % 7)) / 7)
}

// ===== Routes publiques (avant la protection globale) =====
app.use('/api/auth', authRouter)          // inscription, connexion, oubli de mot de passe
app.use('/api/qr', qrRouter)              // BLOC 7 — connexion par QR Code (public par nature)
app.use('/api/webauthn', webauthnRouter)  // BLOC 8 — biométrie (begin/finish publics, gestion protégée)

// ===== Tout le reste exige une session valide + jeton CSRF sur les écritures =====
app.use('/api', exiger, validateCsrf)
app.use('/api/messages', messagesRouter)  // BLOC 3 — messagerie E2EE
app.use('/api/cerveau', cerveauRouter)    // mémoire + apprentissage + historique IA
app.use('/api/recherche', rechercheRouter) // recherche locale / web
app.use('/api/soir', soirRouter)           // « Ce soir » : le plan qui décide à ta place
app.use('/api/livres', livresRouter)       // Bibliothèque : manuels lus et indexés
app.use('/api/mascotte', mascotteRouter)   // Le compagnon : son humeur suit ton travail
app.use('/api/profil', profilRouter)       // Questionnaire d'arrivée : règle l'app sur l'élève

// ===== Tâches =====
function regenRecurrences(uid) {
  const tj = today(), sem = semaine()
  for (const t of db.prepare("SELECT * FROM tasks WHERE user_id=? AND recurrence!='none' AND fait=1").all(uid)) {
    const expire = t.recurrence === 'quotidien' ? t.derniere !== tj : semaine(new Date(t.derniere || 0)) !== sem
    if (expire) db.prepare('UPDATE tasks SET fait=0, statut=?, derniere=? WHERE id=?').run('afaire', tj, t.id)
  }
}
app.get('/api/tasks', (req, res) => {
  regenRecurrences(req.user.id)
  res.json(db.prepare('SELECT * FROM tasks WHERE user_id=? ORDER BY fait, id DESC').all(req.user.id))
})
app.post('/api/tasks', (req, res) => {
  const { titre, priorite = 'normale', recurrence = 'none', echeance = null, statut = 'afaire' } = req.body
  const info = db.prepare('INSERT INTO tasks (titre, priorite, recurrence, echeance, statut, cree, derniere, user_id) VALUES (?,?,?,?,?,?,?,?)')
    .run(titre, priorite, recurrence, echeance, statut, Date.now(), today(), req.user.id)
  observer(req.user.id, 'tache_creee')
  res.json(db.prepare('SELECT * FROM tasks WHERE id=?').get(info.lastInsertRowid))
})
app.put('/api/tasks/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM tasks WHERE id=? AND user_id=?').get(req.params.id, req.user.id)
  if (!t) return res.status(404).json({ erreur: 'introuvable' })
  const champs = ['titre', 'fait', 'priorite', 'recurrence', 'echeance', 'statut']
  const maj = champs.filter(c => c in req.body)
  if ('fait' in req.body && !('statut' in req.body)) { req.body.statut = req.body.fait ? 'fait' : 'afaire'; maj.push('statut') }
  if ('statut' in req.body && !('fait' in req.body)) { req.body.fait = req.body.statut === 'fait' ? 1 : 0; maj.push('fait') }
  if (maj.length) db.prepare(`UPDATE tasks SET ${maj.map(c => c + '=?').join(',')} WHERE id=?`).run(...maj.map(c => req.body[c]), req.params.id)
  if (req.body.fait) observer(req.user.id, 'tache_faite')
  res.json(db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id))
})
app.delete('/api/tasks/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM tasks WHERE id=? AND user_id=?').get(req.params.id, req.user.id)
  if (!t) return res.status(404).json({ erreur: 'introuvable' })
  versCorbeille('tasks', t)
  db.prepare('DELETE FROM tasks WHERE id=?').run(req.params.id)
  db.prepare('DELETE FROM subtasks WHERE task_id=?').run(req.params.id)
  res.json({ ok: true })
})
app.get('/api/tasks/:id/subtasks', (req, res) =>
  res.json(db.prepare('SELECT * FROM subtasks WHERE task_id=? AND user_id=? ORDER BY id').all(req.params.id, req.user.id)))
crud(app, '/api/subtasks', 'subtasks', ['task_id', 'titre', 'fait'], { soft: false })

// ===== Notes & Événements =====
app.get('/api/notes', (req, res) => res.json(db.prepare('SELECT * FROM notes WHERE user_id=? ORDER BY maj DESC').all(req.user.id)))
app.post('/api/notes', (req, res) => {
  const info = db.prepare('INSERT INTO notes (titre, contenu, maj, user_id) VALUES (?,?,?,?)')
    .run(req.body.titre || 'Sans titre', req.body.contenu || '', Date.now(), req.user.id)
  res.json(db.prepare('SELECT * FROM notes WHERE id=?').get(info.lastInsertRowid))
})
app.put('/api/notes/:id', (req, res) => {
  const n = db.prepare('SELECT * FROM notes WHERE id=? AND user_id=?').get(req.params.id, req.user.id)
  if (!n) return res.status(404).json({ erreur: 'introuvable' })
  db.prepare('UPDATE notes SET titre=?, contenu=?, maj=? WHERE id=?').run(req.body.titre ?? n.titre, req.body.contenu ?? n.contenu, Date.now(), req.params.id)
  res.json(db.prepare('SELECT * FROM notes WHERE id=?').get(req.params.id))
})
app.delete('/api/notes/:id', (req, res) => {
  const n = db.prepare('SELECT * FROM notes WHERE id=? AND user_id=?').get(req.params.id, req.user.id)
  if (!n) return res.status(404).json({ erreur: 'introuvable' })
  versCorbeille('notes', n)
  db.prepare('DELETE FROM notes WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

app.get('/api/events', (req, res) => res.json(db.prepare('SELECT * FROM events WHERE user_id=? ORDER BY date').all(req.user.id)))
app.post('/api/events', (req, res) => {
  const info = db.prepare('INSERT INTO events (titre, date, note, user_id) VALUES (?,?,?,?)').run(req.body.titre, req.body.date, req.body.note || '', req.user.id)
  res.json(db.prepare('SELECT * FROM events WHERE id=?').get(info.lastInsertRowid))
})
app.delete('/api/events/:id', (req, res) => {
  const e = db.prepare('SELECT * FROM events WHERE id=? AND user_id=?').get(req.params.id, req.user.id)
  if (!e) return res.status(404).json({ erreur: 'introuvable' })
  versCorbeille('events', e)
  db.prepare('DELETE FROM events WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

// ===== CRUD génériques (scopés utilisateur) =====
crud(app, '/api/habits', 'habits', ['nom', 'couleur'])
crud(app, '/api/subjects', 'subjects', ['nom', 'couleur'])
crud(app, '/api/schedule', 'schedule', ['subject_id', 'jour', 'debut', 'fin', 'salle'])
crud(app, '/api/homework', 'homework', ['subject_id', 'titre', 'echeance', 'fait'], { order: 'echeance' })
crud(app, '/api/grades', 'grades', ['subject_id', 'titre', 'note', 'sur', 'coef'])
crud(app, '/api/revisions', 'revisions', ['subject_id', 'titre', 'contenu', 'maj'], { order: 'maj DESC' })
crud(app, '/api/vocab', 'vocab', ['langue', 'mot', 'traduction', 'exemple'])
crud(app, '/api/favoris', 'favoris', ['titre', 'url'])
crud(app, '/api/mddocs', 'mddocs', ['titre', 'contenu', 'maj'], { order: 'maj DESC' })

// ===== Pomodoro =====
app.get('/api/pomodoro/today', (req, res) =>
  res.json({ sessions: db.prepare('SELECT COUNT(*) c FROM pomodoro WHERE date=? AND user_id=?').get(today(), req.user.id).c }))
app.post('/api/pomodoro', (req, res) => {
  db.prepare('INSERT INTO pomodoro (date, cree, user_id) VALUES (?,?,?)').run(today(), Date.now(), req.user.id)
  observer(req.user.id, 'pomodoro')
  res.json({ ok: true })
})

// ===== Habitudes =====
function streak(habitId, uid) {
  let n = 0, d = new Date()
  for (;;) {
    const iso = d.toISOString().slice(0, 10)
    const ok = db.prepare('SELECT 1 FROM habit_logs WHERE habit_id=? AND date=? AND user_id=?').get(habitId, iso, uid)
    if (ok) { n++; d.setDate(d.getDate() - 1) }
    else { if (iso === today()) { d.setDate(d.getDate() - 1); continue } break }
  }
  return n
}
app.get('/api/habits/state', (req, res) => {
  const habits = db.prepare('SELECT * FROM habits WHERE user_id=? ORDER BY id').all(req.user.id)
  res.json(habits.map(h => ({
    ...h, serie: streak(h.id, req.user.id),
    logs: db.prepare('SELECT date FROM habit_logs WHERE habit_id=?').all(h.id).map(r => r.date)
  })))
})
app.post('/api/habits/:id/toggle', (req, res) => {
  const h = db.prepare('SELECT 1 FROM habits WHERE id=? AND user_id=?').get(req.params.id, req.user.id)
  if (!h) return res.status(404).json({ erreur: 'introuvable' })
  const date = req.body.date || today()
  const ex = db.prepare('SELECT 1 FROM habit_logs WHERE habit_id=? AND date=?').get(req.params.id, date)
  if (ex) db.prepare('DELETE FROM habit_logs WHERE habit_id=? AND date=?').run(req.params.id, date)
  else db.prepare('INSERT OR IGNORE INTO habit_logs (habit_id, date, user_id) VALUES (?,?,?)').run(req.params.id, date, req.user.id)
  res.json({ ok: true })
})

// ===== Moyennes scolaires =====
app.get('/api/grades/moyennes', (req, res) => {
  const subs = db.prepare('SELECT * FROM subjects WHERE user_id=? ORDER BY nom').all(req.user.id)
  let gNum = 0, gDen = 0
  const parMatiere = subs.map(s => {
    const notes = db.prepare('SELECT * FROM grades WHERE subject_id=? AND user_id=?').all(s.id, req.user.id)
    let num = 0, den = 0
    for (const n of notes) { if (n.note == null) continue; const v = (n.note / (n.sur || 20)) * 20; num += v * (n.coef || 1); den += (n.coef || 1) }
    const moy = den ? num / den : null
    if (moy != null) { gNum += num; gDen += den }
    return { ...s, moyenne: moy, nb: notes.length }
  })
  res.json({ parMatiere, generale: gDen ? gNum / gDen : null })
})

// ===== Flashcards (répétition espacée) =====
const INTERVALLES = [0, 1, 3, 7, 16]
app.get('/api/flashcards/review', (req, res) => {
  res.json(db.prepare('SELECT * FROM flashcards WHERE user_id=? AND (due IS NULL OR due<=?) ORDER BY due').all(req.user.id, today()))
})
app.post('/api/flashcards/:id/answer', (req, res) => {
  const c = db.prepare('SELECT * FROM flashcards WHERE id=? AND user_id=?').get(req.params.id, req.user.id)
  if (!c) return res.status(404).json({ erreur: 'introuvable' })
  const box = req.body.bon ? Math.min((c.box || 1) + 1, 5) : 1
  const d = new Date(); d.setDate(d.getDate() + INTERVALLES[box - 1])
  db.prepare('UPDATE flashcards SET box=?, due=? WHERE id=?').run(box, d.toISOString().slice(0, 10), req.params.id)
  observer(req.user.id, 'revision')
  res.json({ ok: true })
})
crud(app, '/api/flashcards', 'flashcards', ['subject_id', 'question', 'reponse', 'box', 'due'])

// ===== Recherche globale =====
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').trim()
  if (!q) return res.json({})
  const like = `%${q}%`, u = req.user.id
  const f = (sql, ...a) => db.prepare(sql).all(...a)
  res.json({
    tasks: f('SELECT id, titre FROM tasks WHERE user_id=? AND titre LIKE ? LIMIT 8', u, like),
    notes: f('SELECT id, titre FROM notes WHERE user_id=? AND (titre LIKE ? OR contenu LIKE ?) LIMIT 8', u, like, like),
    events: f('SELECT id, titre, date FROM events WHERE user_id=? AND titre LIKE ? LIMIT 8', u, like),
    homework: f('SELECT id, titre FROM homework WHERE user_id=? AND titre LIKE ? LIMIT 8', u, like),
    revisions: f('SELECT id, titre FROM revisions WHERE user_id=? AND (titre LIKE ? OR contenu LIKE ?) LIMIT 8', u, like, like),
    flashcards: f('SELECT id, question AS titre FROM flashcards WHERE user_id=? AND (question LIKE ? OR reponse LIKE ?) LIMIT 8', u, like, like),
    vocab: f('SELECT id, mot AS titre FROM vocab WHERE user_id=? AND (mot LIKE ? OR traduction LIKE ?) LIMIT 8', u, like, like),
    favoris: f('SELECT id, titre FROM favoris WHERE user_id=? AND (titre LIKE ? OR url LIKE ?) LIMIT 8', u, like, like),
    files: chercherFichiers(q, req.user.id).slice(0, 8)
  })
})

// ===== Résumé Accueil =====
app.get('/api/summary', (req, res) => {
  const tj = today(), u = req.user.id
  res.json({
    tachesAFaire: db.prepare('SELECT COUNT(*) c FROM tasks WHERE user_id=? AND fait=0').get(u).c,
    evenementsJour: db.prepare('SELECT * FROM events WHERE user_id=? AND date=?').all(u, tj),
    nbNotes: db.prepare('SELECT COUNT(*) c FROM notes WHERE user_id=?').get(u).c,
    devoirs: db.prepare('SELECT COUNT(*) c FROM homework WHERE user_id=? AND fait=0 AND echeance>=?').get(u, tj).c,
    revisions: db.prepare('SELECT COUNT(*) c FROM flashcards WHERE user_id=? AND (due IS NULL OR due<=?)').get(u, tj).c,
    pomodoro: db.prepare('SELECT COUNT(*) c FROM pomodoro WHERE user_id=? AND date=?').get(u, tj).c
  })
})

// Titre lisible d'un élément (liens & rétroliens)
const TITRE_COL = { tasks: 'titre', notes: 'titre', events: 'titre', homework: 'titre', revisions: 'titre', favoris: 'titre', vocab: 'mot', subjects: 'nom', mddocs: 'titre' }
app.get('/api/resolve/:type/:id', (req, res) => {
  const col = TITRE_COL[req.params.type]
  if (!col) return res.json({ titre: req.params.type + ' #' + req.params.id })
  const r = db.prepare(`SELECT ${col} AS titre FROM ${req.params.type} WHERE id=? AND user_id=?`).get(req.params.id, req.user.id)
  res.json({ titre: r?.titre || '(supprimé)', type: req.params.type })
})

// Adresse à utiliser depuis le téléphone (même Wi-Fi)
app.get('/api/reseau', (req, res) => res.json({ lan: adresseLan(), url: baseUrl(req) }))

app.use('/api/files', filesRouter)
app.use('/api', transversal)
app.use('/api/chat', chatRouter)
app.use('/api/ai', aiRouter)

// ===== Sert l'application compilée (dist/) : une seule URL pour tout =====
const racine = path.join(__dirname, '..')
const dist = path.join(racine, 'dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')))
} else {
  app.get('/', (req, res) => res.status(503).send(
    '<h1>Mon Hub n\'est pas compilé</h1><p>Lance <code>npm run build</code> puis relance le serveur.</p>'
  ))
}

const PORT = process.env.PORT || 3001
// 0.0.0.0 : accessible depuis le téléphone sur le même Wi-Fi
app.listen(PORT, '0.0.0.0', () => {
  const lan = adresseLan()
  const seed = amorcerCerveau() // mémoire initiale du cerveau
  if (seed.amorce) console.log(`Cerveau amorcé : ${seed.faits} faits mémorisés`)
  console.log(`Mon Hub : http://localhost:${PORT}`)
  if (lan) console.log(`Depuis ton téléphone (même Wi-Fi) : http://${lan}:${PORT}`)
  else console.warn('⚠️  Aucun réseau détecté : le QR Code ne sera pas ouvrable depuis un téléphone.')
  // BLOC 8, règle 3 : WebAuthn impose un contexte sécurisé (HTTPS, sauf localhost)
  if (!contexteSur()) {
    console.warn(`⚠️  WebAuthn désactivé : APP_DOMAIN="${RP_ID}" nécessite HTTPS. En HTTP, seul "localhost" fonctionne.`)
  }
})
