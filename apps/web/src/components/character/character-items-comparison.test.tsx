import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ index: 0 }))
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>()
  return {
    ...actual,
    useState(initial: unknown) {
      return state.index++ === 5 ? ['candidate', vi.fn()] : actual.useState(initial)
    },
  }
})
import { CharacterItems } from './character-items'
import { starterItemDefinitions } from '@aurevane/game-core/content/starter-items'
import { presentItem } from '@/lib/items/item-presentation'
import type { CharacterItemsView } from '@/server/character/character-items-service'
const hood = presentItem(starterItemDefinitions().find((item) => item.id === 'wayfarer-hood')!)
function comparison(baseEvasion?: number) {
  const stack = (id: string, amount: number) => ({
    id,
    itemId: id,
    quantity: 1,
    slotIndex: id === 'old' ? 0 : 1,
    inventoryCategory: 'gear' as const,
    item: { ...hood, id, statBonuses: [{ stat: 'evasion' as const, amount, conditional: false }] },
  })
  const view: CharacterItemsView = {
    characterId: 'character',
    revision: 1,
    catalogueToken: 'a'.repeat(32),
    battleLocked: false,
    equipmentIssue: null,
    qualityPoints: 5,
    qualityPointLimit: 100,
    equipment: { head: 'old' },
    selectedSupport: { kind: 'basic', actionId: 'basic.recover' },
    notices: [],
    stacks: [stack('old', 100), stack('candidate', 500)],
    baseEvasion,
    statBonuses: [
      {
        itemId: 'old',
        itemName: hood.name,
        position: 'head',
        stat: 'evasion',
        amount: 100,
        conditional: false,
      },
    ],
  }
  return renderToStaticMarkup(<CharacterItems initialView={view} />)
}
beforeEach(() => {
  state.index = 0
})
it.each([undefined, Number.NaN, -1, 10001])(
  'does not label an unproven Evasion comparison as neutral for base %s',
  (base) => {
    const html = comparison(base)
    expect(html).toContain('Evasion comparison unavailable')
    expect(html).not.toContain('No fixed stat change')
    expect(html).not.toContain('data-equipment-stat-change=')
  },
)
it('shows the actual capped Evasion delta when its authoritative base is known', () => {
  const html = comparison(437)
  expect(html).toContain('data-equipment-stat-change="400"')
  expect(html).toContain('+4%')
  expect(html).not.toContain('comparison unavailable')
})
