import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useLayoutEffect: (effect: () => unknown) => effect(),
}))

import { BattleMapTokenPolish } from './battle-map-token-polish'

// The shared React renderer pins the owner-derived accent on every visible token. The DOM
// polish must preserve it even when summons share a name or are absent from the base roster.
function polishSummon(accent: string, namedAccents: Record<string, string>) {
  const properties = new Map([['--battle-combatant-accent', accent]])
  const token = {
    style: {
      setProperty: (key: string, value: string) => properties.set(key, value),
      removeProperty: (key: string) => properties.delete(key),
      getPropertyValue: (key: string) => properties.get(key) ?? '',
    },
    querySelector: () => null,
    querySelectorAll: () => [],
  }
  const tile = {
    dataset: {},
    style: { removeProperty: () => {} },
    getAttribute: () => 'Tile 2, 1; open-ground; elevation 0; occupied by Vesper',
    getBoundingClientRect: () => ({ width: 60, height: 60 }),
    querySelector: () => token,
  }
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
  vi.stubGlobal('document', {
    querySelector: () => null,
    querySelectorAll: () => [tile],
  })
  BattleMapTokenPolish({ combatantAccents: namedAccents })
  return properties.get('border-color')
}

afterEach(() => vi.unstubAllGlobals())

describe('shared summoned-unit identity polish', () => {
  it('preserves the owner accent when a summon is absent from the original roster', () => {
    expect(polishSummon('#c09bdd', {})).toBe('#c09bdd')
  })

  it('preserves the owner accent when another participant has the same visible name', () => {
    expect(polishSummon('#c09bdd', { Vesper: '#d0aa62' })).toBe('#c09bdd')
  })
})
