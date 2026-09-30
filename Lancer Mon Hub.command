#!/bin/zsh
# Double-clique ce fichier pour lancer Mon Hub.
cd "$(dirname "$0")"

# Charge Node (installé via nvm, pas dans le PATH par défaut)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js introuvable. Installe-le puis relance."
  read "?Appuie sur Entrée pour fermer..."
  exit 1
fi

# Compile l'app si besoin (première fois ou après modification du code)
if [ ! -d dist ] || [ src -nt dist ]; then
  echo "Compilation de Mon Hub..."
  npm run build || { echo "Échec de la compilation."; read "?Entrée pour fermer..."; exit 1; }
fi

LAN=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
echo ""
echo "  Sur ce Mac        :  http://localhost:3001"
[ -n "$LAN" ] && echo "  Sur ton téléphone :  http://$LAN:3001   (même Wi-Fi)"
echo "  (garde cette fenêtre ouverte ; Ctrl+C pour arrêter)"
echo ""

# Ouvre le navigateur puis démarre le serveur
( sleep 2; open http://localhost:3001 ) &
node server/index.js
