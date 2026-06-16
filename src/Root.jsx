import { useCallback, useEffect, useState } from 'react'
import LandingPage from './LandingPage.jsx'
import App from './App.jsx'

function readAppAuthMode() {
  const params = new URLSearchParams(window.location.search)
  const m = params.get('mode')
  return m === 'signup' ? 'signup' : 'login'
}

function isAppPath(pathname) {
  return pathname === '/app' || pathname.startsWith('/app/')
}

export default function Root() {
  const [path, setPath] = useState(() => window.location.pathname)
  const [authMode, setAuthMode] = useState(readAppAuthMode)

  useEffect(() => {
    const onPop = () => {
      setPath(window.location.pathname)
      setAuthMode(readAppAuthMode())
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const enterApp = useCallback((mode = 'login') => {
    const q = mode === 'signup' ? '?mode=signup' : ''
    window.history.pushState({}, '', `/app${q}`)
    setPath('/app')
    setAuthMode(mode === 'signup' ? 'signup' : 'login')
    window.scrollTo(0, 0)
  }, [])

  const goLanding = useCallback(() => {
    window.history.pushState({}, '', '/')
    setPath('/')
    window.scrollTo(0, 0)
  }, [])

  if (isAppPath(path)) {
    return <App initialAuthMode={authMode} onBackToLanding={goLanding} />
  }

  return <LandingPage onEnterApp={enterApp} />
}
