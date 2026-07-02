import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Keyboard } from '@capacitor/keyboard'

export const isNative = Capacitor.isNativePlatform()

function setKeyboardInset(px) {
  const v = `${Math.max(0, Math.round(px))}px`
  document.documentElement.style.setProperty('--kb-height', v)
}

export async function initCapacitor() {
  if (!isNative) return

  document.documentElement.classList.add('cap-native')

  try {
    await StatusBar.setStyle({ style: Style.Light })
    await StatusBar.setBackgroundColor({ color: '#152238' })
  } catch { /* web / simulator */ }

  try {
    await SplashScreen.hide({ fadeOutDuration: 300 })
  } catch { /* */ }

  try {
    await Keyboard.setAccessoryBarVisible({ isVisible: true })
    Keyboard.addListener('keyboardWillShow', (info) => {
      setKeyboardInset(info?.keyboardHeight ?? 280)
      document.documentElement.classList.add('kb-open')
    })
    Keyboard.addListener('keyboardDidShow', (info) => {
      setKeyboardInset(info?.keyboardHeight ?? 280)
      document.documentElement.classList.add('kb-open')
    })
    Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardInset(0)
      document.documentElement.classList.remove('kb-open')
    })
    Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardInset(0)
      document.documentElement.classList.remove('kb-open')
    })
  } catch { /* */ }

  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back()
    else App.minimizeApp()
  })
}
