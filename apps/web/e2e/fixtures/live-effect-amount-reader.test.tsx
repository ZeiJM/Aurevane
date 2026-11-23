import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { percentageDotEncounter } from '../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import {
  executeCombatAction,
  endCombatTurn,
  type CombatActionDefinition,
  type CombatEncounterState,
} from '@aurevane/game-core/combat/actions'
import { selectCurrentFinalFacing } from '@aurevane/game-core/combat/board'
import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-action-economy'
import { BattleCombatantEffects } from '@/components/battle/battle-combatant-effects'
import {
  BattleEffectInformation,
  battleEffectInformation,
} from '@/components/battle/battle-effect-information'
import { aggregateBattleStatusStacks } from '@/components/battle/battle-effect-summary'
vi.mock('server-only', () => ({}))
import { projectBattleStatusStateForViewer } from '@/server/battle/battle-live-viewer-projection'
import { createSpectatorBattleViewerEntitlement } from '@/server/battle/battle-viewer-entitlement'

const action: CombatActionDefinition = {
  id: 'test.live-amount',
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
function encounter(pending = false): CombatEncounterState {
  const state = {
    ...percentageDotEncounter(),
    healingDownPolicyVersion: 1 as const,
    effectTimingPolicy: {
      version: 1,
      modes: {
        healing: pending ? ('next-round' as const) : ('instant' as const),
        'mp-recovery': pending ? ('next-round' as const) : ('instant' as const),
        'barrier-change': pending ? ('next-round' as const) : ('instant' as const),
      },
    },
  }
  const actor = state.tactical.battle.combatants.find((row) => row.id === 'actor')!
  actor.hp = 100
  actor.mp = 0
  actor.maxMp = 200
  state.statusState = state.statusState.map((row) =>
    row.combatantId === 'actor'
      ? {
          ...row,
          statuses: [
            {
              statusId: 'hexed',
              statusVersion: 1,
              stacks: 1,
              potencyBasisPoints: 2500,
              remainingOwnerTurnStarts: 3,
              sourceCombatantId: 'enemy',
            },
          ],
        }
      : row,
  )
  return state
}
function cast(state: CombatEncounterState, effects: CombatActionDefinition['effects']) {
  return executeCombatAction(state, { ...action, effects }, { kind: 'self' }, PV1F_COMBAT_CONTENT)
    .state
}
function rows(state: CombatEncounterState, id = 'actor') {
  return projectBattleStatusStateForViewer(state, createSpectatorBattleViewerEntitlement()).find(
    (row) => row.combatantId === id,
  )!.statuses
}
function visible(effect: ReturnType<typeof rows>[number]) {
  return renderToStaticMarkup(<BattleEffectInformation effect={effect} />)
}

it.each(
  (['hp', 'mp'] as const).flatMap((resource) =>
    [false, true].map((pending) => ({ resource, pending })),
  ),
)(
  'exposes the exact native $resource recovery capture, pending=$pending, without recomputing current values',
  ({ resource, pending }) => {
    const state = cast(encounter(pending), [
      { type: 'percentage-recovery', recipient: 'actor', resource, percent: 10, ticks: 3 },
    ])
    const amount = resource === 'hp' ? 75 : 15
    const maximum = resource === 'hp' ? 1000 : 200
    const actor = state.tactical.battle.combatants.find((row) => row.id === 'actor')!
    actor.maxHp = 2000
    actor.maxMp = 400
    state.statusState = state.statusState.map((row) => ({ ...row, statuses: [] }))
    const before = structuredClone(state)
    const effect = rows(state).find(
      (row) => row.statusId === (resource === 'hp' ? 'healing' : 'mp-recovery'),
    )!
    expect(effect).toMatchObject({
      recovery: {
        basis: 'percentage',
        resource,
        percent: 10,
        capture: { maximumAtCast: maximum, amountPerApplication: amount },
      },
      recoveryApplications: pending ? 3 : 2,
    })
    const report = battleEffectInformation(effect)
    for (const text of [visible(effect), report.explanation]) {
      expect(text).toContain(`${amount} ${resource.toUpperCase()}`)
      expect(text).toContain(`10% of ${maximum} maximum ${resource.toUpperCase()}`)
    }
    expect(report.explanation).not.toContain('2000 maximum HP')
    expect(visible(effect)).toContain('data-compact-effect-magnitude="true"')
    expect(state).toEqual(before)
  },
)

it.each(
  (['hp', 'mp'] as const).flatMap((resource) =>
    [false, true].map((pending) => ({ resource, pending })),
  ),
)(
  'distinguishes the native $resource flat base from modified recovery, pending=$pending',
  ({ resource, pending }) => {
    const state = cast(encounter(pending), [
      resource === 'hp'
        ? { type: 'healing', recipient: 'actor', amount: 40, ticks: 3 }
        : { type: 'resource-change', recipient: 'actor', resource: 'mp', delta: 40, ticks: 3 },
    ])
    if (!pending)
      expect(state.tactical.battle.combatants.find((row) => row.id === 'actor')![resource]).toBe(
        resource === 'hp' ? 130 : 30,
      )
    const effect = rows(state).find(
      (row) => row.statusId === (resource === 'hp' ? 'healing' : 'mp-recovery'),
    )!
    const text = battleEffectInformation(effect).explanation
    expect(text).toContain(
      `Base ${resource.toUpperCase()} recovery per application: 40 ${resource.toUpperCase()}`,
    )
    expect(text).toContain('applicable recovery modifiers')
    expect(effect).toMatchObject({ recoveryApplications: pending ? 3 : 2 })
    if (!pending) expect(text).toContain('Skips the current affected-turn end')
  },
)

it('retains a legitimate zero captured MP amount instead of calling it unavailable', () => {
  const base = encounter(true)
  base.tactical.battle.combatants.find((row) => row.id === 'actor')!.maxMp = 0
  const state = cast(base, [
    { type: 'percentage-recovery', recipient: 'actor', resource: 'mp', percent: 10, ticks: 2 },
  ])
  const effect = rows(state).find((row) => row.statusId === 'mp-recovery')!
  const text = battleEffectInformation(effect).explanation
  expect(text).toContain('Captured MP recovery per application: 0 MP')
  expect(text).not.toContain('amount unavailable')
})

it.each([false, true])(
  'shows the recorded Barrier grant pending=%s without substituting the combatant total',
  (pending) => {
    const state = cast(encounter(pending), [
      { type: 'barrier-change', recipient: 'actor', amount: 35 },
    ])
    const effect = rows(state).find((row) => row.statusId === 'barrier')!
    expect(effect).toMatchObject({ barrier: { kind: pending ? 'grant' : 'remaining', amount: 35 } })
    const text = battleEffectInformation(effect).explanation
    expect(text).toContain(
      pending ? 'Barrier gain on activation: 35 HP' : 'Barrier remaining: 35 HP',
    )
    expect(visible(effect)).toContain('data-compact-effect-magnitude="true">[35 HP]')
  },
)

it('shows a historical pending Barrier grant as capped, without inventing its future available pool', () => {
  const base = encounter(true)
  delete base.effectStackingPolicyVersion
  const state = cast(base, [{ type: 'barrier-change', recipient: 'actor', amount: 35 }])
  const text = battleEffectInformation(
    rows(state).find((row) => row.statusId === 'barrier')!,
  ).explanation
  expect(text).toContain('up to 35 HP')
  expect(text).toContain('maximum HP cap')
})

it('preserves unlike Barrier instances and their actual partial depletion', () => {
  let state = cast(encounter(), [{ type: 'barrier-change', recipient: 'actor', amount: 35 }])
  state = cast(state, [{ type: 'barrier-change', recipient: 'actor', amount: 12 }])
  state = endCombatTurn(
    { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
    PV1F_COMBAT_CONTENT,
  ).state
  state = executeCombatAction(
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
      effects: [{ type: 'damage', recipient: 'primary-unit', amount: 18 }],
    },
    { kind: 'unit', combatantId: 'actor' },
    PV1F_COMBAT_CONTENT,
  ).state
  expect(state.effectState!.barriers!.map((row) => row.amount)).toEqual([17, 12])
  const before = structuredClone(state)
  const effects = aggregateBattleStatusStacks(
    rows(state).filter((row) => row.statusId === 'barrier'),
  )
  expect(effects).toHaveLength(2)
  const html = renderToStaticMarkup(<BattleCombatantEffects name="Archer" statuses={effects} />)
  expect(html).toContain('17 HP')
  expect(html).toContain('12 HP')
  expect(state).toEqual(before)
})

it('keeps recipient-specific pending captures bound to their actual recipient', () => {
  const base = encounter(true)
  base.tactical.battle.combatants.find((row) => row.id === 'ally')!.maxHp = 500
  base.tactical.battle.combatants.find((row) => row.id === 'ally')!.hp = 100
  const state = executeCombatAction(
    base,
    {
      ...action,
      target: {
        ...action.target,
        geometryVersion: 2,
        kind: 'unit',
        teamPolicy: 'ally',
        shape: { kind: 'all' },
      },
      effects: [
        {
          type: 'percentage-recovery',
          recipient: 'affected-units',
          resource: 'hp',
          percent: 10,
          ticks: 3,
        },
      ],
    },
    { kind: 'activate' },
    PV1F_COMBAT_CONTENT,
  ).state
  const actor = battleEffectInformation(
    rows(state).find((row) => row.statusId === 'healing')!,
  ).explanation
  const ally = battleEffectInformation(
    rows(state, 'ally').find((row) => row.statusId === 'healing')!,
  ).explanation
  expect(actor).toContain('75 HP')
  expect(actor).toContain('1000 maximum HP')
  expect(ally).toContain('50 HP')
  expect(ally).toContain('500 maximum HP')
})

it('keeps an omitted historical percentage capture unavailable instead of using the current maximum', () => {
  const state = cast(encounter(true), [
    { type: 'percentage-recovery', recipient: 'actor', resource: 'hp', percent: 10, ticks: 3 },
  ])
  delete state.pendingEffects![0]!.percentageRecoveryByRecipient
  const text = battleEffectInformation(
    rows(state).find((row) => row.statusId === 'healing')!,
  ).explanation
  expect(text).toContain('10%')
  expect(text).toContain('Captured recovery amount unavailable')
  expect(text).not.toContain('75 HP')
  expect(text).not.toContain('100 HP')
})

it('does not borrow amount rules for an unsupported captured effect version', () => {
  const state = cast(encounter(), [{ type: 'barrier-change', recipient: 'actor', amount: 35 }])
  const effect = { ...rows(state).find((row) => row.statusId === 'barrier')!, statusVersion: 99 }
  const text = battleEffectInformation(effect).explanation
  expect(text).toContain('Captured effect rules unavailable')
  expect(text).not.toContain('35 HP')
})

it('continues to hide positive recovery and Barrier details under Covert for a spectator', () => {
  const base = encounter()
  base.effectTimingPolicy = {
    version: 1,
    modes: { healing: 'instant', 'barrier-change': 'instant', covert: 'instant' },
  }
  const state = cast(base, [
    { type: 'percentage-recovery', recipient: 'actor', resource: 'hp', percent: 10, ticks: 3 },
    { type: 'barrier-change', recipient: 'actor', amount: 35 },
    { type: 'apply-status', recipient: 'actor', statusId: 'covert', stacks: 1 },
  ])
  expect(rows(state).some((row) => ['healing', 'barrier'].includes(row.statusId))).toBe(false)
})

it('shows total and per-stack remaining Barrier for equal grouped pools', () => {
  let state = cast(encounter(), [{ type: 'barrier-change', recipient: 'actor', amount: 35 }])
  state = cast(state, [{ type: 'barrier-change', recipient: 'actor', amount: 35 }])
  const effects = aggregateBattleStatusStacks(
    rows(state).filter((row) => row.statusId === 'barrier'),
  )
  expect(effects).toHaveLength(1)
  expect(effects[0]!.stacks).toBe(2)
  const text = battleEffectInformation(effects[0]!).explanation
  expect(text).toContain('70 HP total')
  expect(text).toContain('35 HP per stack')
})

it.each([10, 20])(
  'preserves captured recovery schedule strength and per-stack counts when the second percentage is %i',
  (percent) => {
    let state = cast(encounter(), [
      { type: 'percentage-recovery', recipient: 'actor', resource: 'hp', percent: 10, ticks: 3 },
    ])
    state = executeCombatAction(
      state,
      {
        ...action,
        id: 'test.second-recovery',
        effects: [
          { type: 'percentage-recovery', recipient: 'actor', resource: 'hp', percent, ticks: 3 },
        ],
      },
      { kind: 'self' },
      PV1F_COMBAT_CONTENT,
    ).state
    expect(state.effectState!.ongoingRecovery).toHaveLength(2)
    const effects = aggregateBattleStatusStacks(
      rows(state).filter((row) => row.statusId === 'healing'),
    )
    expect(effects).toHaveLength(percent === 10 ? 1 : 2)
    if (percent === 10) {
      const text = battleEffectInformation(effects[0]!).explanation
      expect(text).toContain('150 HP total')
      expect(text).toContain('75 HP per stack')
      expect(text).toContain('2 applications remaining per stack')
    } else {
      expect(
        effects.map((effect) => battleEffectInformation(effect).explanation).join(' '),
      ).toContain('150 HP')
    }
  },
)

it('does not merge equal recovery rows whose first remaining turn-end application differs', () => {
  const state = cast(encounter(), [
    { type: 'percentage-recovery', recipient: 'actor', resource: 'hp', percent: 10, ticks: 3 },
  ])
  const effect = rows(state).find((row) => row.statusId === 'healing')!
  const groups = aggregateBattleStatusStacks([
    effect,
    { ...effect, recoverySkipsCurrentTurnEnd: undefined },
  ])
  expect(groups).toHaveLength(2)
})

it.each(['hp', 'mp'] as const)(
  'keeps native pending flat %s schedules separate when only their application counts differ',
  (resource) => {
    const state = cast(
      encounter(true),
      [1, 3].map((ticks) =>
        resource === 'hp'
          ? {
              type: 'healing' as const,
              recipient: 'actor' as const,
              amount: 10,
              durationTurns: 0,
              ticks,
            }
          : {
              type: 'resource-change' as const,
              recipient: 'actor' as const,
              resource: 'mp' as const,
              delta: 10,
              durationTurns: 0,
              ticks,
            },
      ),
    )
    const statusId = resource === 'hp' ? 'healing' : 'mp-recovery'
    const effects = aggregateBattleStatusStacks(
      rows(state).filter((row) => row.statusId === statusId),
    )
    expect(effects).toHaveLength(2)
    expect(effects.map((row) => row.recoveryApplications)).toEqual([1, 3])
    expect(effects.every((row) => row.stacks === 1)).toBe(true)
    for (const effect of effects) {
      const text = battleEffectInformation(effect).explanation
      expect(text).toContain(`${effect.recoveryApplications} application`)
      expect(text).not.toContain('20 ' + resource.toUpperCase() + ' total')
      expect(visible(effect)).toContain(`${effect.recoveryApplications} application`)
    }
  },
)

it.each(
  (['hp', 'mp'] as const).flatMap((resource) =>
    (['flat', 'percentage'] as const).flatMap((basis) =>
      (['pending', 'ally', 'after-self-skip'] as const).map((mode) => ({ resource, basis, mode })),
    ),
  ),
)(
  'retains native $resource $basis recovery cadence for $mode schedules in visible and accessible readers',
  ({ resource, basis, mode }) => {
    const base = encounter(mode === 'pending')
    const effect =
      basis === 'percentage'
        ? {
            type: 'percentage-recovery' as const,
            recipient: 'affected-units' as const,
            resource,
            percent: 10,
            ticks: 3,
          }
        : resource === 'hp'
          ? { type: 'healing' as const, recipient: 'affected-units' as const, amount: 40, ticks: 3 }
          : {
              type: 'resource-change' as const,
              recipient: 'affected-units' as const,
              resource: 'mp' as const,
              delta: 40,
              ticks: 3,
            }
    let state = executeCombatAction(
      base,
      {
        ...action,
        target: {
          ...action.target,
          geometryVersion: 2,
          kind: 'unit',
          teamPolicy: 'ally',
          shape: { kind: 'all' },
        },
        effects: [effect],
      },
      { kind: 'activate' },
      PV1F_COMBAT_CONTENT,
    ).state
    if (mode === 'after-self-skip') {
      expect(
        state.effectState!.ongoingRecovery.find((row) => row.targetCombatantId === 'actor')!
          .skipCurrentOwnerTurnEnd,
      ).toBe(true)
      state = endCombatTurn(
        { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
        PV1F_COMBAT_CONTENT,
      ).state
      expect(
        state.effectState!.ongoingRecovery.find((row) => row.targetCombatantId === 'actor')!,
      ).toMatchObject({ skipCurrentOwnerTurnEnd: false, remainingFutureTicks: 2 })
    }
    const row = rows(state, mode === 'ally' ? 'ally' : 'actor').find(
      (row) => row.statusId === (resource === 'hp' ? 'healing' : 'mp-recovery'),
    )!
    expect(row.recoverySkipsCurrentTurnEnd).toBeUndefined()
    const before = structuredClone(state)
    for (const text of [visible(row), battleEffectInformation(row).explanation]) {
      if (mode === 'pending') {
        expect(text).toContain('first on activation')
        expect(text).toContain('subsequent applications at affected-turn ends')
      } else expect(text).toContain('one per affected-turn end')
      expect(text).not.toContain('Skips the current affected-turn end')
    }
    expect(row.recoveryApplications).toBe(mode === 'pending' ? 3 : 2)
    expect(state).toEqual(before)
  },
)
