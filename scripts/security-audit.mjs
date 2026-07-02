#!/usr/bin/env node
/**
 * Audit sécurité BuildEasy — scans statiques + tests API anonymes.
 * Usage: npm run security:audit
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const findings = []

function isGitignored(relPath) {
  try {
    execSync(`git check-ignore -q ${JSON.stringify(relPath)}`, { cwd: root, stdio: 'pipe' })
    return true
  } catch {
    const gi = readFileSync(resolve(root, '.gitignore'), 'utf8')
    const base = relPath.split('/').pop()
    return gi.split('\n').some((line) => {
      const t = line.trim()
      return t && !t.startsWith('#') && (t === relPath || t === base || t === `/${relPath}`)
    })
  }
}

function isGitTracked(relPath) {
  try {
    const out = execSync(`git ls-files --error-unmatch ${JSON.stringify(relPath)}`, { cwd: root, stdio: 'pipe' })
    return Boolean(out?.length)
  } catch {
    return false
  }
}

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

function add(severity, title, detail, fix) {
  findings.push({ severity, title, detail, fix })
}

function scanDir(dir, patterns) {
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name)
    if (name.isDirectory()) scanDir(p, patterns)
    else if (/\.(js|mjs|css|html|json)$/.test(name.name)) {
      const text = readFileSync(p, 'utf8')
      for (const { re, label } of patterns) {
        if (re.test(text)) add('critical', `Secret détecté dans ${p.replace(root + '/', '')}`, label, 'Retirer du repo, rotation des clés')
      }
    }
  }
}

loadEnv()

// 1. Fichiers secrets locaux
for (const f of ['.stripe-setup.local.env', '.stripe-setup.env']) {
  const p = resolve(root, f)
  if (!existsSync(p)) continue
  const t = readFileSync(p, 'utf8')
  if (!/sk_(live|test)_/.test(t)) continue
  if (isGitTracked(f)) {
    add('critical', `${f} versionné dans git avec clé Stripe secrète`, 'Clé sk_* commitée', 'Rotation immédiate + git rm --cached + .gitignore')
  } else if (!isGitignored(f)) {
    add('high', `${f} contient sk_* et n'est pas gitignored`, 'Risque de commit accidentel', 'Ajouter au .gitignore')
  } else {
    console.log(`  ℹ ${f} : clé Stripe locale (gitignored — OK pour dev)`)
  }
}

if (!readFileSync(resolve(root, '.gitignore'), 'utf8').includes('.stripe-setup.local.env')) {
  add('high', '.stripe-setup.local.env absent du .gitignore', 'Risque de commit de secrets', 'Ajouter au .gitignore')
}

// 2. Bundle dist
const secretPatterns = [
  { re: /sk_(live|test)_[A-Za-z0-9]+/, label: 'Stripe secret key' },
  { re: /service_role/, label: 'service_role key reference' },
  { re: /admin123|chef123|employe123|client123/, label: 'Mot de passe démo dans le build' },
]
scanDir(resolve(root, 'dist'), secretPatterns)

// 3. Mode démo — alerte seulement si le build prod contiendrait les mots de passe
const demoMode = process.env.VITE_DEMO_MODE === 'true'
if (demoMode) {
  add('high', 'VITE_DEMO_MODE=true dans .env', 'Les builds incluront les mots de passe démo', 'Mettre VITE_DEMO_MODE=false (local + Vercel prod)')
} else {
  console.log('  ✓ VITE_DEMO_MODE=false (local)')
}

// 4. Headers vercel
const vercel = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'))
const allHeaders = (vercel.headers || []).flatMap((h) => h.headers || [])
const keys = new Set(allHeaders.map((h) => h.key))
if (!keys.has('Content-Security-Policy')) add('medium', 'CSP manquant', 'vercel.json', 'Ajouter Content-Security-Policy')
if (!keys.has('X-Frame-Options') && !allHeaders.some((h) => String(h.value).includes('frame-ancestors'))) {
  add('medium', 'Protection clickjacking manquante', 'vercel.json', 'X-Frame-Options: DENY')
}

// 5. Tests API anonymes Supabase
const url = process.env.VITE_SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY

async function anonGet(table, select = 'id') {
  const r = await fetch(`${url}/rest/v1/${table}?select=${select}&limit=1`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
  })
  return { status: r.status, body: await r.text() }
}

async function anonRpc(name, body = {}) {
  const r = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: r.status, body: await r.text() }
}

// 6. Scan code source (XSS / secrets)
function scanSource(dir) {
  const xssPatterns = [
    { re: /dangerouslySetInnerHTML/, label: 'dangerouslySetInnerHTML' },
    { re: /\.innerHTML\s*=/, label: 'innerHTML assignment' },
    { re: /\beval\s*\(/, label: 'eval()' },
  ]
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name)
    if (name.isDirectory() && name.name !== 'node_modules') scanSource(p)
    else if (/\.(jsx?|tsx?)$/.test(name.name)) {
      const text = readFileSync(p, 'utf8')
      for (const { re, label } of xssPatterns) {
        if (re.test(text)) add('medium', `XSS potentiel: ${label}`, p.replace(root + '/', ''), 'Éviter injection HTML')
      }
    }
  }
}
scanSource(resolve(root, 'src'))

if (url && anon) {
  for (const table of ['profiles', 'chantiers', 'clients', 'devis', 'messages', 'billing_subscriptions']) {
    try {
      const { status, body } = await anonGet(table)
      const leaked = status === 200 && body && body !== '[]' && !body.includes('error')
      if (leaked) {
        add('critical', `Fuite données anon: ${table}`, `HTTP ${status} — ${body.slice(0, 120)}`, 'Vérifier RLS + révoquer accès anon')
      } else if (status === 200 && body === '[]') {
        console.log(`  ✓ ${table} : anon → [] (OK)`)
      } else {
        console.log(`  ✓ ${table} : anon bloqué (${status})`)
      }
    } catch (e) {
      console.log(`  ⚠ ${table} : test réseau impossible (${e.message})`)
    }
  }

  // RPC referral sans auth
  try {
    const { status } = await anonRpc('ensure_org_referral_code', { p_org_id: '00000000-0000-0000-0000-000000000001' })
    if (status < 400) {
      add('critical', 'RPC ensure_org_referral_code accessible en anon', `HTTP ${status}`, 'Appliquer migration 20260622_security_lockdown.sql')
    } else {
      console.log(`  ✓ ensure_org_referral_code : bloqué (${status})`)
    }
  } catch { /* */ }

  // finish_signup sans auth
  try {
    const { status } = await anonRpc('finish_signup', { entreprise_nom: 'hack', nom_utilisateur: 'hack' })
    if (status < 400) {
      add('critical', 'RPC finish_signup accessible en anon', `HTTP ${status}`, 'Vérifier GRANT EXECUTE')
    } else {
      console.log(`  ✓ finish_signup : bloqué (${status})`)
    }
  } catch { /* */ }

  // Invitation preview (autorisé anon avec token — doit échouer sans token valide)
  try {
    const { status, body } = await anonRpc('get_invitation_preview', { p_token: 'invalid' })
    if (status < 400 && body.includes('"valid":true')) {
      add('high', 'get_invitation_preview accepte token invalide', body.slice(0, 80), 'Vérifier la fonction')
    } else {
      console.log(`  ✓ get_invitation_preview : token invalide rejeté (${status})`)
    }
  } catch { /* */ }
} else {
  add('low', 'Supabase non configuré localement', 'Tests API ignorés', 'Définir VITE_SUPABASE_URL dans .env')
}

// Rapport
const order = { critical: 0, high: 1, medium: 2, low: 3 }
findings.sort((a, b) => order[a.severity] - order[b.severity])

console.log('\n═══ Audit sécurité BuildEasy ═══\n')
if (!findings.length) {
  console.log('✅ Aucun problème critique détecté.\n')
} else {
  for (const f of findings) {
    const icon = { critical: '🔴', high: '🟠', medium: '🟡', low: '⚪' }[f.severity]
    console.log(`${icon} [${f.severity.toUpperCase()}] ${f.title}`)
    console.log(`   ${f.detail}`)
    console.log(`   → ${f.fix}\n`)
  }
  console.log(`Total : ${findings.length} finding(s)\n`)
  process.exit(findings.some((f) => f.severity === 'critical') ? 1 : 0)
}
