/**
 * Enregistrement du service worker — permet le chargement de l'app sans réseau
 * après une première visite en ligne (ou installation PWA).
 */
const SW_URL = '/sw.js'

export function isPwaSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator
}

export function isRunningStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
}

export function registerPWA({ onOfflineReady, onNeedRefresh } = {}) {
  if (!isPwaSupported()) return () => {}
  // En dev, le SW sert un cache stale et masque les changements (routing, login, etc.)
  if (import.meta.env.DEV) return () => {}

  let refreshing = false

  const register = () => {
    navigator.serviceWorker
      .register(SW_URL, { scope: '/' })
      .then((reg) => {
        if (reg.active || reg.installing?.state === 'activated') {
          sessionStorage.setItem('be_pwa_ready', '1')
          onOfflineReady?.()
        }

        reg.addEventListener('updatefound', () => {
          const worker = reg.installing
          if (!worker) return
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                onNeedRefresh?.()
              } else {
                sessionStorage.setItem('be_pwa_ready', '1')
                onOfflineReady?.()
              }
            }
          })
        })
      })
      .catch(() => {
        /* preview local HTTP ou sw absent */
      })
  }

  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true
    window.location.reload()
  })

  return () => {
    navigator.serviceWorker.getRegistration(SW_URL).then((reg) => {
      reg?.waiting?.postMessage('SKIP_WAITING')
    })
  }
}

export function skipWaitingAndReload() {
  navigator.serviceWorker.getRegistration(SW_URL).then((reg) => {
    if (reg?.waiting) {
      reg.waiting.postMessage('SKIP_WAITING')
    } else {
      window.location.reload()
    }
  })
}
