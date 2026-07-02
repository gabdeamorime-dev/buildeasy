#!/usr/bin/env bash
# Prépare BuildEasy pour iPhone (sync web → iOS + ouverture Xcode)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "▶ Vérification Apple Developer…"
if [ ! -f ios/Signing.xcconfig ]; then
  echo "⚠ ios/Signing.xcconfig absent"
  echo "  Copiez ios/Signing.xcconfig.example → ios/Signing.xcconfig"
  echo "  Puis : npm run configure:ios -- VOTRE_TEAM_ID"
  echo "  (Team ID sur developer.apple.com → Membership)"
fi

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "❌ Xcode non installé — installez-le depuis l'App Store Mac"
  exit 1
fi

if ! xcodebuild -checkFirstLaunchStatus 2>/dev/null; then
  echo "⚠ Acceptez la licence : sudo xcodebuild -license accept"
fi

if [ ! -f node_modules/@capacitor/app/Package.swift ]; then
  echo "▶ Installation npm (requise pour les packages Capacitor SPM)…"
  npm ci
fi

echo "▶ Assets store (icône + splash)…"
if [ ! -f assets/icon.png ]; then
  npm run assets:generate
else
  echo "  (assets/icon.png présent — skip, lancez npm run assets:generate pour régénérer)"
fi

echo "▶ Sync Capacitor iOS…"
npm run cap:sync

echo ""
echo "✅ Projet iOS prêt."
echo ""
echo "Sur iPhone (test) :"
echo "  1. Branchez votre iPhone au Mac"
echo "  2. npm run open:ios"
echo "  3. Xcode → Signing & Capabilities → Team = votre compte Apple Developer"
echo "  4. Sélectionnez votre iPhone en haut → ▶ Run"
echo ""
echo "Pour l'App Store :"
echo "  Xcode → Product → Archive → Distribute App → App Store Connect"
echo "  Voir IOS.md pour la checklist complète."
