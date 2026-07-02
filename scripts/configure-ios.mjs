/**
 * Configure la signature iOS avec votre Apple Developer Team ID.
 *
 * Usage:
 *   1. Ajoutez APPLE_TEAM_ID=XXXXXXXXXX dans .env
 *   2. npm run configure:ios
 *
 * Team ID : https://developer.apple.com/account → Membership
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadEnv() {
  for (const name of ['.env', '.env.local']) {
    const p = resolve(root, name)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (!m || line.trimStart().startsWith('#')) continue
      if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

loadEnv()

const teamId = (process.env.APPLE_TEAM_ID || process.argv[2] || '').trim()

if (!teamId) {
  console.error('❌ Définissez APPLE_TEAM_ID dans .env ou passez-le en argument :')
  console.error('   npm run configure:ios -- XXXXXXXXXX')
  process.exit(1)
}

if (!/^[A-Z0-9]{10}$/.test(teamId)) {
  console.warn('⚠ Team ID inhabituel (attendu : 10 caractères alphanumériques)')
}

const signingPath = resolve(root, 'ios/Signing.xcconfig')
const content = `// Généré par npm run configure:ios — ne pas commiter si repo public
DEVELOPMENT_TEAM = ${teamId}
`

writeFileSync(signingPath, content)
console.log(`✓ ios/Signing.xcconfig → DEVELOPMENT_TEAM = ${teamId}`)
console.log('\nProchaines étapes :')
console.log('  npm run prepare:ios    # sync + ouvre Xcode')
console.log('  Xcode → Product → Archive → Distribute App')
