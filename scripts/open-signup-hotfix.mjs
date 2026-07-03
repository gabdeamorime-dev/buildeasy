#!/usr/bin/env node
/**
 * Copie HOTFIX_SIGNUP_v4.sql dans le presse-papier et ouvre le SQL Editor Supabase.
 * Usage: npm run db:open-signup-fix
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PROJECT_REF = 'nvgemgfeaxqocrmzdmzy'
const SQL_URL = `https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`

const candidates = [
  'supabase/HOTFIX_SIGNUP_v4.sql',
  'supabase/HOTFIX_SIGNUP_v3.sql',
  'supabase/HOTFIX_SIGNUP_v2.sql',
]

const rel = candidates.find((c) => existsSync(resolve(root, c)))
if (!rel) {
  console.error('❌ Aucun fichier HOTFIX_SIGNUP_*.sql trouvé')
  process.exit(1)
}

const sql = readFileSync(resolve(root, rel), 'utf8')

try {
  execSync('pbcopy', { input: sql })
  console.log(`✅ SQL copié dans le presse-papier (${rel})`)
} catch {
  console.log(`⚠ pbcopy indisponible — ouvrez ${rel} et copiez manuellement`)
}

try {
  execSync(`open "${SQL_URL}"`)
  console.log(`✅ SQL Editor ouvert : ${SQL_URL}`)
} catch (e) {
  console.log(`→ Ouvrez manuellement : ${SQL_URL}`)
}

console.log('\nDans Supabase : Cmd+V → Run → puis npm run test:signup')
