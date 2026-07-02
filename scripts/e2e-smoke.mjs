#!/usr/bin/env node
/**
 * E2E smoke — build, preview sur :5195, Playwright Python.
 * Usage: npm run test:e2e
 */
import { spawn, execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 5195
const BASE = `http://127.0.0.1:${PORT}`

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: 'inherit', cwd: root, ...opts })
}

async function waitForServer(maxMs = 45000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    try {
      const r = await fetch(`${BASE}/`)
      if (r.ok) return
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(`Serveur preview inaccessible sur ${BASE}`)
}

async function main() {
  try {
    execSync('python3 -c "import playwright"', { stdio: 'pipe' })
  } catch {
    console.log('→ Installation Playwright Python…')
    run('python3 -m pip install playwright --user')
  }

  console.log('→ Installation navigateur Chromium…')
  run('python3 -m playwright install chromium')

  console.log(`→ Dev server sur :${PORT} (comptes démo actifs)…`)
  const dev = spawn('npx', ['vite', '--port', String(PORT), '--host', '127.0.0.1'], {
    cwd: root,
    stdio: 'ignore',
    detached: true,
  })
  dev.unref()

  const killDev = () => {
    try { process.kill(-dev.pid, 'SIGTERM') } catch { /* */ }
    try { dev.kill('SIGTERM') } catch { /* */ }
  }
  process.on('exit', killDev)
  process.on('SIGINT', () => { killDev(); process.exit(130) })

  await waitForServer()
  console.log('→ Tests E2E…\n')
  run(`BASE_URL=${BASE} python3 scripts/e2e-smoke.py`, { env: { ...process.env, BASE_URL: BASE } })
  killDev()
  console.log('\n✅ E2E terminé')
}

main().catch((e) => {
  console.error('\n❌ E2E échoué:', e.message)
  process.exit(1)
})
