// Authentification durcie : Argon2id, paire de clés E2EE, sessions liées à l'appareil,
// anti-force-brute, journalisation et alertes e-mail.
import express from 'express'
import crypto from 'crypto'
import dns from 'dns/promises'
import db from './db.js'
import {
  hashPassword, verifyPassword, doitMigrer, genererPaireCles,
  chiffrerClePrivee, dechiffrerClePrivee
} from './encryption.js'
import {
  logEvent, ipDe, uaDe, bloque, noterEssai, essaisRestants,
  genererCsrf, verifierSession, estEmail, texte
} from './security.js'
import { sendVerificationEmail, sendPasswordResetEmail, sendSecurityAlert, consommerToken } from './mailer.js'

const router = express.Router()
db.exec('CREATE TABLE IF NOT EXISTS resets (email TEXT PRIMARY KEY, code TEXT, expire INTEGER)')

// Clés privées déverrouillées, gardées EN MÉMOIRE seulement (jamais en base ni en clair sur disque).
// Elles disparaissent à la déconnexion ou au redémarrage du serveur.
const clesEnMemoire = new Map() // token de session → clé privée base64
export const clePriveeDe = (token) => clesEnMemoire.get(token) || null

function creerSession(userId, req, priveeB64) {
  const token = crypto.randomBytes(32).toString('hex')
  const csrf = genererCsrf()
  db.prepare('INSERT INTO sessions (token, user_id, cree, ip, user_agent, derniere_activite, csrf) VALUES (?,?,?,?,?,?,?)')
    .run(token, userId, Date.now(), ipDe(req), uaDe(req), Date.now(), csrf)
  if (priveeB64) clesEnMemoire.set(token, priveeB64)
  return { token, csrf }
}
const publique = (u) => ({
  id: u.id, nom: u.nom, email: u.email, notif_connexion: u.notif_connexion,
  email_verified: u.email_verified, qr_login_enabled: u.qr_login_enabled,
  biometric_enabled: u.biometric_enabled, public_key: u.public_key
})

// Détecte une connexion depuis un appareil inconnu (alerte de sécurité)
function appareilConnu(userId, req) {
  return !!db.prepare('SELECT 1 FROM security_logs WHERE user_id=? AND action=? AND ip=? AND user_agent=? LIMIT 1')
    .get(userId, 'connexion_reussie', ipDe(req), uaDe(req))
}

// ===== Middleware : exige une session valide (timeout + IP + user-agent) =====
export function exiger(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  const s = token && db.prepare('SELECT * FROM sessions WHERE token=?').get(token)
  if (!s) return res.status(401).json({ erreur: 'Non connecté' })
  const v = verifierSession(s, req)
  if (!v.ok) {
    db.prepare('DELETE FROM sessions WHERE token=?').run(token)
    clesEnMemoire.delete(token)
    logEvent(s.user_id, 'session_rejetee', req, v.raison)
    return res.status(401).json({ erreur: v.raison === 'expiree' ? 'Session expirée (30 min d\'inactivité)' : 'Session invalide' })
  }
  req.user = db.prepare('SELECT * FROM users WHERE id=?').get(s.user_id)
  if (!req.user) return res.status(401).json({ erreur: 'Compte introuvable' })
  db.prepare('UPDATE sessions SET derniere_activite=? WHERE token=?').run(Date.now(), token)
  req.token = token
  req.session = s
  next()
}

