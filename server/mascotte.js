// Le compagnon : un petit renard dont l'humeur dépend de ton travail.
// Principe : le travail est sa nourriture. Tu bosses → il va bien.
// Tu ne fais rien pendant des jours → il s'affaiblit, sans jamais culpabiliser.
import express from 'express'
import db from './db.js'
import { texte } from './security.js'

const router = express.Router()
const jour = (d = new Date()) => d.toISOString().slice(0, 10)

// Minutes de travail réellement effectuées un jour donné
function minutesDuJour(uid, date) {
  const r = db.prepare(`SELECT COALESCE(SUM(b.minutes),0) m FROM plan_blocs b
    JOIN plan_soir p ON p.id = b.plan_id
    WHERE b.user_id=? AND p.date=? AND b.statut='fait'`).get(uid, date)
  const pomo = db.prepare('SELECT COUNT(*) c FROM pomodoro WHERE user_id=? AND date=?').get(uid, date).c
  return r.m + pomo * 25
}

// Satiété 0–100 : elle monte avec le travail, redescend avec les jours creux
export function etat(uid) {
  let satiete = 45           // point de départ neutre
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const m = minutesDuJour(uid, jour(d))
    if (m >= 45) satiete += 14
    else if (m >= 20) satiete += 9
    else if (m > 0) satiete += 4
    else satiete -= 9        // un jour sans rien : il a faim
  }
  satiete = Math.max(0, Math.min(100, satiete))

  // Série de jours consécutifs avec du travail
  let serie = 0
  for (let i = 0; i < 60; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    if (minutesDuJour(uid, jour(d)) > 0) serie++
    else { if (i === 0) continue; break }   // aujourd'hui pas encore commencé : on n'en tient pas rigueur
  }

  const aujourdhui = minutesDuJour(uid, jour())
  const h = new Date().getHours()

  // Humeur : l'état visible du compagnon
  let humeur
  if (h >= 23 || h < 6) humeur = 'endormi'
  else if (satiete >= 80) humeur = 'rayonnant'
  else if (satiete >= 60) humeur = 'content'
  else if (satiete >= 35) humeur = 'neutre'
  else if (satiete >= 15) humeur = 'fatigue'
  else humeur = 'affame'

  const nom = (db.prepare("SELECT valeur FROM settings WHERE cle='mascotte_nom' AND user_id=?").get(uid))
  return {
    nom: nom ? JSON.parse(nom.valeur) : 'Nino',
    satiete, serie, minutesAujourdhui: aujourdhui, humeur,
    phrase: phrase(humeur, serie, aujourdhui, h)
  }
}

// Ce qu'il dit : encourageant, jamais moralisateur
function phrase(humeur, serie, minutes, h) {
  if (humeur === 'endormi') return "Il dort. Toi aussi tu devrais."
  if (minutes > 0 && humeur !== 'affame') {
    if (minutes >= 60) return `${minutes} min aujourd'hui — il est repu.`
    return `${minutes} min aujourd'hui. Il apprécie.`
  }
  switch (humeur) {
    case 'rayonnant': return serie > 3 ? `${serie} jours d'affilée. Il est fier de toi.` : "Il pète la forme."
    case 'content': return "Il va bien. Un petit bloc et il sera ravi."
    case 'neutre': return "Il attend tranquillement. Rien d'urgent."
    case 'fatigue': return "Il commence à avoir faim. 10 minutes suffiraient."
    default: return "Il n'a rien mangé depuis un moment. Même 5 minutes l'aideraient."
  }
}

router.get('/', (req, res) => res.json(etat(req.user.id)))

// Renommer son compagnon
router.put('/nom', (req, res) => {
  const nom = texte(req.body.nom, 20) || 'Nino'
  db.prepare("DELETE FROM settings WHERE cle='mascotte_nom' AND user_id=?").run(req.user.id)
  db.prepare("INSERT INTO settings (cle, valeur, user_id) VALUES ('mascotte_nom',?,?)").run(JSON.stringify(nom), req.user.id)
  res.json({ ok: true, nom })
})

export default router
