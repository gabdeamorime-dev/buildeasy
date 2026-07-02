# BuildEasy — Publication iPhone (App Store)

Guide pas à pas après l'achat du **Apple Developer Program** (99 €/an).

| Champ | Valeur |
|-------|--------|
| **Nom** | BuildEasy |
| **Bundle ID** | `eu.buildeasy.app` |
| **Version** | 1.0.0 (build 1) |
| **Politique de confidentialité** | https://buildeasy.vercel.app/privacy |
| **Support** | https://buildeasy.vercel.app/support |

---

## 1. Prérequis Mac

```bash
# Licence Xcode (une fois)
sudo xcodebuild -license accept

# Vérifier Xcode
xcodebuild -version
```

Installez **Xcode** depuis l'App Store si ce n'est pas déjà fait.

---

## 2. Configurer votre Team ID Apple

1. Allez sur [developer.apple.com/account](https://developer.apple.com/account) → **Membership**
2. Copiez le **Team ID** (10 caractères, ex. `AB12CD34EF`)
3. Ajoutez-le dans `.env` :

```bash
APPLE_TEAM_ID=AB12CD34EF
```

4. Générez la config de signature :

```bash
npm run configure:ios
```

Cela crée `ios/Signing.xcconfig` (fichier local, non versionné).

---

## 3. Préparer le projet iOS

```bash
npm run prepare:ios
```

Cette commande :
- vérifie Xcode et la signature
- build le web + service worker
- sync Capacitor (`dist` → projet iOS)
- affiche les étapes suivantes

Pour ouvrir Xcode :

```bash
npm run open:ios
```

---

## 4. Tester sur votre iPhone

1. Branchez l'iPhone au Mac (câble USB)
2. Sur l'iPhone : **Réglages → Confidentialité → Mode développeur** (si demandé après la 1ʳᵉ install)
3. Dans Xcode :
   - Cible **App** → **Signing & Capabilities**
   - **Team** = votre compte Apple Developer
   - Cochez **Automatically manage signing**
4. En haut de Xcode, sélectionnez votre **iPhone** (pas le simulateur)
5. Cliquez **▶ Run**

> La première fois, Xcode peut créer automatiquement le certificat et le profil de provisioning.

---

## 5. Créer l'app sur App Store Connect

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Apps** → **+** → **Nouvelle app**
2. Renseigner :
   - **Plateformes** : iOS
   - **Nom** : BuildEasy
   - **Langue principale** : Français
   - **Bundle ID** : `eu.buildeasy.app` (doit exister dans [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list))
   - **SKU** : `buildeasy-ios`
3. **Informations sur l'app** :
   - **URL de support** : `https://buildeasy.vercel.app/support`
   - **URL politique de confidentialité** : `https://buildeasy.vercel.app/privacy`

### App Privacy (obligatoire)

Dans App Store Connect → **Confidentialité de l'app** :

| Donnée | Collectée | Liée à l'identité | Suivi |
|--------|-----------|-------------------|-------|
| Email | Oui (compte) | Oui | Non |
| Nom | Oui (profil) | Oui | Non |
| Photos / vidéos | Oui (chat chantier, optionnel) | Oui | Non |
| Contenu utilisateur | Oui (devis, messages) | Oui | Non |

- **Pas de tracking** publicitaire
- **Pas de données vendues à des tiers**

### Fiche App Store

- **Catégorie** : Business ou Productivity
- **Description** : Gestion de chantier BTP — heures, tâches, devis, incidents, MOA, chat avec photos
- **Mots-clés** : BTP, chantier, construction, devis, planning, artisan
- **Captures** : minimum 3 écrans iPhone 6.7" (et 6.5" si possible)
- **Âge** : 4+ (app pro, pas de contenu sensible)

---

## 6. Archiver et envoyer à l'App Store

Dans Xcode :

1. Sélectionnez **Any iOS Device (arm64)** en haut (pas un simulateur)
2. **Product → Archive**
3. Dans l'Organizer : **Distribute App**
4. **App Store Connect** → **Upload**
5. Attendez le traitement (15–60 min) dans App Store Connect → **TestFlight** ou **App Store**

Ensuite dans App Store Connect :

1. **Version iOS** → ajoutez la build uploadée
2. Remplissez la fiche (captures, description, confidentialité)
3. **Soumettre pour examen**

Délai d'examen Apple : en général 24–48 h.

---

## 7. Checklist technique (déjà dans le projet)

- [x] Capacitor 8 + plugins (App, Splash, StatusBar, Keyboard)
- [x] Bundle ID `eu.buildeasy.app`
- [x] Permissions caméra / photothèque / micro (chat médias)
- [x] `ITSAppUsesNonExemptEncryption = false` (pas de déclaration export)
- [x] `PrivacyInfo.xcprivacy` (API UserDefaults, FileTimestamp)
- [x] Safe area iPhone (encoche, barre d'accueil)
- [x] Pages `/privacy` et `/support` (obligatoires App Store)
- [x] Schéma Xcode partagé (`App.xcscheme`) pour Archive
- [x] Config signature via `APPLE_TEAM_ID`

---

## 8. Incrémenter une version (mises à jour)

1. `package.json` → `"version": "1.0.1"`
2. Xcode → **App** → **General** → Version `1.0.1`, Build `+1`
3. `npm run prepare:ios`
4. **Product → Archive** → upload

---

## Dépannage

| Problème | Solution |
|----------|----------|
| *Signing requires a development team* | `npm run configure:ios` puis choisir Team dans Xcode |
| *Failed to register bundle identifier* | Créez `eu.buildeasy.app` sur developer.apple.com → Identifiers |
| iPhone non listé | Déverrouillez l'iPhone, faites confiance à l'ordinateur |
| Archive grisé | Sélectionnez **Any iOS Device**, pas un simulateur |
| App blanche au lancement | `npm run cap:sync` puis rebuild dans Xcode |
| Licence Xcode | `sudo xcodebuild -license accept` |
| **Could not resolve package dependencies** / `@capacitor/* doesn't exist` | Lancer `npm ci` puis `npm run cap:sync` **avant** Xcode. Sur **Xcode Cloud**, le dossier `ci_scripts/ci_post_clone.sh` du repo installe npm automatiquement. |

---

## Commandes utiles

```bash
npm run configure:ios      # Team ID → Signing.xcconfig
npm run prepare:ios        # Build + sync + instructions
npm run open:ios           # Ouvre Xcode
npm run cap:sync           # Rebuild web + sync iOS/Android
npm run assets:generate    # Régénère icônes et splash
```

Voir aussi [STORE.md](./STORE.md) pour Android et la vue d'ensemble stores.
