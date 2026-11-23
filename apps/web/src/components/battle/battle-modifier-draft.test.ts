import { expect, it } from 'vitest'
import {
  prepareBattleModifierDraft,
  toggleBattleModifierDraft,
  resolveBattleModifierDraft,
  type BattleModifierContext,
  type BattleModifierPinnedSelection,
} from './battle-modifier-draft'

const context: BattleModifierContext = {
  battleSessionId: 'battle',
  battleVersion: 4,
  actorId: 'actor',
  actionId: 'strike',
  behaviorId: 'hit',
  rootContentVersion: 7,
  rootFingerprint: 'root-v7',
}
const a: BattleModifierPinnedSelection = {
  sourceInstanceId: 'a',
  abilityId: 'bonus',
  contentVersion: 3,
  behaviorId: 'extra',
  fingerprint: 'bonus-v3',
}
const b: BattleModifierPinnedSelection = { ...a, sourceInstanceId: 'b' }
const draft = () =>
  toggleBattleModifierDraft(toggleBattleModifierDraft(prepareBattleModifierDraft(context), b), a)
it('retains one normalized set for the same root without mutating inputs', () => {
  const selected = draft()
  const before = JSON.stringify(selected)
  expect(resolveBattleModifierDraft(selected, { ...context }, [a, b], undefined)).toEqual({
    manualModifiers: [
      { sourceInstanceId: 'a', behaviorId: 'extra' },
      { sourceInstanceId: 'b', behaviorId: 'extra' },
    ],
    stale: false,
    locked: false,
  })
  expect(toggleBattleModifierDraft(selected, a).selected).toEqual([b])
  expect(JSON.stringify(selected)).toBe(before)
})
it.each([
  { actionId: 'other' },
  { behaviorId: 'other' },
  { actorId: 'other' },
  { battleVersion: 5 },
  { battleSessionId: 'other' },
  { rootContentVersion: 8 },
  { rootFingerprint: 'changed' },
])('immediately rejects changed context %j before any effect cleanup', (change) => {
  expect(
    resolveBattleModifierDraft(draft(), { ...context, ...change }, [a, b], undefined).stale,
  ).toBe(true)
})
it.each([{ contentVersion: 4 }, { abilityId: 'other' }, { fingerprint: 'changed' }])(
  'retains and blocks a changed same-version selection %j instead of becoming a plain cast',
  (change) => {
    const result = resolveBattleModifierDraft(draft(), context, [{ ...a, ...change }, b], undefined)
    expect(result.stale).toBe(true)
    expect(result.manualModifiers).toHaveLength(2)
    expect(resolveBattleModifierDraft(draft(), context, [b], undefined).stale).toBe(true)
  },
)
it('takes an authoritative empty or nonempty prime exclusively, including after reconnect/version change', () => {
  const primed = { phase: 'primed' as const, canPrime: false, canCancel: true }
  expect(resolveBattleModifierDraft(draft(), { ...context, battleVersion: 5 }, [], primed)).toEqual(
    { manualModifiers: [], stale: false, locked: true },
  )
  expect(
    resolveBattleModifierDraft(null, { ...context, battleVersion: 5 }, [], {
      ...primed,
      manualModifiers: [{ sourceInstanceId: 'locked', behaviorId: 'captured' }],
    }),
  ).toEqual({
    manualModifiers: [{ sourceInstanceId: 'locked', behaviorId: 'captured' }],
    stale: false,
    locked: true,
  })
})
