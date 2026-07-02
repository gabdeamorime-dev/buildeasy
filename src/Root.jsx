import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useState } from 'react'
import LandingPage from './LandingPage.jsx'
import LegalPage from './LegalPage.jsx'
import { isNative } from './lib/capacitorInit.js'
import { isRunningStandalone } from './lib/pwaRegister.js'

const App = lazy(() => import('./App.jsx'))
import { persistReferralCode } from './lib/auth.js'
import { persistInviteToken } from './lib/team.js'

const REF_KEY = 'be_ref'

/** App installée (Capacitor / PWA) : pas de page marketing, login direct. */
function isInstalledApp() {
  return isNative || isRunningStandalone()
}

function normalizePath(pathname) {
  if (pathname === '/index.html') return '/'
  return pathname
}

function readInitialPath() {
  const pathname = normalizePath(window.location.pathname)
  if (isInstalledApp() && pathname === '/') return '/app'
  return pathname
}

function readAppAuthMode() {
  const params = new URLSearchParams(window.location.search)
  const m = params.get('mode')
  return m === 'signup' ? 'signup' : 'login'
}

function readInviteToken(pathname, search) {
  if (pathname === '/app/join' || pathname.startsWith('/app/join/')) {
    return new URLSearchParams(search).get('token') || ''
  }
  return ''
}

function isAppPath(pathname) {
  return pathname === '/app' || pathname.startsWith('/app/')
}

function readLegalKind(pathname) {
  if (pathname === '/privacy') return 'privacy'
  if (pathname === '/support') return 'support'
  return null
}

function captureReferralFromUrl() {
  const ref = new URLSearchParams(window.location.search).get('ref')
  if (ref) persistReferralCode(ref)
}

export default function Root() {
  const [path, setPath] = useState(readInitialPath)
  const [search, setSearch] = useState(() => window.location.search)
  const [authMode, setAuthMode] = useState(readAppAuthMode)
  const [inviteToken, setInviteToken] = useState(() => readInviteToken(readInitialPath(), window.location.search))

  useEffect(() => {
    if (!isInstalledApp()) return
    const urlPath = normalizePath(window.location.pathname)
    if (urlPath === '/' && !readLegalKind(urlPath)) {
      window.history.replaceState({}, '', `/app${window.location.search}`)
      setPath('/app')
      setAuthMode('login')
    }
  }, [])

  useLayoutEffect(() => {
    const inApp = isAppPath(path)
    document.documentElement.classList.toggle('be-app-view', inApp)
    document.documentElement.classList.toggle('be-landing-view', !inApp)
  }, [path])

  useEffect(() => {
    captureReferralFromUrl()
    const token = readInviteToken(window.location.pathname, window.location.search)
    if (token) persistInviteToken(token)
  }, [])

  useEffect(() => {
    const onPop = () => {
      setPath(window.location.pathname)
      setSearch(window.location.search)
      setAuthMode(readAppAuthMode())
      setInviteToken(readInviteToken(window.location.pathname, window.location.search))
      captureReferralFromUrl()
      const token = readInviteToken(window.location.pathname, window.location.search)
      if (token) persistInviteToken(token)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const enterApp = useCallback((mode = 'login') => {
    sessionStorage.setItem('be_force_auth', '1')
    const ref = sessionStorage.getItem(REF_KEY)
    const params = new URLSearchParams()
    if (mode === 'signup') params.set('mode', 'signup')
    else params.set('mode', 'login')
    if (ref) params.set('ref', ref)
    const q = params.toString()
    window.history.pushState({}, '', `/app${q ? `?${q}` : ''}`)
    setPath('/app')
    setSearch(q ? `?${q}` : '')
    setAuthMode(mode === 'signup' ? 'signup' : 'login')
    setInviteToken('')
    window.scrollTo(0, 0)
  }, [])

  const goLanding = useCallback(() => {
    if (isInstalledApp()) {
      window.history.replaceState({}, '', '/app')
      setPath('/app')
      setSearch('')
      setInviteToken('')
      setAuthMode('login')
      window.scrollTo(0, 0)
      return
    }
    window.history.pushState({}, '', '/')
    setPath('/')
    setSearch('')
    setInviteToken('')
    window.scrollTo(0, 0)
  }, [])

  if (isAppPath(path)) {
    return (
      <Suspense
        fallback={(
          <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#eceef2', color: '#152238', fontFamily: 'system-ui, sans-serif', fontSize: 14 }}>
            Chargement…
          </div>
        )}
      >
        <App
          key={`${authMode}-${inviteToken || 'main'}`}
          initialAuthMode={authMode}
          inviteToken={inviteToken}
          onBackToLanding={isInstalledApp() ? undefined : goLanding}
        />
      </Suspense>
    )
  }

  const legalKind = readLegalKind(path)
  if (legalKind) {
    return <LegalPage kind={legalKind} onBack={goLanding} />
  }

  return <LandingPage onEnterApp={enterApp} />
}
