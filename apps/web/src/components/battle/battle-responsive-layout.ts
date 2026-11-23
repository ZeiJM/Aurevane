'use client'

import { useCallback, useSyncExternalStore } from 'react'

export const BATTLE_MOBILE_LAYOUT_QUERY =
  '(max-width: 820px), (max-width: 980px) and (max-height: 500px) and (pointer: coarse)'

function subscribe(listener: () => void): () => void {
  const media = window.matchMedia(BATTLE_MOBILE_LAYOUT_QUERY)
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}

function getSnapshot(): boolean {
  return !window.matchMedia(BATTLE_MOBILE_LAYOUT_QUERY).matches
}

function getServerSnapshot(): boolean {
  return false
}

export function useDesktopBattleLayout(): boolean {
  const subscribeToLayout = useCallback((listener: () => void) => subscribe(listener), [])
  return useSyncExternalStore(subscribeToLayout, getSnapshot, getServerSnapshot)
}
