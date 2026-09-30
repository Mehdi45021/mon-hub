// Questionnaire d'arrivée : ce qui permet à l'assistant de te connaître
// avant même la première soirée de travail. Chaque réponse alimente le Cerveau
// ET règle concrètement l'algorithme (horaires, durée des blocs, priorités).
import express from 'express'
import db from './db.js'
import { texte } from './security.js'

const router = express.Router()

// 15 questions. Chacune sert à quelque chose de précis — aucune n'est décorative.
export const QUESTIONS = [
  { id: 'niveau', q: 'Tu es en quelle classe ?', icone: 'GraduationCap',
    options: ['Seconde', 'Première', 'Terminale', 'Études supérieures', 'Collège'] },

  { id: 'objectif', q: "Ton objectif cette année ?",
    options: ['Remonter mes notes', 'Rester à niveau sans stress', 'Viser une mention', 'Décrocher mon orientation'] },

  { id: 'fortes', q: 'Dans quelles matières tu t\'en sors bien ?', multi: true,
    options: ['Maths', 'Physique-Chimie', 'SVT', 'Français', 'Histoire-Géo', 'Langues', 'Philosophie', 'SES', 'Autre'] },

  { id: 'faibles', q: 'Et lesquelles te posent problème ?', multi: true,
    options: ['Maths', 'Physique-Chimie', 'SVT', 'Français', 'Histoire-Géo', 'Langues', 'Philosophie', 'SES', 'Autre'] },

  { id: 'moment', q: 'Tu travailles le mieux à quel moment ?',
    options: ['Le matin tôt', "En fin d'après-midi", 'Le soir', 'Tard la nuit'] },

  { id: 'rentree', q: 'Tu rentres chez toi vers quelle heure ?',
    options: ['Avant 16 h', 'Vers 17 h', 'Vers 18 h', 'Après 18 h 30'] },

  { id: 'coucher', q: 'Tu veux avoir fini de travailler à…',
    options: ['20 h 30', '21 h 30', '22 h 30', '23 h 30'] },

  { id: 'duree', q: 'Tu tiens combien de temps sans décrocher ?',
    options: ['10 minutes', '20 minutes', '30 minutes', 'Une heure ou plus'] },

  { id: 'blocage', q: "Ce qui te bloque le plus, c'est…",
    options: ['Me lancer', 'Rester concentré', 'Comprendre le cours', "Savoir par où commencer", 'Le manque de temps'] },

  { id: 'revision', q: 'Tu révises plutôt comment ?', multi: true,
    options: ['Je relis mes cours', 'Je fais des fiches', 'Je refais des exercices', 'Flashcards / par cœur', 'J\'explique à voix haute'] },

  { id: 'distraction', q: 'Ce qui te détourne le plus du travail ?',
    options: ['Mon téléphone', 'Les jeux vidéo', 'La fatigue', 'Le bruit à la maison', 'Rien de particulier'] },

  { id: 'stress', q: 'Ton niveau de stress scolaire, en ce moment ?',
    options: ['Très calme', 'Ça va', 'Souvent tendu', 'Vraiment beaucoup'] },

  { id: 'activites', q: 'Tu as des activités en dehors des cours ?', multi: true,
    options: ['Sport', 'Musique', 'Jeux vidéo', 'Job / petit boulot', 'Association', 'Non, pas vraiment'] },

  { id: 'aide', q: "Quand tu ne comprends pas, tu fais quoi ?",
    options: ['Je demande à un prof', 'Je demande à un ami', 'Je cherche sur internet', "Je laisse tomber"] },

  { id: 'attente', q: "Ce que tu attends de l'app, avant tout ?",
    options: ["Qu'elle me dise par où commencer", 'Que je réussisse à m\'y mettre',
              "Que j'arrête de tout faire au dernier moment", 'Que je stresse moins'] }
]

router.get('/questions', (req, res) => res.json(QUESTIONS))

// Traduction des réponses en réglages concrets
const HEURE_RENTREE = { 'Avant 16 h': '16:30', 'Vers 17 h': '17:30', 'Vers 18 h': '18:30', 'Après 18 h 30': '19:30' }
const HEURE_FIN = { '20 h 30': '20:30', '21 h 30': '21:30', '22 h 30': '22:30', '23 h 30': '23:30' }

