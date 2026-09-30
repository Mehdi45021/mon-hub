// BLOC 3 — Messagerie privée E2EE (équivalent /modules/messages/*)
// Le serveur ne stocke QUE du chiffré. Il ne peut déchiffrer qu'avec la clé privée
// de l'utilisateur, déverrouillée en mémoire pendant sa session uniquement.
import express from 'express'
import db from './db.js'
import { chiffrerMessage, dechiffrerMessage, encrypt, decrypt } from './encryption.js'
import { logEvent, texte } from './security.js'
import { clePriveeDe } from './auth.js'
import { sendNewMessageNotification } from './mailer.js'

const router = express.Router()
const paire = (a, b) => [Math.min(a, b), Math.max(a, b)]

// Déchiffre un message pour l'utilisateur courant (null si clé indisponible)
function lire(msg, moi, privee) {
  if (!privee) return null
  const autreId = msg.sender_id === moi.id ? msg.receiver_id : msg.sender_id
  const autre = db.prepare('SELECT public_key FROM users WHERE id=?').get(autreId)
  if (!autre?.public_key) return null
  return dechiffrerMessage(msg.body, autre.public_key, privee)
}

// ===== Contacts disponibles (autres comptes ayant une clé publique) =====
router.get('/contacts', (req, res) => {
  res.json(db.prepare('SELECT id, nom, email FROM users WHERE id!=? AND public_key IS NOT NULL ORDER BY nom').all(req.user.id))
})

// ===== index.php : liste des conversations =====
router.get('/', (req, res) => {
  const moi = req.user, privee = clePriveeDe(req.token)
  const convs = db.prepare(`
    SELECT * FROM conversations WHERE user1_id=? OR user2_id=? ORDER BY last_message_at DESC`).all(moi.id, moi.id)
  res.json(convs.map(c => {
    const autreId = c.user1_id === moi.id ? c.user2_id : c.user1_id
    const autre = db.prepare('SELECT id, nom, email FROM users WHERE id=?').get(autreId)
    const dernier = db.prepare(`SELECT * FROM messages
      WHERE ((sender_id=? AND receiver_id=? AND deleted_by_sender=0) OR (sender_id=? AND receiver_id=? AND deleted_by_receiver=0))
      ORDER BY id DESC LIMIT 1`).get(moi.id, autreId, autreId, moi.id)
    const nonLus = db.prepare('SELECT COUNT(*) c FROM messages WHERE sender_id=? AND receiver_id=? AND is_read=0 AND deleted_by_receiver=0')
      .get(autreId, moi.id).c
    return {
      contact: autre, nonLus, date: dernier?.created_at || c.last_message_at,
      apercu: dernier ? (lire(dernier, moi, privee)?.slice(0, 80) ?? '🔒 chiffré') : ''
    }
  }))
})

// ===== conversation.php : fil de messages avec un contact =====
router.get('/with/:id', (req, res) => {
  const moi = req.user, autreId = Number(req.params.id), privee = clePriveeDe(req.token)
  const autre = db.prepare('SELECT id, nom, email FROM users WHERE id=?').get(autreId)
  if (!autre) return res.status(404).json({ erreur: 'Utilisateur introuvable' })
  const msgs = db.prepare(`SELECT * FROM messages
    WHERE ((sender_id=? AND receiver_id=? AND deleted_by_sender=0) OR (sender_id=? AND receiver_id=? AND deleted_by_receiver=0))
    ORDER BY id`).all(moi.id, autreId, autreId, moi.id)
  db.prepare('UPDATE messages SET is_read=1 WHERE sender_id=? AND receiver_id=?').run(autreId, moi.id)
  res.json({
    contact: autre,
    verrouille: !privee, // clé privée indisponible (ex. session restaurée après redémarrage)
    messages: msgs.map(m => ({
      id: m.id, moi: m.sender_id === moi.id, date: m.created_at, lu: !!m.is_read,
      sujet: m.subject ? decrypt(m.subject) : null,
      texte: lire(m, moi, privee) ?? '🔒 Message chiffré — reconnecte-toi pour le lire'
    }))
  })
})

// ===== send.php : envoi (chiffré avec la clé publique du destinataire) =====
router.post('/send', (req, res) => {
  const moi = req.user, privee = clePriveeDe(req.token)
  const dest = db.prepare('SELECT * FROM users WHERE id=?').get(Number(req.body.receiver_id))
  const corps = texte(req.body.body, 5000)
  if (!dest?.public_key) return res.status(404).json({ erreur: 'Destinataire introuvable' })
  if (!corps) return res.status(400).json({ erreur: 'Message vide' })
  if (!privee) return res.status(409).json({ erreur: 'Clé de chiffrement verrouillée — reconnecte-toi' })

  const chiffre = chiffrerMessage(corps, dest.public_key, privee)
  db.prepare('INSERT INTO messages (sender_id, receiver_id, subject, body) VALUES (?,?,?,?)')
    .run(moi.id, dest.id, req.body.subject ? encrypt(texte(req.body.subject, 200)) : null, chiffre)

  const [u1, u2] = paire(moi.id, dest.id)
  db.prepare(`INSERT INTO conversations (user1_id, user2_id, last_message_at) VALUES (?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(user1_id, user2_id) DO UPDATE SET last_message_at=CURRENT_TIMESTAMP`).run(u1, u2)

  logEvent(moi.id, 'message_envoye', req, 'vers #' + dest.id)
  sendNewMessageNotification(dest, moi.nom) // sans le contenu (E2EE)
  res.json({ ok: true })
})

// ===== delete.php : suppression logique côté utilisateur =====
router.post('/delete/:id', (req, res) => {
  const m = db.prepare('SELECT * FROM messages WHERE id=?').get(req.params.id)
  if (!m || (m.sender_id !== req.user.id && m.receiver_id !== req.user.id))
    return res.status(404).json({ erreur: 'Message introuvable' })
  const champ = m.sender_id === req.user.id ? 'deleted_by_sender' : 'deleted_by_receiver'
  db.prepare(`UPDATE messages SET ${champ}=1 WHERE id=?`).run(req.params.id)
  // Purge physique quand les deux parties ont supprimé
  db.prepare('DELETE FROM messages WHERE id=? AND deleted_by_sender=1 AND deleted_by_receiver=1').run(req.params.id)
  res.json({ ok: true })
})

export default router
