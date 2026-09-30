import express from 'express'
import db, { TABLES_USER } from './db.js'

const router = express.Router()
export const TABLES = TABLES_USER

// ===== RÉGLAGES (clé/valeur JSON, par utilisateur) =====
router.get('/settings/:cle', (req, res) => {
  const r = db.prepare('SELECT valeur FROM settings WHERE cle=? AND user_id=?').get(req.params.cle, req.user.id)
  res.json({ valeur: r ? JSON.parse(r.valeur) : null })
})
router.put('/settings/:cle', (req, res) => {
  db.prepare('DELETE FROM settings WHERE cle=? AND user_id=?').run(req.params.cle, req.user.id)
  db.prepare('INSERT INTO settings (cle, valeur, user_id) VALUES (?,?,?)').run(req.params.cle, JSON.stringify(req.body.valeur), req.user.id)
  res.json({ ok: true })
})

// ===== TAGS =====
router.get('/tags', (req, res) => res.json(db.prepare('SELECT * FROM tags WHERE user_id=? ORDER BY nom').all(req.user.id)))
router.post('/tags', (req, res) => {
  const info = db.prepare('INSERT INTO tags (nom, couleur, user_id) VALUES (?,?,?)').run(req.body.nom, req.body.couleur || '#E0915C', req.user.id)
  res.json(db.prepare('SELECT * FROM tags WHERE id=?').get(info.lastInsertRowid))
})
router.delete('/tags/:id', (req, res) => {
  const t = db.prepare('SELECT 1 FROM tags WHERE id=? AND user_id=?').get(req.params.id, req.user.id)
  if (!t) return res.status(404).json({ erreur: 'introuvable' })
  db.prepare('DELETE FROM tags WHERE id=?').run(req.params.id)
  db.prepare('DELETE FROM item_tags WHERE tag_id=?').run(req.params.id)
  res.json({ ok: true })
})
router.get('/tags/map/:type', (req, res) => {
  const rows = db.prepare(`SELECT it.item_id, t.* FROM item_tags it JOIN tags t ON t.id=it.tag_id WHERE it.item_type=? AND t.user_id=?`).all(req.params.type, req.user.id)
  const map = {}
  for (const r of rows) { (map[r.item_id] ||= []).push({ id: r.id, nom: r.nom, couleur: r.couleur }) }
  res.json(map)
})
router.get('/tags/of/:type/:id', (req, res) => {
  res.json(db.prepare(`SELECT t.* FROM tags t JOIN item_tags it ON it.tag_id=t.id
    WHERE it.item_type=? AND it.item_id=? AND t.user_id=?`).all(req.params.type, req.params.id, req.user.id))
})
router.post('/tags/attach', (req, res) => {
  const { tag_id, item_type, item_id } = req.body
  if (!db.prepare('SELECT 1 FROM tags WHERE id=? AND user_id=?').get(tag_id, req.user.id)) return res.status(404).json({ erreur: 'tag introuvable' })
  db.prepare('INSERT OR IGNORE INTO item_tags (tag_id, item_type, item_id) VALUES (?,?,?)').run(tag_id, item_type, item_id)
  res.json({ ok: true })
})
router.post('/tags/detach', (req, res) => {
  const { tag_id, item_type, item_id } = req.body
  db.prepare('DELETE FROM item_tags WHERE tag_id=? AND item_type=? AND item_id=?').run(tag_id, item_type, item_id)
  res.json({ ok: true })
})

// ===== LIENS + RÉTROLIENS =====
router.get('/links/:type/:id', (req, res) => {
  const { type, id } = req.params
  res.json({
    sortants: db.prepare('SELECT * FROM links WHERE src_type=? AND src_id=? AND user_id=?').all(type, id, req.user.id),
    entrants: db.prepare('SELECT * FROM links WHERE dst_type=? AND dst_id=? AND user_id=?').all(type, id, req.user.id)
  })
})
router.post('/links', (req, res) => {
  const { src_type, src_id, dst_type, dst_id, label = '' } = req.body
  const info = db.prepare('INSERT INTO links (src_type, src_id, dst_type, dst_id, label, user_id) VALUES (?,?,?,?,?,?)')
    .run(src_type, src_id, dst_type, dst_id, label, req.user.id)
  res.json(db.prepare('SELECT * FROM links WHERE id=?').get(info.lastInsertRowid))
})
router.delete('/links/:id', (req, res) => {
  db.prepare('DELETE FROM links WHERE id=? AND user_id=?').run(req.params.id, req.user.id)
  res.json({ ok: true })
})

// ===== CORBEILLE (restauration 30 jours) =====
const J30 = 30 * 24 * 3600 * 1000
router.get('/trash', (req, res) => {
  db.prepare('DELETE FROM trash WHERE supprime_le < ?').run(Date.now() - J30)
  res.json(db.prepare('SELECT * FROM trash WHERE user_id=? ORDER BY supprime_le DESC').all(req.user.id).map(r => ({
    id: r.id, type: r.type, supprime_le: r.supprime_le, data: JSON.parse(r.data)
  })))
})
router.post('/trash/:id/restore', (req, res) => {
  const t = db.prepare('SELECT * FROM trash WHERE id=? AND user_id=?').get(req.params.id, req.user.id)
  if (!t) return res.status(404).json({ erreur: 'introuvable' })
  if (!TABLES.includes(t.type)) return res.status(400).json({ erreur: 'type inconnu' })
  const row = JSON.parse(t.data)
  row.user_id = req.user.id
  const cols = Object.keys(row).filter(c => c !== 'id')
  db.prepare(`INSERT INTO ${t.type} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
    .run(...cols.map(c => row[c]))
  db.prepare('DELETE FROM trash WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})
router.delete('/trash/:id', (req, res) => {
  db.prepare('DELETE FROM trash WHERE id=? AND user_id=?').run(req.params.id, req.user.id)
  res.json({ ok: true })
})

// ===== EXPORT / IMPORT (données du compte uniquement) =====
router.get('/export', (req, res) => {
  const dump = { item_tags: [] }
  for (const t of TABLES) dump[t] = db.prepare(`SELECT * FROM ${t} WHERE user_id=?`).all(req.user.id)
  // item_tags n'a pas de user_id : on exporte ceux liés aux tags du compte
  dump.item_tags = db.prepare('SELECT it.* FROM item_tags it JOIN tags t ON t.id=it.tag_id WHERE t.user_id=?').all(req.user.id)
  res.json({ version: 2, date: Date.now(), data: dump })
})
router.post('/import', (req, res) => {
  const data = req.body?.data
  if (!data) return res.status(400).json({ erreur: 'données absentes' })
  const u = req.user.id
  const tx = db.transaction(() => {
    for (const t of TABLES) {
      if (!data[t]) continue
      db.prepare(`DELETE FROM ${t} WHERE user_id=?`).run(u)
      for (const row of data[t]) {
        row.user_id = u
        const cols = Object.keys(row)
        db.prepare(`INSERT INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
          .run(...cols.map(c => row[c]))
      }
    }
    if (data.item_tags) for (const row of data.item_tags) {
      db.prepare('INSERT OR IGNORE INTO item_tags (tag_id, item_type, item_id) VALUES (?,?,?)').run(row.tag_id, row.item_type, row.item_id)
    }
  })
  try { tx(); res.json({ ok: true }) } catch (e) { res.status(500).json({ erreur: e.message }) }
})

export default router
