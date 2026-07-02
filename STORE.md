# BuildEasy — Publication App Store & Google Play

## Identité app

| Champ | Valeur |
|-------|--------|
| **Nom** | BuildEasy |
| **Bundle ID / Package** | `eu.buildeasy.app` |
| **Version** | 1.0.0 (build 1) |
| **Catégorie** | Business / Productivity |
| **Orientation** | Portrait (iPhone), iPad flexible |

---

## Prérequis (une seule fois)

### macOS / iOS

Voir le guide détaillé **[IOS.md](./IOS.md)**.

```bash
# 1. Team ID dans .env puis :
npm run configure:ios

# 2. Build + sync + instructions
npm run prepare:ios

# 3. Ouvrir Xcode
npm run open:ios
```

```bash
sudo xcodebuild -license accept
```
- Compte [Apple Developer Program](https://developer.apple.com/programs/) (99 €/an)
- Dans Xcode → projet **App** → **Signing & Capabilities** : Team + *Automatically manage signing*

### Android
- Compte [Google Play Console](https://play.google.com/console) (25 $ unique)
- JDK : Android Studio embarque Java 21 (`/Applications/Android Studio.app/Contents/jbr/Contents/Home`)

---

## Commandes de build

```bash
# Sync + assets (si icône modifiée)
npm run assets:generate
npm run cap:sync

# Tout-en-un (APK, AAB, archive iOS)
npm run build:store

# Ou séparément
npm run open:ios          # Xcode
npm run open:android      # Android Studio
npm run build:android     # APK + AAB
```

### Fichiers générés
- **Android APK** : `android/app/build/outputs/apk/release/app-release.apk`
- **Android AAB** (Play Store) : `android/app/build/outputs/bundle/release/app-release.aab`
- **iOS archive** : `build/BuildEasy.xcarchive`
- **iOS IPA** : `build/ios-export/App.ipa` (après export réussi)

### Keystore Android (déjà créé en local)
- Fichier : `android/release/buildeasy-release.keystore`
- Config : `android/keystore.properties` (**ne pas commiter**)
- Alias : `buildeasy`
- **Important** : sauvegardez le keystore + mots de passe — Google exige le même certificat pour toutes les mises à jour.

Pour régénérer (prod) :
```bash
keytool -genkey -v -keystore android/release/buildeasy-release.keystore \
  -alias buildeasy -keyalg RSA -keysize 2048 -validity 10000
cp android/keystore.properties.example android/keystore.properties
```

---

## App Store Connect (iOS)

1. [App Store Connect](https://appstoreconnect.apple.com) → **My Apps** → **+** → New App
2. Renseigner : BuildEasy, `eu.buildeasy.app`, SKU `buildeasy-ios`
3. Xcode → **Product → Archive** → **Distribute App → App Store Connect**
4. Fiche App Store :
   - **Description** : Gestion de chantier BTP — heures, tâches, devis, incidents, MOA
   - **Mots-clés** : BTP, chantier, construction, devis, planning
   - **URL support** : https://buildeasy.vercel.app/support
   - **URL politique de confidentialité** : https://buildeasy.vercel.app/privacy
   - **Captures** : iPhone 6.7" + 6.5" (minimum 3 écrans)
5. **App Privacy** : pas de tracking ; données compte/email si Supabase activé
6. **Export compliance** : `ITSAppUsesNonExemptEncryption = false` (déjà dans Info.plist)

---

## Google Play Console (Android)

1. **Create app** → BuildEasy, Business, Free/Paid selon modèle
2. **Release → Production → Create release**
3. Uploader `app-release.aab`
4. **Store listing** :
   - Icône 512×512 (généré dans `assets/icon.png`)
   - Feature graphic 1024×500
   - Captures téléphone (min. 2)
5. **Data safety** : déclarer stockage local + sync cloud optionnelle (Supabase)
6. **Content rating** : questionnaire IARC
7. **Target audience** : 18+ (app pro)

---

## Politique de confidentialité (obligatoire)

Pages publiques déjà intégrées à l'app :

- **Confidentialité** : https://buildeasy.vercel.app/privacy
- **Support** : https://buildeasy.vercel.app/support

Contact : support@buildeasy.eu

---

## Checklist technique (déjà fait dans le projet)

- [x] Capacitor 8 + plugins (App, Splash, StatusBar, Keyboard)
- [x] Icônes & splash iOS/Android (`npm run assets:generate`)
- [x] `PrivacyInfo.xcprivacy` (Apple)
- [x] HTTPS only, pas de cleartext (Android network config)
- [x] Portrait verrouillé (mobile)
- [x] Version 1.0.0 / build 1
- [x] Pages légales `/privacy` et `/support` (App Store)
- [x] Schéma Xcode + signature via `APPLE_TEAM_ID` (voir IOS.md)
- [x] PWA manifest web

---

## Incrémenter une version

1. `package.json` → `"version": "1.0.1"`
2. iOS : Xcode → General → Version 1.0.1, Build +1
3. Android : `android/app/build.gradle` → `versionCode 2`, `versionName "1.0.1"`
4. `npm run cap:sync` puis rebuild

---

## Support

- Docs Capacitor : https://capacitorjs.com/docs
- Problème Gradle : vérifier réseau + `JAVA_HOME`
- Problème Xcode : `sudo xcodebuild -license accept` puis clean build folder
