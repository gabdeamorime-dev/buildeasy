#!/usr/bin/env bash
# BuildEasy — builds release iOS + Android pour les stores
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "▶ Sync web → native…"
npm run cap:sync

export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
export PATH="$JAVA_HOME/bin:$PATH"

echo "▶ Android release (APK + AAB)…"
cd android
./gradlew assembleRelease bundleRelease
cd "$ROOT"

APK="android/app/build/outputs/apk/release/app-release.apk"
AAB="android/app/build/outputs/bundle/release/app-release.aab"
[ -f "$APK" ] && echo "✓ APK: $APK" || echo "✗ APK non généré"
[ -f "$AAB" ] && echo "✓ AAB: $AAB" || echo "✗ AAB non généré"

echo "▶ iOS archive (nécessite licence Xcode + certificat Apple)…"
if ! xcodebuild -checkFirstLaunchStatus 2>/dev/null; then
  echo "⚠ Acceptez la licence Xcode: sudo xcodebuild -license accept"
fi

mkdir -p build
xcodebuild -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath build/BuildEasy.xcarchive \
  archive \
  || echo "⚠ Archive iOS échouée — ouvrez Xcode, configurez Signing & Capabilities, puis Product → Archive"

if [ -d build/BuildEasy.xcarchive ]; then
  xcodebuild -exportArchive \
    -archivePath build/BuildEasy.xcarchive \
    -exportPath build/ios-export \
    -exportOptionsPlist ios/ExportOptions.plist \
    || echo "⚠ Export IPA échoué — vérifiez l'équipe de signature dans Xcode"
fi

echo ""
echo "Terminé. Voir STORE.md pour App Store Connect et Google Play Console."
