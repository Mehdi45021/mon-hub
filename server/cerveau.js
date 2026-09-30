// Le "cerveau" de Mon Hub : ce que l'IA sait de toi (faits perso/pro),
// ce qu'elle apprend de ton comportement, et l'historique des discussions.
import express from 'express'
import db from './db.js'
import { texte } from './security.js'

const router = express.Router()
const now = () => Date.now()

// ===== Apprentissage passif : chaque action laisse une trace =====
export function observer(userId, type, cle = null) {
  if (!userId) return
  const d = new Date()
  try {
    db.prepare('INSERT INTO brain_events (user_id, type, cle, heure, jour, cree) VALUES (?,?,?,?,?,?)')
      .run(userId, type, cle, d.getHours(), (d.getDay() + 6) % 7, now())
    // On garde 90 jours de traces
    db.prepare('DELETE FROM brain_events WHERE user_id=? AND cree < ?').run(userId, now() - 90 * 864e5)
  } catch {}
}

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
const creneau = (h) => h < 6 ? 'nuit' : h < 12 ? 'matin' : h < 18 ? 'après-midi' : 'soir'

// ===== Synthèse : ce que le cerveau a compris de tes habitudes =====
export function synthese(userId) {
  const ev = (sql, ...a) => db.prepare(sql).all(userId, ...a)
  const total = db.prepare('SELECT COUNT(*) c FROM brain_events WHERE user_id=?').get(userId).c

  // Créneau horaire le plus actif
  const parHeure = ev('SELECT heure, COUNT(*) c FROM brain_events WHERE user_id=? GROUP BY heure ORDER BY c DESC')
  const parJour = ev('SELECT jour, COUNT(*) c FROM brain_events WHERE user_id=? GROUP BY jour ORDER BY c DESC')
  const parSection = ev("SELECT cle, COUNT(*) c FROM brain_events WHERE user_id=? AND type='section' GROUP BY cle ORDER BY c DESC LIMIT 5")

  // Rapport à la tâche
  const creees = db.prepare("SELECT COUNT(*) c FROM brain_events WHERE user_id=? AND type='tache_creee'").get(userId).c
  const faites = db.prepare("SELECT COUNT(*) c FROM brain_events WHERE user_id=? AND type='tache_faite'").get(userId).c
  const enRetard = db.prepare("SELECT COUNT(*) c FROM tasks WHERE user_id=? AND fait=0 AND echeance IS NOT NULL AND echeance < date('now')").get(userId).c
  const pomodoros = db.prepare("SELECT COUNT(*) c FROM pomodoro WHERE user_id=?").get(userId).c

  // École
  const devoirsRetard = db.prepare("SELECT COUNT(*) c FROM homework WHERE user_id=? AND fait=0 AND echeance < date('now')").get(userId).c
  const cartesDues = db.prepare("SELECT COUNT(*) c FROM flashcards WHERE user_id=? AND (due IS NULL OR due<=date('now'))").get(userId).c
  const matieres = db.prepare(`SELECT s.nom, COUNT(f.id) c FROM subjects s LEFT JOIN flashcards f ON f.subject_id=s.id
    WHERE s.user_id=? GROUP BY s.id ORDER BY c DESC LIMIT 3`).all(userId)

  // Régularité des habitudes (7 derniers jours)
  const habitudes = db.prepare(`SELECT h.nom, COUNT(l.id) c FROM habits h
    LEFT JOIN habit_logs l ON l.habit_id=h.id AND l.date >= date('now','-7 day')
    WHERE h.user_id=? GROUP BY h.id ORDER BY c DESC`).all(userId)

  const insights = []
  if (parHeure.length) insights.push(`Tu travailles surtout le ${creneau(parHeure[0].heure)} (vers ${parHeure[0].heure}h).`)
  if (parJour.length) insights.push(`Ton jour le plus actif est le ${JOURS[parJour[0].jour]}.`)
  if (parSection.length) insights.push(`Sections les plus utilisées : ${parSection.map(s => s.cle).join(', ')}.`)
  if (creees) {
    const taux = Math.round((faites / creees) * 100)
    insights.push(`Tu termines environ ${taux}% des tâches que tu crées.`)
    if (taux < 50) insights.push('Tendance : tu crées plus de tâches que tu n\'en finis — mieux vaut en ajouter moins à la fois.')
  }
  if (enRetard) insights.push(`${enRetard} tâche(s) en retard.`)
  if (devoirsRetard) insights.push(`${devoirsRetard} devoir(s) dépassé(s).`)
  if (pomodoros) insights.push(`${pomodoros} session(s) de focus au total.`)
  if (cartesDues) insights.push(`${cartesDues} flashcard(s) à réviser aujourd'hui.`)
  const molles = habitudes.filter(h => h.c < 3)
  if (molles.length) insights.push(`Habitudes irrégulières cette semaine : ${molles.map(h => h.nom).join(', ')}.`)

  return {
    total,
    creneau: parHeure.length ? creneau(parHeure[0].heure) : null,
    heurePointe: parHeure[0]?.heure ?? null,
    jourPointe: parJour.length ? JOURS[parJour[0].jour] : null,
    sections: parSection,
    taches: { creees, faites, enRetard, taux: creees ? Math.round((faites / creees) * 100) : null },
    pomodoros, devoirsRetard, cartesDues, matieres, habitudes, insights
  }
}

