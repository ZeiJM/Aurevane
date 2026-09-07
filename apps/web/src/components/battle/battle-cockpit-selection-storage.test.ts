import { describe, expect, it } from 'vitest'

import {
  battleCockpitSelectionStorageKey,
  readBattleCockpitSelections,
  writeBattleCockpitSelections,
  type BattleCockpitSelectionStorage,
} from './battle-cockpit-selection-storage'

class MemoryStorage implements BattleCockpitSelectionStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

describe('battle cockpit selection persistence', () => {
  it('restores Attack, Guard, and Heal selector choices for the same battle', () => {
    const storage = new MemoryStorage()

    writeBattleCockpitSelections(storage, '/game/battle/battle-one', {
      Attack: 'Cleave',
      Guard: 'Barrier',
      Heal: 'Mending Light',
    })

    expect(readBattleCockpitSelections(storage, '/game/battle/battle-one')).toEqual({
      Attack: 'Cleave',
      Guard: 'Barrier',
      Heal: 'Mending Light',
    })
  })

  it('does not carry cockpit choices into another battle', () => {
    const storage = new MemoryStorage()

    writeBattleCockpitSelections(storage, '/game/battle/battle-one', {
      Attack: 'Cleave',
    })

    expect(readBattleCockpitSelections(storage, '/game/battle/battle-two')).toEqual({})
  })

  it('ignores malformed persisted values safely', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      battleCockpitSelectionStorageKey('/game/battle/battle-one'),
      JSON.stringify({ version: 1, selections: { Attack: 42, Guard: 'Barrier' } }),
    )

    expect(readBattleCockpitSelections(storage, '/game/battle/battle-one')).toEqual({
      Guard: 'Barrier',
    })
  })
})
