/**
 * Génère dist/sw.js avec la liste exacte des assets du build Vite.
 * Stratégie : shell app en cache-first (offline), assets hashés immuables, navigation → index.html.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const dist = join(root, 'dist')
const assetsDir = join(dist, 'assets')

if (!existsSync(dist)) {
  console.error('[sw] dist/ introuvable — lancez vite build d\'abord')
  process.exit(1)
}

function distPath(urlPath) {
  const rel = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath
  return join(dist, rel)
}

const assetFiles = existsSync(assetsDir) ? readdirSync(assetsDir) : []
const shellRoutes = ['/', '/index.html', '/app', '/manifest.json', '/icons.svg', '/icon.png']
const precacheCandidates = [
  ...shellRoutes,
  ...assetFiles.map((f) => `/assets/${f}`),
]

const precache = precacheCandidates.filter((p) => existsSync(distPath(p)))

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = `${pkg.version}-${Date.now()}`
const cacheName = `buildeasy-${version.replace(/\./g, '-')}`

const sw = `/* BuildEasy service worker — généré automatiquement */
const CACHE = ${JSON.stringify(cacheName)};
const PRECACHE = ${JSON.stringify(precache)};
const SHELL = new Set(${JSON.stringify(shellRoutes)});

async function precacheAll(cache) {
  await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
}

function isAsset(pathname) {
  return pathname.startsWith('/assets/');
}

function isShellNavigation(url, request) {
  if (request.mode !== 'navigate') return false;
  if (SHELL.has(url.pathname)) return true;
  if (url.pathname.startsWith('/app')) return true;
  return !url.pathname.includes('.');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then(precacheAll)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('buildeasy-') && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isAsset(url.pathname)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        try {
          const res = await fetch(request);
          if (res.ok) cache.put(request, res.clone());
          return res;
        } catch {
          return hit || new Response('', { status: 503, statusText: 'Offline' });
        }
      })
    );
    return;
  }

  if (isShellNavigation(url, request)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        try {
          const res = await fetch(request);
          if (res.ok) cache.put('/index.html', res.clone());
          return res;
        } catch {
          const cached = await cache.match('/index.html') || await cache.match('/');
          if (cached) return cached;
          return new Response(
            '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BuildEasy hors ligne</title></head><body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#eceef2;color:#152238;text-align:center;padding:24px"><div><h1 style="font-size:1.25rem">BuildEasy</h1><p>Ouvrez l\\'application une fois en ligne pour l\\'utiliser hors connexion.</p></div></body></html>',
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        }
      })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(request);
      if (hit) return hit;
      try {
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      } catch {
        return new Response('Hors ligne', { status: 503, statusText: 'Offline' });
      }
    })
  );
});
`

writeFileSync(join(dist, 'sw.js'), sw)
console.log(`[sw] dist/sw.js — ${precache.length} fichiers (${cacheName})`)
