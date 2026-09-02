'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'

const STORAGE_KEY_PREFIX = 'aurevane:battle-skill-selections:v1:'

export type BattleSkillSelectionStorage = Pick<Storage, 'getItem' | 'setItem'>

export type BattleSkillCategoryDefinition = {
  defaultSkillId: string
  skillIds: readonly string[]
}

export type BattleSkillCategoryDefinitions = Readonly<Record<string, BattleSkillCategoryDefinition>>

export type BattleSkillSelections = Readonly<Record<string, string>>

type BattleSkillSelectionListener = () => void

const selectionListeners = new Map<string, Set<BattleSkillSelectionListener>>()

type PersistedBattleSkillSelections = {
  version: 1
  selections: Record<string, string>
}

export function battleSkillSelectionsStorageKey(battleSessionId: string): string {
  return `${STORAGE_KEY_PREFIX}${encodeURIComponent(battleSessionId)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanSelections(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {}

  const selections: Record<string, string> = {}
  for (const [category, skillId] of Object.entries(value)) {
    if (
      category.length > 0 &&
      category.length <= 80 &&
      typeof skillId === 'string' &&
      skillId.length > 0
    ) {
      selections[category] = skillId
    }
  }
  return selections
}

function parseBattleSkillSelections(raw: string | null): BattleSkillSelections {
  if (!raw) return {}

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== 1) return {}
    return cleanSelections(parsed.selections)
  } catch {
    return {}
  }
}

export function readBattleSkillSelections(
  storage: BattleSkillSelectionStorage,
  battleSessionId: string,
): BattleSkillSelections {
  try {
    return parseBattleSkillSelections(
      storage.getItem(battleSkillSelectionsStorageKey(battleSessionId)),
    )
  } catch {
    return {}
  }
}

export function writeBattleSkillSelections(
  storage: BattleSkillSelectionStorage,
  battleSessionId: string,
  selections: BattleSkillSelections,
): void {
  const payload: PersistedBattleSkillSelections = {
    version: 1,
    selections: { ...selections },
  }

  try {
    storage.setItem(battleSkillSelectionsStorageKey(battleSessionId), JSON.stringify(payload))
  } catch {
    // Storage can be unavailable or full. The caller keeps the current selection in memory.
  }
}

function notifyBattleSkillSelectionListeners(battleSessionId: string): void {
  selectionListeners.get(battleSessionId)?.forEach((listener) => listener())
}

function subscribeToBattleSkillSelections(
  battleSessionId: string,
  listener: BattleSkillSelectionListener,
): () => void {
  const listeners = selectionListeners.get(battleSessionId) ?? new Set()
  listeners.add(listener)
  selectionListeners.set(battleSessionId, listeners)

  const storageKey = battleSkillSelectionsStorageKey(battleSessionId)
  const onStorage = (event: StorageEvent) => {
    if (event.storageArea === window.sessionStorage && event.key === storageKey) listener()
  }
  window.addEventListener('storage', onStorage)

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) selectionListeners.delete(battleSessionId)
    window.removeEventListener('storage', onStorage)
  }
}

function getBattleSkillSelectionsSnapshot(battleSessionId: string): string {
  try {
    return window.sessionStorage.getItem(battleSkillSelectionsStorageKey(battleSessionId)) ?? ''
  } catch {
    return ''
  }
}

export function resolveBattleSkillSelections(
  persisted: BattleSkillSelections,
  definitions: BattleSkillCategoryDefinitions,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(definitions).map(([category, definition]) => {
      const persistedSkillId = persisted[category]
      const selectedSkillId =
        typeof persistedSkillId === 'string' && definition.skillIds.includes(persistedSkillId)
          ? persistedSkillId
          : definition.defaultSkillId
      return [category, selectedSkillId]
    }),
  )
}

export function useBattleSkillSelections(
  battleSessionId: string,
  definitions: BattleSkillCategoryDefinitions,
): {
  selectedSkillId: (category: string) => string
  selectSkill: (category: string, skillId: string) => void
} {
  const subscribe = useCallback(
    (listener: BattleSkillSelectionListener) =>
      subscribeToBattleSkillSelections(battleSessionId, listener),
    [battleSessionId],
  )
  const getSnapshot = useCallback(
    () => getBattleSkillSelectionsSnapshot(battleSessionId),
    [battleSessionId],
  )
  const persistedSnapshot = useSyncExternalStore(subscribe, getSnapshot, () => '')
  const persisted = useMemo(
    () => parseBattleSkillSelections(persistedSnapshot),
    [persistedSnapshot],
  )

  const resolvedSelections = useMemo(
    () => resolveBattleSkillSelections(persisted, definitions),
    [definitions, persisted],
  )

  const selectedSkillId = useCallback(
    (category: string): string => {
      const definition = definitions[category]
      return resolvedSelections[category] ?? definition?.defaultSkillId ?? ''
    },
    [definitions, resolvedSelections],
  )

  const selectSkill = useCallback(
    (category: string, skillId: string): void => {
      const definition = definitions[category]
      if (!definition || !definition.skillIds.includes(skillId)) return

      const nextPersisted = { ...persisted, [category]: skillId }
      writeBattleSkillSelections(window.sessionStorage, battleSessionId, nextPersisted)
      notifyBattleSkillSelectionListeners(battleSessionId)
    },
    [battleSessionId, definitions, persisted],
  )

  return { selectedSkillId, selectSkill }
}
