import { expect, it } from 'vitest'
import type { WorldView } from './types'
import { mergeWorldAttackReceipt } from './attack-receipt'
it('merges only committed encounter identity into the latest owned receipt', () => {
  const view = {
    characterId: 'owner',
    version: 3,
    serverNow: 1500,
    route: [],
  } as unknown as WorldView
  const next = mergeWorldAttackReceipt(
    view,
    { characterId: 'owner', battleSessionId: 'battle' },
    'owner',
  )
  expect(next).toEqual({ ...view, battleSessionId: 'battle' })
  expect(next.route).toBe(view.route)
})
it('rejects a changed character or invalid committed encounter identity', () => {
  const view = { characterId: 'owner', version: 3 } as WorldView
  expect(() =>
    mergeWorldAttackReceipt(view, { characterId: 'other', battleSessionId: 'battle' }, 'owner'),
  ).toThrow()
  expect(() =>
    mergeWorldAttackReceipt(
      { ...view, characterId: 'other' },
      { characterId: 'owner', battleSessionId: 'battle' },
      'owner',
    ),
  ).toThrow()
  expect(() =>
    mergeWorldAttackReceipt(view, { characterId: 'owner', battleSessionId: ' ' }, 'owner'),
  ).toThrow()
})
