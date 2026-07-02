#!/usr/bin/env node
/**
 * Déploiement Vercel production.
 * Par défaut : build sur les serveurs Vercel (fiable pour Vite).
 * Option --prebuilt : vercel build + deploy (artefact local).
 */
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const usePrebuilt = process.argv.includes('--prebuilt')

function vercelBin() {
  try {
    execSync('command -v vercel', { stdio: 'pipe' })
    return 'vercel'
  } catch {
    return 'npx vercel'
  }
}

/** En local, le CLI lit auth.json (vercel login). VERCEL_TOKEN n'est injecté que s'il est déjà dans l'env (CI). */
function vercelEnv() {
  const env = { ...process.env }
  if (!process.env.VERCEL_TOKEN) delete env.VERCEL_TOKEN
  return env
}

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'inherit', cwd: root, env: vercelEnv() })
  } catch (err) {
    console.error('\n❌ Déploiement Vercel échoué.')
    if (process.env.VERCEL_TOKEN) {
      console.error('   VERCEL_TOKEN invalide ou expiré → régénérez-le sur vercel.com/account/tokens')
    } else {
      console.error('   Reconnectez le CLI : vercel login')
    }
    throw err
  }
}

const vc = vercelBin()

if (usePrebuilt) {
  console.log('→ Build local (Vite)…')
  run('npm run build')
  if (!existsSync(resolve(root, 'dist/index.html'))) {
    console.error('❌ dist/index.html introuvable')
    process.exit(1)
  }
  console.log('\n→ vercel build (artefact .vercel/output)…')
  try {
    run(`${vc} build --prod`)
    console.log('\n→ Déploiement --prebuilt…')
    run(`${vc} deploy --prebuilt --prod --yes`)
  } catch {
    console.log('\n⚠ --prebuilt impossible, build distant…')
    run(`${vc} deploy --prod --yes`)
  }
} else {
  console.log('→ Déploiement Vercel (build distant, recommandé)…')
  run(`${vc} deploy --prod --yes`)
}

console.log('\n✅ Déployé.')
console.log('   https://buildeasy.vercel.app/')
console.log('   https://buildeasy.vercel.app/app')
