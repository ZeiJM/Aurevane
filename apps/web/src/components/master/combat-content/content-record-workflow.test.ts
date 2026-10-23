import { expect, it } from 'vitest'
import type { CompleteCombatContentRecord } from '@aurevane/db/combat-content'
import { savedPublicationCommand } from './content-record-workflow'
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
