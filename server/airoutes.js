import express from 'express'
import db from './db.js'
import { ia, extraireJSON } from './ai.js'

const router = express.Router()

// Résumé d'un texte long (note ou document)
router.post('/summarize', async (req, res) => {
  const texte = (req.body.text || '').slice(0, 8000)
  if (!texte.trim()) return res.json({ resume: '' })
  try {
    const { reponse } = await ia([{ role: 'user', content: 'Résume ce texte en français, en 3 à 5 points clés concis:\n\n' + texte }], { max: 500 })
    res.json({ resume: reponse.trim() })
  } catch (e) { res.status(e.code || 500).json({ erreur: e.message }) }
})

// Génère des flashcards à partir d'un texte ; les insère si subject_id fourni / save
router.post('/flashcards', async (req, res) => {
  const texte = (req.body.text || '').slice(0, 8000)
  if (!texte.trim()) return res.json({ cartes: [] })
  try {
    const { reponse } = await ia([{ role: 'user', content:
      'À partir de ce texte, génère 5 flashcards de révision. Réponds UNIQUEMENT par un tableau JSON [{"question":"...","reponse":"..."}].\n\n' + texte
    }], { max: 700 })
    const cartes = extraireJSON(reponse)
    if (!Array.isArray(cartes)) return res.status(502).json({ erreur: 'Format IA inattendu' })
    if (req.body.save) {
      const sid = req.body.subject_id || null
      const stmt = db.prepare('INSERT INTO flashcards (subject_id, question, reponse, box, due, user_id) VALUES (?,?,?,1,NULL,?)')
      for (const c of cartes) if (c.question && c.reponse) stmt.run(sid, c.question, c.reponse, req.user.id)
    }
    res.json({ cartes })
  } catch (e) { res.status(e.code || 500).json({ erreur: e.message }) }
})

// Génère un quiz (QCM) à partir d'un texte
router.post('/quiz', async (req, res) => {
  const texte = (req.body.text || '').slice(0, 8000)
  if (!texte.trim()) return res.json({ questions: [] })
  try {
    const { reponse } = await ia([{ role: 'user', content:
      'Crée un quiz de 5 questions QCM à partir de ce texte. Réponds UNIQUEMENT en JSON: [{"question":"...","choix":["a","b","c","d"],"reponse":0}] (reponse = index correct).\n\n' + texte
    }], { max: 900 })
    const questions = extraireJSON(reponse)
    res.json({ questions: Array.isArray(questions) ? questions : [] })
  } catch (e) { res.status(e.code || 500).json({ erreur: e.message }) }
})

// Traduction rapide via IA vers une langue cible
router.post('/translate', async (req, res) => {
  const texte = (req.body.text || '').slice(0, 1000)
  const cible = req.body.cible || 'Anglais'
  if (!texte.trim()) return res.json({ traduction: '' })
  try {
    const { reponse } = await ia([{ role: 'user', content: `Traduis en ${cible}. Réponds UNIQUEMENT par la traduction, sans guillemets ni explication:\n\n${texte}` }], { max: 300 })
    res.json({ traduction: reponse.trim() })
  } catch (e) { res.status(e.code || 500).json({ erreur: e.message }) }
})

// Recherche sémantique (par le sens) dans notes + fiches
router.post('/search', async (req, res) => {
  const q = (req.body.q || '').trim()
  if (!q) return res.json({ resultats: [] })
  const coupe = (s = '') => s.slice(0, 200)
  const items = [
    ...db.prepare('SELECT id, titre, contenu FROM notes WHERE user_id=?').all(req.user.id).map(x => ({ ...x, type: 'notes' })),
    ...db.prepare('SELECT id, titre, contenu FROM revisions WHERE user_id=?').all(req.user.id).map(x => ({ ...x, type: 'revisions' }))
  ]
  if (!items.length) return res.json({ resultats: [] })
  const liste = items.map((x, i) => `${i}: [${x.type}] ${x.titre} — ${coupe(x.contenu)}`).join('\n')
  try {
    const { reponse } = await ia([{ role: 'user', content:
      `Voici des documents numérotés. Question: "${q}". Renvoie UNIQUEMENT un tableau JSON des index (max 5) des documents les plus pertinents par le SENS.\n\n${liste}`
    }], { max: 100 })
    const idx = extraireJSON(reponse)
    const sel = Array.isArray(idx) ? idx.map(i => items[i]).filter(Boolean) : []
    res.json({ resultats: sel.map(x => ({ id: x.id, type: x.type, titre: x.titre, extrait: coupe(x.contenu) })) })
  } catch (e) { res.status(e.code || 500).json({ erreur: e.message }) }
})

export default router
