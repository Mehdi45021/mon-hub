// « Ce soir » — le module central.
// Il décide QUOI faire, dans QUEL ordre, selon l'énergie du moment,
// montre CE QUE ÇA LIBÈRE, et déclare la journée finie.
import express from 'express'
import db from './db.js'
import { texte } from './security.js'
import { observer } from './cerveau.js'

const router = express.Router()
const jour = (d = new Date()) => d.toISOString().slice(0, 10)
const demain = () => { const d = new Date(); d.setDate(d.getDate() + 1); return jour(d) }
const joursAvant = (date) => Math.round((new Date(date) - new Date(jour())) / 86400000)

// Budget de travail selon l'état : on ne propose jamais plus que ce qui est tenable.
const BUDGET = { cuit: 25, moyen: 60, forme: 105 }
const MOTS_EVAL = /(ds|contr[ôo]le|[ée]val|interro|examen|bac blanc|test|oral|expos[ée]|partiel)/i

// Réglages horaires de l'élève (modifiables)
function horaires(uid) {
  const r = db.prepare("SELECT valeur FROM settings WHERE cle='horaires_soir' AND user_id=?").get(uid)
  return r ? JSON.parse(r.valeur) : { reprise: '19:00', fin: '22:30' }
}

// ===== Ce que l'app sait déjà devoir être fait =====
function sources(uid) {
  const tj = jour()
  const items = []

  // Devoirs non faits
  for (const h of db.prepare(`SELECT h.*, s.nom AS matiere FROM homework h
      LEFT JOIN subjects s ON s.id = h.subject_id
      WHERE h.user_id=? AND h.fait=0`).all(uid)) {
    items.push({
      type: 'homework', id: h.id, titre: h.titre, matiere: h.matiere,
      echeance: h.echeance, minutes: 30
    })
  }

  // Tâches non faites
  for (const t of db.prepare(`SELECT * FROM tasks WHERE user_id=? AND fait=0`).all(uid)) {
    items.push({
      type: 'task', id: t.id, titre: t.titre, matiere: null,
      echeance: t.echeance, priorite: t.priorite, minutes: 25
    })
  }

  // Évaluations à venir (détectées dans le calendrier) → sessions de révision
  for (const e of db.prepare(`SELECT * FROM events WHERE user_id=? AND date>=?`).all(uid, tj)) {
    if (!MOTS_EVAL.test(e.titre)) continue
    const j = joursAvant(e.date)
    if (j > 12) continue
    items.push({
      type: 'eval', id: e.id, titre: 'Réviser : ' + e.titre, matiere: null,
      echeance: e.date, minutes: 30, eval: true, joursRestants: j
    })
  }

  // Flashcards dues → session courte, faisable même fatigué
  const dues = db.prepare(`SELECT COUNT(*) c FROM flashcards WHERE user_id=? AND (due IS NULL OR due<=?)`).get(uid, tj).c
  if (dues > 0) {
    items.push({
      type: 'flashcards', id: 0, titre: `Réviser ${dues} flashcard${dues > 1 ? 's' : ''}`,
      minutes: Math.min(20, 5 + dues), leger: true
    })
  }
  return items
}

// Depuis combien de jours cette matière est-elle négligée ?
function negligeeDepuis(uid, matiere) {
  if (!matiere) return 0
  const r = db.prepare(`SELECT MAX(fait_le) f FROM plan_blocs WHERE user_id=? AND matiere=? AND statut='fait'`).get(uid, matiere)
  if (!r?.f) return 99
  return Math.round((Date.now() - r.f) / 86400000)
}

