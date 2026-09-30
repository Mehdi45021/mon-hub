// Bibliothèque : les manuels et documents de l'élève.
// Le PDF est lu une fois, son texte est indexé page par page, puis l'IA peut
// retrouver un exercice (« exercice 4 p.142 ») ou expliquer un cours.
// Usage strictement personnel : rien n'est partagé entre comptes.
import express from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from './db.js'
import { texte } from './security.js'
import { ia } from './ai.js'
import { observer } from './cerveau.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DOSSIER = path.join(__dirname, '..', 'data', 'livres')
fs.mkdirSync(DOSSIER, { recursive: true })

const router = express.Router()
const FORMATS = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'docx',
  'text/plain': 'txt',
  'text/markdown': 'txt'
}
const upload = multer({
  dest: DOSSIER,
  limits: { fileSize: 120 * 1024 * 1024 }, // un manuel scolaire peut être lourd
  fileFilter: (req, f, cb) => {
    const ext = (f.originalname.split('.').pop() || '').toLowerCase()
    const ok = FORMATS[f.mimetype] || ['pdf', 'docx', 'doc', 'txt', 'md'].includes(ext)
    cb(null, !!ok)
  }
})
const typeDe = (f) => FORMATS[f.mimetype]
  || ({ pdf: 'pdf', docx: 'docx', doc: 'docx', txt: 'txt', md: 'txt' }[(f.originalname.split('.').pop() || '').toLowerCase()])
  || 'txt'

// Extraction du texte selon le format. On garde toujours un découpage par « page »,
// c'est ce qui permet de dire « exercice 4 p.142 ».
async function extraire(chemin, type) {
  if (type === 'pdf') {
    const { PDFParse } = await import('pdf-parse')
    const parseur = new PDFParse({ data: new Uint8Array(fs.readFileSync(chemin)) })
    const r = await parseur.getText()
    return (r.pages || []).map(p => String(p.text || '').replace(/\s+/g, ' ').trim())
  }
  if (type === 'docx') {
    const mammoth = await import('mammoth')
    const r = await mammoth.extractRawText({ path: chemin })
    return decouper(r.value)
  }
  return decouper(fs.readFileSync(chemin, 'utf8'))
}

// Word et texte n'ont pas de pages : on découpe en tranches lisibles (~2500 signes)
function decouper(texteBrut) {
  const propre = String(texteBrut || '').replace(/\r/g, '')
  const paras = propre.split(/\n\s*\n/).filter(p => p.trim())
  const pages = []
  let bloc = ''
  for (const p of paras) {
    if ((bloc + p).length > 2500 && bloc) { pages.push(bloc.trim()); bloc = '' }
    bloc += p + '\n\n'
  }
  if (bloc.trim()) pages.push(bloc.trim())
  return pages.length ? pages : [propre.slice(0, 2500)]
}

