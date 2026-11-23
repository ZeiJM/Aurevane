import { expect, it } from 'vitest'
import { battleProposedCosts, proposedResourceSegment } from './battle-proposed-cost'
import type { BattlePreviewSkill } from './battle-preview-selection'

const descriptor: BattlePreviewSkill = {
  id: 'skill',
  behaviorId: 'cast',
  targetKind: 'unit',
  targetTeamPolicy: 'enemy',
  minimumRange: 0,
  maximumRange: 3,
  costs: [
    { resource: 'ap', amount: 47 },
    { resource: 'mp', amount: 3 },
    { resource: 'hp', amount: 2 },
  ],
}
function input(): Parameters<typeof battleProposedCosts>[0] {
  const intent = {
    kind: 'action' as const,
    actionId: 'skill',
    behaviorId: 'cast',
    target: { kind: 'unit' as const, combatantId: 'enemy' },
  }
  return {
    enabled: true,
    actorId: 'actor',
    battleSessionId: 'battle',
    battleVersion: 3,
    descriptor,
    allowCapturedCosts: true,
    pendingIntent: intent,
    preview: {
      battleSessionId: 'battle',
      battleVersion: 3,
      intent,
      preview: {
        kind: 'action',
        legal: true,
        actionId: 'skill',
        actorId: 'actor',
        primaryCombatantId: 'enemy',
        affectedTiles: [],
        affectedCombatantIds: ['enemy'],
        projectedEffects: [],
        projectedStatuses: [],
        issues: [],
        spendsAction: false,
        actionEconomyBefore: 100,
        actionEconomyAfter: 41,
        actionEconomyCost: 59,
        mpCost: 9,
        hpCost: 4,
        hitChanceBasisPoints: null,
        defenseKind: null,
        defenseRating: null,
        mitigatedBaseDamage: null,
        commandCosts: [
          { resource: 'ap', amount: 59 },
          { resource: 'mp', amount: 9 },
          { resource: 'hp', amount: 4 },
        ],
      },
    },
  }
}
it('prefers the exact composed quote and never adds Move or captured root costs again', () => {
  const value = input()
  const path = [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ]
  const modifiers = [{ sourceInstanceId: 'modifier', behaviorId: 'add' }]
  value.descriptor = {
    ...descriptor,
    move: { maximumTiles: 3, conditional: false },
    movementPath: path,
    manualModifiers: modifiers,
  }
  value.pendingIntent = {
    ...value.pendingIntent!,
    movementPath: path,
    manualModifiers: modifiers,
  } as typeof value.pendingIntent
  value.preview!.intent = value.pendingIntent!
  expect(battleProposedCosts(value)).toEqual({ actorId: 'actor', ap: 59, mp: 9, hp: 4 })
  expect(battleProposedCosts({ ...value, preview: null })).toBeNull()
  expect(
    battleProposedCosts({
      ...value,
      preview: null,
      descriptor: { ...value.descriptor, manualModifiers: [] },
    }),
  ).toEqual({ actorId: 'actor', ap: 47, mp: 3, hp: 2 })
})
it.each([
  'session',
  'version',
  'actor',
  'action',
  'behavior',
  'path',
  'modifier',
  'target',
  'disabled',
  'unavailable',
])('hides stale or mismatched %s proposals', (kind) => {
  const value = input()
  if (kind === 'session') value.battleSessionId = 'other'
  if (kind === 'version') value.battleVersion++
  if (kind === 'actor') value.actorId = 'other'
  if (kind === 'action') value.descriptor = { ...descriptor, id: 'other' }
  if (kind === 'behavior') value.descriptor = { ...descriptor, behaviorId: 'other' }
  if (kind === 'path') value.descriptor = { ...descriptor, movementPath: [{ x: 2, y: 1 }] }
  if (kind === 'modifier')
    value.descriptor = {
      ...descriptor,
      manualModifiers: [{ sourceInstanceId: 'other', behaviorId: 'other' }],
    }
  if (kind === 'target')
    value.pendingIntent = { kind: 'action', actionId: 'skill', target: { kind: 'self' } }
  if (kind === 'disabled') value.enabled = false
  if (kind === 'unavailable') value.descriptor = { ...descriptor, unavailable: true }
  expect(battleProposedCosts(value)).toBeNull()
})
it('uses authoritative legacy evaluated costs when no command quote is captured', () => {
  const value = input()
  if (value.preview!.preview.kind !== 'action') throw new Error('fixture')
  delete value.preview!.preview.commandCosts
  expect(battleProposedCosts(value)).toEqual({ actorId: 'actor', ap: 59, mp: 9, hp: 4 })
})
it('does not propose a payment for free Controlled priming or paid Reversal cancellation', () => {
  for (const controlled of [
    { phase: 'unprimed' as const, canPrime: true, canCancel: false },
    { kind: 'reversal' as const, phase: 'primed' as const, canPrime: false, canCancel: true },
  ])
    expect(
      battleProposedCosts({ ...input(), preview: null, descriptor: { ...descriptor, controlled } }),
    ).toBeNull()
})
it('does not mistake a future release quote for a free Controlled preparation payment', () => {
  expect(
    battleProposedCosts({
      ...input(),
      descriptor: {
        ...descriptor,
        controlled: { phase: 'unprimed', canPrime: true, canCancel: false, requiresTarget: true },
      },
    }),
  ).toBeNull()
})
it.each([0, -1, NaN, Infinity])('ignores invalid or nonpositive spending %s', (amount) => {
  expect(proposedResourceSegment(30, 80, amount)).toBeNull()
  expect(
    battleProposedCosts({
      ...input(),
      preview: null,
      descriptor: { ...descriptor, costs: [{ resource: 'mp', amount }] },
    }),
  ).toEqual({ actorId: 'actor', ap: 0, mp: 0, hp: 0 })
})
it('bounds unavailable resources and zero maximums without including Barrier', () => {
  expect(proposedResourceSegment(35, 80, 999)).toEqual({ left: 0, width: 43.75 })
  expect(proposedResourceSegment(0, 0, 3)).toBeNull()
  expect(proposedResourceSegment(-1, 80, 3)).toBeNull()
})
