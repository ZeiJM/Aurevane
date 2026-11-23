'use client'
import { useCallback, useSyncExternalStore } from 'react'
import type { BattleItemPresentation } from '@/lib/battle/battle-item-presentation'
const listeners = new Map<string, Set<() => void>>()
const memory = new Map<string, string>()
function storageKey(battleId: string, actorId: string | null) {
  return `aurevane:selected-battle-item:v1:${encodeURIComponent(battleId)}:${encodeURIComponent(actorId ?? '')}`
}
function snapshot(key: string): string {
  try {
    return memory.get(key) ?? window.sessionStorage.getItem(key) ?? ''
  } catch {
    return memory.get(key) ?? ''
  }
}
function serverSnapshot() {
  return ''
}
/** A reading/selection preference; it never submits an action or changes inventory. */
export function useSelectedBattleItem(
  battleId: string,
  actorId: string | null,
  items: readonly BattleItemPresentation[],
) {
  const key = storageKey(battleId, actorId)
  const subscribe = useCallback(
    (listener: () => void) => {
      const group = listeners.get(key) ?? new Set<() => void>()
      group.add(listener)
      listeners.set(key, group)
      return () => {
        group.delete(listener)
        if (!group.size) listeners.delete(key)
      }
    },
    [key],
  )
  const getSnapshot = useCallback(() => snapshot(key), [key])
  const selectedId = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot)
  const remember = useCallback(
    (actionId: string) => {
      memory.set(key, actionId)
      try {
        window.sessionStorage.setItem(key, actionId)
      } catch {
        /* Keep the preference in memory if browser storage is unavailable. */
      }
      listeners.get(key)?.forEach((listener) => listener())
    },
    [key],
  )
  return [items.find((item) => item.actionId === selectedId) ?? items[0] ?? null, remember] as const
}
