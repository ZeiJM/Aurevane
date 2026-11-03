import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { itemFixture } from '../../../../../packages/game-core/src/content/items-test-fixtures'
import { combatContentCategory } from './combat-content-categories'
import {
  createCombatContentResolver,
  RpcPublishedCombatContentSource,
  resolveCombatContentCatalogueSnapshot,
} from './combat-content-resolver'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
const item = itemFixture({ media: { artworkId: 'environment.entry.gateway' } })
it('publishes only genuine-media V2 Items and retains V1/future-kind blockers', () => {
  const descriptor = combatContentCategory('item')!
  expect(descriptor.publicationBlocker).toBeNull()
  expect(descriptor.validatePublication).toBeTypeOf('function')
  expect(() => descriptor.validatePublication!(item)).not.toThrow()
  expect(() =>
    descriptor.validatePublication!({ ...item, media: { artworkId: 'missing.art' } }),
  ).toThrow(/artwork/i)
  const v1 = {
    schemaVersion: 1,
    id: 'legacy.item',
    contentVersion: 1,
    name: 'Old Item',
    description: 'Retained',
    sortOrder: 0,
    enabled: true,
    media: {},
    itemClass: 'tool',
    usage: 'none',
    equipmentSlot: null,
    acquisition: 'unimplemented',
    requirements: null,
    ability: null,
  }
  expect(descriptor.parseRetained(v1, v1.id)).toEqual(v1)
  expect(() => descriptor.validatePublication!(v1)).toThrow(/V2|version/i)
  for (const kind of ['ascension', 'severence'])
    expect(combatContentCategory(kind)!.publicationBlocker).not.toBeNull()
})
it('uses authoritative current/pinned Item source RPCs without stale media fallback', async () => {
  const calls: string[] = []
  let current = { ...item, contentVersion: 2, name: 'Current Helm' }
  const source = new RpcPublishedCombatContentSource(async (name) => {
    calls.push(name)
    return { data: name === 'read_runtime_item_version_v1' ? item : current, error: null }
  })
  const resolver = createCombatContentResolver(source)
  expect(await resolver.resolveCurrentItemDefinition!(item.id)).toEqual(current)
  expect(await resolver.resolvePinnedItemDefinition!(item.id, 1)).toEqual(item)
  current = { ...current, name: 'Changed Helm' }
  expect((await resolver.resolveCurrentItemDefinition!(item.id))!.name).toBe('Changed Helm')
  expect(calls).toEqual([
    'read_current_runtime_item_v1',
    'read_runtime_item_version_v1',
    'read_current_runtime_item_v1',
  ])
})
it('includes runtime Item publications in the shared catalogue and rejects unsupported bound effects', () => {
  const snapshot = {
    token: 't',
    policy: { version: 1 as const, modes: {} },
    publications: [
      {
        id: 'version',
        contentKind: 'item' as const,
        contentKey: item.id,
        contentVersion: 1,
        definition: { ...item },
        publishedBy: 'owner',
        publishedAt: 'now',
      },
    ],
  }
  expect(
    resolveCombatContentCatalogueSnapshot(snapshot).entries.find(
      (row) => row.contentKey === item.id,
    ),
  ).toMatchObject({ category: 'item', definition: item })
  const ability = defaultBasicSkills().find((row) => row.id === 'basic.pilfer')!.ability!
  expect(() =>
    combatContentCategory('item')!.validatePublication!({
      ...item,
      inventoryCategory: 'battle-items',
      itemClass: 'battle-item',
      equipment: { slot: 'hand', hands: 1 },
      maximumStack: 99,
      battleUses: 2,
      ability,
      actions: { use: { behaviorId: ability.behaviors[0]!.id, name: 'Loot' } },
    }),
  ).toThrow(/Pilfer|Loot|source/i)
})

it('treats authoritative Item absence as final even if a retained generic publication pointer exists', async () => {
  const resolver = createCombatContentResolver({
    findCurrentRuntimeItem: async () => null,
    findCurrentContent: async () => ({
      id: 'old',
      contentKey: item.id,
      contentKind: 'item',
      contentVersion: 1,
      definition: { ...item },
      publishedBy: 'owner',
      publishedAt: 'then',
    }),
    findCurrentSkill: async () => null,
    findSkillVersion: async () => null,
  })
  expect(await resolver.resolveCurrentItemDefinition!(item.id)).toBeNull()
})