// ===== Priorité : ce qui doit passer en premier =====
function score(uid, it) {
  let s = 0
  const j = it.echeance ? joursAvant(it.echeance) : null

  if (j !== null) {
    if (j < 0) s += 120                 // en retard
    else if (j === 0) s += 110          // pour aujourd'hui
    else if (j === 1) s += 100          // pour demain
    else if (j === 2) s += 55
    else if (j <= 5) s += 30
    else s += 10
  }
  if (it.eval) s += it.joursRestants <= 2 ? 95 : it.joursRestants <= 5 ? 60 : 35
  if (it.priorite === 'haute') s += 25
  if (it.leger) s += 15                 // court : bon pour lancer la soirée

  // Une matière délaissée remonte doucement
  const neg = negligeeDepuis(uid, it.matiere)
  if (neg >= 7) s += 20

  // Ce qui a déjà été reporté ne doit pas s'enliser
  const rep = db.prepare(`SELECT COUNT(*) c FROM plan_blocs
    WHERE user_id=? AND source_type=? AND source_id=? AND statut='reporte'`).get(uid, it.type, it.id).c
  s += rep * 35
  return s
}

// ===== Les deux phrases qui font la différence =====
// « pourquoi maintenant » (confiance + apprentissage de la méthode)
function pourquoi(it, rang) {
  const j = it.echeance ? joursAvant(it.echeance) : null
  if (j !== null && j < 0) return "C'est en retard — on solde ça d'abord, tu vas te sentir mieux."
  // Une éval demain n'est pas « un devoir à rendre » : le message doit le refléter
  if (it.eval && it.joursRestants <= 1) return "Ton éval est demain. C'est maintenant que ça se joue."
  if (j === 1) return it.minutes <= 25
    ? "C'est pour demain et c'est court : tu t'en débarrasses tout de suite."
    : "C'est pour demain. Autant le faire maintenant que dans le bus."
  if (it.eval && it.joursRestants <= 2) return `Ton éval est dans ${it.joursRestants} jour${it.joursRestants > 1 ? 's' : ''}. Ce soir compte double.`
  if (it.eval) return "Une session maintenant vaut trois sessions la veille."
  if (it.leger && rang === 0) return "On commence léger, histoire de lancer la machine."
  const neg = it.negligee
  if (neg >= 7) return `Ça fait ${neg} jours que tu n'as rien fait dans cette matière.`
  return "Rien d'urgent, mais l'avancer maintenant t'allège la semaine."
}

// « ce que ça te libère » (la projection que Mehdi demande explicitement)
function gain(it) {
  const j = it.echeance ? joursAvant(it.echeance) : null
  if (j !== null && j < 0) return "Une fois soldé, ça arrête de peser dans un coin de ta tête."
  if (it.eval && it.joursRestants <= 1) return "Réviser ce soir plutôt que paniquer demain matin."
  if (j === 1) return "Fait ce soir → demain matin tu arrives tranquille."
  if (it.eval && it.joursRestants <= 3) return "Chaque minute ici, c'est une heure de panique en moins la veille."
  if (it.eval) return "Tu ne réviseras pas tout la veille. C'est tout l'intérêt."
  if (it.leger) return "5 minutes, et c'est réglé pour aujourd'hui."
  return `${it.minutes} min maintenant = ${it.minutes} min de moins ce week-end.`
}

