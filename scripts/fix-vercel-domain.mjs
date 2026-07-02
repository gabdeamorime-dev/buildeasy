#!/usr/bin/env node
/**
 * Corrige buildeasy.vercel.app → projet Vite buildeasy (prj_OQEYJFsqiYuPQf9nBz56csbBKHy3)
 * Usage: node scripts/fix-vercel-domain.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TARGET_PROJECT_ID = 'prj_OQEYJFsqiYuPQf9nBz56csbBKHy3'
const DOMAIN = 'buildeasy.vercel.app'

function getToken() {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN
  const p = resolve(homedir(), 'Library/Application Support/com.vercel.cli/auth.json')
  if (!existsSync(p)) throw new Error('Token Vercel absent — lancez: vercel login')
  return JSON.parse(readFileSync(p, 'utf8')).token
}

async function api(path, { method = 'GET', body } = {}) {
  const token = getToken()
  const r = await fetch(`https://api.vercel.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await r.text()
  let json = {}
  try { json = text ? JSON.parse(text) : {} } catch { json = { raw: text } }
  if (!r.ok) {
    throw new Error(`${method} ${path} → ${r.status}: ${json.error?.message || json.message || text.slice(0, 300)}`)
  }
  return json
}

async function findDomainOwner() {
  const { projects } = await api('/v9/projects?limit=50')
  for (const p of projects || []) {
    try {
      const d = await api(`/v9/projects/${p.id}/domains`)
      const names = (d.domains || []).map((x) => x.name)
      if (names.includes(DOMAIN)) return { project: p, domains: names }
    } catch { /* skip */ }
  }
  return null
}

async function main() {
  console.log(`=== Fix domaine ${DOMAIN} ===\n`)

  const owner = await findDomainOwner()
  if (owner) {
    console.log(`Domaine actuellement sur: ${owner.project.name} (${owner.project.id})`)
    console.log(`  Framework dashboard: ${owner.project.framework || '—'}`)
    if (owner.project.id !== TARGET_PROJECT_ID) {
      console.log(`→ Retrait du mauvais projet…`)
      await api(`/v9/projects/${owner.project.id}/domains/${DOMAIN}`, { method: 'DELETE' })
      console.log('  ✓ Domaine retiré')
    } else {
      console.log('  ✓ Domaine déjà sur le bon projet')
    }
  } else {
    console.log('Domaine non rattaché à un projet (ou API limitée)')
  }

  console.log('\n→ Config projet Vite cible…')
  await api(`/v9/projects/${TARGET_PROJECT_ID}`, {
    method: 'PATCH',
    body: {
      framework: 'vite',
      buildCommand: 'npm run build',
      outputDirectory: 'dist',
      installCommand: 'npm install',
    },
  })
  console.log('  ✓ Framework = Vite, output = dist')

  console.log('\n→ Rattachement domaine au projet buildeasy…')
  try {
    await api(`/v10/projects/${TARGET_PROJECT_ID}/domains`, {
      method: 'POST',
      body: { name: DOMAIN },
    })
    console.log('  ✓ Domaine ajouté')
  } catch (e) {
    if (String(e.message).includes('already') || String(e.message).includes('409')) {
      console.log('  ✓ Domaine déjà présent')
    } else {
      throw e
    }
  }

  console.log('\n→ Déploiement production (build sur Vercel)…')
  const env = { ...process.env, VERCEL_TOKEN: getToken() }
  try {
    execSync('npx vercel deploy --prod --yes', { stdio: 'inherit', cwd: root, env })
  } catch (e) {
    console.log('\n⚠ deploy direct échoué, tentative locale…')
    execSync('npm run build', { stdio: 'inherit', cwd: root, env })
    execSync('npx vercel build --prod', { stdio: 'inherit', cwd: root, env })
    execSync('npx vercel deploy --prebuilt --prod --yes', { stdio: 'inherit', cwd: root, env })
  }

  console.log('\n→ Vérification HTTP…')
  await new Promise((r) => setTimeout(r, 5000))
  for (const url of [`https://${DOMAIN}/`, `https://${DOMAIN}/app`]) {
    const res = await fetch(url, { redirect: 'follow' })
    const snippet = res.ok ? 'OK' : (await res.text()).slice(0, 80).replace(/\s+/g, ' ')
    console.log(`  ${url} → HTTP ${res.status} ${snippet}`)
  }

  console.log('\n✅ Terminé. Ouvrez https://buildeasy.vercel.app/app')
}

main().catch((e) => {
  console.error('\n❌', e.message)
  process.exit(1)
})
