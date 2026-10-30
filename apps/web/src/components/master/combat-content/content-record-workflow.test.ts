import { expect, it } from 'vitest'
import type { CompleteCombatContentRecord } from '@aurevane/db/combat-content'
import {
  editableDefinition,
  savedPublicationCommand,
  recordIsDirty,
} from './content-record-workflow'
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

it('requires an explicit save of automatic Damage settings before publishing an older draft', () => {
  const definition = {
    id: 'skill.damage',
    name: 'Damage',
    effects: [
      {
        type: 'damage',
        recipient: 'primary-unit',
        amount: 7,
        defenseKind: 'ward',
        scaling: { source: 'mystic-power', coefficientBasisPoints: 19999 },
      },
    ],
  }
  const record = {
    contentKind: 'skill',
    contentKey: definition.id,
    draft: { definition, draftVersion: 8, baseVersion: 4 },
  } as unknown as CompleteCombatContentRecord
  const editable = editableDefinition(record)!
  expect(recordIsDirty(record, editable)).toBe(true)
  expect(() => savedPublicationCommand(record, editable)).toThrow('Save your complete changes')
  const saved = { ...record, draft: { ...record.draft!, definition: editable } }
  expect(recordIsDirty(saved, editable)).toBe(false)
  expect(savedPublicationCommand(saved, editable)).toMatchObject({ action: 'publish' })
  expect(definition.effects[0]!.scaling.coefficientBasisPoints).toBe(19999)
})
