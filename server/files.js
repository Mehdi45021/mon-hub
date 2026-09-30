import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Racine sandbox : chaque utilisateur a SON dossier data/fichiers/u<id>
const BASE = path.join(__dirname, '..', 'data', 'fichiers')
fs.mkdirSync(BASE, { recursive: true })

function rootDe(uid) {
  const r = path.join(BASE, 'u' + uid)
  fs.mkdirSync(r, { recursive: true })
  return r
}

const router = express.Router()

// Résout un chemin relatif en absolu et bloque toute sortie de la racine (path traversal)
function safe(uid, rel = '') {
  const ROOT = rootDe(uid)
  const abs = path.resolve(ROOT, '.' + path.sep + (rel || ''))
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) {
    throw Object.assign(new Error('Chemin hors sandbox'), { code: 403 })
  }
  return abs
}

// ===== Verrous (par utilisateur) =====
const cleLocks = (uid) => 'files_locks_u' + uid
const cleCode = (uid) => 'files_code_u' + uid
const lireSetting = (cle) => { const r = db.prepare('SELECT valeur FROM settings WHERE cle=? AND user_id IS NULL').get(cle) || db.prepare('SELECT valeur FROM settings WHERE cle=?').get(cle); return r ? JSON.parse(r.valeur) : null }
function ecrireSetting(cle, val) {
  db.prepare('DELETE FROM settings WHERE cle=?').run(cle)
  db.prepare('INSERT INTO settings (cle, valeur) VALUES (?,?)').run(cle, JSON.stringify(val))
}
const getLocks = (uid) => lireSetting(cleLocks(uid)) || []
const getCode = (uid) => lireSetting(cleCode(uid))
const estVerrouille = (uid, rel) => getLocks(uid).some(l => rel === l || (rel || '').startsWith(l + '/'))
function bloquer(uid, rel) {
  if (estVerrouille(uid, rel)) throw Object.assign(new Error('Verrouillé'), { code: 423 })
}

router.post('/lock', (req, res) => {
  const { path: rel, code } = req.body
  const uid = req.user.id
  if (!rel) return res.status(400).json({ erreur: 'Chemin requis' })
  const existant = getCode(uid)
  if (!existant) {
    if (!code || code.length < 4) return res.status(400).json({ erreur: 'Choisis un code d\'au moins 4 caractères' })
    ecrireSetting(cleCode(uid), code)
  } else if (code !== existant) return res.status(403).json({ erreur: 'Code incorrect' })
  const locks = getLocks(uid)
  if (!locks.includes(rel)) { locks.push(rel); ecrireSetting(cleLocks(uid), locks) }
  res.json({ ok: true })
})
router.post('/unlock', (req, res) => {
  const uid = req.user.id
  if (req.body.code !== getCode(uid)) return res.status(403).json({ erreur: 'Code incorrect' })
  ecrireSetting(cleLocks(uid), getLocks(uid).filter(l => l !== req.body.path))
  res.json({ ok: true })
})

// Liste le contenu d'un dossier
router.get('/list', (req, res) => {
  try {
    const uid = req.user.id, rel = req.query.path || ''
    bloquer(uid, rel)
    const abs = safe(uid, rel)
    const items = fs.readdirSync(abs, { withFileTypes: true }).map(d => ({
      nom: d.name,
      dossier: d.isDirectory(),
      verrou: estVerrouille(uid, rel ? rel + '/' + d.name : d.name)
    }))
    items.sort((a, b) => (b.dossier - a.dossier) || a.nom.localeCompare(b.nom))
    res.json({ path: rel, items })
  } catch (e) { res.status(e.code || 500).json({ erreur: e.message }) }
})

router.get('/read', (req, res) => {
  try {
    bloquer(req.user.id, req.query.path || '')
    res.json({ contenu: fs.readFileSync(safe(req.user.id, req.query.path || ''), 'utf8') })
  } catch (e) { res.status(e.code || 500).json({ erreur: e.message }) }
})

router.post('/write', (req, res) => {
  try {
    bloquer(req.user.id, req.body.path || '')
    fs.writeFileSync(safe(req.user.id, req.body.path || ''), req.body.contenu ?? '', 'utf8')
    res.json({ ok: true })
  } catch (e) { res.status(e.code || 500).json({ erreur: e.message }) }
})

router.post('/create', (req, res) => {
  try {
    bloquer(req.user.id, req.body.path || '')
    const abs = safe(req.user.id, req.body.path || '')
    if (req.body.dossier) fs.mkdirSync(abs, { recursive: true })
    else fs.writeFileSync(abs, '', { flag: 'wx' })
    res.json({ ok: true })
  } catch (e) { res.status(e.code || 500).json({ erreur: e.message }) }
})

router.post('/delete', (req, res) => {
  try {
    const uid = req.user.id
    bloquer(uid, req.body.path || '')
    const abs = safe(uid, req.body.path || '')
    if (abs === rootDe(uid)) throw Object.assign(new Error('Racine protégée'), { code: 403 })
    fs.rmSync(abs, { recursive: true, force: true })
    res.json({ ok: true })
  } catch (e) { res.status(e.code || 500).json({ erreur: e.message }) }
})

// Recherche par nom de fichier (récursif) — pour la recherche globale
export function chercherFichiers(q, uid) {
  const res = []
  const lower = q.toLowerCase()
  const ROOT = rootDe(uid)
  function walk(dir, rel) {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      const r = rel ? rel + '/' + d.name : d.name
      if (estVerrouille(uid, r)) continue // les éléments verrouillés restent cachés
      if (d.name.toLowerCase().includes(lower)) res.push({ nom: d.name, path: r, dossier: d.isDirectory() })
      if (d.isDirectory()) walk(path.join(dir, d.name), r)
    }
  }
  try { walk(ROOT, '') } catch {}
  return res
}

export default router