// ===== Inscription =====
router.post('/register', async (req, res) => {
  const nom = texte(req.body.nom, 60), email = texte(req.body.email, 190).toLowerCase(), mdp = req.body.mdp || ''
  if (!nom || !estEmail(email) || mdp.length < 6)
    return res.status(400).json({ erreur: 'Nom, e-mail valide et mot de passe (6 caractères min.) requis' })
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email))
    return res.status(409).json({ erreur: 'Un compte existe déjà avec cet e-mail' })

  // Le domaine doit réellement héberger une messagerie (enregistrements MX).
  // Écarte les domaines inventés avant même de créer quoi que ce soit.
  try {
    const mx = await dns.resolveMx(email.split('@')[1])
    if (!mx?.length) throw new Error('aucun serveur de messagerie')
  } catch {
    logEvent(null, 'inscription_domaine_invalide', req, email)
    return res.status(400).json({ erreur: "Ce domaine e-mail n'existe pas ou ne reçoit pas de courrier. Vérifie l'orthographe." })
  }

  // Paire de clés E2EE : la privée est chiffrée par le mot de passe (le serveur ne peut pas la lire seul)
  const paire = genererPaireCles()
  const info = db.prepare(`INSERT INTO users (nom, email, mdp, cree, public_key, encrypted_private_key)
    VALUES (?,?,?,?,?,?)`).run(nom, email, hashPassword(mdp), Date.now(), paire.publique, chiffrerClePrivee(paire.privee, mdp))
  const uid = info.lastInsertRowid

  // Premier compte : adopte les données créées avant le système de comptes
  if (db.prepare('SELECT COUNT(*) c FROM users').get().c === 1) {
    for (const t of ['tasks', 'notes', 'events', 'tags', 'links', 'trash', 'settings', 'subtasks', 'pomodoro', 'habits',
      'habit_logs', 'subjects', 'schedule', 'homework', 'grades', 'flashcards', 'revisions', 'vocab', 'snippets',
      'favoris', 'flights', 'mddocs']) {
      try { db.prepare(`UPDATE ${t} SET user_id=? WHERE user_id IS NULL`).run(uid) } catch {}
    }
  }
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(uid)
  logEvent(uid, 'inscription', req)

  // L'adresse doit exister : sans e-mail délivré, pas de compte utilisable.
  const envoi = await sendVerificationEmail(u).catch(() => ({ envoye: false, raison: 'envoi impossible' }))
  if (!envoi?.envoye) {
    // Adresse injoignable (domaine inexistant, boîte fermée…) → on annule l'inscription
    db.prepare('DELETE FROM users WHERE id=?').run(uid)
    db.prepare('DELETE FROM email_tokens WHERE user_id=?').run(uid)
    logEvent(null, 'inscription_annulee_email', req, email + ' — ' + (envoi?.raison || ''))
    return res.status(400).json({ erreur: "Cette adresse e-mail semble inexistante : aucun message n'a pu y être remis. Vérifie l'orthographe." })
  }
  // Pas de session tant que l'adresse n'est pas confirmée
  res.json({ verification: true, email: u.email })
})

// Renvoyer l'e-mail de vérification
router.post('/resend-verification', async (req, res) => {
  const email = texte(req.body.email, 190).toLowerCase()
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(email)
  if (!u || u.email_verified) return res.json({ ok: true })
  await sendVerificationEmail(u).catch(() => {})
  res.json({ ok: true })
})

