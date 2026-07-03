#!/usr/bin/env node
/**
 * Applique le correctif inscription Supabase (migration 20260623).
 *
 * Usage:
 *   npm run db:fix-signup
 *
 * Option A — mot de passe base (recommandé) :
 *   Supabase Dashboard → Project Settings → Database → Database password
 *   SUPABASE_DB_PASSWORD='…' npm run db:fix-signup
 *
 * Option B — Supabase CLI lié :
 *   supabase login && supabase link --project-ref nvgemgfeaxqocrmzdmzy
 *   npm run db:fix-signup
 *
 * Option C — SQL Editor (sans CLI) :
 *   https://supabase.com/dashboard/project/nvgemgfeaxqocrmzdmzy/sql/new
 *   Coller le contenu de supabase/migrations/20260623_fix_signup_trigger.sql
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PROJECT_REF = 'nvgemgfeaxqocrmzdmzy'
const migrationRel = 'supabase/migrations/20260623_fix_signup_trigger.sql'
const hotfixRel = 'supabase/HOTFIX_SIGNUP_v4.sql'
const hotfixV3 = 'supabase/HOTFIX_SIGNUP_v3.sql'
const hotfixV2 = 'supabase/HOTFIX_SIGNUP_v2.sql'
const hotfixLegacy = 'supabase/HOTFIX_SIGNUP.sql'
const migrationPath = resolve(root, migrationRel)
const sql = readFileSync(
  existsSync(resolve(root, hotfixRel)) ? resolve(root, hotfixRel)
    : existsSync(resolve(root, hotfixV3)) ? resolve(root, hotfixV3)
    : existsSync(resolve(root, hotfixV2)) ? resolve(root, hotfixV2)
    : existsSync(resolve(root, hotfixLegacy)) ? resolve(root, hotfixLegacy)
    : resolve(root, migrationRel),
  'utf8',
)
const dashboardSql = `https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`

function loadEnv() {
  const env = { ...process.env }
  for (const file of ['.env', '.env.local']) {
    const p = resolve(root, file)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i <= 0) continue
      env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
    }
  }
  return env
}

function printManualInstructions() {
  console.log('\n── Appliquer manuellement (2 min) ──\n')
  console.log(`1. Ouvrir : ${dashboardSql}`)
  console.log(`2. Coller le SQL depuis : supabase/HOTFIX_SIGNUP_v4.sql`)
  console.log('   (ou lancez : npm run db:open-signup-fix — copie auto + ouvre le navigateur)')
  console.log('3. Cliquer Run')
  console.log('4. Réessayer l\'inscription dans l\'app\n')
  console.log('─'.repeat(60))
  console.log(sql)
  console.log('─'.repeat(60))
}

async function applyViaPg(env) {
  const password = env.SUPABASE_DB_PASSWORD || env.SUPABASE_DB_PASS
  const connectionString =
    env.DATABASE_URL ||
    env.SUPABASE_DB_URL ||
    (password
      ? `postgresql://postgres:${encodeURIComponent(password)}@db.${PROJECT_REF}.supabase.co:5432/postgres`
      : '')

  if (!connectionString) return false

  let Client
  try {
    ;({ Client } = await import('pg'))
  } catch {
    console.log('→ Installation de pg…')
    execSync('npm install pg --no-save', { stdio: 'inherit', cwd: root })
    ;({ Client } = await import('pg'))
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })

  console.log('→ Connexion Postgres + exécution migration…')
  await client.connect()
  try {
    await client.query(sql)
  } finally {
    await client.end()
  }
  return true
}

async function verifySignup(env) {
  const url = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.log('⚠ Vérification ignorée (SUPABASE_SERVICE_ROLE_KEY manquant)')
    return
  }

  const sb = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const email = `signup-fix-${Date.now()}@buildeasy-test.invalid`
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password: 'VerifyPass123!',
    email_confirm: true,
    user_metadata: { signup: 'true', nom: 'Verify', entreprise: 'Verify SA' },
  })

  if (error) {
    console.log(`⚠ Test inscription admin : ${error.message}`)
    return
  }

  const { error: profileErr } = await sb
    .from('profiles')
    .select('id, nom, role, vierge')
    .eq('id', data.user.id)
    .maybeSingle()

  await sb.auth.admin.deleteUser(data.user.id)

  if (profileErr) {
    console.log(`⚠ Profil après trigger : ${profileErr.message}`)
    return
  }

  console.log('✅ Test inscription OK (trigger handle_new_user)')
}

async function main() {
  const env = loadEnv()

  console.log('═══ Correctif inscription BuildEasy ═══\n')

  try {
    if (await applyViaPg(env)) {
      console.log('\n✅ Migration appliquée via Postgres.')
      await verifySignup(env)
      return
    }
  } catch (e) {
    console.error(`\n❌ Postgres : ${e.message}`)
    if (/password authentication failed/i.test(e.message)) {
      console.error('   Vérifiez SUPABASE_DB_PASSWORD (Dashboard → Database → password).')
    }
  }

  try {
    execSync('npx supabase --version', { stdio: 'pipe', cwd: root })
    console.log('→ supabase db execute (project ref)…\n')
    execSync(
      `npx supabase db execute --project-ref ${PROJECT_REF} --file supabase/HOTFIX_SIGNUP_v4.sql`,
      { stdio: 'inherit', cwd: root, env: { ...env, SUPABASE_ACCESS_TOKEN: env.SUPABASE_ACCESS_TOKEN || '' } },
    )
    console.log('\n✅ Migration appliquée via Supabase CLI.')
    await verifySignup(env)
    return
  } catch (e) {
    console.log('⚠ supabase db execute échoué —', e.message?.split('\n')[0] || 'CLI non lié')
  }

  try {
    execSync('npx supabase --version', { stdio: 'pipe', cwd: root })
    console.log('→ supabase db push…\n')
    execSync('npx supabase db push', { stdio: 'inherit', cwd: root })
    console.log('\n✅ Migration appliquée via Supabase CLI.')
    await verifySignup(env)
    return
  } catch {
    /* CLI non lié */
  }

  printManualInstructions()
  console.log('\nAstuce : ajoutez SUPABASE_DB_PASSWORD dans .env puis relancez npm run db:fix-signup')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
