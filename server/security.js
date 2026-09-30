// BLOC 2 — Sécurité générale (équivalent /config/security.php)
// Headers HTTP stricts, CSRF, sessions durcies (timeout + IP/UA), anti-force-brute,
// journalisation des évènements sensibles.
import crypto from 'crypto'
import db from './db.js'

export const ipDe = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || ''
export const uaDe = (req) => (req.headers['user-agent'] || '').slice(0, 255)

// ===== A. Headers HTTP de sécurité =====
export function headers(req, res, next) {
  // CSP stricte : pas de script externe ; 'unsafe-inline' limité aux styles (Tailwind runtime)
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'"
  ].join('; '))
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()')
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none')
  // HSTS uniquement en HTTPS (sinon il bloquerait l'accès local en http)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  res.removeHeader('X-Powered-By')
  next()
}

// ===== F. Journalisation =====
export function logEvent(userId, action, req, details = '') {
  try {
    db.prepare('INSERT INTO security_logs (user_id, action, ip, user_agent, details) VALUES (?,?,?,?,?)')
      .run(userId ?? null, action, req ? ipDe(req) : null, req ? uaDe(req) : null, details ? String(details).slice(0, 500) : null)
  } catch (e) { console.error('log sécurité :', e.message) }
}

// ===== D. Anti-force-brute : 5 essais / 15 minutes =====
const FENETRE = 15 * 60 * 1000, MAX_ESSAIS = 5
export function bloque(email, ip) {
  const depuis = Date.now() - FENETRE
  const n = db.prepare('SELECT COUNT(*) c FROM login_attempts WHERE reussi=0 AND created_at>? AND (email=? OR ip=?)')
    .get(depuis, (email || '').toLowerCase(), ip).c
  return n >= MAX_ESSAIS
}
export function noterEssai(email, ip, reussi) {
  db.prepare('INSERT INTO login_attempts (email, ip, reussi, created_at) VALUES (?,?,?,?)')
    .run((email || '').toLowerCase(), ip, reussi ? 1 : 0, Date.now())
  if (reussi) db.prepare('DELETE FROM login_attempts WHERE email=? AND reussi=0').run((email || '').toLowerCase())
  db.prepare('DELETE FROM login_attempts WHERE created_at < ?').run(Date.now() - 24 * 3600 * 1000) // purge
}
export function essaisRestants(email, ip) {
  const depuis = Date.now() - FENETRE
  const n = db.prepare('SELECT COUNT(*) c FROM login_attempts WHERE reussi=0 AND created_at>? AND (email=? OR ip=?)')
    .get(depuis, (email || '').toLowerCase(), ip).c
  return Math.max(0, MAX_ESSAIS - n)
}

// ===== B. CSRF (double-submit : jeton lié à la session, renvoyé en en-tête) =====
export const genererCsrf = () => crypto.randomBytes(32).toString('hex')
// Les appels d'écriture doivent porter X-CSRF-Token identique à celui de la session
export function validateCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  const envoye = req.headers['x-csrf-token']
  if (!req.session?.csrf || envoye !== req.session.csrf) {
    logEvent(req.user?.id, 'csrf_invalide', req, req.originalUrl)
    return res.status(403).json({ erreur: 'Jeton CSRF invalide' })
  }
  next()
}

// ===== C. Sessions durcies : timeout 30 min + liaison IP / user-agent =====
export const TIMEOUT = 30 * 60 * 1000
export function verifierSession(session, req) {
  if (!session) return { ok: false, raison: 'inconnue' }
  const maintenant = Date.now()
  if (session.derniere_activite && maintenant - session.derniere_activite > TIMEOUT) return { ok: false, raison: 'expiree' }
  if (session.ip && session.ip !== ipDe(req)) return { ok: false, raison: 'ip' }
  if (session.user_agent && session.user_agent !== uaDe(req)) return { ok: false, raison: 'appareil' }
  return { ok: true }
}
export const toucherSession = (token) =>
  db.prepare('UPDATE sessions SET derniere_activite=? WHERE token=?').run(Date.now(), token)

// ===== D. Validation / échappement des entrées =====
export const estEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
export const texte = (v, max = 255) => typeof v === 'string' ? v.trim().slice(0, max) : ''
// Échappement HTML (équivalent htmlspecialchars) pour toute sortie non-React
export const echapper = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#039;')
