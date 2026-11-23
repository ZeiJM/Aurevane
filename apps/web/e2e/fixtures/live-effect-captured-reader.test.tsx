import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { percentageDotEncounter } from '../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import {
  executeCombatAction,
  endCombatTurn,
  type CombatActionDefinition,
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
  id: 'test.captured-reader',
  version: 1,
  sourceType: 'test',
  tags: ['attack'],
  cost: { spendsAction: false, mp: 0 },
  requirements: [],
  target: {
    kind: 'unit',
    teamPolicy: 'enemy',
    shape: { kind: 'single' },
    minimumRange: 0,
    maximumRange: 5,
    requiresLineOfSight: false,
    maximumElevationDifference: null,
    friendlyFire: 'enemies-only',
  },
  effects: [],
}

it('shows the remaining Burn progression after an actual affected-turn tick', () => {
  const base = { ...percentageDotEncounter(), dotTriggerPolicyVersion: 2 as const }
  let state = executeCombatAction(
    base,
    {
      ...action,
      effects: [
        { type: 'damage', recipient: 'primary-unit', amount: 20 },
        {
          type: 'burn',
          recipient: 'primary-unit',
          durationTurns: 3,
          damageProfile: {
            kind: 'attack-percentage',
            basisPoints: 3000,
            decayBasisPointsPerTick: 1000,
          },
        },
      ],
    },
    { kind: 'unit', combatantId: 'enemy' },
    PV1F_COMBAT_CONTENT,
  ).state
  do {
    const actor = state.tactical.battle.currentTurn!.combatantId
    state = endCombatTurn(
      { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
      PV1F_COMBAT_CONTENT,
    ).state
    if (actor === 'enemy') break
  } while (state.tactical.battle.round === 1)
  const before = structuredClone(state)
  const effect = projectBattleStatusStateForViewer(state, createSpectatorBattleViewerEntitlement())
    .find((row) => row.combatantId === 'enemy')!
    .statuses.find((row) => row.statusId === 'burn')!
  expect(effect.percentageDotStage).toBe(1)
  const report = battleEffectInformation(effect)
  expect(report.description).toContain('20% → 10%')
  expect(report.description).toContain('Next tick: 4 HP')
  expect(report.description).not.toContain('30% →')
  expect(state).toEqual(before)
})
it('retains default then explicit native Guard applications through public projection into the reader', () => {
  let state = percentageDotEncounter()
  for (const potencyBasisPoints of [undefined, 2000]) {
    state = executeCombatAction(
      state,
      {
        ...action,
        effects: [
          {
            type: 'apply-status',
            recipient: 'primary-unit',
            statusId: 'guarded',
            stacks: 1,
            durationTurns: 2,
            ...(potencyBasisPoints === undefined ? {} : { potencyBasisPoints }),
          },
        ],
      },
      { kind: 'unit', combatantId: 'enemy' },
      PV1F_COMBAT_CONTENT,
    ).state as typeof state
  }
  const before = structuredClone(state)
  const effect = projectBattleStatusStateForViewer(state, createSpectatorBattleViewerEntitlement())
    .find((row) => row.combatantId === 'enemy')!
    .statuses.find((row) => row.statusId === 'guarded')!
  expect(effect.potencyBasisPoints).toBe(2000)
  expect(effect.applicationModifiers![0]).not.toHaveProperty('potencyBasisPoints')
  const report = battleEffectInformation(effect)
  expect(report.applications[0]).toContain('15%')
  expect(report.applications[1]).toContain('20%')
  expect(report.incoming).toBe('−32%')
  expect(state).toEqual(before)
})

it.each(
  (['burn', 'poison', 'bleed'] as const).flatMap((type) =>
    (['pending', 'active'] as const).map((phase) => ({ type, phase })),
  ),
)(
  'shows actual $phase $type captured percentages without guessed pending HP',
  ({ type, phase }) => {
    const base = {
      ...percentageDotEncounter(),
      dotTriggerPolicyVersion: 2 as const,
      effectTimingPolicy: {
        version: 1 as const,
        modes: {
          damage: 'instant' as const,
          [type]: phase === 'pending' ? ('next-round' as const) : ('instant' as const),
        },
      },
    }
    const profile = {
      kind: 'attack-percentage' as const,
      basisPoints: 3000,
      ...(type === 'burn' ? { decayBasisPointsPerTick: 1000 } : {}),
    }
    const state = executeCombatAction(
      base,
      {
        ...action,
        effects: [
          { type: 'damage', recipient: 'primary-unit', amount: 20 },
          { type, recipient: 'primary-unit', ticks: 3, durationTurns: 3, damageProfile: profile },
        ],
      },
      { kind: 'unit', combatantId: 'enemy' },
      PV1F_COMBAT_CONTENT,
    ).state
    const before = structuredClone(state)
    const effect = projectBattleStatusStateForViewer(
      state,
      createSpectatorBattleViewerEntitlement(),
    )
      .find((row) => row.combatantId === 'enemy')!
      .statuses.find((row) => row.statusId === type)!
    expect(effect.timingState).toBe(phase)
    const report = battleEffectInformation(effect)
    const html = renderToStaticMarkup(<BattleEffectInformation effect={effect} />)
    for (const text of [report.explanation, html]) {
      expect(text).toContain('30%')
      if (type === 'burn') expect(text).toContain('30% → 20% → 10%')
    }
    if (phase === 'pending') {
      expect(report.explanation).not.toContain('Next tick:')
      expect(report.explanation).not.toContain('Captured attack damage:')
    } else expect(report.explanation).toContain('Next tick: 6 HP')
    expect(state).toEqual(before)
  },
)
