'use client'

const STORAGE_KEY_PREFIX = 'aurevane:battle-cockpit-selections:v1:'

export type BattleCockpitSelectionStorage = Pick<Storage, 'getItem' | 'setItem'>
export type BattleCockpitSelections = Readonly<Record<string, string>>

type PersistedBattleCockpitSelections = {
  version: 1
  selections: Record<string, string>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function battleCockpitSelectionStorageKey(battleScope: string): string {
  return `${STORAGE_KEY_PREFIX}${encodeURIComponent(battleScope)}`
}

export function readBattleCockpitSelections(
  storage: BattleCockpitSelectionStorage,
  battleScope: string,
): BattleCockpitSelections {
  try {
    const raw = storage.getItem(battleCockpitSelectionStorageKey(battleScope))
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.selections)) return {}

    const selections: Record<string, string> = {}
    for (const [category, skillLabel] of Object.entries(parsed.selections)) {
      if (
        category.length > 0 &&
        category.length <= 80 &&
        typeof skillLabel === 'string' &&
        skillLabel.length > 0 &&
        skillLabel.length <= 160
      ) {
        selections[category] = skillLabel
      }
    }
    return selections
  } catch {
    return {}
  }
}

export function writeBattleCockpitSelections(
  storage: BattleCockpitSelectionStorage,
  battleScope: string,
  selections: BattleCockpitSelections,
): void {
  const payload: PersistedBattleCockpitSelections = {
    version: 1,
    selections: { ...selections },
  }

  try {
    storage.setItem(battleCockpitSelectionStorageKey(battleScope), JSON.stringify(payload))
  } catch {
    // Battle interaction remains usable even when browser session storage is unavailable.
  }
}
