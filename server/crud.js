import db from './db.js'

// Déplace une ligne vers la corbeille puis la supprime (restauration possible 30j)
export function versCorbeille(type, row, userId) {
  db.prepare('INSERT INTO trash (type, data, supprime_le, user_id) VALUES (?,?,?,?)')
    .run(type, JSON.stringify(row), Date.now(), userId ?? row.user_id ?? null)
}

// Fabrique un routeur CRUD standard pour une table, TOUJOURS restreint à req.user.
export function crud(router, base, table, cols, opts = {}) {
  const order = opts.order || 'id DESC'

  router.get(base, (req, res) => {
    let sql = `SELECT * FROM ${table} WHERE user_id=?`
    const args = [req.user.id]
    const w = Object.entries(req.query).filter(([k]) => cols.includes(k))
    if (w.length) { sql += ' AND ' + w.map(([k]) => `${k}=?`).join(' AND '); w.forEach(([, v]) => args.push(v)) }
    sql += ' ORDER BY ' + order
    res.json(db.prepare(sql).all(...args))
  })

  router.post(base, (req, res) => {
    const vals = cols.map(c => req.body[c] ?? null)
    const info = db.prepare(`INSERT INTO ${table} (${cols.join(', ')}, user_id) VALUES (${cols.map(() => '?').join(', ')}, ?)`)
      .run(...vals, req.user.id)
    res.json(db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(info.lastInsertRowid))
  })

  router.put(base + '/:id', (req, res) => {
    const cur = db.prepare(`SELECT * FROM ${table} WHERE id=? AND user_id=?`).get(req.params.id, req.user.id)
    if (!cur) return res.status(404).json({ erreur: 'introuvable' })
    const maj = cols.filter(c => c in req.body)
    if (maj.length) {
      db.prepare(`UPDATE ${table} SET ${maj.map(c => c + '=?').join(', ')} WHERE id=?`)
        .run(...maj.map(c => req.body[c]), req.params.id)
    }
    res.json(db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(req.params.id))
  })

  router.delete(base + '/:id', (req, res) => {
    const cur = db.prepare(`SELECT * FROM ${table} WHERE id=? AND user_id=?`).get(req.params.id, req.user.id)
    if (!cur) return res.status(404).json({ erreur: 'introuvable' })
    if (opts.soft !== false) versCorbeille(table, cur, req.user.id)
    db.prepare(`DELETE FROM ${table} WHERE id=?`).run(req.params.id)
    res.json({ ok: true })
  })
}
