import { expect, it } from 'vitest'
import type { CompleteCombatContentRecord } from '@aurevane/db/combat-content'
import { editableDefinition, savedPublicationCommand } from './content-record-workflow'
it('the current editor and its preview omit retired accuracy without mutating a saved snapshot', () => {
  const definition = {
    id: 'skill.test',
    name: 'Test',
    accuracyMode: 'per-target',
    accuracyModifierBasisPoints: 750,
    effects: [{ type: 'apply-status', statusId: 'blindside' }],
  }
  const record = {
    contentKind: 'skill',
    current: { definition },
  } as unknown as CompleteCombatContentRecord
  expect(editableDefinition(record)).toEqual({
    id: 'skill.test',
    name: 'Test',
    accuracyMode: 'per-target',
    effects: definition.effects,
  })
  expect(record.current!.definition.accuracyModifierBasisPoints).toBe(750)
})
it('publishes only the exact saved revision and base, never a replacement definition', () => {
  const definition = { id: 'basic.guard', name: 'Changed Guard' }
  const record = {
    contentKey: 'basic.guard',
    draft: { definition, draftVersion: 8, baseVersion: 4 },
  } as unknown as CompleteCombatContentRecord
  expect(savedPublicationCommand(record, definition)).toEqual({
    action: 'publish',
    contentKey: 'basic.guard',
    expectedDraftVersion: 8,
    expectedBaseVersion: 4,
  })
  expect(() => savedPublicationCommand(record, { ...definition, name: 'Unsaved Guard' })).toThrow(
    'Save your complete changes',
  )
  expect(() => savedPublicationCommand({ ...record, draft: null }, definition)).toThrow(
    'Save your complete changes',
  )
})
