#!/usr/bin/env node
/**
 * Correctif inscription Supabase — affiche les instructions ou lance supabase db push.
 * Usage: npm run db:fix-signup
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const migration = 'supabase/migrations/20260623_fix_signup_trigger.sql'

console.log('═══ Correctif inscription BuildEasy ═══\n')

try {
  execSync('npx supabase --version', { stdio: 'pipe', cwd: root })
  console.log('→ supabase db push…\n')
  execSync('npx supabase db push', { stdio: 'inherit', cwd: root })
  console.log('\n✅ Migration appliquée. Réessayez de créer un compte.')
} catch {
  console.log('Supabase CLI non lié ou indisponible.\n')
  console.log('Appliquez manuellement dans Supabase Dashboard → SQL Editor :')
  console.log(`  ${resolve(root, migration)}\n`)
  console.log('Contenu (copier-coller) :\n')
  console.log('─'.repeat(60))
  console.log(readFileSync(resolve(root, migration), 'utf8'))
  console.log('─'.repeat(60))
  console.log('\nPuis : Authentication → Providers → Email → désactiver "Confirm email" pour les tests.')
}
