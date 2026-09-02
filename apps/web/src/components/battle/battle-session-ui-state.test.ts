import { describe, expect, it } from 'vitest'

import {
  battleSessionUiStorageKey,
  readBattleSessionUiState,
  writeBattleSessionUiState,
  type BattleSessionUiStorage,
} from './battle-session-ui-state'

class MemoryStorage implements BattleSessionUiStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

describe('battle-scoped UI state persistence', () => {
  it('restores battle log and coordinate choices in the same battle', () => {
    const storage = new MemoryStorage()

    writeBattleSessionUiState(storage, 'battle-one', {
      battleLogOpen: true,
      coordinatesVisible: true,
    })

    expect(readBattleSessionUiState(storage, 'battle-one')).toEqual({
      battleLogOpen: true,
      coordinatesVisible: true,
    })
  })

  it('does not carry UI choices into a new battle session', () => {
    const storage = new MemoryStorage()

    writeBattleSessionUiState(storage, 'battle-one', {
      battleLogOpen: true,
      coordinatesVisible: true,
    })

    expect(readBattleSessionUiState(storage, 'battle-two')).toEqual({})
  })

  it('persists explicit off and closed choices after they were enabled', () => {
    const storage = new MemoryStorage()

    writeBattleSessionUiState(storage, 'battle-one', {
      battleLogOpen: false,
      coordinatesVisible: false,
    })

    expect(readBattleSessionUiState(storage, 'battle-one')).toEqual({
      battleLogOpen: false,
      coordinatesVisible: false,
    })
  })

  it('ignores malformed and non-boolean settings', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      battleSessionUiStorageKey('battle-one'),
      JSON.stringify({ version: 1, values: { battleLogOpen: 'yes', coordinatesVisible: true } }),
    )

    expect(readBattleSessionUiState(storage, 'battle-one')).toEqual({
      coordinatesVisible: true,
    })
  })
})
