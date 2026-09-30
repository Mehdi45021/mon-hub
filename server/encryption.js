// BLOC 1 — Chiffrement (équivalent /config/encryption.php, avec libsodium)
// Chiffrement symétrique des données sensibles + hachage Argon2id des mots de passe
// + paires de clés asymétriques pour la messagerie E2EE.
// Version "sumo" : inclut crypto_pwhash (Argon2id), absent de la version standard
import sodium from 'libsodium-wrappers-sumo'
import crypto from 'crypto'

await sodium.ready
export const pret = sodium

// Clé maître symétrique (depuis .env, jamais dans le dépôt)
const CLE = process.env.APP_ENCRYPTION_KEY
  ? sodium.from_hex(process.env.APP_ENCRYPTION_KEY)
  : null
if (!CLE) console.warn('⚠️  APP_ENCRYPTION_KEY absente : les données sensibles ne seront pas chiffrées.')

// ===== Symétrique (secretbox = XSalsa20-Poly1305, authentifié) =====
export function encrypt(data) {
  if (!CLE || data == null) return data
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  const chiffre = sodium.crypto_secretbox_easy(String(data), nonce, CLE)
  return 'v1:' + sodium.to_base64(nonce) + ':' + sodium.to_base64(chiffre)
}
export function decrypt(data) {
  if (!CLE || typeof data !== 'string' || !data.startsWith('v1:')) return data
  try {
    const [, n, c] = data.split(':')
    return sodium.to_string(sodium.crypto_secretbox_open_easy(sodium.from_base64(c), sodium.from_base64(n), CLE))
  } catch { return null } // altération détectée
}

// ===== Mots de passe (Argon2id) =====
export const hashPassword = (mdp) =>
  sodium.crypto_pwhash_str(mdp, sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE, sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE)
export function verifyPassword(mdp, hash) {
  try {
    // Compatibilité avec les anciens comptes en scrypt "sel:hash"
    if (hash.includes(':') && !hash.startsWith('$')) {
      const [sel, h] = hash.split(':')
      const test = crypto.scryptSync(mdp, sel, 64).toString('hex')
      return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(test, 'hex'))
    }
    return sodium.crypto_pwhash_str_verify(hash, mdp)
  } catch { return false }
}
// Un hash scrypt doit être migré vers Argon2id à la prochaine connexion réussie
export const doitMigrer = (hash) => hash.includes(':') && !hash.startsWith('$')

// ===== Asymétrique (messagerie E2EE) =====
export function genererPaireCles() {
  const p = sodium.crypto_box_keypair()
  return { publique: sodium.to_base64(p.publicKey), privee: sodium.to_base64(p.privateKey) }
}
// Dérive une clé depuis le mot de passe pour protéger la clé privée au repos
function cleDepuisMdp(mdp, selB64) {
  return sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES, mdp, sodium.from_base64(selB64),
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE, sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_DEFAULT
  )
}
// Chiffre la clé privée avec le mot de passe → le serveur seul ne peut rien lire
export function chiffrerClePrivee(priveeB64, mdp) {
  const sel = sodium.to_base64(sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES))
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  const c = sodium.crypto_secretbox_easy(sodium.from_base64(priveeB64), nonce, cleDepuisMdp(mdp, sel))
  return ['v1', sel, sodium.to_base64(nonce), sodium.to_base64(c)].join(':')
}
export function dechiffrerClePrivee(paquet, mdp) {
  try {
    const [, sel, n, c] = paquet.split(':')
    return sodium.to_base64(sodium.crypto_secretbox_open_easy(sodium.from_base64(c), sodium.from_base64(n), cleDepuisMdp(mdp, sel)))
  } catch { return null }
}

// ===== Messages (crypto_box : clé publique destinataire + clé privée expéditeur) =====
export function chiffrerMessage(texte, publiqueDest, priveeExp) {
  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES)
  const c = sodium.crypto_box_easy(texte, nonce, sodium.from_base64(publiqueDest), sodium.from_base64(priveeExp))
  return sodium.to_base64(nonce) + ':' + sodium.to_base64(c)
}
export function dechiffrerMessage(paquet, publiqueAutre, priveeMoi) {
  try {
    const [n, c] = paquet.split(':')
    return sodium.to_string(sodium.crypto_box_open_easy(
      sodium.from_base64(c), sodium.from_base64(n), sodium.from_base64(publiqueAutre), sodium.from_base64(priveeMoi)))
  } catch { return null }
}

// Jeton aléatoire sûr + empreinte SHA-256 (pour stocker un token haché)
export const generateSecureToken = () => crypto.randomBytes(32).toString('hex')
export const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex')
