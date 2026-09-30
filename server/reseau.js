// Détection de l'adresse réseau locale (LAN) du serveur.
// Sert à construire des liens ouvrables depuis le TÉLÉPHONE : "localhost" ne
// fonctionne pas sur un autre appareil, il faut l'IP de la machine sur le Wi-Fi.
import os from 'os'

const PORT = process.env.PORT || 3001

// Première IPv4 non interne (ex. 192.168.1.174). Recalculée à chaque appel :
// si tu changes de réseau, les liens suivent automatiquement.
export function adresseLan() {
  const interfaces = os.networkInterfaces()
  // On privilégie les interfaces Wi-Fi/Ethernet classiques
  const ordre = ['en0', 'en1', 'eth0', 'wlan0']
  const candidates = []
  for (const [nom, addrs] of Object.entries(interfaces)) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) candidates.push({ nom, ip: a.address })
    }
  }
  candidates.sort((a, b) => (ordre.indexOf(a.nom) + 99) % 99 - (ordre.indexOf(b.nom) + 99) % 99)
  return candidates[0]?.ip || null
}

// URL de base joignable depuis un autre appareil.
// - Si la requête arrive déjà sur une IP/domaine réel, on la réutilise telle quelle.
// - Si elle arrive sur localhost, on substitue l'IP du réseau local.
export function baseUrl(req) {
  const hote = req?.get?.('host') || ''
  const proto = req?.headers?.['x-forwarded-proto'] || req?.protocol || 'http'
  if (hote && !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(hote)) return `${proto}://${hote}`
  const lan = adresseLan()
  return lan ? `http://${lan}:${PORT}` : (process.env.APP_URL || `http://localhost:${PORT}`)
}

// URL utilisée hors requête (e-mails) : APP_URL s'il pointe ailleurs que localhost, sinon le LAN
export function baseUrlHorsRequete() {
  const conf = process.env.APP_URL || ''
  if (conf && !/localhost|127\.0\.0\.1/.test(conf)) return conf
  const lan = adresseLan()
  return lan ? `http://${lan}:${PORT}` : conf || `http://localhost:${PORT}`
}