router.post('/', (req, res) => {
  const r = req.body.reponses || {}
  const uid = req.user.id
  const now = Date.now()

  // 1) Mémoire du Cerveau : ce que l'assistant saura de toi
  const fait = db.prepare(`INSERT INTO brain_facts (user_id, sphere, categorie, cle, valeur, source, poids, cree, maj)
    VALUES (?,?,?,?,?, 'profil', 3, ?, ?)`)
  db.prepare("DELETE FROM brain_facts WHERE user_id=? AND source='profil'").run(uid)

  const tx = db.transaction(() => {
    for (const q of QUESTIONS) {
      const v = r[q.id]
      if (!v || (Array.isArray(v) && !v.length)) continue
      const valeur = texte(Array.isArray(v) ? v.join(', ') : String(v), 300)
      const sphere = ['niveau', 'objectif', 'fortes', 'faibles', 'revision', 'aide'].includes(q.id) ? 'pro' : 'perso'
      fait.run(uid, sphere, 'profil', q.q.replace(/\s*\?$/, ''), valeur, now, now)
    }
  })
  tx()

  // 2) Réglages réels de l'algorithme du soir
  const reprise = HEURE_RENTREE[r.rentree] || '19:00'
  const fin = HEURE_FIN[r.coucher] || '22:30'
  db.prepare("DELETE FROM settings WHERE cle='horaires_soir' AND user_id=?").run(uid)
  db.prepare("INSERT INTO settings (cle, valeur, user_id) VALUES ('horaires_soir',?,?)")
    .run(JSON.stringify({ reprise, fin }), uid)

  // Durée de concentration → taille des blocs
  const dureeBloc = { '10 minutes': 10, '20 minutes': 20, '30 minutes': 30, 'Une heure ou plus': 40 }[r.duree] || 25
  db.prepare("DELETE FROM settings WHERE cle='duree_bloc' AND user_id=?").run(uid)
  db.prepare("INSERT INTO settings (cle, valeur, user_id) VALUES ('duree_bloc',?,?)").run(JSON.stringify(dureeBloc), uid)

  // 3) Les matières citées deviennent de vraies matières
  const COULEURS = ['#E0915C', '#5FB37A', '#7AA2E3', '#A78BFA', '#E0708C', '#5CC8C2']
  const matieres = [...new Set([...(r.fortes || []), ...(r.faibles || [])])].filter(m => m !== 'Autre')
  matieres.forEach((nom, i) => {
    if (!db.prepare('SELECT 1 FROM subjects WHERE nom=? AND user_id=?').get(nom, uid)) {
      db.prepare('INSERT INTO subjects (nom, couleur, user_id) VALUES (?,?,?)').run(nom, COULEURS[i % COULEURS.length], uid)
    }
  })

  db.prepare("DELETE FROM settings WHERE cle='profil_fait' AND user_id=?").run(uid)
  db.prepare("INSERT INTO settings (cle, valeur, user_id) VALUES ('profil_fait','true',?)").run(uid)
  res.json({ ok: true, matieres: matieres.length, horaires: { reprise, fin }, dureeBloc })
})

// Le profil a-t-il déjà été rempli ?
router.get('/statut', (req, res) => {
  const f = db.prepare("SELECT 1 FROM settings WHERE cle='profil_fait' AND user_id=?").get(req.user.id)
  res.json({ fait: !!f })
})

export default router

// ===== Langue de l'application et de l'assistant =====
export const LANGUES = [
  ['auto', 'Automatique', '🌐'], ['français', 'Français', '🇫🇷'], ['English', 'English', '🇬🇧'],
  ['español', 'Español', '🇪🇸'], ['العربية', 'العربية', '🇸🇦'], ['darija', 'الدارجة', '🇲🇦'],
  ['Deutsch', 'Deutsch', '🇩🇪'], ['italiano', 'Italiano', '🇮🇹'], ['português', 'Português', '🇵🇹'],
  ['Nederlands', 'Nederlands', '🇳🇱'], ['polski', 'Polski', '🇵🇱'], ['русский', 'Русский', '🇷🇺'],
  ['türkçe', 'Türkçe', '🇹🇷'], ['中文', '中文', '🇨🇳'], ['日本語', '日本語', '🇯🇵'],
  ['한국어', '한국어', '🇰🇷'], ['हिन्दी', 'हिन्दी', '🇮🇳'], ['tiếng Việt', 'Tiếng Việt', '🇻🇳'],
  ['ไทย', 'ไทย', '🇹🇭'], ['svenska', 'Svenska', '🇸🇪'], ['ελληνικά', 'Ελληνικά', '🇬🇷']
]
router.get('/langues', (req, res) => res.json(LANGUES.map(([id, nom, drapeau]) => ({ id, nom, drapeau }))))
router.put('/langue', (req, res) => {
  const id = String(req.body.langue || 'auto')
  if (!LANGUES.some(l => l[0] === id)) return res.status(400).json({ erreur: 'Langue inconnue' })
  db.prepare("DELETE FROM settings WHERE cle='langue' AND user_id=?").run(req.user.id)
  db.prepare("INSERT INTO settings (cle, valeur, user_id) VALUES ('langue',?,?)").run(JSON.stringify(id), req.user.id)
  res.json({ ok: true, langue: id })
})
router.get('/langue', (req, res) => {
  const r = db.prepare("SELECT valeur FROM settings WHERE cle='langue' AND user_id=?").get(req.user.id)
  res.json({ langue: r ? JSON.parse(r.valeur) : 'auto' })
})
