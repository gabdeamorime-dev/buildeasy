#!/bin/bash
# BuildEasy — créer les comptes démo dans Supabase
# Double-clic ou : bash setup-comptes.sh

cd "$(dirname "$0")"
echo ""
echo "🏗 BuildEasy — création des comptes démo"
echo "   Dossier : $(pwd)"
echo ""

if [ ! -f .env ]; then
  echo "❌ Fichier .env introuvable dans $(pwd)"
  echo "   Ouvrez le dossier buildeasy dans Cursor."
  exit 1
fi

if ! grep -q "SUPABASE_SERVICE_ROLE_KEY=ey" .env 2>/dev/null; then
  echo "❌ SUPABASE_SERVICE_ROLE_KEY manquante dans .env"
  echo "   Supabase → Project Settings → API → service_role"
  exit 1
fi

echo "→ Lancement du seed..."
npm run seed:users

echo ""
echo "→ Démarrage de l'app (Ctrl+C pour arrêter)..."
npm run dev
