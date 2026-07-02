#!/bin/sh
# Filet de sécurité si ci_post_clone n'a pas tourné ou a échoué silencieusement.
set -e

cd "${CI_PRIMARY_REPOSITORY_PATH:-.}"

if [ ! -d node_modules/@capacitor/app ]; then
  echo "▶ Capacitor plugins manquants — npm ci + cap sync…"
  npm ci
  npm run build
  npx cap sync ios
fi
