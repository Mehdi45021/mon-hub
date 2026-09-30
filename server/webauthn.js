// BLOC 8 — Authentification biométrique (WebAuthn)
// La biométrie ne quitte JAMAIS l'appareil : le serveur ne reçoit qu'une signature
// vérifiée avec la clé publique du device. Compteur anti-rejeu (sign_count).
import express from 'express'
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse
} from '@simplewebauthn/server'
import db from './db.js'
import { logEvent, texte, estEmail } from './security.js'
import { creerSession, exiger } from './auth.js'

const router = express.Router()

// Relying Party (depuis .env) — APP_DOMAIN doit correspondre EXACTEMENT au domaine servi
export const RP_NAME = process.env.APP_NAME || 'Mon Hub'
export const RP_ID = process.env.APP_DOMAIN || 'localhost'
const ORIGINES = [process.env.APP_URL || 'http://localhost:3001']

// Défis en mémoire, expirés après 60 s
const defis = new Map()
const poserDefi = (cle, challenge) => defis.set(cle, { challenge, exp: Date.now() + 60000 })
function prendreDefi(cle) {
  const d = defis.get(cle); defis.delete(cle)
  return d && d.exp > Date.now() ? d.challenge : null
}
const b64 = (buf) => Buffer.from(buf).toString('base64url')

// WebAuthn exige un contexte sécurisé (HTTPS, sauf localhost)
export const contexteSur = () => RP_ID === 'localhost' || ORIGINES.some(o => o.startsWith('https://'))

