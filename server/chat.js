import express from 'express'
import db from './db.js'
import { ia, extraireJSON } from './ai.js'
import { contexteCerveau, observer, ajouterMessage } from './cerveau.js'
import { chercherWeb, definitionWiki } from './recherche.js'
import { extraitsPourIA } from './livres.js'

const router = express.Router()
const today = () => new Date().toISOString().slice(0, 10)

// Résumé court de TOUTES les données du compte (économie de tokens, tronqué ~150 car.)
function contexteDonnees(u) {
  const coupe = (s = '') => (s.length > 150 ? s.slice(0, 150) + '…' : s)
  const brut = (s = '') => coupe(String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
  const tj = today()
  const tasks = db.prepare('SELECT titre, priorite FROM tasks WHERE user_id=? AND fait=0 ORDER BY id DESC LIMIT 15').all(u)
  const notes = db.prepare('SELECT titre, contenu FROM notes WHERE user_id=? ORDER BY maj DESC LIMIT 8').all(u)
  const events = db.prepare('SELECT titre, date FROM events WHERE user_id=? AND date>=? ORDER BY date LIMIT 10').all(u, tj)
  const devoirs = db.prepare('SELECT h.titre, h.echeance, s.nom AS matiere FROM homework h LEFT JOIN subjects s ON s.id=h.subject_id WHERE h.user_id=? AND h.fait=0 ORDER BY h.echeance LIMIT 12').all(u)
  const fiches = db.prepare('SELECT titre, contenu FROM revisions WHERE user_id=? ORDER BY maj DESC LIMIT 8').all(u)
  const flash = db.prepare('SELECT COUNT(*) c FROM flashcards WHERE user_id=? AND (due IS NULL OR due<=?)').get(u, tj).c
  const habits = db.prepare('SELECT nom FROM habits WHERE user_id=? LIMIT 10').all(u)
  return [
    'Tâches à faire: ' + (tasks.map(t => `${t.titre} (${t.priorite})`).join(', ') || 'aucune'),
    'Devoirs à rendre: ' + (devoirs.map(d => `${d.titre}${d.matiere ? ' [' + d.matiere + ']' : ''} pour ${d.echeance}`).join(', ') || 'aucun'),
    'Événements à venir: ' + (events.map(e => `${e.date} ${e.titre}`).join(', ') || 'aucun'),
    'Notes: ' + (notes.map(n => `${n.titre}: ${brut(n.contenu)}`).join(' | ') || 'aucune'),
    'Fiches de révision: ' + (fiches.map(fr => `${fr.titre}: ${brut(fr.contenu)}`).join(' | ') || 'aucune'),
    `Flashcards à réviser aujourd'hui: ${flash}`,
    'Habitudes suivies: ' + (habits.map(h => h.nom).join(', ') || 'aucune')
  ].join('\n')
}

// Détection de la langue du message. Les modèles ouverts répondent souvent dans
// la langue du prompt système : on doit donc NOMMER la langue attendue.
function detecter(t = '') {
  if (/[\u0600-\u06FF]/.test(t)) return 'arabe'
  if (/[\uAC00-\uD7AF]/.test(t)) return 'coréen'
  if (/[\u3040-\u30FF]/.test(t)) return 'japonais'
  if (/[\u4E00-\u9FFF]/.test(t)) return 'chinois'
  if (/[\u0400-\u04FF]/.test(t)) return 'russe'
  if (/[\u0900-\u097F]/.test(t)) return 'hindi'
  if (/[\u0E00-\u0E7F]/.test(t)) return 'thaï'
  if (/[\u0370-\u03FF]/.test(t)) return 'grec'
  const b = ' ' + t.toLowerCase() + ' '
  const score = (mots) => mots.reduce((n, m) => n + (b.includes(' ' + m + ' ') ? 1 : 0), 0)
  const langues = [
    ['français', ['je', 'tu', 'le', 'la', 'les', 'des', 'quoi', 'faire', 'mes', 'est', 'pour', 'que', 'aujourd\'hui']],
    ['anglais', ['the', 'what', 'do', 'you', 'my', 'have', 'today', 'how', 'and', 'is', 'to', 'need']],
    ['espagnol', ['que', 'qué', 'hola', 'tengo', 'hacer', 'hoy', 'para', 'mis', 'como', 'cómo', 'los']],
    ['allemand', ['ich', 'was', 'muss', 'heute', 'meine', 'und', 'ist', 'nicht', 'wie']],
    ['italien', ['che', 'cosa', 'devo', 'fare', 'oggi', 'sono', 'miei', 'come', 'per']],
    ['portugais', ['que', 'fazer', 'hoje', 'meus', 'como', 'para', 'estou', 'preciso']],
    ['turc', ['ne', 'bugün', 'yapmam', 'benim', 'nasıl', 'için', 'var']],
    ['néerlandais', ['wat', 'moet', 'vandaag', 'mijn', 'hoe', 'voor', 'ik']]
  ]
  let best = null, max = 1
  for (const [nom, mots] of langues) { const sc = score(mots); if (sc > max) { max = sc; best = nom } }
  return best
}

// Le plan du soir déjà calculé : l'assistant doit conseiller le MÊME ordre que l'app,
// sinon il dirait une chose et l'écran une autre.
function contextePlan(uid) {
  const p = db.prepare("SELECT * FROM plan_soir WHERE user_id=? AND date=?").get(uid, today())
  if (!p) return ''
  const blocs = db.prepare("SELECT titre, minutes, statut, pourquoi FROM plan_blocs WHERE plan_id=? ORDER BY ordre").all(p.id)
  if (!blocs.length) return ''
  const restants = blocs.filter(b => b.statut === 'a_faire')
  if (!restants.length) return "PLAN DU SOIR : tout est fait. Il peut s'arrêter."
  return 'PLAN DU SOIR DÉJÀ CALCULÉ (conseille cet ordre) :\n' +
    restants.map((b, i) => `${i + 1}. ${b.titre} — ${b.minutes} min — raison : ${b.pourquoi}`).join('\n')
}

// Langue de réponse : celle réglée par l'utilisateur, sinon celle détectée.
function consigneLangue(uid, question) {
  const r = db.prepare("SELECT valeur FROM settings WHERE cle='langue' AND user_id=?").get(uid)
  const choisie = r ? JSON.parse(r.valeur) : null
  const langue = (choisie && choisie !== 'auto') ? choisie : detecter(question)
  return langue
    ? `LANGUE OBLIGATOIRE : réponds intégralement en ${langue}. N'utilise aucune autre langue.`
    : "Réponds dans la langue du message de l'utilisateur."
}

// Ce que l'assistant sait réellement faire — pour se présenter sans inventer.
const CAPACITES = `TES CAPACITÉS RÉELLES (n'en invente aucune autre) :
- Organiser la soirée : dire par quoi commencer, dans quel ordre, et pourquoi
- Voir tes devoirs, évaluations, tâches, notes, fiches, flashcards et habitudes
- Créer une tâche, une note ou un événement à ta demande
- Expliquer un cours ou un exercice à partir des manuels importés (« exercice 4 page 142 »)
- Résumer une note, en tirer des flashcards ou un quiz
- Chercher sur le web et citer les sources
- Traduire, et t'aider en langues
- Répondre dans ta langue, quelle qu'elle soit`

const SYSTEM = `Tu es l'assistant de Mon Hub, le compagnon d'études de l'utilisateur.

${CAPACITES}

RÈGLES DE FORME — applique-les systématiquement :
1. Va droit au but. Pas de préambule du type « Bien sûr ! », « Voici… », « Je vais t'aider à… ».
2. Dès qu'il y a plus d'une chose à dire, utilise une LISTE À PUCES (« - ») ou numérotée.
   Une phrase par point, courte. Jamais de gros pavé de texte.
3. Mets en **gras** ce qui compte : un nom de devoir, une durée, une échéance.
4. Termine par UNE phrase d'ouverture ou de conseil, jamais plus.

SI ON TE DEMANDE QUOI FAIRE (« qu'est-ce que j'ai à faire », « par où je commence », « aide-moi à m'organiser ») :
- Propose un ORDRE, pas un inventaire. Format attendu :
  « Je te propose de commencer par **X**, parce que [raison courte].
    Puis tu enchaînes sur **Y**, parce que [raison].
    Si tu as encore de l'énergie : **Z**. »
- Justifie TOUJOURS par une raison concrète : l'échéance, la durée, l'éval qui approche,
  la matière négligée. Jamais « parce que c'est important ».
- Donne une durée estimée par étape.
- Si sa soirée est déjà planifiée (voir PLAN DU SOIR ci-dessous), appuie-toi dessus.
- S'il n'a rien à faire, dis-le simplement et propose de l'avance ou du repos.

SI ON TE DEMANDE CE QUE TU SAIS FAIRE (« tu peux faire quoi », « tu sers à quoi », « aide ») :
- Réponds de façon pédagogique et concrète, en listant tes capacités par thème.
- Pour chaque capacité, donne un EXEMPLE de phrase que l'utilisateur pourrait te dire.
- Termine en lui demandant par quoi il veut commencer.

TON : celui d'un ami qui s'y connaît. Tutoiement. Encourageant, jamais moralisateur,
jamais culpabilisant. Tu ne dis jamais « tu aurais dû ».

Si l'utilisateur demande de CRÉER une tâche, une note ou un événement :
- réponds par UNE seule phrase de confirmation brève (ex: « C'est ajouté. »), SANS lister les champs ni expliquer,
- puis ajoute à la fin un bloc:
\`\`\`json
{"action":"creer","type":"task|note|event","titre":"...","date":"AAAA-MM-JJ (events seulement)","priorite":"haute|normale|basse (task)","contenu":"... (note)"}
\`\`\`
N'ajoute ce bloc QUE si l'utilisateur demande explicitement de créer, ajouter ou noter quelque chose.
Une simple question (« c'est quoi… », « explique-moi… », « comment… ») ne crée JAMAIS rien.
Dans le doute, ne crée rien. N'affiche jamais de JSON brut hors du bloc. Aujourd'hui: ${today()}.`

// Garde-fou : même si le modèle propose une création, on ne l'exécute que si
// l'utilisateur l'a réellement demandée. Poser une question ne doit rien créer.
const VEUT_CREER = /\b(ajoute|ajouter|cr[ée]e|cr[ée]er|note[rz]?|noter|enregistre|rappelle[- ]moi|planifie|programme|mets? (?:une|un|ça|le|la))\b/i

// Exécute une action décidée par l'IA (dans le compte de l'utilisateur)
function executer(a, u) {
  if (!a || a.action !== 'creer') return null
  if (a.type === 'task') { db.prepare('INSERT INTO tasks (titre, priorite, statut, cree, derniere, user_id) VALUES (?,?,?,?,?,?)').run(a.titre, a.priorite || 'normale', 'afaire', Date.now(), today(), u); return `Tâche créée : ${a.titre}` }
  if (a.type === 'note') { db.prepare('INSERT INTO notes (titre, contenu, maj, user_id) VALUES (?,?,?,?)').run(a.titre || 'Sans titre', a.contenu || '', Date.now(), u); return `Note créée : ${a.titre}` }
  if (a.type === 'event') { db.prepare('INSERT INTO events (titre, date, note, user_id) VALUES (?,?,?,?)').run(a.titre, a.date || today(), '', u); return `Événement créé : ${a.titre} (${a.date || today()})` }
  return null
}

router.post('/', async (req, res) => {
  const messages = (req.body.messages || []).slice(-6) // 6 derniers messages
  const question = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || ''
  observer(req.user.id, 'chat')

  // Le chat peut aller chercher sur le web quand on le lui demande (ou en mode "web")
  let sources = []
  let bloc = ''
  const veutWeb = req.body.web === true ||
    /\b(cherche|recherche|google|sur (le )?web|actualit|dernières? (24|nouvelles)|aujourd'hui dans le monde)\b/i.test(question)
  if (veutWeb && question) {
    const periode = /\b(24 ?h|dernières 24|aujourd'hui|actualit)/i.test(question) ? 'jour' : null
    const [web, wiki] = await Promise.all([
      chercherWeb(question, periode).catch(() => []),
      definitionWiki(question.replace(/^(c'est quoi|définition de|qu'est[- ]ce que)\s+/i, '').trim()).catch(() => null)
    ])
    if (wiki) { bloc += `\nWIKIPÉDIA — [W] ${wiki.titre} : ${wiki.extrait}`; sources.push({ ref: 'W', type: 'Wikipédia', titre: wiki.titre, url: wiki.url }) }
    if (web.length) {
      bloc += '\nRÉSULTATS WEB :\n' + web.map((r, i) => `[${i + 1}] ${r.titre} — ${r.extrait} (${r.url})`).join('\n')
      sources.push(...web.map((r, i) => ({ ref: String(i + 1), type: 'Web', titre: r.titre, url: r.url })))
    }
  }

  // Ses propres manuels : l'IA cite le cours de SON livre, pas une généralité
  const manuels = question ? extraitsPourIA(req.user.id, question) : ''

  // Le plan du soir, s'il existe : l'assistant doit s'appuyer dessus pour conseiller un ordre
  const planSoir = contextePlan(req.user.id)

  const sys = consigneLangue(req.user.id, question) + '\n\n' + SYSTEM
    + '\n\nCE QUE TU SAIS DE L\'UTILISATEUR :\n' + contexteCerveau(req.user.id)
    + (manuels ? '\n\n' + manuels : '')
    + (planSoir ? '\n\n' + planSoir : '')
    + '\n\nDonnées actuelles:\n' + contexteDonnees(req.user.id)
    + (bloc ? '\n\nSOURCES WEB (cite-les avec [n]) :' + bloc : '')
  try {
    const { reponse, via } = await ia(messages, { system: sys, max: 800 })
    const fait = VEUT_CREER.test(question) ? executer(extraireJSON(reponse), req.user.id) : null
    // Nettoyage de l'affichage : blocs de code, JSON brut, puis marqueurs de fence orphelins
    let propre = reponse.replace(/```[\s\S]*?```/g, '')
    if (fait) propre = propre.replace(/\{[\s\S]*\}|\[[\s\S]*\]/g, '')
    propre = propre.replace(/```[a-z]*/gi, '').replace(/\n{3,}/g, '\n\n').trim()
    const finale = propre + (fait ? `${propre ? '\n\n' : ''}✓ ${fait}` : '')
    // Historique de discussion
    if (req.body.conv_id) {
      if (question) ajouterMessage(req.user.id, req.body.conv_id, 'user', question)
      ajouterMessage(req.user.id, req.body.conv_id, 'assistant', finale, sources.length ? sources : null)
    }
    res.json({ reponse: finale, via, action: !!fait, sources })
  } catch (e) { res.status(e.code || 500).json({ erreur: e.message }) }
})

export default router
