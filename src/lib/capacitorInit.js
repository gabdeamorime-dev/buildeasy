import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Keyboard } from '@capacitor/keyboard'

export const isNative = Capacitor.isNativePlatform()

export async function initCapacitor() {
  if (!isNative) return

  document.documentElement.classList.add('cap-native')

  try {
    await StatusBar.setStyle({ style: Style.Light })
    await StatusBar.setBackgroundColor({ color: '#2563EB' })
  } catch { /* web / simulator */ }

  try {
    await SplashScreen.hide({ fadeOutDuration: 300 })
  } catch { /* */ }

  try {
    Keyboard.setAccessoryBarVisible({ isVisible: true })
    Keyboard.addListener('keyboardWillShow', () => {
      document.documentElement.classList.add('kb-open')
    })
    Keyboard.addListener('keyboardWillHide', () => {
      document.documentElement.classList.remove('kb-open')
    })
  } catch { /* */ }

  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back()
    else App.minimizeApp()
  })
}
