/** Scroll le champ focus dans le formulaire auth (clavier mobile). */
export function scrollAuthFieldIntoView(el) {
  if (!el || typeof el.scrollIntoView !== 'function') return
  const run = () => {
    try {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    } catch {
      el.scrollIntoView(true)
    }
  }
  requestAnimationFrame(() => {
    run()
    setTimeout(run, 120)
    setTimeout(run, 320)
  })
}

export function bindAuthFormScroll(root) {
  if (!root || root.__beAuthScroll) return () => {}
  root.__beAuthScroll = true

  const onFocus = (e) => {
    const t = e.target
    if (t?.matches?.('input, textarea, select')) scrollAuthFieldIntoView(t)
  }

  root.addEventListener('focusin', onFocus)

  const onViewport = () => {
    const active = document.activeElement
    if (active?.matches?.('input, textarea, select') && root.contains(active)) {
      scrollAuthFieldIntoView(active)
    }
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onViewport)
    window.visualViewport.addEventListener('scroll', onViewport)
  }

  return () => {
    root.removeEventListener('focusin', onFocus)
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', onViewport)
      window.visualViewport.removeEventListener('scroll', onViewport)
    }
    delete root.__beAuthScroll
  }
}

/** Clavier virtuel navigateur mobile (Safari / Chrome). */
export function initMobileKeyboardInset() {
  if (typeof window === 'undefined' || !window.visualViewport) return () => {}

  const sync = () => {
    const vv = window.visualViewport
    const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
    document.documentElement.style.setProperty('--kb-height', `${Math.round(inset)}px`)
    document.documentElement.classList.toggle('kb-open', inset > 72)
  }

  window.visualViewport.addEventListener('resize', sync)
  window.visualViewport.addEventListener('scroll', sync)
  sync()

  return () => {
    window.visualViewport.removeEventListener('resize', sync)
    window.visualViewport.removeEventListener('scroll', sync)
    document.documentElement.style.setProperty('--kb-height', '0px')
    document.documentElement.classList.remove('kb-open')
  }
}
