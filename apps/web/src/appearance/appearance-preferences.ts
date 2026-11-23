const STORAGE_KEY = 'aurevane:classic-portrait-tokens'
const CHANGE_EVENT = 'aurevane:appearance-display-changed'

export function readClassicPortraitTokens() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function setClassicPortraitTokens(classic: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(classic))
    window.dispatchEvent(new Event(CHANGE_EVENT))
  } catch {
    // Storage may be unavailable in a private browser context.
  }
}

export function subscribeClassicPortraitTokens(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener()
  }
  window.addEventListener(CHANGE_EVENT, listener)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener)
    window.removeEventListener('storage', onStorage)
  }
}
