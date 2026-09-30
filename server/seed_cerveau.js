// Amorçage du cerveau : les faits établis au fil des sessions de travail.
// Uniquement des éléments vérifiables (projets réels, préférences exprimées, environnement
// technique constaté) — rien d'inventé. Tout est modifiable dans la section Cerveau.
import db from './db.js'

const EMAIL = 'mehdibelfquih09@gmail.com'

const FAITS = [
  // ---- PERSO ----
  ['perso', 'identité', 'Prénom', 'Mehdi'],
  ['perso', 'identité', 'E-mail', EMAIL],
  ['perso', 'identité', 'Langue', 'Français — communique et travaille en français'],
  ['perso', 'identité', 'Statut', 'Lycéen'],
  ['perso', 'langues', 'Langues étudiées', 'Français, Anglais, Espagnol, Darija, Coréen'],
  ['perso', 'préférences', 'Style d\'interface', 'Sombre, sobre, éditorial (références Linear, Vercel, Arc) — déteste le générique et les emojis décoratifs'],
  ['perso', 'préférences', 'Rythme de travail', 'Va droit au but, veut du concret et du fonctionnel, pas de blabla'],
  ['perso', 'préférences', 'Exigence', 'Veut que les choses marchent vraiment, teste lui-même et signale ce qui est cassé'],
  ['perso', 'outils', 'Machine', 'Mac, sans Homebrew ni droits sudo'],

  // ---- PRO / SCOLAIRE / TECH ----
  ['pro', 'environnement', 'Stack habituelle', 'PHP/MySQL avec MAMP (Apache 8888, MySQL 8889), htdocs comme racine'],
  ['pro', 'environnement', 'Node.js', 'Node 20 via nvm — à charger avec: export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"'],
  ['pro', 'environnement', 'Front habituel', 'Approche CDN-only (Tailwind, GSAP, Chart.js) sur les projets PHP'],
  ['pro', 'projets', 'Mon Hub', 'Tableau de bord personnel (ce site) : React + Vite + Tailwind, Express + SQLite, port 3001'],
  ['pro', 'projets', 'nextech', 'Site de journalisme tech en PHP/MySQL, mode sombre/clair, RSS + NewsData.io'],
  ['pro', 'projets', 'JARVIS', 'Assistant vocal en HTML/CSS/JS pur, Gemini 2.0 Flash, Web Speech API'],
  ['pro', 'projets', 'Cerveau (iOS)', 'Application de notes SwiftUI/SwiftData, projet dans ~/Documents/Cerveau'],
  ['pro', 'projets', 'neon-archive', 'Interface façon OS futuriste, HTML/CSS/JS vanilla'],
  ['pro', 'projets', 'Autres', 'lartducaftan (e-commerce), portfolio-mehdi, TaskManager, studyrooms-final, theway'],
  ['pro', 'scolaire', 'Notes & moyennes', 'Gérées dans Pronote / Skolengo, pas dans Mon Hub'],
  ['pro', 'méthode', 'Habitudes de code', 'Vanilla JS en IIFE, glassmorphism, GSAP pour les animations, commentaires en français'],
  ['pro', 'sécurité', 'Exigences', 'Chiffrement de bout en bout, 2FA par QR Code, biométrie WebAuthn, journal de sécurité']
]

export function amorcerCerveau() {
  const u = db.prepare('SELECT id FROM users WHERE email=?').get(EMAIL)
  if (!u) return { amorce: false, raison: 'compte absent' }
  const deja = db.prepare("SELECT COUNT(*) c FROM brain_facts WHERE user_id=? AND source='seed'").get(u.id).c
  if (deja) return { amorce: false, raison: 'déjà amorcé', faits: deja }

  const ins = db.prepare(`INSERT INTO brain_facts (user_id, sphere, categorie, cle, valeur, source, poids, cree, maj)
    VALUES (?,?,?,?,?,'seed',2,?,?)`)
  const t = Date.now()
  const tx = db.transaction(() => { for (const [s, c, k, v] of FAITS) ins.run(u.id, s, c, k, v, t, t) })
  tx()
  return { amorce: true, faits: FAITS.length }
}
