// BLOC 4 — Envoi d'e-mails (équivalent /config/mailer.php + PHPMailer)
// SMTP authentifié et chiffré (STARTTLS), gabarits HTML, jetons de lien sécurisés (hachés).
import nodemailer from 'nodemailer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from './db.js'
import { generateSecureToken, hashToken } from './encryption.js'
import { echapper } from './security.js'
import { baseUrlHorsRequete } from './reseau.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DOSSIER = path.join(__dirname, '..', 'templates', 'emails')
// Recalculée à chaque envoi : les liens restent ouvrables depuis le téléphone
const lienBase = () => baseUrlHorsRequete()

// Transport SMTP authentifié + TLS (équivalent ENCRYPTION_STARTTLS)
const transporteur = process.env.MAIL_USER ? nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.MAIL_PORT || 587),
  secure: false,            // STARTTLS sur le port 587
  requireTLS: true,
  auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
}) : null

const lire = (f) => fs.readFileSync(path.join(DOSSIER, f), 'utf8')
const remplir = (tpl, vars) => Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{{${k}}}`, v ?? ''), tpl)

// Compose le gabarit + le corps, puis envoie (jamais bloquant)
export function sendMail(to, subject, fichier, vars = {}) {
  if (!transporteur) return Promise.resolve({ envoye: false, raison: 'SMTP non configuré' })
  const corps = remplir(lire(fichier), vars)
  const html = remplir(lire('_layout.html'), { TITRE: escapeTitre(subject), CORPS: corps })
  const text = corps.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return transporteur.sendMail({
    from: `"${process.env.APP_NAME || 'Mon Hub'}" <${process.env.MAIL_FROM || process.env.MAIL_USER}>`,
    to, subject: `${process.env.APP_NAME || 'Mon Hub'} — ${subject}`, html, text
  }).then(() => ({ envoye: true })).catch(e => {
    console.error('Mail non envoyé :', e.message)
    return { envoye: false, raison: e.message }
  })
}
const escapeTitre = (s) => echapper(s)

// ===== Jetons de lien (stockés HACHÉS, expirables, usage unique) =====
export function creerToken(userId, type, dureeMs) {
  const brut = generateSecureToken()
  db.prepare('INSERT INTO email_tokens (user_id, token, type, expires_at) VALUES (?,?,?,?)')
    .run(userId, hashToken(brut), type, Date.now() + dureeMs)
  return brut
}
// Consomme un jeton : vérifie type, expiration et non-utilisation
export function consommerToken(brut, type) {
  const t = db.prepare('SELECT * FROM email_tokens WHERE token=? AND type=?').get(hashToken(brut), type)
  if (!t || t.used_at || t.expires_at < Date.now()) return null
  db.prepare('UPDATE email_tokens SET used_at=? WHERE id=?').run(Date.now(), t.id)
  return t.user_id
}

// ===== E-mails métier =====
export function sendVerificationEmail(user) {
  const token = creerToken(user.id, 'verify_email', 24 * 3600 * 1000) // 24 h
  return sendMail(user.email, 'Bienvenue !', 'welcome.html', {
    NOM: echapper(user.nom),
    LIEN: `${lienBase()}/verifier?token=${token}`
  })
}
export function sendPasswordResetEmail(user, code) {
  const token = creerToken(user.id, 'reset_password', 3600 * 1000) // 1 h
  return sendMail(user.email, 'Réinitialisation du mot de passe', 'reset_password.html', {
    LIEN: `${lienBase()}/reinitialiser?token=${token}`, CODE: code,
    HEURE: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  })
}
export function sendNewMessageNotification(receiver, senderName) {
  return sendMail(receiver.email, 'Nouveau message privé', 'new_message.html', {
    EXPEDITEUR: echapper(senderName), LIEN: `${lienBase()}/#messages`
  })
}
export function sendSecurityAlert(user, raison, req) {
  return sendMail(user.email, 'Alerte de sécurité', 'security_alert.html', {
    RAISON: echapper(raison),
    DATE: new Date().toLocaleString('fr-FR'),
    IP: echapper(req?.ip || '—'),
    APPAREIL: echapper((req?.ua || '—').slice(0, 120))
  })
}
