import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { itemFixture } from '../../../../../packages/game-core/src/content/items-test-fixtures'
import {
  loadCharacterItems,
  mutateCharacterItems,
  type CharacterItemsRepository,
} from './character-items-service'

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
