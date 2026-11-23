import { expect, it, vi } from 'vitest'
import type { CombatContentAuthoringService } from './combat-content-authoring-service'
import { handleCombatContentAuthoringRequest } from './combat-content-authoring-handler'
vi.mock('server-only', () => ({}))

it.each([
  { operation: 'rollback', skillId: 'basic.guard', targetVersion: 1 },
  {
    operation: 'restore-basic-draft',
    skillId: 'basic.guard',
    targetVersion: 1,
    expectedBaseVersion: 1,
    expectedDraftVersion: null,
  },
  {
    operation: 'record',
    command: {
      action: 'restore',
      contentKey: 'basic.guard',
      expectedRevision: 1,
      sourceVersion: 1,
    },
  },
])('rejects retired rollback entry point before any mutation: $operation', async (body) => {
  const mutate = vi.fn().mockResolvedValue({})
  const response = await handleCombatContentAuthoringRequest(
    new Request('https://example.test/api/master/combat-content', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    {
      getActor: async () => ({ userId: 'owner' }),
      createService: () =>
        ({
          requireOperator: async () => {},
          rollbackSkill: mutate,
          restoreBasicSkillDraft: mutate,
          recordCommand: mutate,
        }) as unknown as CombatContentAuthoringService,
    },
  )
  expect(response.status).toBe(400)
  expect(mutate).not.toHaveBeenCalled()
})

it('returns current editable content without rollback-only history in the public authoring response', async () => {
  const record = {
    contentKey: 'basic.guard',
    history: [{ definition: { name: 'old' } }],
    builtinRestoreVersion: 1,
    current: { definition: { name: 'Current' } },
  }
  const response = await handleCombatContentAuthoringRequest(
    new Request('https://example.test/api/master/combat-content', {
      method: 'POST',
      body: JSON.stringify({
        operation: 'record',
        command: { action: 'read', contentKey: 'basic.guard' },
      }),
    }),
    {
      getActor: async () => ({ userId: 'owner' }),
      createService: () =>
        ({
          requireOperator: async () => {},
          recordCommand: async () => ({ record }),
        }) as unknown as CombatContentAuthoringService,
    },
  )
  const result = await response.json()
  expect(result.record.history).toEqual([])
  expect(result.record.builtinRestoreVersion).toBeUndefined()
  expect(result.record.current.definition.name).toBe('Current')
  expect(record.history).toHaveLength(1)
})
