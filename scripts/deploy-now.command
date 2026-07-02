#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "BuildEasy — déploiement production"
echo "==================================="
echo ""
npm run fix:vercel-domain
echo ""
echo "→ Audit sécurité…"
npm run security:audit
echo ""
echo "→ Tests E2E (Playwright)…"
python3 -m playwright install chromium 2>/dev/null || python3 -m pip install playwright --user && python3 -m playwright install chromium
npm run test:e2e
echo ""
echo "✅ Terminé — https://buildeasy.vercel.app/app"
read -p "Appuyez sur Entrée pour fermer…"