// ===== Construction du plan =====
function construire(uid, energie, extras = []) {
  const budget = BUDGET[energie] || BUDGET.moyen
  // Durée de concentration déclarée au questionnaire d'arrivée
  const rd = db.prepare("SELECT valeur FROM settings WHERE cle='duree_bloc' AND user_id=?").get(uid)
  const confort = rd ? JSON.parse(rd.valeur) : 25
  // Bloc plus court quand la réserve est basse — jamais au-delà de ce que l'élève tient
  const blocMax = energie === 'cuit' ? Math.min(15, confort)
    : energie === 'moyen' ? confort
    : Math.round(confort * 1.3)

  const items = sources(uid)
    .map(it => ({ ...it, negligee: negligeeDepuis(uid, it.matiere), _s: 0 }))
  items.forEach(it => {
    it._s = score(uid, it)
    // Épuisé : ce qui est léger (flashcards, révision passive) passe devant.
    // Proposer 30 min de maths à quelqu'un de vidé, c'est le faire fermer l'app.
    if (energie === 'cuit') {
      if (it.leger) it._s += 70
      else if (!it.echeance || joursAvant(it.echeance) > 1) it._s -= 40
    }
  })

  // Ce que l'élève a ajouté lui-même passe en priorité haute
  extras.forEach((e, i) => items.push({
    type: 'libre', id: 0, titre: texte(e.titre, 120),
    minutes: Math.min(Math.max(Number(e.minutes) || 25, 5), 60),
    _s: 90 - i, ajoute: true
  }))

  items.sort((a, b) => b._s - a._s)

  // Remplissage : on découpe ce qui est trop long, on s'arrête au budget
  const blocs = []
  let total = 0
  for (const it of items) {
    if (total >= budget) break
    let m = it.minutes
    // Un bloc ne dépasse jamais le plafond du soir : c'est ce qui le rend démarrable.
    // Un gros devoir est simplement entamé — « avancer » suffit, il n'est pas dû ce soir.
    if (m > blocMax) m = blocMax
    if (total + m > budget) m = budget - total
    if (m < 5) continue
    const partiel = m < it.minutes
    blocs.push({
      titre: (partiel && !it.leger && !/^(Réviser|Avancer)/i.test(it.titre) ? 'Avancer : ' : '') + it.titre,
      matiere: it.matiere || null, minutes: m, partiel: partiel ? 1 : 0,
      source_type: it.type, source_id: it.id || null,
      pourquoi: it.ajoute ? "Tu l'as ajouté toi-même." : pourquoi(it, blocs.length),
      gain: it.ajoute ? "Une chose de moins dans ta tête." : gain(it),
      detail: it.detail || null
    })
    total += m
  }
  return { blocs, total }
}

// ===== API =====

// État du jour
router.get('/', (req, res) => {
  const uid = req.user.id, tj = jour()
  const plan = db.prepare('SELECT * FROM plan_soir WHERE user_id=? AND date=?').get(uid, tj)
  const blocs = plan
    ? db.prepare('SELECT * FROM plan_blocs WHERE plan_id=? ORDER BY ordre').all(plan.id)
    : []
  const h = horaires(uid)
  const maintenant = new Date().toTimeString().slice(0, 5)
  res.json({
    plan, blocs, horaires: h,
    enPause: maintenant < h.reprise,
    tardif: maintenant >= h.fin,
    maintenant,
    // Ce que l'app sait déjà, pour l'étape « qu'est-ce que tu as à faire ? »
    connu: plan ? [] : sources(uid).map(s => ({ titre: s.titre, matiere: s.matiere, echeance: s.echeance, type: s.type }))
  })
})

