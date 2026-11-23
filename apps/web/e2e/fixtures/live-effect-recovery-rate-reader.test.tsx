import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { percentageDotEncounter } from '../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import { healingDownAdjustedRecovery } from '../../../../packages/game-core/src/combat/combat-recovery-modifiers'
import {
  executeCombatAction,
  endCombatTurn,
  type CombatActionDefinition,
  type CombatEncounterState,
  type CombatContentCatalog,
} from '@aurevane/game-core/combat/actions'
import { selectCurrentFinalFacing } from '@aurevane/game-core/combat/board'
import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  BattleEffectInformation,
  battleEffectInformation,
} from '@/components/battle/battle-effect-information'
vi.mock('server-only', () => ({}))
import { projectBattleStatusStateForViewer } from '@/server/battle/battle-live-viewer-projection'
import { createSpectatorBattleViewerEntitlement } from '@/server/battle/battle-viewer-entitlement'
const action: CombatActionDefinition = {
  id: 'test.live-recovery-rate',
  version: 1,
  sourceType: 'test',
  tags: [],
  cost: { spendsAction: false, mp: 0 },
  requirements: [],
  target: {
    kind: 'self',
    teamPolicy: 'self',
    shape: { kind: 'single' },
    minimumRange: 0,
    maximumRange: 0,
    requiresLineOfSight: false,
    maximumElevationDifference: null,
    friendlyFire: 'allies-only',
  },
  effects: [],
}
function encounter(current = true, recoveryPolicy = true): CombatEncounterState {
  const state: CombatEncounterState = {
    ...percentageDotEncounter(),
    ...(recoveryPolicy ? { healingDownPolicyVersion: 1 as const } : {}),
  }
  if (!current) delete state.effectStackingPolicyVersion
  const actor = state.tactical.battle.combatants.find((r) => r.id === 'actor')!
  actor.hp = 100
  actor.mp = 0
  actor.maxMp = 1000
  return state
}
function cast(
  state: CombatEncounterState,
  effects: CombatActionDefinition['effects'],
  content: CombatContentCatalog = PV1F_COMBAT_CONTENT,
) {
  return executeCombatAction(state, { ...action, effects }, { kind: 'self' }, content).state
}
function hex(state: CombatEncounterState, potencyBasisPoints?: number, stacks = 1) {
  return cast(state, [
    {
      type: 'apply-status',
      recipient: 'actor',
      statusId: 'hexed',
      stacks,
      durationTurns: 2,
      ...(potencyBasisPoints === undefined ? {} : { potencyBasisPoints }),
    },
  ])
}
function row(state: CombatEncounterState, statusId = 'hexed') {
  return projectBattleStatusStateForViewer(state, createSpectatorBattleViewerEntitlement())
    .find((r) => r.combatantId === 'actor')!
    .statuses.find((r) => r.statusId === statusId)!
}
function texts(effect: ReturnType<typeof row>) {
  return [
    battleEffectInformation(effect).explanation,
    renderToStaticMarkup(<BattleEffectInformation effect={effect} />),
  ]
}
function end(state: CombatEncounterState, content: CombatContentCatalog = PV1F_COMBAT_CONTENT) {
  return endCombatTurn(
    { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
    content,
  ).state
}
const policies = [true, false].flatMap((current) =>
  [true, false].map((recoveryPolicy) => ({ current, recoveryPolicy })),
)
it.each(
  policies.flatMap((policy) => [
    {
      ...policy,
      potencies: [undefined, undefined],
      rate: policy.current ? '56.25%' : '75%',
      native: policy.current ? 5625n : 7500n,
    },
    {
      ...policy,
      potencies: [undefined, 2000],
      rate: policy.current ? '60%' : '80%',
      native: policy.current ? 6000n : 8000n,
    },
  ]),
)(
  'preserves captured Healing Down stacking and HP/MP policy current=$current recoveryPolicy=$recoveryPolicy rate=$rate',
  ({ current, recoveryPolicy, potencies, rate, native }) => {
    let state = encounter(current, recoveryPolicy)
    for (const potency of potencies) state = hex(state, potency)
    expect(healingDownAdjustedRecovery(state, 'actor', 10_000n, PV1F_COMBAT_CONTENT)).toBe(native)
    const before = structuredClone(state)
    const effect = row(state)
    const report = battleEffectInformation(effect)
    expect(report.amounts.rows).toContainEqual({
      label: 'HP recovery from this effect',
      magnitude: rate + ' before rounding',
    })
    expect(report.amounts.rows).toContainEqual({
      label: 'MP recovery from this effect',
      magnitude: (recoveryPolicy ? rate : '100%') + ' before rounding',
    })
    for (const text of texts(effect)) {
      expect(text).toContain('HP recovery from this effect')
      expect(text).toContain('MP recovery from this effect')
      expect(text).toContain(rate + ' before rounding')
      expect(text).toContain((recoveryPolicy ? rate : '100%') + ' before rounding')
      expect(text).toContain('rounded down after each applied modifier')
      expect(text).toContain('Previously captured percentage recovery keeps its recorded amount')
      if (!recoveryPolicy)
        expect(text).toContain('Historical rules do not reduce MP recovery or Absorb')
    }
    expect(renderToStaticMarkup(<BattleEffectInformation effect={effect} />)).toContain(
      'data-compact-effect-magnitude="true"',
    )
    expect(state).toEqual(before)
  },
)
it.each(policies.flatMap((p) => ['hp', 'mp'].map((resource) => ({ ...p, resource }))))(
  'distinguishes nominal rate from actual small $resource recovery current=$current recoveryPolicy=$recoveryPolicy',
  ({ current, recoveryPolicy, resource }) => {
    let state = hex(hex(encounter(current, recoveryPolicy)))
    const before = row(state)
    state = cast(state, [
      resource === 'hp'
        ? { type: 'healing', recipient: 'actor', amount: 9 }
        : { type: 'resource-change', recipient: 'actor', resource: 'mp', delta: 9 },
    ])
    const restored = resource === 'mp' && !recoveryPolicy ? 9 : current ? 4 : 6
    const actor = state.tactical.battle.combatants.find((r) => r.id === 'actor')!
    expect(resource === 'hp' ? actor.hp - 100 : actor.mp).toBe(restored)
    expect(battleEffectInformation(before).amounts.rows).toContainEqual({
      label: `${resource.toUpperCase()} recovery from this effect`,
      magnitude:
        (resource === 'mp' && !recoveryPolicy ? '100%' : current ? '56.25%' : '75%') +
        ' before rounding',
    })
  },
)
it.each(
  [true, false].flatMap((recoveryPolicy) =>
    ['hp', 'mp'].map((resource) => ({ recoveryPolicy, resource })),
  ),
)(
  'does not reapply later Healing Down to captured $resource recovery recoveryPolicy=$recoveryPolicy',
  ({ recoveryPolicy, resource }) => {
    let state = hex(hex(encounter(true, recoveryPolicy)))
    state = cast(state, [
      {
        type: 'percentage-recovery',
        recipient: 'actor',
        resource: resource as 'hp' | 'mp',
        percent: 10,
        ticks: 3,
      },
    ])
    const amount = resource === 'mp' && !recoveryPolicy ? 100 : 56
    expect(row(state, resource === 'hp' ? 'healing' : 'mp-recovery').recovery).toMatchObject({
      capture: { amountPerApplication: amount },
    })
    state = cast(state, [{ type: 'remove-status', recipient: 'actor', statusIds: ['hexed'] }])
    state = hex(state, 5000)
    const initial = state.tactical.battle.combatants.find((r) => r.id === 'actor')![
      resource as 'hp' | 'mp'
    ]
    for (let i = 0; i < 5; i++) state = end(state)
    expect(
      state.tactical.battle.combatants.find((r) => r.id === 'actor')![resource as 'hp' | 'mp'] -
        initial,
    ).toBe(amount)
    for (const text of texts(row(state)))
      expect(text).toContain('Previously captured percentage recovery keeps its recorded amount')
  },
)
it.each(policies)(
  'labels pending recovery modifiers on activation current=$current recoveryPolicy=$recoveryPolicy',
  ({ current, recoveryPolicy }) => {
    const base = encounter(current, recoveryPolicy)
    base.effectTimingPolicy = { version: 1, modes: { hexed: 'next-round' } }
    const state = hex(base)
    const effect = row(state)
    expect(effect.timingState).toBe('pending')
    expect(healingDownAdjustedRecovery(state, 'actor', 100n, PV1F_COMBAT_CONTENT)).toBe(100n)
    const report = battleEffectInformation(effect)
    expect(report.amounts.rows).toContainEqual({
      label: 'HP recovery on activation',
      magnitude: '75% before rounding',
    })
    expect(report.amounts.rows.some((r) => r.label === 'HP recovery from this effect')).toBe(false)
  },
)
it('marks an inexact nominal rate instead of borrowing per-step rounded recovery', () => {
  const state = hex(hex(encounter(), 3333), 3333)
  expect(healingDownAdjustedRecovery(state, 'actor', 10_000n, PV1F_COMBAT_CONTENT)).toBe(4444n)
  expect(battleEffectInformation(row(state)).amounts.rows).toContainEqual({
    label: 'HP recovery from this effect',
    magnitude: '≈44.45% before rounding',
  })
})
it('does not call a positive nominal rate zero when it is below the displayed precision', () => {
  const state = hex(encounter(), 2500, 100)
  expect(healingDownAdjustedRecovery(state, 'actor', 100n, PV1F_COMBAT_CONTENT)).toBe(0n)
  expect(battleEffectInformation(row(state)).amounts.rows).toContainEqual({
    label: 'HP recovery from this effect',
    magnitude: '<0.01% before rounding',
  })
})
it('bounds exact nominal arithmetic for a very large valid captured stack count', () => {
  const state = hex(encounter(), 2500, 1_000_000)
  expect(healingDownAdjustedRecovery(state, 'actor', 100n, PV1F_COMBAT_CONTENT)).toBe(0n)
  const report = battleEffectInformation(row(state))
  expect(report.amounts.rows).toContainEqual({
    label: 'HP recovery from this effect',
    magnitude: 'Unavailable',
  })
  expect(report.explanation).toContain('Combined recovery multiplier unavailable')
})
it('does not borrow current recovery rules for an unsupported captured version', () => {
  const state = hex(encounter())
  const effect = { ...row(state), statusVersion: 99 }
  for (const text of texts(effect)) {
    expect(text).toContain('Captured effect rules unavailable')
    expect(text).not.toContain('before rounding')
  }
})
it('retains Covert privacy for recovery modifier facts', () => {
  const base = encounter()
  base.effectTimingPolicy = {
    version: 1,
    modes: { hexed: 'instant', covert: 'instant', inspired: 'instant' },
  }
  const state = cast(hex(hex(base)), [
    { type: 'apply-status', recipient: 'actor', statusId: 'inspired', stacks: 1 },
    { type: 'apply-status', recipient: 'actor', statusId: 'covert', stacks: 1 },
  ])
  expect(row(state, 'inspired')).toBeUndefined()
  expect(row(state).statusId).toBe('hexed')
  expect(battleEffectInformation(row(state)).amounts.rows).toContainEqual({
    label: 'HP recovery from this effect',
    magnitude: '56.25% before rounding',
  })
})
it('does not apply recovery reductions to native MP Drain', () => {
  const state = cast(hex(hex(encounter())), [
    { type: 'resource-change', recipient: 'actor', resource: 'mp', delta: 40 },
  ])
  const result = cast(state, [
    { type: 'resource-change', recipient: 'actor', resource: 'mp', delta: -9 },
  ])
  expect(result.tactical.battle.combatants.find((r) => r.id === 'actor')!.mp).toBe(13)
  expect(battleEffectInformation(row(result)).explanation).toContain(
    'rounded down after each applied modifier',
  )
})
it.each(['hp', 'mp'])(
  'keeps actual $resource restoration bounded by missing resource',
  (resource) => {
    const state = hex(hex(encounter()))
    const actor = state.tactical.battle.combatants.find((r) => r.id === 'actor')!
    actor[resource as 'hp' | 'mp'] = 995
    const result = cast(state, [
      resource === 'hp'
        ? { type: 'healing', recipient: 'actor', amount: 100 }
        : { type: 'resource-change', recipient: 'actor', resource: 'mp', delta: 100 },
    ])
    expect(
      result.tactical.battle.combatants.find((r) => r.id === 'actor')![resource as 'hp' | 'mp'],
    ).toBe(1000)
    for (const text of texts(row(result)))
      expect(text).toContain('Actual recovery is capped by missing HP or MP')
  },
)
it.each([true, false])('retains native Absorb handling recoveryPolicy=%s', (recoveryPolicy) => {
  const content: CombatContentCatalog = {
    ...PV1F_COMBAT_CONTENT,
    statuses: [
      ...PV1F_COMBAT_CONTENT.statuses,
      {
        id: 'test.absorb-both',
        version: 1,
        maximumStacks: 1,
        durationOwnerTurnStarts: 2,
        damageTakenMultiplierBasisPoints: 10_000,
        polarity: 'positive',
        reactionClass: 'reactive',
        absorbHpBasisPoints: 2500,
        absorbMpBasisPoints: 2500,
      },
    ],
  }
  let state = hex(hex(encounter(true, recoveryPolicy)))
  state = cast(
    state,
    [{ type: 'apply-status', recipient: 'actor', statusId: 'test.absorb-both', stacks: 1 }],
    content,
  )
  state.tactical.battle.combatants.find((r) => r.id === 'actor')!.hp = 500
  state = end(state, content)
  const hit = executeCombatAction(
    state,
    {
      ...action,
      tags: ['attack'],
      target: {
        ...action.target,
        kind: 'unit',
        teamPolicy: 'enemy',
        maximumRange: 5,
        friendlyFire: 'enemies-only',
      },
      effects: [{ type: 'damage', recipient: 'primary-unit', amount: 100 }],
    },
    { kind: 'unit', combatantId: 'actor' },
    content,
  )
  const actor = hit.state.tactical.battle.combatants.find((r) => r.id === 'actor')!
  expect(actor.hp).toBe(recoveryPolicy ? 413 : 425)
  expect(actor.mp).toBe(recoveryPolicy ? 13 : 25)
  const report = battleEffectInformation(row(hit.state))
  expect(report.amounts.rows).toContainEqual({
    label: 'MP recovery from this effect',
    magnitude: (recoveryPolicy ? '56.25%' : '100%') + ' before rounding',
  })
})