// ===== register_begin : options de création (utilisateur connecté) =====
router.post('/register/begin', exiger, async (req, res) => {
  const existants = db.prepare('SELECT credential_id FROM webauthn_credentials WHERE user_id=?').all(req.user.id)
  const options = await generateRegistrationOptions({
    rpName: RP_NAME, rpID: RP_ID,
    userID: Buffer.from(String(req.user.id)),
    userName: req.user.email, userDisplayName: req.user.nom,
    timeout: 60000, attestationType: 'none',
    excludeCredentials: existants.map(c => ({ id: c.credential_id, type: 'public-key' })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' }
  })
  poserDefi('reg:' + req.user.id, options.challenge)
  res.json(options)
})

// ===== register_finish : vérifie et enregistre l'appareil =====
router.post('/register/finish', exiger, async (req, res) => {
  const challenge = prendreDefi('reg:' + req.user.id)
  if (!challenge) return res.status(408).json({ erreur: 'Défi expiré, recommence' })
  try {
    const v = await verifyRegistrationResponse({
      response: req.body.credential, expectedChallenge: challenge,
      expectedOrigin: ORIGINES, expectedRPID: RP_ID, requireUserVerification: true
    })
    if (!v.verified) throw new Error('Vérification refusée')
    const i = v.registrationInfo
    db.prepare(`INSERT INTO webauthn_credentials (user_id, credential_id, public_key, sign_count, device_name, aaguid)
      VALUES (?,?,?,?,?,?)`).run(
      req.user.id,
      typeof i.credentialID === 'string' ? i.credentialID : b64(i.credentialID),
      b64(i.credentialPublicKey), i.counter || 0,
      texte(req.body.device_name, 100) || 'Mon appareil', i.aaguid || null
    )
    db.prepare('UPDATE users SET biometric_enabled=1 WHERE id=?').run(req.user.id)
    logEvent(req.user.id, 'biometrie_enregistree', req)
    res.json({ status: 'ok' })
  } catch (e) {
    logEvent(req.user.id, 'biometrie_erreur', req, e.message)
    res.status(400).json({ erreur: e.message })
  }
})

// ===== auth_begin : options d'authentification (public, depuis l'e-mail saisi) =====
router.post('/auth/begin', async (req, res) => {
  const email = texte(req.body.email, 190).toLowerCase()
  if (!estEmail(email)) return res.status(400).json({ erreur: 'E-mail invalide' })
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(email)
  const creds = u ? db.prepare('SELECT credential_id FROM webauthn_credentials WHERE user_id=?').all(u.id) : []
  if (!u || !u.biometric_enabled || !creds.length)
    return res.status(404).json({ erreur: 'Biométrie non configurée pour ce compte' })
  const options = await generateAuthenticationOptions({
    rpID: RP_ID, timeout: 60000, userVerification: 'required',
    allowCredentials: creds.map(c => ({ id: c.credential_id, type: 'public-key' }))
  })
  poserDefi('auth:' + u.id, options.challenge)
  res.json({ ...options, uid: u.id })
})

// ===== auth_finish : vérifie la signature et ouvre la session =====
router.post('/auth/finish', async (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(Number(req.body.uid))
  if (!u) return res.status(400).json({ erreur: 'Compte introuvable' })
  const challenge = prendreDefi('auth:' + u.id)
  if (!challenge) return res.status(408).json({ erreur: 'Défi expiré, recommence' })
  const idRecu = req.body.credential?.id
  const cred = db.prepare('SELECT * FROM webauthn_credentials WHERE user_id=? AND credential_id=?').get(u.id, idRecu)
  if (!cred) return res.status(404).json({ erreur: 'Appareil non reconnu' })
  try {
    const v = await verifyAuthenticationResponse({
      response: req.body.credential, expectedChallenge: challenge,
      expectedOrigin: ORIGINES, expectedRPID: RP_ID, requireUserVerification: true,
      authenticator: {
        credentialID: cred.credential_id,
        credentialPublicKey: Buffer.from(cred.public_key, 'base64url'),
        counter: cred.sign_count
      }
    })
    if (!v.verified) throw new Error('Signature invalide')
    // Anti-clonage : le compteur doit progresser (0 = authentificateur sans compteur)
    const nouveau = v.authenticationInfo.newCounter
    if (nouveau !== 0 && nouveau <= cred.sign_count) {
      logEvent(u.id, 'biometrie_rejeu_detecte', req)
      return res.status(403).json({ erreur: 'Anomalie de sécurité détectée (compteur)' })
    }
    db.prepare('UPDATE webauthn_credentials SET sign_count=?, last_used_at=CURRENT_TIMESTAMP WHERE id=?').run(nouveau, cred.id)
    // Session sans clé privée E2EE : la biométrie ne fournit pas le mot de passe.
    // La messagerie restera verrouillée jusqu'à une connexion par mot de passe.
    const sess = creerSession(u.id, req, null)
    logEvent(u.id, 'connexion_biometrique', req)
    res.json({
      status: 'ok', ...sess,
      user: { id: u.id, nom: u.nom, email: u.email, notif_connexion: u.notif_connexion, email_verified: u.email_verified,
        qr_login_enabled: u.qr_login_enabled, biometric_enabled: u.biometric_enabled, public_key: u.public_key }
    })
  } catch (e) {
    logEvent(u.id, 'biometrie_echec', req, e.message)
    res.status(400).json({ erreur: e.message })
  }
})

// ===== Liste / suppression des appareils =====
router.get('/credentials', exiger, (req, res) => {
  res.json(db.prepare('SELECT id, device_name, created_at, last_used_at FROM webauthn_credentials WHERE user_id=?').all(req.user.id))
})
router.post('/delete', exiger, (req, res) => {
  const c = db.prepare('SELECT * FROM webauthn_credentials WHERE id=? AND user_id=?').get(req.body.id, req.user.id)
  if (!c) return res.status(404).json({ erreur: 'Appareil introuvable' })
  db.prepare('DELETE FROM webauthn_credentials WHERE id=?').run(c.id)
  const reste = db.prepare('SELECT COUNT(*) c FROM webauthn_credentials WHERE user_id=?').get(req.user.id).c
  if (!reste) db.prepare('UPDATE users SET biometric_enabled=0 WHERE id=?').run(req.user.id)
  logEvent(req.user.id, 'biometrie_supprimee', req, c.device_name)
  res.json({ ok: true })
})

export default router