// ===== Classement automatique par matière =====
// L'IA lit le début du document et choisit parmi les matières existantes.
async function classer(uid, titre, extrait) {
  const matieres = db.prepare('SELECT id, nom FROM subjects WHERE user_id=?').all(uid)
  if (!matieres.length || !extrait) return null
  const liste = matieres.map(m => m.nom).join(', ')
  try {
    const { reponse } = await ia([{ role: 'user', content:
      `Document : « ${titre} »\n\nDébut du contenu :\n${extrait.slice(0, 1200)}\n\n` +
      `À quelle matière appartient-il ? Choisis EXACTEMENT un nom dans cette liste : ${liste}. ` +
      `Réponds uniquement par le nom, rien d'autre. Si aucune ne correspond, réponds : AUCUNE.`
    }], { max: 20 })
    const nom = reponse.trim().replace(/[."']/g, '')
    return matieres.find(m => m.nom.toLowerCase() === nom.toLowerCase())?.id || null
  } catch { return null }
}

// ===== Import d'un manuel =====
router.post('/', upload.single('fichier'), async (req, res) => {
  if (!req.file) return res.status(400).json({ erreur: 'Envoie un fichier PDF.' })
  const type = typeDe(req.file)
  const titre = texte(req.body.titre, 160) || req.file.originalname.replace(/\.(pdf|docx?|txt|md)$/i, '')
  let subject_id = req.body.subject_id ? Number(req.body.subject_id) : null

  const info = db.prepare(`INSERT INTO livres (user_id, titre, subject_id, fichier, pages, statut, cree, format)
    VALUES (?,?,?,?,0,'lecture',?,?)`).run(req.user.id, titre, subject_id, path.basename(req.file.path), Date.now(), type)
  const id = info.lastInsertRowid
  res.json({ id, titre, statut: 'lecture' }) // réponse immédiate, lecture en tâche de fond

  // Indexation (peut durer sur un gros manuel)
  try {
    const pages = await extraire(req.file.path, type)
    const ins = db.prepare('INSERT INTO livre_pages (livre_id, user_id, page, texte) VALUES (?,?,?,?)')
    const tx = db.transaction(() => {
      pages.forEach((t, i) => { if (t) ins.run(id, req.user.id, i + 1, t) })
    })
    tx()
    // Classement automatique : l'IA range le document dans la bonne matière
    if (!subject_id) {
      subject_id = await classer(req.user.id, titre, pages[0] || '')
      if (subject_id) db.prepare('UPDATE livres SET subject_id=? WHERE id=?').run(subject_id, id)
    }
    db.prepare("UPDATE livres SET pages=?, statut='pret' WHERE id=?").run(pages.length, id)
    observer(req.user.id, 'livre_importe')
  } catch (e) {
    db.prepare("UPDATE livres SET statut='erreur', erreur=? WHERE id=?").run(String(e.message).slice(0, 200), id)
  }
})

// ===== Liste =====
router.get('/', (req, res) => {
  res.json(db.prepare(`SELECT l.id, l.titre, l.pages, l.statut, l.erreur, l.cree, s.nom AS matiere
    FROM livres l LEFT JOIN subjects s ON s.id = l.subject_id
    WHERE l.user_id=? ORDER BY l.cree DESC`).all(req.user.id))
})

// ===== Une page précise (« exercice 4 p.142 ») =====
router.get('/:id/page/:n', (req, res) => {
  const p = db.prepare('SELECT page, texte FROM livre_pages WHERE livre_id=? AND user_id=? AND page=?')
    .get(req.params.id, req.user.id, req.params.n)
  if (!p) return res.status(404).json({ erreur: 'Page introuvable' })
  res.json(p)
})

// ===== Recherche dans les manuels =====
router.get('/search', (req, res) => {
  const q = texte(req.query.q, 120)
  if (!q) return res.json([])
  res.json(db.prepare(`SELECT p.livre_id, l.titre, p.page, substr(p.texte, 1, 220) AS extrait
    FROM livre_pages p JOIN livres l ON l.id = p.livre_id
    WHERE p.user_id=? AND p.texte LIKE ? LIMIT 12`).all(req.user.id, '%' + q + '%'))
})

// ===== Explication d'un passage par l'IA =====
// « Je ne comprends pas l'exercice 4 page 142 » → l'IA a le texte sous les yeux.
router.post('/expliquer', async (req, res) => {
  const livre_id = Number(req.body.livre_id)
  const page = Number(req.body.page)
  const question = texte(req.body.question, 400) || "Explique-moi cette page simplement."

  const l = db.prepare('SELECT * FROM livres WHERE id=? AND user_id=?').get(livre_id, req.user.id)
  if (!l) return res.status(404).json({ erreur: 'Manuel introuvable' })

  // On donne la page demandée et ses voisines : le cours est souvent juste avant
  const pages = db.prepare(`SELECT page, texte FROM livre_pages
    WHERE livre_id=? AND user_id=? AND page BETWEEN ? AND ? ORDER BY page`)
    .all(livre_id, req.user.id, Math.max(1, page - 1), page + 1)
  if (!pages.length) return res.status(404).json({ erreur: 'Cette page n\'a pas été lue' })

  const contexte = pages.map(p => `--- Page ${p.page} ---\n${p.texte.slice(0, 3500)}`).join('\n\n')
  try {
    const { reponse } = await ia([{ role: 'user', content: `${question}\n\nExtrait de « ${l.titre} » :\n\n${contexte}` }], {
      system: "Tu es un professeur particulier patient. Explique à un lycéen, simplement, étape par étape, "
        + "en partant de l'extrait fourni. Si c'est un exercice, guide-le vers la solution sans la donner d'emblée. "
        + "Si l'extrait ne contient pas la réponse, dis-le franchement.",
      max: 900
    })
    observer(req.user.id, 'livre_explique')
    res.json({ reponse, pages: pages.map(p => p.page), livre: l.titre })
  } catch (e) { res.status(e.code || 500).json({ erreur: e.message }) }
})

// ===== Suppression =====
router.delete('/:id', (req, res) => {
  const l = db.prepare('SELECT * FROM livres WHERE id=? AND user_id=?').get(req.params.id, req.user.id)
  if (!l) return res.status(404).json({ erreur: 'introuvable' })
  db.prepare('DELETE FROM livre_pages WHERE livre_id=?').run(l.id)
  db.prepare('DELETE FROM livres WHERE id=?').run(l.id)
  try { fs.unlinkSync(path.join(DOSSIER, l.fichier)) } catch {}
  res.json({ ok: true })
})

// Contexte manuel pour le Chat : les passages liés à une question
export function extraitsPourIA(uid, question) {
  const mots = question.split(/\s+/).filter(m => m.length > 4).slice(0, 4)
  if (!mots.length) return ''
  const trouves = []
  for (const m of mots) {
    const r = db.prepare(`SELECT l.titre, p.page, substr(p.texte,1,600) AS t
      FROM livre_pages p JOIN livres l ON l.id=p.livre_id
      WHERE p.user_id=? AND p.texte LIKE ? LIMIT 2`).all(uid, '%' + m + '%')
    trouves.push(...r)
  }
  if (!trouves.length) return ''
  return 'EXTRAITS DE TES MANUELS :\n' + trouves.slice(0, 3)
    .map(x => `[${x.titre}, p.${x.page}] ${x.t}`).join('\n')
}

export default router
