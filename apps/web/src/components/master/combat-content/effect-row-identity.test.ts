import { expect, it } from 'vitest'
import { reconcileEffectRowIdentity } from './effect-row-identity'
it('preserves distinct repeated-tag rows through reorder, editing, removal and append', () => {
  const a = { type: 'damage', amount: 1 },
    b = { type: 'damage', amount: 2 }
  let state = { value: [a, b], keys: [0, 1], next: 2 }
  state = reconcileEffectRowIdentity(state, [b, a]) as typeof state
  expect(state.keys).toEqual([1, 0])
  state = reconcileEffectRowIdentity(state, [{ ...b, amount: 4 }, a]) as typeof state
  expect(state.keys).toEqual([1, 0])
  state = reconcileEffectRowIdentity(state, [a]) as typeof state
  expect(state.keys).toEqual([0])
  expect(reconcileEffectRowIdentity(state, [a, a]).keys).toEqual([0, 2])
})
