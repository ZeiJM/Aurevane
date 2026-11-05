import { defaultBasicSkills } from '../combat/combat-basic-actions'
import { expect, it } from 'vitest'
import { itemFixture } from '../content/items-test-fixtures'
import {
  equipInventoryItem,
  grantInventoryItems,
  selectInventorySupport,
  sortItemInventory,
  unequipInventoryItem,
  validateEquipmentLoadout,
  type ItemInventorySnapshot,
} from './item-inventory'
import { parseRuntimeItemDefinition, type RuntimeItemDefinition } from '../content/items'
import { starterItemDefinitions } from '../content/starter-items'
const catalogue = (items: readonly RuntimeItemDefinition[]) =>
  Object.fromEntries(items.map((item) => [item.id, item]))
const empty = (): ItemInventorySnapshot => ({
  characterId: 'character-a',
  revision: 0,
  stacks: [],
  equipment: {},
  selectedSupport: { kind: 'basic', actionId: 'basic.recover' },
  previousBasicSupport: 'basic.recover',
  grants: [],
})
function owned(items: readonly RuntimeItemDefinition[]): ItemInventorySnapshot {
  return {
    ...empty(),
    stacks: items.map((item, slotIndex) => ({
      id: `stack-${slotIndex}`,
      characterId: 'character-a',
      itemId: item.id,
      inventoryCategory: item.inventoryCategory,
      slotIndex,
      quantity: 1,
      acquiredAt: '2026-11-03T00:00:00Z',
      acquiredContentVersion: 1,
      provenance: 'test',
    })),
  }
}
it('reserves hands for weapon and armor while two independent supplies remain usable with Sunsplitter', () => {
  const definitions = starterItemDefinitions()
  const items = ['sunsplitter', 'wardstone-bracer', 'mender-salve', 'ward-sigil-scroll'].map((id) =>
    definitions.find((item) => item.id === id)!,
  )
  const s = owned(items),
    d = catalogue(items)
  const equipment = { 'main-hand': 'stack-0', 'consumable-1': 'stack-2', 'consumable-2': 'stack-3' }
  expect(validateEquipmentLoadout({ ...s, equipment }, d)).toEqual({ ok: true, qualityPoints: 80 })
  expect(
    validateEquipmentLoadout({ ...s, equipment: { ...equipment, 'off-hand': 'stack-1' } }, d),
  ).toMatchObject({ ok: false, issue: { code: 'hand-conflict' } })
  for (const [position, stack] of [
    ['off-hand', 'stack-0'],
    ['main-hand', 'stack-1'],
    ['main-hand', 'stack-2'],
    ['off-hand', 'stack-2'],
    ['consumable-1', 'stack-0'],
  ] as const)
    expect(equipInventoryItem(s, d, 0, stack, position).ok).toBe(false)
  expect(equipInventoryItem(s, d, 0, 'stack-1', 'off-hand').ok).toBe(true)
})
it('accepts exactly 100 QP, rejects 101, and counts a two-handed stack once', () => {
  const blade = itemFixture({
    id: 'test.blade',
    itemClass: 'weapon',
    ability: defaultBasicSkills().find((x) => x.id === 'unarmed.basic')!.ability!,
    actions: { attack: { behaviorId: 'use', name: 'Cut' } },
    equipment: { slot: 'hand', hands: 2 },
    qualityPoints: 50,
  })
  const helm = itemFixture({ qualityPoints: 50 })
  expect(parseRuntimeItemDefinition(blade)).toEqual(blade)
  const snapshot = {
    ...owned([blade, helm]),
    equipment: { 'main-hand': 'stack-0', head: 'stack-1' },
  }
  expect(validateEquipmentLoadout(snapshot, catalogue([blade, helm]))).toMatchObject({
    ok: true,
    qualityPoints: 100,
  })
  expect(
    validateEquipmentLoadout(snapshot, catalogue([blade, { ...helm, qualityPoints: 51 }])),
  ).toMatchObject({ ok: false, issue: { code: 'overQP' } })
  expect(
    validateEquipmentLoadout(
      { ...snapshot, equipment: { ...snapshot.equipment, 'off-hand': 'stack-0' } },
      catalogue([blade, helm]),
    ),
  ).toMatchObject({ ok: false, issue: { code: 'hand-conflict' } })
})
it('rejects nonowned stacks, repeated assignments, illegal slots, disabled and V1 definitions', () => {
  const item = itemFixture()
  const snapshot = owned([item])
  const definitions = catalogue([item])
  expect(
    validateEquipmentLoadout({ ...snapshot, equipment: { head: 'foreign' } }, definitions),
  ).toMatchObject({ ok: false, issue: { code: 'ownership' } })
  expect(
    validateEquipmentLoadout(
      { ...snapshot, equipment: { head: 'stack-0', body: 'stack-0' } },
      definitions,
    ).ok,
  ).toBe(false)
  expect(equipInventoryItem(snapshot, definitions, 0, 'stack-0', 'body')).toMatchObject({
    ok: false,
    issue: { code: 'slot' },
  })
  expect(
    equipInventoryItem(snapshot, catalogue([{ ...item, enabled: false }]), 0, 'stack-0', 'head'),
  ).toMatchObject({ ok: false, issue: { code: 'definition' } })
})
it('requires explicit replacement and rejects stale CAS without mutating inputs', () => {
  const a = itemFixture(),
    b = itemFixture({ id: 'test.other' })
  const snapshot = { ...owned([a, b]), equipment: { head: 'stack-0' } }
  const definitions = catalogue([a, b])
  const before = structuredClone(snapshot)
  expect(equipInventoryItem(snapshot, definitions, 1, 'stack-1', 'head')).toMatchObject({
    ok: false,
    issue: { code: 'stale-revision' },
  })
  expect(equipInventoryItem(snapshot, definitions, 0, 'stack-1', 'head')).toMatchObject({
    ok: false,
    issue: { code: 'slot-conflict' },
  })
  expect(equipInventoryItem(snapshot, definitions, 0, 'stack-1', 'head', ['head'])).toMatchObject({
    ok: true,
    snapshot: { revision: 1, equipment: { head: 'stack-1' } },
  })
  expect(snapshot).toEqual(before)
})
it('restores Basic Support when selected off-hand armor is removed', () => {
  const item = itemFixture({
    equipment: { slot: 'hand', hands: 1 },
    itemClass: 'hand-armor',
    ability: {
      ...defaultBasicSkills().find((x) => x.id === 'basic.recover')!.ability!,
      behaviors: defaultBasicSkills()
        .find((x) => x.id === 'basic.recover')!
        .ability!.behaviors.map((b) => ({ ...b, id: 'support' })),
    },
    actions: { support: { behaviorId: 'support', name: 'Steady' } },
  })
  const snapshot = {
    ...owned([item, item]),
    equipment: { 'off-hand': 'stack-1' },
  }
  const definitions = catalogue([item])
  const selected = selectInventorySupport(snapshot, definitions, 0, {
    kind: 'equipment',
    position: 'off-hand',
    itemId: item.id,
    behaviorId: 'support',
  })
  expect(selected.ok).toBe(true)
  if (!selected.ok) return
  expect(unequipInventoryItem(selected.snapshot, definitions, 1, 'off-hand')).toMatchObject({
    ok: true,
    snapshot: { selectedSupport: { kind: 'basic', actionId: 'basic.recover' } },
    notices: ['equipment-support-removed'],
  })
  expect(
    selectInventorySupport(snapshot, definitions, 0, {
      kind: 'equipment',
      position: 'head',
      itemId: item.id,
      behaviorId: 'support',
    }).ok,
  ).toBe(false)
})
it('grants idempotently, splits 99/100 safely, and rolls back full 40-slot categories', () => {
  const item = itemFixture({
    inventoryCategory: 'materials',
    itemClass: 'material',
    equipment: null,
    qualityPoints: 0,
    maximumStack: 99,
  })
  const definitions = catalogue([item])
  const first = grantInventoryItems(
    empty(),
    definitions,
    0,
    'starter.v1',
    [{ itemId: item.id, quantity: 100 }],
    '2026-11-03T00:00:00Z',
  )
  expect(first.ok).toBe(true)
  if (!first.ok) return
  expect(first.snapshot.stacks.map((s) => s.quantity)).toEqual([99, 1])
  expect(
    grantInventoryItems(
      first.snapshot,
      definitions,
      0,
      'starter.v1',
      [{ itemId: item.id, quantity: 100 }],
      'later',
    ),
  ).toMatchObject({ ok: true, snapshot: first.snapshot })
  const full = grantInventoryItems(
    empty(),
    definitions,
    0,
    'full',
    [{ itemId: item.id, quantity: 3960 }],
    '2026-11-03T00:00:00Z',
  )
  expect(full.ok).toBe(true)
  if (!full.ok) return
  expect(full.snapshot.stacks).toHaveLength(40)
  expect(
    grantInventoryItems(
      full.snapshot,
      definitions,
      1,
      'overflow',
      [{ itemId: item.id, quantity: 1 }],
      '2026-11-03T00:00:00Z',
    ),
  ).toMatchObject({ ok: false, issue: { code: 'capacity' } })
  expect(
    grantInventoryItems(
      first.snapshot,
      definitions,
      1,
      'starter.v1',
      [{ itemId: item.id, quantity: 1 }],
      'later',
    ),
  ).toMatchObject({ ok: false, issue: { code: 'grant-conflict' } })
})
it('sorts a complete owned category permutation and rejects foreign/repeated IDs', () => {
  const a = itemFixture(),
    b = itemFixture({ id: 'test.other' })
  const snapshot = owned([a, b])
  const defs = catalogue([a, b])
  expect(sortItemInventory(snapshot, defs, 0, 'gear', ['stack-1', 'stack-0'])).toMatchObject({
    ok: true,
    snapshot: {
      stacks: [
        { id: 'stack-0', slotIndex: 1 },
        { id: 'stack-1', slotIndex: 0 },
      ],
    },
  })
  for (const ids of [['stack-1', 'foreign'], ['stack-0', 'stack-0'], ['stack-0']])
    expect(sortItemInventory(snapshot, defs, 0, 'gear', ids)).toMatchObject({
      ok: false,
      issue: { code: 'permutation' },
    })
})
it('rejects duplicate consumable identity across one or separate stacks and permits repair', () => {
  const item = starterItemDefinitions().find((x) => x.itemClass === 'battle-item')!
  const s = owned([item, item]),
    d = catalogue([item])
  for (const other of ['stack-0', 'stack-1']) {
    const invalid = {
      ...s,
      stacks: s.stacks.map((x) => ({ ...x, quantity: 2 })),
      equipment: { 'consumable-1': 'stack-0', 'consumable-2': other },
    }
    expect(validateEquipmentLoadout(invalid, d)).toMatchObject({
      ok: false,
      issue: { code: 'duplicate-consumable' },
    })
    expect(unequipInventoryItem(invalid, d, 0, 'consumable-2').ok).toBe(true)
  }
  const distinct = { ...item, id: 'other.supply' }
  expect(
    validateEquipmentLoadout(
      {
        ...owned([item, distinct]),
        equipment: { 'consumable-1': 'stack-0', 'consumable-2': 'stack-1' },
      },
      catalogue([item, distinct]),
    ).ok,
  ).toBe(true)
})
it('enforces authored equip requirements against base facts and allows removal after changes', () => {
  const item = itemFixture({
    equipRequirements: { minimumLevel: 4, minimumCoreStats: { might: 13 } },
  })
  const s = owned([item]),
    d = catalogue([item])
  const context = {
    level: 4,
    disciplineIds: ['vanguard'],
    baseCoreStats: { might: 12, finesse: 4, vitality: 7, agility: 4, intellect: 3, resolve: 6 },
  }
  expect(equipInventoryItem(s, d, 0, 'stack-0', 'head')).toMatchObject({
    ok: false,
    issue: { code: 'equip-requirements' },
  })
  expect(equipInventoryItem(s, d, 0, 'stack-0', 'head', [], context)).toMatchObject({
    ok: false,
    issue: { code: 'equip-requirements' },
  })
  expect(
    equipInventoryItem(s, d, 0, 'stack-0', 'head', [], {
      ...context,
      baseCoreStats: { ...context.baseCoreStats, might: 13 },
    }).ok,
  ).toBe(true)
  expect(unequipInventoryItem({ ...s, equipment: { head: 'stack-0' } }, d, 0, 'head').ok).toBe(true)
})
it('rejects invalid current stack ceilings without unbounded grant arithmetic', () => {
  const item = itemFixture({ maximumStack: 0 })
  expect(
    grantInventoryItems(
      empty(),
      catalogue([item]),
      0,
      'bad',
      [{ itemId: item.id, quantity: 1 }],
      '2026-11-03',
    ),
  ).toMatchObject({ ok: false, issue: { code: 'definition' } })
})
it('reverts selected support when its stack is explicitly swapped for an identical item', () => {
  const ability = defaultBasicSkills().find((x) => x.id === 'basic.recover')!.ability!
  const behaviorId = ability.behaviors[0]!.id
  const item = itemFixture({
    equipment: { slot: 'hand', hands: 1 },
    itemClass: 'hand-armor',
    ability,
    actions: { support: { behaviorId, name: 'Steady' } },
  })
  const snapshot = {
    ...owned([item, item]),
    equipment: { 'off-hand': 'stack-0' },
    selectedSupport: {
      kind: 'equipment' as const,
      position: 'off-hand' as const,
      itemId: item.id,
      behaviorId,
    },
  }
  expect(
    equipInventoryItem(snapshot, catalogue([item]), 0, 'stack-1', 'off-hand', ['off-hand']),
  ).toMatchObject({
    ok: true,
    snapshot: { selectedSupport: { kind: 'basic', actionId: 'basic.recover' } },
    notices: ['equipment-support-removed'],
  })
})
it('computes all six supported sort choices using current definitions and deterministic ties', () => {
  const a = itemFixture({ name: 'Zinc', tier: 'D', qualityPoints: 1 }),
    b = itemFixture({ id: 'test.other', name: 'Amber', tier: 'S', qualityPoints: 20 })
  const snapshot = owned([a, b])
  const defs = catalogue([a, b])
  expect(sortItemInventory(snapshot, defs, 0, 'gear', 'name')).toMatchObject({
    ok: true,
    snapshot: {
      stacks: [
        { id: 'stack-0', slotIndex: 1 },
        { id: 'stack-1', slotIndex: 0 },
      ],
    },
  })
  for (const mode of ['tier', 'quality-points', 'quantity', 'newest', 'class'] as const)
    expect(sortItemInventory(snapshot, defs, 0, 'gear', mode).ok).toBe(true)
})
it('permits successive removal repairs after current QP changes and sorts unavailable inventory', () => {
  const a = itemFixture({ qualityPoints: 100 }),
    b = itemFixture({ id: 'test.body', equipment: { slot: 'body', hands: 1 }, qualityPoints: 100 }),
    c = itemFixture({
      id: 'test.boots',
      equipment: { slot: 'boots', hands: 1 },
      qualityPoints: 100,
    })
  const snapshot = {
    ...owned([a, b, c]),
    equipment: { head: 'stack-0', body: 'stack-1', boots: 'stack-2' },
  }
  const defs = catalogue([a, b, c])
  const first = unequipInventoryItem(snapshot, defs, 0, 'head')
  expect(first.ok).toBe(true)
  if (!first.ok) return
  expect(validateEquipmentLoadout(first.snapshot, defs)).toMatchObject({
    ok: false,
    issue: { code: 'overQP' },
  })
  expect(unequipInventoryItem(first.snapshot, defs, 1, 'body').ok).toBe(true)
  expect(sortItemInventory(snapshot, {}, 0, 'gear', ['stack-2', 'stack-1', 'stack-0']).ok).toBe(
    true,
  )
  expect(
    unequipInventoryItem({ ...snapshot, equipment: { head: 'stack-0' } }, {}, 0, 'head').ok,
  ).toBe(true)
})
it('keeps ownership validation on retained assignments during a removal repair', () => {
  const item = itemFixture()
  const snapshot = { ...owned([item]), equipment: { head: 'stack-0', body: 'foreign' } }
  expect(unequipInventoryItem(snapshot, {}, 0, 'head')).toMatchObject({
    ok: false,
    issue: { code: 'ownership' },
  })
})
function sortedStackIds(result: ReturnType<typeof sortItemInventory>): readonly string[] {
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.issue.message)
  return [...result.snapshot.stacks]
    .sort((a, b) => a.slotIndex - b.slotIndex)
    .map((stack) => stack.id)
}
it.each(['quantity', 'newest'] as const)(
  'sorts archived Items by %s using their retained stack data',
  (mode) => {
    const material = itemFixture({
      inventoryCategory: 'materials',
      itemClass: 'material',
      equipment: null,
      qualityPoints: 0,
      maximumStack: 99,
    })
    const snapshot = owned([material, material, material])
    const quantities = [1, 5, 3]
    const dates = ['2026-11-01T00:00:00Z', '2026-11-03T00:00:00Z', '2026-11-02T00:00:00Z']
    const archived = {
      ...snapshot,
      stacks: snapshot.stacks.map((stack, index) => ({
        ...stack,
        quantity: quantities[index]!,
        acquiredAt: dates[index]!,
      })),
    }
    expect(sortedStackIds(sortItemInventory(archived, {}, 0, 'materials', mode))).toEqual([
      'stack-1',
      'stack-2',
      'stack-0',
    ])
  },
)
it.each(['name', 'tier', 'quality-points', 'class'] as const)(
  'sorts mixed current and unavailable definitions by %s independently of input order',
  (mode) => {
    const zinc = itemFixture({ name: 'Zinc', tier: 'D', qualityPoints: 1 })
    const missing = itemFixture({ id: 'test.archived' })
    const amber = itemFixture({ id: 'test.amber', name: 'Amber', tier: 'S', qualityPoints: 20 })
    const anotherMissing = itemFixture({ id: 'test.also-archived' })
    const snapshot = owned([zinc, missing, amber, anotherMissing])
    const definitions = catalogue([zinc, amber])
    const permutations = [
      [0, 1, 2, 3],
      [2, 1, 0, 3],
      [3, 2, 1, 0],
      [1, 0, 3, 2],
      [3, 1, 2, 0],
      [2, 3, 0, 1],
    ]
    for (const permutation of permutations) {
      const shuffled = { ...snapshot, stacks: permutation.map((index) => snapshot.stacks[index]!) }
      expect(sortedStackIds(sortItemInventory(shuffled, definitions, 0, 'gear', mode))).toEqual([
        'stack-2',
        'stack-0',
        'stack-1',
        'stack-3',
      ])
    }
  },
)
