#!/bin/sh
# Filet de sécurité — ci_post_clone peut être ignoré si mal placé.
set -e

cd "${CI_PRIMARY_REPOSITORY_PATH:-.}"

if [ ! -f node_modules/@capacitor/app/Package.swift ]; then
  echo "▶ Capacitor plugins manquants — npm ci + cap sync…"
  if ! command -v npm >/dev/null 2>&1; then
    brew install node@22
    export PATH="/opt/homebrew/opt/node@22/bin:/usr/local/opt/node@22/bin:$PATH"
  fi
  npm ci
  npm run build
  npx cap sync ios
fi
