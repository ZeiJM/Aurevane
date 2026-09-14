import { describe, expect, expectTypeOf, it } from 'vitest'

import type { CombatActionSourceType } from './actions'
import { canonicalCombatActionSourceKind } from './combat-action-source'
import type { CombatActionSourceKind } from './combat-kernel-types'

describe('canonical combat action source mapping', () => {
  it.each([
    ['basic-attack', 'basic'],
    ['basic-action', 'basic'],
    ['discipline-skill', 'discipline-skill'],
    ['scenario', 'scenario'],
    ['test', 'test'],
  ] as const)(
    'maps current action source %s into kernel source %s',
    (source, expected) => {
      const canonical = canonicalCombatActionSourceKind(source)

      expect(canonical).toBe(expected)
      expectTypeOf(canonical).toEqualTypeOf<CombatActionSourceKind>()
    },
  )

  it('covers every current persisted source type', () => {
    const currentSources: readonly CombatActionSourceType[] = [
      'basic-attack',
      'basic-action',
      'discipline-skill',
      'scenario',
      'test',
    ]

    expect(currentSources.map(canonicalCombatActionSourceKind)).toEqual([
      'basic',
      'basic',
      'discipline-skill',
      'scenario',
      'test',
    ])
  })
})