// ===== Connexion =====
router.post('/login', (req, res) => {
  const email = texte(req.body.email, 190).toLowerCase(), mdp = req.body.mdp || ''
  const ip = ipDe(req)
  if (bloque(email, ip)) {
    logEvent(null, 'blocage_force_brute', req, email)
    return res.status(429).json({ erreur: 'Trop de tentatives. Réessaie dans 15 minutes.' })
  }
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(email)
  if (!u || !verifyPassword(mdp, u.mdp)) {
    noterEssai(email, ip, false)
    logEvent(u?.id ?? null, 'connexion_echouee', req, email)
    const reste = essaisRestants(email, ip)
    if (u && reste === 0) sendSecurityAlert(u, '5 tentatives de connexion échouées sur ton compte.', { ip, ua: uaDe(req) })
    return res.status(401).json({ erreur: 'E-mail ou mot de passe incorrect' + (reste ? ` — ${reste} essai(s) restant(s)` : '') })
  }
  noterEssai(email, ip, true)

  // Adresse non confirmée : le mot de passe est bon, mais rien ne prouve encore
  // que la boîte existe et appartient à cette personne.
  if (!u.email_verified) {
    logEvent(u.id, 'connexion_bloquee_non_verifie', req)
    return res.status(403).json({
      erreur: "Ton adresse n'est pas encore confirmée. Ouvre l'e-mail de bienvenue et clique sur le lien.",
      verification: true, email: u.email
    })
  }

  // Migration transparente scrypt → Argon2id
  if (doitMigrer(u.mdp)) db.prepare('UPDATE users SET mdp=? WHERE id=?').run(hashPassword(mdp), u.id)
  // Génère la paire de clés pour les comptes créés avant la messagerie
  let privee = null
  if (!u.public_key) {
    const p = genererPaireCles()
    db.prepare('UPDATE users SET public_key=?, encrypted_private_key=? WHERE id=?')
      .run(p.publique, chiffrerClePrivee(p.privee, mdp), u.id)
    privee = p.privee
  } else {
    privee = dechiffrerClePrivee(u.encrypted_private_key, mdp)
  }

  const nouveau = !appareilConnu(u.id, req)
  logEvent(u.id, 'connexion_reussie', req)
  if (nouveau) sendSecurityAlert(u, 'Connexion depuis un appareil ou un lieu inconnu.', { ip, ua: uaDe(req) })
  if (u.notif_connexion) {
    import('./mailer.js').then(m => m.sendMail(u.email, 'Nouvelle connexion', 'security_alert.html', {
      RAISON: 'Une connexion à ton compte vient d\'avoir lieu.',
      DATE: new Date().toLocaleString('fr-FR'), IP: ip, APPAREIL: uaDe(req).slice(0, 120)
    }))
  }
  const s = creerSession(u.id, req, privee)
  res.json({ ...s, user: publique(db.prepare('SELECT * FROM users WHERE id=?').get(u.id)) })
})

// ===== Session courante / déconnexion =====
router.get('/me', exiger, (req, res) => res.json({ user: publique(req.user), csrf: req.session.csrf }))
router.post('/logout', exiger, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token=?').run(req.token)
  clesEnMemoire.delete(req.token)
  logEvent(req.user.id, 'deconnexion', req)
  res.json({ ok: true })
})

// ===== Vérification d'adresse e-mail =====
router.post('/verify-email', (req, res) => {
  const uid = consommerToken(texte(req.body.token, 128), 'verify_email')
  if (!uid) return res.status(403).json({ erreur: 'Lien invalide ou expiré' })
  db.prepare('UPDATE users SET email_verified=1 WHERE id=?').run(uid)
  logEvent(uid, 'email_verifie', req)
  res.json({ ok: true })
})

// ===== Changement de mot de passe =====
router.post('/password', exiger, (req, res) => {
  const { ancien, nouveau } = req.body
  if (!verifyPassword(ancien || '', req.user.mdp)) {
    logEvent(req.user.id, 'changement_mdp_refuse', req)
    return res.status(403).json({ erreur: 'Ancien mot de passe incorrect' })
  }
  if ((nouveau || '').length < 6) return res.status(400).json({ erreur: '6 caractères minimum' })
  // La clé privée doit être re-chiffrée avec le nouveau mot de passe
  const privee = dechiffrerClePrivee(req.user.encrypted_private_key, ancien)
  db.prepare('UPDATE users SET mdp=?, encrypted_private_key=? WHERE id=?')
    .run(hashPassword(nouveau), privee ? chiffrerClePrivee(privee, nouveau) : req.user.encrypted_private_key, req.user.id)
  db.prepare('DELETE FROM sessions WHERE user_id=? AND token!=?').run(req.user.id, req.token)
  logEvent(req.user.id, 'changement_mdp', req)
  sendSecurityAlert(req.user, 'Ton mot de passe vient d\'être modifié.', { ip: ipDe(req), ua: uaDe(req) })
  res.json({ ok: true })
})

// ===== Mot de passe oublié =====
// Machine locale : le code peut être affiché à l'écran si l'e-mail ne part pas.
// Jamais depuis le réseau (téléphone, autre poste) — sinon n'importe qui pourrait
// réinitialiser n'importe quel compte.
const surLaMachine = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ipDe(req))

