# Mon Hub

Tableau de bord personnel local et modulaire (Accueil, Calendrier, Tâches, Notes, Fichiers, Chat IA).

## Stack
React + Vite + Tailwind · Express + better-sqlite3 (SQLite).

## Lancer (usage normal)

**Double-clique `Lancer Mon Hub.command`** → l'app se compile si besoin, démarre, et le navigateur s'ouvre sur :

### http://localhost:3001

Garde la fenêtre Terminal ouverte tant que tu utilises Mon Hub (Ctrl+C pour arrêter).

⚠️ Mon Hub **ne s'ouvre pas** via `localhost:8888/mon-hub/` : ce n'est pas un site PHP,
il lui faut son serveur Node (Apache/MAMP ne sait pas l'exécuter).

### En ligne de commande
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"   # Node est installé via nvm
npm start        # compile + démarre sur http://localhost:3001
```

### Pour développer (rechargement à chaud)
```bash
npm run dev      # front http://localhost:5173 + API 3001
```

## Structure du dépôt

| Dossier | Contenu |
|---|---|
| `src/`, `server/`, `migrations/` | Site Web Mon Hub (React + Express + SQLite) |
| `ios/Cerveau/` | App iOS Cerveau (SwiftUI / SwiftData) — s'ouvre avec `Cerveau.xcodeproj` |

Non versionnés (volontairement) : `.env`, `data/hub.db*`, `data/fichiers/`, `data/livres/`.

## Démarrage automatique (macOS)

Un service `launchd` (`~/Library/LaunchAgents/com.mehdi.monhub.plist`) lance le serveur à l'ouverture de session, sans MAMP.

```bash
launchctl bootout gui/$(id -u)/com.mehdi.monhub                                        # arrêter
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.mehdi.monhub.plist         # démarrer
```

Après une modification du front : `npm run build`, puis redémarrer le service.

## Sécurité

| Domaine | Mise en œuvre |
|---|---|
| Mots de passe | Argon2id (libsodium), migration auto depuis scrypt |
| Données sensibles | `encrypt()`/`decrypt()` XSalsa20-Poly1305, clé dans `.env` |
| Messagerie | E2EE `crypto_box` — la base ne contient que du chiffré |
| Clé privée | Chiffrée par le mot de passe, déverrouillée en mémoire pendant la session |
| En-têtes HTTP | CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, HSTS en HTTPS |
| CSRF | Jeton par session, en-tête `X-CSRF-Token` exigé sur toute écriture |
| Sessions | Timeout 30 min, liées à l'IP + user-agent, révoquées au changement de mot de passe |
| Force brute | 5 essais / 15 min (`login_attempts`) + alerte e-mail |
| SQL | 100 % requêtes préparées (better-sqlite3) |
| Journal | `security_logs` — consultable dans Réglages → Sécurité |
| 2FA QR Code | QR 3 min + OTP 6 chiffres à usage unique, 3 essais max |
| Biométrie | WebAuthn (Face ID / Touch ID / Windows Hello), compteur anti-rejeu |

Fichiers : `server/encryption.js`, `security.js`, `mailer.js`, `messages.js`, `qrlogin.js`,
`webauthn.js` · schéma dans `migrations/` · gabarits d'e-mails dans `templates/emails/`.

⚠️ **WebAuthn exige HTTPS**, sauf sur `localhost` (le cas ici). Si tu exposes le site
sur un domaine, mets `APP_DOMAIN` et `APP_URL` à jour dans `.env` et passe en HTTPS.

## Où est la base de données ?

**`data/hub.db`** — c'est du **SQLite**, pas du MySQL.
👉 Elle n'apparaît donc **pas dans phpMyAdmin** (qui ne gère que MySQL). C'est un simple fichier.

Pour l'ouvrir :
- **DB Browser for SQLite** (gratuit, https://sqlitebrowser.org) → Fichier > Ouvrir une base
- **Terminal** : `sqlite3 data/hub.db` puis `.tables` / `SELECT * FROM notes;`
- **Plus simple** : Réglages → Sauvegarde → *Exporter* (tout en JSON lisible)

⚠️ Sauvegarde : copie **les 3 fichiers** `hub.db`, `hub.db-wal`, `hub.db-shm` (le `-wal` contient
les écritures récentes), ou passe par l'export JSON.

## Données
- SQLite : `data/hub.db` (27 tables : comptes, tâches, notes, école…) — persiste après redémarrage.
- Fichiers : `data/fichiers/` = sandbox de l'explorateur (tout y reste, `../` bloqué).

## Ajouter une section
1. Créer `src/modules/MaSection.jsx`.
2. Ajouter une ligne dans `src/modules/index.js` (`MODULES`).
Le menu et le routage se génèrent automatiquement.

## Chat IA
- Proxy serveur `/api/chat` ; la clé reste dans `.env` (jamais côté front).
- Économe : contexte = résumé court des données (tronqué ~150 car.), 6 derniers messages, `max_tokens` 800.
- `.env` : `AI_PROVIDER` (anthropic|openai), `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL` (optionnel).
