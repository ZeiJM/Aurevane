import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
const hook = vi.hoisted(() => ({ index: 0, position: 'main-hand' }))
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>()
  return {
    ...actual,
    useState(initial: unknown) {
      return hook.index++ === 7 ? [hook.position, vi.fn()] : actual.useState(initial)
    },
  }
})
import { CharacterItems } from './character-items'
import { presentItem } from '@/lib/items/item-presentation'
import { starterItemDefinitions } from '@aurevane/game-core/content/starter-items'
import type { CharacterItemsView } from '@/server/character/character-items-service'
function view(
  ids: string[],
  qualityPoints: number,
  equipment: CharacterItemsView['equipment'] = {},
): CharacterItemsView {
  return {
    characterId: 'test',
    revision: 1,
    catalogueToken: 'a'.repeat(32),
    battleLocked: false,
    equipmentIssue: null,
    qualityPoints,
    qualityPointLimit: 100,
    equipment,
    selectedSupport: { kind: 'basic', actionId: 'basic.recover' },
    notices: [],
    stacks: ids.map((id, i) => ({
      id,
      itemId: id,
      quantity: 12,
      slotIndex: i,
      inventoryCategory: 'gear',
      item: presentItem(starterItemDefinitions().find((x) => x.id === id)!),
    })),
  }
}
function picker(v: CharacterItemsView) {
  return (
    renderToStaticMarkup(<CharacterItems initialView={v} />).split(
      'aria-label="Owned Items for ',
    )[1] ?? ''
  )
}
beforeEach(() => {
  hook.index = 0
  hook.position = 'main-hand'
})
it('hides unaffordable choices while retaining affordable weapons', () => {
  const html = picker(view(['stormcaller-staff', 'iron-shortsword', 'sunsplitter'], 85))
  expect(html).toContain('Iron Shortsword')
  expect(html).not.toContain('Stormcaller Staff')
  expect(html).not.toContain('Sunsplitter')
})
it('credits a removed two-handed weapon before filtering off-hand QP', () => {
  hook.position = 'off-hand'
  const v = view(['sunsplitter', 'quickdraw-glove'], 98, { 'main-hand': 'sunsplitter' })
  expect(picker(v)).toContain('Quickdraw Glove')
})
it('keeps consumable quantity inline with its name', () => {
  hook.position = 'consumable-1'
  const html = picker(view(['mender-salve'], 0))
  expect(html).toMatch(/Mender Salve(?:<!-- -->)?\s*<small[^>]*>×(?:<!-- -->)?12<\/small><\/span>/)
})
