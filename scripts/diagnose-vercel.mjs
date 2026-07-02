#!/usr/bin/env node
/** Diagnostic rapide prod Vercel — npm run diagnose:vercel */
import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PROJECT_ID = 'prj_OQEYJFsqiYuPQf9nBz56csbBKHy3'

function getToken() {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN
  const p = resolve(homedir(), 'Library/Application Support/com.vercel.cli/auth.json')
  if (!existsSync(p)) return null
  return JSON.parse(readFileSync(p, 'utf8')).token
}

async function main() {
  console.log('=== Diagnostic buildeasy.vercel.app ===\n')

  for (const url of ['https://buildeasy.vercel.app/', 'https://buildeasy.vercel.app/app']) {
    try {
      const r = await fetch(url, { redirect: 'follow' })
      const ct = r.headers.get('content-type') || ''
      console.log(`${url}`)
      console.log(`  HTTP ${r.status} | ${ct.split(';')[0]}`)
      if (r.status >= 500) {
        const body = (await r.text()).slice(0, 200)
        console.log(`  Body: ${body.replace(/\s+/g, ' ')}`)
      }
    } catch (e) {
      console.log(`${url} → ${e.message}`)
    }
  }

  const token = getToken()
  if (!token) {
    console.log('\n⚠ Token Vercel absent — vercel login')
    return
  }

  try {
    const r = await fetch(`https://api.vercel.com/v6/deployments?projectId=${PROJECT_ID}&limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const d = await r.json()
    const dep = d.deployments?.[0]
    if (dep) {
      console.log('\nDernier déploiement Vercel :')
      console.log(`  URL      : ${dep.url}`)
      console.log(`  État     : ${dep.readyState || dep.state}`)
      console.log(`  Cible    : ${dep.target}`)
      console.log(`  Framework: ${dep.meta?.framework || dep.creator?.username || '—'}`)
    }
  } catch (e) {
    console.log('\nAPI Vercel :', e.message)
  }

  console.log('\nChecklist dashboard :')
  console.log('  Framework Preset = Vite (PAS Next.js)')
  console.log('  Output Directory = dist')
  console.log('  Build Command    = npm run build')
  console.log('  Install Command  = npm install')
}

main()
