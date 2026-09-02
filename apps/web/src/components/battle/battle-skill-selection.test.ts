import { describe, expect, it } from 'vitest'

import {
  battleSkillSelectionsStorageKey,
  readBattleSkillSelections,
  resolveBattleSkillSelections,
  writeBattleSkillSelections,
  type BattleSkillSelectionStorage,
} from './battle-skill-selection'

class MemoryStorage implements BattleSkillSelectionStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

const definitions = {
  attack: {
    defaultSkillId: 'basic-attack',
    skillIds: ['basic-attack', 'heavy-attack'],
  },
  heal: {
    defaultSkillId: 'hp-recovery',
    skillIds: ['hp-recovery', 'mp-recovery'],
  },
} as const

describe('battle skill selection persistence', () => {
  it('stores and restores every category under the current battle session', () => {
    const storage = new MemoryStorage()
    const battleSessionId = 'battle/one'

    writeBattleSkillSelections(storage, battleSessionId, {
      attack: 'heavy-attack',
      heal: 'mp-recovery',
    })

    expect(readBattleSkillSelections(storage, battleSessionId)).toEqual({
      attack: 'heavy-attack',
      heal: 'mp-recovery',
    })
    expect(storage.getItem(battleSkillSelectionsStorageKey(battleSessionId))).toContain(
      '"version":1',
    )
  })

  it('keeps selections isolated so a new battle resolves its defaults', () => {
    const storage = new MemoryStorage()

    writeBattleSkillSelections(storage, 'battle-one', { heal: 'mp-recovery' })

    expect(
      resolveBattleSkillSelections(readBattleSkillSelections(storage, 'battle-two'), definitions),
    ).toEqual({
      attack: 'basic-attack',
      heal: 'hp-recovery',
    })
  })

  it('rejects stale or invalid skill ids and falls back to category defaults', () => {
    expect(
      resolveBattleSkillSelections({ attack: 'removed-skill', heal: 'mp-recovery' }, definitions),
    ).toEqual({
      attack: 'basic-attack',
      heal: 'mp-recovery',
    })
  })

  it('ignores malformed persisted data without breaking the cockpit', () => {
    const storage = new MemoryStorage()
    storage.setItem(battleSkillSelectionsStorageKey('battle-one'), '{not-json')

    expect(readBattleSkillSelections(storage, 'battle-one')).toEqual({})
  })
})