// Génère (ou régénère) le plan du soir
router.post('/generer', (req, res) => {
  const uid = req.user.id, tj = jour()
  const energie = ['cuit', 'moyen', 'forme'].includes(req.body.energie) ? req.body.energie : 'moyen'
  const extras = Array.isArray(req.body.extras) ? req.body.extras.slice(0, 6) : []

  const { blocs, total } = construire(uid, energie, extras)

  db.prepare('DELETE FROM plan_blocs WHERE plan_id IN (SELECT id FROM plan_soir WHERE user_id=? AND date=?)').run(uid, tj)
  db.prepare('DELETE FROM plan_soir WHERE user_id=? AND date=?').run(uid, tj)
  const info = db.prepare('INSERT INTO plan_soir (user_id, date, energie, minutes, cree) VALUES (?,?,?,?,?)')
    .run(uid, tj, energie, total, Date.now())
  const pid = info.lastInsertRowid

  const ins = db.prepare(`INSERT INTO plan_blocs
    (plan_id, user_id, titre, detail, matiere, source_type, source_id, minutes, ordre, pourquoi, gain, partiel)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
  blocs.forEach((b, i) => ins.run(pid, uid, b.titre, b.detail, b.matiere, b.source_type, b.source_id, b.minutes, i, b.pourquoi, b.gain, b.partiel || 0))

  observer(uid, 'plan_soir', energie)
  res.json({
    plan: db.prepare('SELECT * FROM plan_soir WHERE id=?').get(pid),
    blocs: db.prepare('SELECT * FROM plan_blocs WHERE plan_id=? ORDER BY ordre').all(pid)
  })
})

// Bloc terminé
router.post('/bloc/:id/fait', (req, res) => {
  const b = db.prepare('SELECT * FROM plan_blocs WHERE id=? AND user_id=?').get(req.params.id, req.user.id)
  if (!b) return res.status(404).json({ erreur: 'introuvable' })
  db.prepare("UPDATE plan_blocs SET statut='fait', fait_le=? WHERE id=?").run(Date.now(), b.id)
  // On ne clôt le devoir source que si l'élève dit l'avoir terminé.
  // Un bloc « Avancer : … » entame le travail sans le solder.
  const termine = b.partiel ? req.body.termine === true : true
  if (termine && b.source_type === 'homework') db.prepare('UPDATE homework SET fait=1 WHERE id=? AND user_id=?').run(b.source_id, req.user.id)
  if (termine && b.source_type === 'task') db.prepare("UPDATE tasks SET fait=1, statut='fait' WHERE id=? AND user_id=?").run(b.source_id, req.user.id)
  observer(req.user.id, 'bloc_fait', b.matiere)
  res.json({ ok: true })
})

// Bloc reporté : jamais perdu, toujours recalé
router.post('/bloc/:id/reporter', (req, res) => {
  const b = db.prepare('SELECT * FROM plan_blocs WHERE id=? AND user_id=?').get(req.params.id, req.user.id)
  if (!b) return res.status(404).json({ erreur: 'introuvable' })
  const quand = req.body.quand === 'matin' ? jour() : demain()
  db.prepare("UPDATE plan_blocs SET statut='reporte', reporte_au=? WHERE id=?").run(quand, b.id)
  res.json({ ok: true, reporte_au: quand, message: quand === jour() ? 'Recalé à demain matin.' : 'Recalé à demain.' })
})

// Clôture de la journée
router.post('/terminer', (req, res) => {
  const uid = req.user.id, tj = jour()
  const plan = db.prepare('SELECT * FROM plan_soir WHERE user_id=? AND date=?').get(uid, tj)
  if (!plan) return res.status(404).json({ erreur: 'aucun plan' })
  db.prepare("UPDATE plan_soir SET statut='fini', fini_le=? WHERE id=?").run(Date.now(), plan.id)

  const blocs = db.prepare('SELECT * FROM plan_blocs WHERE plan_id=?').all(plan.id)
  const faits = blocs.filter(b => b.statut === 'fait')
  const minutes = faits.reduce((s, b) => s + b.minutes, 0)

  // Ce qui attend demain — la preuve que rien n'est oublié
  const dm = demain()
  const attend = [
    ...db.prepare(`SELECT h.titre FROM homework h WHERE h.user_id=? AND h.fait=0 AND h.echeance<=? LIMIT 4`).all(uid, dm).map(x => x.titre),
    ...db.prepare(`SELECT titre FROM plan_blocs WHERE user_id=? AND statut='reporte' AND reporte_au<=? LIMIT 4`).all(uid, dm).map(x => x.titre)
  ]
  observer(uid, 'soiree_close')
  res.json({ minutes, faits: faits.length, total: blocs.length, demain: [...new Set(attend)].slice(0, 4) })
})

// Réglages horaires
router.put('/horaires', (req, res) => {
  const v = { reprise: texte(req.body.reprise, 5) || '19:00', fin: texte(req.body.fin, 5) || '22:30' }
  db.prepare("DELETE FROM settings WHERE cle='horaires_soir' AND user_id=?").run(req.user.id)
  db.prepare("INSERT INTO settings (cle, valeur, user_id) VALUES ('horaires_soir',?,?)").run(JSON.stringify(v), req.user.id)
  res.json({ ok: true, ...v })
})

// Série de soirées closes (motivation, sans culpabilisation)
router.get('/serie', (req, res) => {
  let n = 0, d = new Date()
  for (;;) {
    const p = db.prepare("SELECT 1 FROM plan_soir WHERE user_id=? AND date=? AND statut='fini'").get(req.user.id, jour(d))
    if (p) { n++; d.setDate(d.getDate() - 1) }
    else { if (jour(d) === jour()) { d.setDate(d.getDate() - 1); continue } break }
  }
  res.json({ serie: n })
})

export default router
