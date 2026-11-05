import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { itemFixture } from '../../../../../packages/game-core/src/content/items-test-fixtures'
import {
  loadCharacterItems,
  characterItemsView,
  mutateCharacterItems,
  type CharacterItemsRepository,
} from './character-items-service'
import { calculateCharacterBuildDerivedStats } from '@aurevane/game-core/character/discipline-build'
import type { ItemEquipContext } from '@aurevane/game-core/character/item-equip-requirements'

it('projects authoritative base Evasion consistently with the current profile and preserves missing-context repair reads', () => {
  const state = {
    snapshot: {
      characterId: 'hero',
      revision: 0,
      stacks: [],
      equipment: {},
      selectedSupport: { kind: 'basic' as const, actionId: 'basic.recover' as const },
      previousBasicSupport: 'basic.recover' as const,
      grants: [],
    },
    definitions: {},
    catalogueToken: 'current',
    battleLocked: false,
  }
  const attributes = { might: 6, finesse: 6, vitality: 6, agility: 60, intellect: 6, resolve: 6 }
  const equipContext = { level: 1, disciplineIds: ['vanguard'], baseCoreStats: attributes }
  const view = characterItemsView({ ...state, equipContext })
  expect(view.baseEvasion).toBe(5500)
  const profile = calculateCharacterBuildDerivedStats({
    attributes,
    level: 1,
    primaryDefinition: {
      id: 'vanguard',
      definitionVersion: 1,
      name: 'Vanguard',
      summary: 'Balanced combat.',
      enabledForPrimary: true,
      enabledForSecondary: true,
    },
    primaryProfile: {
      disciplineId: 'vanguard',
      profileVersion: 1,
      statOffsets: { evasion: 9999 },
      statCaps: { evasion: 0 },
    },
  })
  expect(view.baseEvasion).toBe(profile.stats.evasion.value)
  expect(JSON.stringify(view)).not.toContain('baseCoreStats')
  for (const context of [
    undefined,
    { ...equipContext, level: 0 },
    { ...equipContext, baseCoreStats: { ...attributes, agility: 61 } },
    { ...equipContext, baseCoreStats: { ...attributes, agility: Number.NaN } },
    { ...equipContext, baseCoreStats: undefined },
  ]) {
    expect(
      characterItemsView({ ...state, equipContext: context as ItemEquipContext | undefined })
        .baseEvasion,
    ).toBeUndefined()
  }
})

it('projects current Item presentation without private grants or source definitions and preserves unavailable stacks', async () => {
  const definition = itemFixture()
  const snapshot = {
    characterId: 'hero',
    revision: 2,
    stacks: [
      {
        id: 'stack',
        characterId: 'hero',
        itemId: definition.id,
        inventoryCategory: 'gear' as const,
        slotIndex: 0,
        quantity: 1,
        acquiredAt: '2026-11-03',
        acquiredContentVersion: 1,
        provenance: 'secret-grant',
      },
    ],
    equipment: { head: 'stack' },
    selectedSupport: { kind: 'basic' as const, actionId: 'basic.recover' as const },
    previousBasicSupport: 'basic.recover' as const,
    grants: [{ key: 'secret-grant', items: [] }],
  }
  const repository = {
    read: async () => ({
      snapshot,
      definitions: { [definition.id]: definition },
      catalogueToken: 'token',
      battleLocked: false,
    }),
  } as unknown as CharacterItemsRepository
  const view = await loadCharacterItems('user', 'hero', repository)
  expect(view).toMatchObject({
    revision: 2,
    qualityPoints: 10,
    qualityPointLimit: 100,
    stacks: [{ id: 'stack', item: { name: 'Iron Helm' } }],
  })
  expect(JSON.stringify(view)).not.toMatch(/secret-grant|acquiredContentVersion|"ability"|"grants"/)
  const unavailable = await loadCharacterItems('user', 'hero', {
    ...repository,
    read: async () => ({ snapshot, definitions: {}, catalogueToken: 'new', battleLocked: false }),
  })
  expect(unavailable.stacks).toHaveLength(1)
  expect(unavailable.stacks[0]!.item).toBeNull()
  expect(unavailable.equipmentIssue?.code).toBe('definition')
})

it('rejects forged grants and stale request tokens before any mutation', async () => {
  const write = vi.fn()
  const repository = {
    read: async () => ({
      snapshot: {
        characterId: 'hero',
        revision: 2,
        stacks: [],
        equipment: {},
        selectedSupport: { kind: 'basic', actionId: 'basic.recover' },
        previousBasicSupport: 'basic.recover',
        grants: [],
      },
      definitions: {},
      catalogueToken: 'current',
      battleLocked: false,
    }),
    write,
  } as unknown as CharacterItemsRepository
  await expect(
    mutateCharacterItems(
      'user',
      'hero',
      { action: 'grant', expectedRevision: 2, catalogueToken: 'current', items: [] },
      repository,
    ),
  ).rejects.toThrow(/command/i)
  await expect(
    mutateCharacterItems(
      'user',
      'hero',
      { action: 'unequip', expectedRevision: 1, catalogueToken: 'current', position: 'head' },
      repository,
    ),
  ).rejects.toThrow(/changed|revision/i)
  await expect(
    mutateCharacterItems(
      'user',
      'hero',
      { action: 'unequip', expectedRevision: 2, catalogueToken: 'old', position: 'head' },
      repository,
    ),
  ).rejects.toThrow(/changed|catalogue/i)
  expect(write).not.toHaveBeenCalled()
})
it('shows unmet equip conditions from server base facts and rejects equip without a write', async () => {
  const definition = itemFixture({ equipRequirements: { minimumCoreStats: { might: 13 } } })
  const state = {
    snapshot: {
      characterId: 'hero',
      revision: 0,
      stacks: [
        {
          id: 'stack',
          characterId: 'hero',
          itemId: definition.id,
          inventoryCategory: 'gear' as const,
          slotIndex: 0,
          quantity: 1,
          acquiredAt: '2026-11-03',
          acquiredContentVersion: 1,
          provenance: 'test',
        },
      ],
      equipment: {},
      selectedSupport: { kind: 'basic' as const, actionId: 'basic.recover' as const },
      previousBasicSupport: 'basic.recover' as const,
      grants: [],
    },
    definitions: { [definition.id]: definition },
    catalogueToken: 'current',
    battleLocked: false,
    equipContext: {
      level: 1,
      disciplineIds: ['vanguard'],
      baseCoreStats: { might: 12, finesse: 4, vitality: 7, agility: 4, intellect: 3, resolve: 6 },
    },
  }
  const write = vi.fn(),
    repository = { read: async () => state, write } as unknown as CharacterItemsRepository
  const view = await loadCharacterItems('user', 'hero', repository)
  expect(view.stacks[0]).toMatchObject({
    unmetEquipRequirements: ['Base Might 13 required (current 12).'],
  })
  await expect(
    mutateCharacterItems(
      'user',
      'hero',
      {
        action: 'equip',
        stackId: 'stack',
        position: 'head',
        expectedRevision: 0,
        catalogueToken: 'current',
      },
      repository,
    ),
  ).rejects.toThrow('Base Might 13 required')
  expect(write).not.toHaveBeenCalled()
})