router.post('/forgot', async (req, res) => {
  const email = texte(req.body.email, 190).toLowerCase()
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(email)
  if (!u) return res.json({ ok: true }) // réponse identique : aucune fuite sur l'existence du compte

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0')
  db.prepare(`INSERT INTO resets (email, code, expire) VALUES (?,?,?)
    ON CONFLICT(email) DO UPDATE SET code=excluded.code, expire=excluded.expire`)
    .run(email, code, Date.now() + 3600 * 1000)
  logEvent(u.id, 'demande_reinitialisation', req)

  const envoi = await sendPasswordResetEmail(u, code).catch(() => ({ envoye: false }))
  // Secours : SMTP muet + demande faite depuis le Mac → on montre le code
  if (!envoi?.envoye && surLaMachine(req)) {
    logEvent(u.id, 'code_affiche_local', req)
    return res.json({ ok: true, code, secours: true })
  }
  res.json({ ok: true })
})

// Réinitialisation par code (ou par lien : le token vaut le code)
router.post('/reset', (req, res) => {
  const email = texte(req.body.email, 190).toLowerCase()
  const r = db.prepare('SELECT * FROM resets WHERE email=?').get(email)
  const parToken = req.body.token ? consommerToken(texte(req.body.token, 128), 'reset_password') : null
  const okCode = r && r.code === req.body.code && r.expire >= Date.now()
  if (!okCode && !parToken) {
    // On distingue les cas : un « code invalide » sec pousse à réessayer le même code.
    if (r && r.expire < Date.now()) return res.status(403).json({ erreur: 'Ce code a expiré (1 h). Redemandes-en un nouveau.' })
    if (r) return res.status(403).json({ erreur: "Ce code ne correspond pas. Ouvre le DERNIER e-mail reçu : chaque demande annule le code précédent." })
    return res.status(403).json({ erreur: "Aucune demande en cours. Refais « Mot de passe oublié »." })
  }
  if ((req.body.nouveau || '').length < 6) return res.status(400).json({ erreur: '6 caractères minimum' })
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(email)
  if (!u) return res.status(403).json({ erreur: 'Code invalide ou expiré' })

  // La clé privée est protégée par l'ancien mot de passe : on repart d'une paire neuve.
  // Conséquence assumée : les anciens messages reçus deviennent illisibles (E2EE réel).
  const p = genererPaireCles()
  db.prepare('UPDATE users SET mdp=?, public_key=?, encrypted_private_key=? WHERE id=?')
    .run(hashPassword(req.body.nouveau), p.publique, chiffrerClePrivee(p.privee, req.body.nouveau), u.id)
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(u.id)
  db.prepare('DELETE FROM resets WHERE email=?').run(email)
  logEvent(u.id, 'reinitialisation_mdp', req)
  sendSecurityAlert(u, 'Ton mot de passe a été réinitialisé.', { ip: ipDe(req), ua: uaDe(req) })
  res.json({ ok: true })
})

// ===== Options (e-mail de connexion, QR, biométrie) =====
router.post('/notif', exiger, (req, res) => {
  db.prepare('UPDATE users SET notif_connexion=? WHERE id=?').run(req.body.actif ? 1 : 0, req.user.id)
  res.json({ ok: true, actif: !!req.body.actif })
})
router.post('/option', exiger, (req, res) => {
  const cle = req.body.cle
  if (!['qr_login_enabled', 'biometric_enabled'].includes(cle)) return res.status(400).json({ erreur: 'Option inconnue' })
  db.prepare(`UPDATE users SET ${cle}=? WHERE id=?`).run(req.body.actif ? 1 : 0, req.user.id)
  logEvent(req.user.id, 'option_securite', req, `${cle}=${req.body.actif ? 1 : 0}`)
  res.json({ ok: true })
})

// ===== Journal de sécurité de l'utilisateur =====
router.get('/logs', exiger, (req, res) => {
  res.json(db.prepare('SELECT action, ip, user_agent, details, created_at FROM security_logs WHERE user_id=? ORDER BY id DESC LIMIT 50').all(req.user.id))
})

export default router
export { creerSession }
