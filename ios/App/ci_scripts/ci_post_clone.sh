#!/bin/sh
# Xcode Cloud — npm + Capacitor AVANT résolution SPM (plugins dans node_modules).
# Emplacement requis : ios/App/ci_scripts/ (même niveau que App.xcodeproj).
set -e

echo "▶ BuildEasy ci_post_clone (ios/App/ci_scripts)"

cd "${CI_PRIMARY_REPOSITORY_PATH:-.}"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm absent — installation via Homebrew…"
  brew install node@22
  export PATH="/opt/homebrew/opt/node@22/bin:/usr/local/opt/node@22/bin:$PATH"
fi

echo "Node $(node --version) · npm $(npm --version)"
echo "Repo: $(pwd)"

npm ci
npm run build
npx cap sync ios

if [ ! -f node_modules/@capacitor/app/Package.swift ]; then
  echo "❌ @capacitor/app introuvable après npm ci"
  ls -la node_modules/@capacitor 2>/dev/null || echo "(node_modules/@capacitor absent)"
  exit 1
fi

echo "✅ node_modules + Capacitor iOS prêts pour xcodebuild"
