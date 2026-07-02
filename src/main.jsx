import React from 'react'
import ReactDOM from 'react-dom/client'
import Root from './Root.jsx'
import { initCapacitor } from './lib/capacitorInit.js'
import { registerPWA, skipWaitingAndReload } from './lib/pwaRegister.js'
import { initMobileKeyboardInset } from './lib/authFormScroll.js'

async function prepareDevEnvironment() {
  if (!import.meta.env.DEV || !('serviceWorker' in navigator)) return
  const regs = await navigator.serviceWorker.getRegistrations()
  await Promise.all(regs.map((r) => r.unregister()))
  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k.startsWith('buildeasy-')).map((k) => caches.delete(k)))
  }
}

const activatePwaUpdate = registerPWA({
  onOfflineReady: () => {
    sessionStorage.setItem('be_pwa_ready', '1')
  },
  onNeedRefresh: () => {
    window.__BE_PWA_UPDATE__ = true
  },
})

window.__BE_DISMISS_BOOT__ = () => {
  const el = document.getElementById('be-boot')
  if (el) {
    el.classList.add('hide')
    setTimeout(() => el.remove(), 220)
  }
}

window.__BE_ACTIVATE_PWA__ = activatePwaUpdate
window.__BE_SKIP_WAITING__ = skipWaitingAndReload

initCapacitor()
  .then(prepareDevEnvironment)
  .finally(() => {
  initMobileKeyboardInset()
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>,
  )
  requestAnimationFrame(() => window.__BE_DISMISS_BOOT__?.())
})
