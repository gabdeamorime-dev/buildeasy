#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "BuildEasy — configuration production"
echo "======================================"
node scripts/configure-production.mjs --deploy
echo ""
read -p "Appuyez sur Entrée pour fermer…"
