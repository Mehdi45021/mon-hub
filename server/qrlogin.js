// BLOC 7 — Connexion par QR Code + code OTP à 6 chiffres
// PC : affiche un QR → téléphone : scanne et s'authentifie → affiche un OTP →
// PC : saisit l'OTP → session créée. Le QR vit 3 minutes, l'OTP est à usage unique.
import express from 'express'
import crypto from 'crypto'
import QRCode from 'qrcode'
import db from './db.js'
import { hashPassword, verifyPassword, dechiffrerClePrivee } from './encryption.js'
import { logEvent, ipDe, uaDe, bloque, noterEssai, texte, estEmail } from './security.js'
import { creerSession } from './auth.js'
import { baseUrl } from './reseau.js'

const router = express.Router()
const DUREE = 3 * 60 * 1000        // 3 minutes
const MAX_ESSAIS_OTP = 3

// Clé privée E2EE déverrouillée sur le téléphone, transmise en mémoire à la session PC
const clesTransit = new Map()

const nettoyer = () => db.prepare("UPDATE qr_sessions SET status='expired' WHERE expires_at<? AND status!='validated'").run(Date.now())

// ===== generate.php : le PC demande un QR Code =====
router.post('/generate', async (req, res) => {
  nettoyer()
  const token = crypto.randomBytes(32).toString('hex')
  const expire = Date.now() + DUREE
  db.prepare('INSERT INTO qr_sessions (session_token, status, ip_desktop, created_at, expires_at) VALUES (?,?,?,?,?)')
    .run(token, 'pending', ipDe(req), Date.now(), expire)
  // URL joignable depuis le téléphone (IP du réseau local, jamais "localhost")
  const url = `${baseUrl(req)}/qr?token=${token}`
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 320, color: { dark: '#ECEDEF', light: '#15171C' } })
  res.json({ token, qr, url, expires_in: Math.floor(DUREE / 1000) })
})

// ===== poll.php : le PC interroge l'état toutes les 2 s =====
router.get('/poll', (req, res) => {
  nettoyer()
  const s = db.prepare('SELECT * FROM qr_sessions WHERE session_token=?').get(texte(req.query.token, 128))
  if (!s) return res.json({ status: 'expired' })
  if (s.expires_at < Date.now() && s.status !== 'validated') return res.json({ status: 'expired' })
  res.json({ status: s.status })
})

// ===== scan.php : le téléphone s'authentifie et reçoit l'OTP à afficher =====
router.post('/scan', (req, res) => {
  nettoyer()
  const s = db.prepare('SELECT * FROM qr_sessions WHERE session_token=?').get(texte(req.body.token, 128))
  if (!s || s.status !== 'pending' || s.expires_at < Date.now())
    return res.status(410).json({ erreur: 'QR Code expiré ou invalide' })

  const email = texte(req.body.email, 190).toLowerCase(), ip = ipDe(req)
  if (bloque(email, ip)) return res.status(429).json({ erreur: 'Trop de tentatives. Réessaie dans 15 minutes.' })
  if (!estEmail(email)) return res.status(400).json({ erreur: 'E-mail invalide' })

  const u = db.prepare('SELECT * FROM users WHERE email=?').get(email)
  if (!u || !verifyPassword(req.body.mdp || '', u.mdp)) {
    noterEssai(email, ip, false)
    logEvent(u?.id ?? null, 'qr_scan_echoue', req, email)
    return res.status(401).json({ erreur: 'E-mail ou mot de passe incorrect' })
  }
  if (!u.qr_login_enabled)
    return res.status(403).json({ erreur: 'La connexion par QR Code n\'est pas activée sur ce compte (Réglages → Sécurité).' })
  noterEssai(email, ip, true)

  // OTP à 6 chiffres, stocké haché uniquement
  const otp = String(crypto.randomInt(0, 1000000)).padStart(6, '0')
  db.prepare(`UPDATE qr_sessions SET user_id=?, otp_hash=?, status='scanned', scanned_at=?, ip_mobile=? WHERE session_token=?`)
    .run(u.id, hashPassword(otp), Date.now(), ip, s.session_token)
  // La clé privée voyage en mémoire seulement, le temps de la validation
  const privee = dechiffrerClePrivee(u.encrypted_private_key, req.body.mdp)
  if (privee) clesTransit.set(s.session_token, privee)
  logEvent(u.id, 'qr_scan_reussi', req)
  // Le téléphone n'est PAS connecté : il affiche seulement le code
  res.json({ otp, expire_dans: Math.max(0, Math.floor((s.expires_at - Date.now()) / 1000)) })
})

// ===== verify.php : le PC saisit l'OTP =====
router.post('/verify', (req, res) => {
  nettoyer()
  const s = db.prepare('SELECT * FROM qr_sessions WHERE session_token=?').get(texte(req.body.token, 128))
  if (!s || s.status !== 'scanned' || !s.user_id || s.expires_at < Date.now())
    return res.status(410).json({ erreur: 'Session expirée — régénère un QR Code' })
  if (s.attempts >= MAX_ESSAIS_OTP) {
    db.prepare("UPDATE qr_sessions SET status='expired' WHERE session_token=?").run(s.session_token)
    return res.status(429).json({ erreur: 'Trop d\'essais — QR Code invalidé' })
  }
  const code = texte(req.body.code, 6)
  if (!verifyPassword(code, s.otp_hash)) {
    db.prepare('UPDATE qr_sessions SET attempts=attempts+1 WHERE session_token=?').run(s.session_token)
    logEvent(s.user_id, 'qr_otp_incorrect', req)
    return res.status(403).json({ erreur: `Code incorrect (${MAX_ESSAIS_OTP - s.attempts - 1} essai(s) restant(s))` })
  }
  // Usage unique : la session passe à "validated" dès le premier succès
  db.prepare("UPDATE qr_sessions SET status='validated' WHERE session_token=?").run(s.session_token)
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(s.user_id)
  const privee = clesTransit.get(s.session_token)
  clesTransit.delete(s.session_token)
  const sess = creerSession(u.id, req, privee)
  logEvent(u.id, 'connexion_qr', req)
  res.json({
    ...sess,
    user: { id: u.id, nom: u.nom, email: u.email, notif_connexion: u.notif_connexion, email_verified: u.email_verified,
      qr_login_enabled: u.qr_login_enabled, biometric_enabled: u.biometric_enabled, public_key: u.public_key }
  })
})

export default router
