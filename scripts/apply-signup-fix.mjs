#!/usr/bin/env node
/**
 * Correctif inscription Supabase — applique 20260623_fix_signup_trigger.sql
 * Usage: npm run db:fix-signup
 *
 * Méthodes (dans l'ordre) :
 * 1. DATABASE_URL ou SUPABASE_DB_URL → psql
 * 2. supabase db push --db-url (si historique migrations OK)
 * 3. Instructions manuelles + lien SQL Editor
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync, spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'nvgemgfeaxqocrmzdmzy'
const migrationRel = 'supabase/migrations/20260623_fix_signup_trigger.sql'
const migrationPath = resolve(root, migrationRel)
const SQL_EDITOR = `https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`

function loadEnvFile(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i <= 0) continue
    const key = t.slice(0, i).trim()
    let val = t.slice(i + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

function mergeEnv() {
  return {
    ...loadEnvFile(resolve(root, '.env')),
    ...loadEnvFile(resolve(root, '.env.local')),
    ...process.env,
  }
}

function resolveDbUrl(env) {
  const direct = env.DATABASE_URL || env.SUPABASE_DB_URL || env.POSTGRES_URL
  if (direct) return direct

  const password = env.SUPABASE_DB_PASSWORD || env.POSTGRES_PASSWORD
  if (password) {
    const host = env.SUPABASE_DB_HOST || `db.${PROJECT_REF}.supabase.co`
    const user = env.SUPABASE_DB_USER || 'postgres'
    const port = env.SUPABASE_DB_PORT || '5432'
    const db = env.SUPABASE_DB_NAME || 'postgres'
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${db}`
  }
  return null
}

function hasPsql() {
  const r = spawnSync('psql', ['--version'], { stdio: 'pipe' })
  return r.status === 0
}

function applyWithPsql(dbUrl) {
  console.log('→ Application via psql…\n')
  execSync(`psql "${dbUrl.replace(/"/g, '\\"')}" -v ON_ERROR_STOP=1 -f "${migrationPath}"`, {
    stdio: 'inherit',
    cwd: root,
  })
}

function applyWithSupabasePush(dbUrl) {
  console.log('→ Application via supabase db push --db-url…\n')
  execSync(`npx supabase db push --db-url "${dbUrl}" --yes`, {
    stdio: 'inherit',
    cwd: root,
  })
}

function printManualInstructions() {
  const sql = readFileSync(migrationPath, 'utf8')
  console.log('═══ Correctif inscription BuildEasy ═══\n')
  console.log('Appliquez la migration dans Supabase Dashboard → SQL Editor :')
  console.log(`  ${SQL_EDITOR}\n`)
  console.log(`Fichier local : ${migrationPath}\n`)
  console.log('Contenu (copier-coller puis Run) :\n')
  console.log('─'.repeat(60))
  console.log(sql)
  console.log('─'.repeat(60))
  console.log('\nEnsuite : Authentication → Providers → Email → désactiver « Confirm email » pour les tests.')
  console.log('Puis réessayez l\'inscription sur https://buildeasy.vercel.app/app')
}

async function main() {
  if (!existsSync(migrationPath)) {
    console.error(`❌ Fichier introuvable : ${migrationPath}`)
    process.exit(1)
  }

  const env = mergeEnv()
  const dbUrl = resolveDbUrl(env)

  console.log('═══ Correctif inscription BuildEasy ═══\n')
  console.log(`Projet Supabase : ${PROJECT_REF}`)
  console.log(`Migration       : ${migrationRel}\n`)

  if (dbUrl) {
    try {
      if (hasPsql()) {
        applyWithPsql(dbUrl)
        console.log('\n✅ Migration appliquée (psql). Réessayez de créer un compte.')
        return
      }
      applyWithSupabasePush(dbUrl)
      console.log('\n✅ Migration appliquée (supabase db push). Réessayez de créer un compte.')
      return
    } catch (e) {
      console.error(`\n⚠ Échec application automatique : ${e.message || e}\n`)
    }
  } else {
    console.log('ℹ DATABASE_URL / SUPABASE_DB_URL / SUPABASE_DB_PASSWORD absent — mode manuel.\n')
    console.log('Pour appliquer automatiquement, ajoutez dans .env :')
    console.log('  DATABASE_URL=postgresql://postgres:[MOT_DE_PASSE]@db.' + PROJECT_REF + '.supabase.co:5432/postgres')
    console.log('  (Supabase → Project Settings → Database → Connection string)\n')
  }

  printManualInstructions()
}

main().catch((e) => {
  console.error('❌', e.message || e)
  process.exit(1)
})
