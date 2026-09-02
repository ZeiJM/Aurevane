'use client'

import {
  useCallback,
  useMemo,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from 'react'

const STORAGE_KEY_PREFIX = 'aurevane:battle-ui-state:v1:'
const EMPTY_SNAPSHOT = ''

export type BattleSessionUiStorage = Pick<Storage, 'getItem' | 'setItem'>
export type BattleSessionUiState = Readonly<Record<string, boolean>>

type PersistedBattleSessionUiState = {
  version: 1
  values: Record<string, boolean>
}

type BattleSessionUiListener = () => void

const listenersByBattle = new Map<string, Set<BattleSessionUiListener>>()
const memorySnapshots = new Map<string, string>()

export function battleSessionUiStorageKey(battleSessionId: string): string {
  return `${STORAGE_KEY_PREFIX}${encodeURIComponent(battleSessionId)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseBattleSessionUiState(raw: string | null): BattleSessionUiState {
  if (!raw) return {}

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.values)) return {}

    const values: Record<string, boolean> = {}
    for (const [key, value] of Object.entries(parsed.values)) {
      if (key.length > 0 && key.length <= 80 && typeof value === 'boolean') values[key] = value
    }
    return values
  } catch {
    return {}
  }
}

function serializeBattleSessionUiState(state: BattleSessionUiState): string {
  const payload: PersistedBattleSessionUiState = {
    version: 1,
    values: { ...state },
  }
  return JSON.stringify(payload)
}

export function readBattleSessionUiState(
  storage: BattleSessionUiStorage,
  battleSessionId: string,
): BattleSessionUiState {
  try {
    return parseBattleSessionUiState(storage.getItem(battleSessionUiStorageKey(battleSessionId)))
  } catch {
    return {}
  }
}

export function writeBattleSessionUiState(
  storage: BattleSessionUiStorage,
  battleSessionId: string,
  state: BattleSessionUiState,
): void {
  try {
    storage.setItem(
      battleSessionUiStorageKey(battleSessionId),
      serializeBattleSessionUiState(state),
    )
  } catch {
    // The browser-facing hook keeps an in-memory snapshot if session storage is unavailable.
  }
}

function getSnapshot(battleSessionId: string): string {
  try {
    const stored = window.sessionStorage.getItem(battleSessionUiStorageKey(battleSessionId))
    if (stored !== null) {
      memorySnapshots.set(battleSessionId, stored)
      return stored
    }
  } catch {
    // Fall through to the in-memory snapshot.
  }
  return memorySnapshots.get(battleSessionId) ?? EMPTY_SNAPSHOT
}

function subscribe(battleSessionId: string, listener: BattleSessionUiListener): () => void {
  const listeners = listenersByBattle.get(battleSessionId) ?? new Set()
  listeners.add(listener)
  listenersByBattle.set(battleSessionId, listeners)

  const storageKey = battleSessionUiStorageKey(battleSessionId)
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey) listener()
  }
  window.addEventListener('storage', onStorage)

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) listenersByBattle.delete(battleSessionId)
    window.removeEventListener('storage', onStorage)
  }
}

function notify(battleSessionId: string): void {
  listenersByBattle.get(battleSessionId)?.forEach((listener) => listener())
}

function persistSnapshot(battleSessionId: string, state: BattleSessionUiState): void {
  const snapshot = serializeBattleSessionUiState(state)
  memorySnapshots.set(battleSessionId, snapshot)
  try {
    window.sessionStorage.setItem(battleSessionUiStorageKey(battleSessionId), snapshot)
  } catch {
    // The memory snapshot keeps the UI responsive for the remainder of this page session.
  }
  notify(battleSessionId)
}

function getServerSnapshot(): string {
  return EMPTY_SNAPSHOT
}

export function useBattleSessionUiBoolean(
  battleSessionId: string,
  key: string,
  defaultValue = false,
): readonly [boolean, Dispatch<SetStateAction<boolean>>] {
  const subscribeToBattle = useCallback(
    (listener: BattleSessionUiListener) => subscribe(battleSessionId, listener),
    [battleSessionId],
  )
  const getBattleSnapshot = useCallback(() => getSnapshot(battleSessionId), [battleSessionId])
  const snapshot = useSyncExternalStore(subscribeToBattle, getBattleSnapshot, getServerSnapshot)
  const state = useMemo(() => parseBattleSessionUiState(snapshot), [snapshot])
  const value = state[key] ?? defaultValue

  const setValue = useCallback<Dispatch<SetStateAction<boolean>>>(
    (nextValue) => {
      const currentState = parseBattleSessionUiState(getSnapshot(battleSessionId))
      const currentValue = currentState[key] ?? defaultValue
      const resolvedValue = typeof nextValue === 'function' ? nextValue(currentValue) : nextValue
      persistSnapshot(battleSessionId, { ...currentState, [key]: resolvedValue })
    },
    [battleSessionId, defaultValue, key],
  )

  return [value, setValue] as const
}