// ===== Contexte injecté à l'IA (court, pour économiser les tokens) =====
export function contexteCerveau(userId) {
  const faits = db.prepare('SELECT sphere, categorie, cle, valeur FROM brain_facts WHERE user_id=? ORDER BY sphere, poids DESC LIMIT 40').all(userId)
  const s = synthese(userId)
  const bloc = (sph) => faits.filter(f => f.sphere === sph).map(f => `${f.cle}: ${f.valeur}`).join(' · ')
  const lignes = []
  if (bloc('perso')) lignes.push('PROFIL PERSO — ' + bloc('perso'))
  if (bloc('pro')) lignes.push('PROFIL PRO/SCOLAIRE — ' + bloc('pro'))
  if (s.insights.length) lignes.push('HABITUDES OBSERVÉES — ' + s.insights.join(' '))
  return lignes.join('\n')
}

// ===== API : faits =====
router.get('/facts', (req, res) => {
  res.json(db.prepare('SELECT * FROM brain_facts WHERE user_id=? ORDER BY sphere, categorie, id').all(req.user.id))
})
router.post('/facts', (req, res) => {
  const { sphere = 'perso', categorie = 'général', cle, valeur } = req.body
  if (!cle || !valeur) return res.status(400).json({ erreur: 'Clé et valeur requises' })
  const info = db.prepare(`INSERT INTO brain_facts (user_id, sphere, categorie, cle, valeur, source, cree, maj)
    VALUES (?,?,?,?,?,'manuel',?,?)`).run(req.user.id, sphere === 'pro' ? 'pro' : 'perso',
    texte(categorie, 40), texte(cle, 80), texte(valeur, 500), now(), now())
  res.json(db.prepare('SELECT * FROM brain_facts WHERE id=?').get(info.lastInsertRowid))
})
router.put('/facts/:id', (req, res) => {
  const f = db.prepare('SELECT * FROM brain_facts WHERE id=? AND user_id=?').get(req.params.id, req.user.id)
  if (!f) return res.status(404).json({ erreur: 'introuvable' })
  db.prepare('UPDATE brain_facts SET valeur=?, sphere=?, categorie=?, maj=? WHERE id=?')
    .run(texte(req.body.valeur ?? f.valeur, 500), req.body.sphere ?? f.sphere, texte(req.body.categorie ?? f.categorie, 40), now(), f.id)
  res.json({ ok: true })
})
router.delete('/facts/:id', (req, res) => {
  db.prepare('DELETE FROM brain_facts WHERE id=? AND user_id=?').run(req.params.id, req.user.id)
  res.json({ ok: true })
})

// ===== API : synthèse comportementale =====
router.get('/synthese', (req, res) => res.json(synthese(req.user.id)))

// Enregistre une visite de section (appelé par le front)
router.post('/observer', (req, res) => {
  observer(req.user.id, texte(req.body.type, 30) || 'section', texte(req.body.cle, 40))
  res.json({ ok: true })
})

// ===== API : historique des discussions =====
router.get('/conversations', (req, res) => {
  const mode = req.query.mode === 'recherche' ? 'recherche' : 'chat'
  res.json(db.prepare('SELECT * FROM ia_conversations WHERE user_id=? AND mode=? ORDER BY maj DESC LIMIT 50').all(req.user.id, mode))
})
router.post('/conversations', (req, res) => {
  const mode = req.body.mode === 'recherche' ? 'recherche' : 'chat'
  const info = db.prepare('INSERT INTO ia_conversations (user_id, mode, titre, cree, maj) VALUES (?,?,?,?,?)')
    .run(req.user.id, mode, texte(req.body.titre, 80) || 'Nouvelle discussion', now(), now())
  res.json(db.prepare('SELECT * FROM ia_conversations WHERE id=?').get(info.lastInsertRowid))
})
router.get('/conversations/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM ia_conversations WHERE id=? AND user_id=?').get(req.params.id, req.user.id)
  if (!c) return res.status(404).json({ erreur: 'introuvable' })
  const msgs = db.prepare('SELECT * FROM ia_messages WHERE conv_id=? ORDER BY id').all(c.id)
  res.json({ ...c, messages: msgs.map(m => ({ ...m, sources: m.sources ? JSON.parse(m.sources) : null })) })
})
router.delete('/conversations/:id', (req, res) => {
  db.prepare('DELETE FROM ia_messages WHERE conv_id=? AND user_id=?').run(req.params.id, req.user.id)
  db.prepare('DELETE FROM ia_conversations WHERE id=? AND user_id=?').run(req.params.id, req.user.id)
  res.json({ ok: true })
})

// Ajoute un message à une conversation (utilisé par chat.js et recherche.js)
export function ajouterMessage(userId, convId, role, contenu, sources = null) {
  db.prepare('INSERT INTO ia_messages (conv_id, user_id, role, contenu, sources, cree) VALUES (?,?,?,?,?,?)')
    .run(convId, userId, role, contenu, sources ? JSON.stringify(sources) : null, now())
  db.prepare('UPDATE ia_conversations SET maj=? WHERE id=?').run(now(), convId)
  // Le titre reprend la première question de l'utilisateur
  const c = db.prepare('SELECT titre FROM ia_conversations WHERE id=?').get(convId)
  if (role === 'user' && c?.titre === 'Nouvelle discussion') {
    db.prepare('UPDATE ia_conversations SET titre=? WHERE id=?').run(contenu.slice(0, 70), convId)
  }
}

export default router
