'use client'

import { useCallback, useSyncExternalStore } from 'react'

const DESKTOP_BATTLE_QUERY = '(min-width: 821px)'

function subscribe(listener: () => void): () => void {
  const media = window.matchMedia(DESKTOP_BATTLE_QUERY)
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}

function getSnapshot(): boolean {
  return window.matchMedia(DESKTOP_BATTLE_QUERY).matches
}

function getServerSnapshot(): boolean {
  return false
}

export function useDesktopBattleLayout(): boolean {
  const subscribeToLayout = useCallback((listener: () => void) => subscribe(listener), [])
  return useSyncExternalStore(subscribeToLayout, getSnapshot, getServerSnapshot)
}
