import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { percentageDotEncounter } from '../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import { conditionalDamageMultiplier } from '@aurevane/game-core/combat/damage-modifiers'
import { outgoingSuppressionBasisPoints } from '../../../../packages/game-core/src/combat/combat-suppress'
import {
  executeCombatAction,
  type CombatActionDefinition,
  type CombatEncounterState,
} from '@aurevane/game-core/combat/actions'
import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  BattleEffectInformation,
  battleEffectInformation,
} from '@/components/battle/battle-effect-information'
vi.mock('server-only', () => ({}))
import { projectBattleStatusStateForViewer } from '@/server/battle/battle-live-viewer-projection'
import { createSpectatorBattleViewerEntitlement } from '@/server/battle/battle-viewer-entitlement'

const action: CombatActionDefinition = {
  id: 'test.live-strength',
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
function cast(
  state: CombatEncounterState,
  statusId: string,
  potencyBasisPoints?: number,
  stacks = 1,
) {
  return executeCombatAction(
    state,
    {
      ...action,
      effects: [
        {
          type: 'apply-status',
          recipient: 'actor',
          statusId,
          stacks,
          durationTurns: 2,
          ...(potencyBasisPoints === undefined ? {} : { potencyBasisPoints }),
        },
      ],
    },
    { kind: 'self' },
    PV1F_COMBAT_CONTENT,
  ).state
}
function row(state: CombatEncounterState, statusId: string) {
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
const cases: {
  statusId: string
  current: boolean
  potencies: (number | undefined)[]
  out: number
  incoming: number | null
  outText: string
  inText?: string
}[] = [
  {
    statusId: 'inspired',
    current: true,
    potencies: [undefined, 2000],
    out: 13200,
    incoming: null,
    outText: '132%',
  },
  {
    statusId: 'inspired',
    current: false,
    potencies: [undefined, 2000],
    out: 12000,
    incoming: null,
    outText: '120%',
  },
  {
    statusId: 'inspired',
    current: true,
    potencies: [undefined, undefined],
    out: 12100,
    incoming: null,
    outText: '121%',
  },
  {
    statusId: 'inspired',
    current: false,
    potencies: [undefined, undefined],
    out: 11000,
    incoming: null,
    outText: '110%',
  },
  {
    statusId: 'reckless',
    current: true,
    potencies: [undefined, undefined],
    out: 19600,
    incoming: 15625,
    outText: '196%',
    inText: '156.25%',
  },
  {
    statusId: 'reckless',
    current: false,
    potencies: [undefined, undefined],
    out: 14000,
    incoming: 12500,
    outText: '140%',
    inText: '125%',
  },
  {
    statusId: 'fortified',
    current: true,
    potencies: [undefined, undefined],
    out: 6400,
    incoming: 4900,
    outText: '64%',
    inText: '49%',
  },
  {
    statusId: 'fortified',
    current: false,
    potencies: [undefined, undefined],
    out: 8000,
    incoming: 7000,
    outText: '80%',
    inText: '70%',
  },
  {
    statusId: 'reckless',
    current: true,
    potencies: [1000, 2000],
    out: 13200,
    incoming: 13200,
    outText: '132%',
    inText: '132%',
  },
  {
    statusId: 'fortified',
    current: true,
    potencies: [1000, 2000],
    out: 7200,
    incoming: 7200,
    outText: '72%',
    inText: '72%',
  },
  {
    statusId: 'reckless',
    current: false,
    potencies: [1000, 2000],
    out: 12000,
    incoming: 12000,
    outText: '120%',
    inText: '120%',
  },
  {
    statusId: 'fortified',
    current: false,
    potencies: [1000, 2000],
    out: 8000,
    incoming: 8000,
    outText: '80%',
    inText: '80%',
  },
]
it.each(cases)(
  'matches native $statusId combined multipliers current=$current with $potencies',
  ({ statusId, current, potencies, out, incoming, outText, ...entry }) => {
    let state: CombatEncounterState = percentageDotEncounter()
    if (!current) delete state.effectStackingPolicyVersion
    for (const potency of potencies) state = cast(state, statusId, potency)
    expect(conditionalDamageMultiplier(state, 'actor', 'enemy', PV1F_COMBAT_CONTENT)).toBe(out)
    if (incoming !== null)
      expect(conditionalDamageMultiplier(state, 'enemy', 'actor', PV1F_COMBAT_CONTENT)).toBe(
        incoming,
      )
    const before = structuredClone(state)
    const effect = row(state, statusId)
    for (const text of texts(effect)) {
      expect(text).toContain(`Outgoing damage from this effect`)
      expect(text).toContain(outText)
      if (incoming !== null) {
        expect(text).toContain('Incoming damage from this effect')
        expect(text).toContain(entry.inText)
      }
      expect(text).toContain('Other damage modifiers still apply')
    }
    expect(renderToStaticMarkup(<BattleEffectInformation effect={effect} />)).toContain(
      'data-compact-effect-magnitude="true"',
    )
    expect(state).toEqual(before)
  },
)

it.each([
  { statusId: 'inspired', out: 10607, text: '106.07%' },
  { statusId: 'reckless', out: 10608, text: '106.08%' },
])('preserves native rounding for three $statusId applications', ({ statusId, out, text }) => {
  const state = cast(percentageDotEncounter(), statusId, 199, 3)
  expect(conditionalDamageMultiplier(state, 'actor', 'enemy', PV1F_COMBAT_CONTENT)).toBe(out)
  for (const value of texts(row(state, statusId))) expect(value).toContain(text)
})

it.each([true, false])('uses strongest native Suppress once current=%s', (current) => {
  let state: CombatEncounterState = percentageDotEncounter()
  if (!current) delete state.effectStackingPolicyVersion
  for (const potency of [2500, 4000, 3000]) state = cast(state, 'suppress', potency)
  expect(outgoingSuppressionBasisPoints(state, 'actor')).toBe(4000)
  expect(row(state, 'suppress').stacks).toBe(1)
  for (const text of texts(row(state, 'suppress'))) {
    expect(text).toContain('Outgoing direct damage from this effect')
    expect(text).toContain('60%')
  }
})
it('retains zero outgoing damage under complete native Suppress', () => {
  const state = cast(percentageDotEncounter(), 'suppress', 10000)
  expect(outgoingSuppressionBasisPoints(state, 'actor')).toBe(10000)
  expect(battleEffectInformation(row(state, 'suppress')).amounts.rows).toContainEqual({
    label: 'Outgoing direct damage from this effect',
    magnitude: '0%',
  })
  for (const text of texts(row(state, 'suppress'))) expect(text).toContain('0%')
})

it.each(['inspired', 'reckless', 'fortified', 'suppress'])(
  'qualifies pending %s strength without claiming an active modifier',
  (statusId) => {
    const base: CombatEncounterState = percentageDotEncounter()
    base.effectTimingPolicy = { version: 1, modes: { [statusId]: 'next-round' } }
    const state = cast(base, statusId)
    const effect = row(state, statusId)
    expect(effect.timingState).toBe('pending')
    expect(conditionalDamageMultiplier(state, 'actor', 'enemy', PV1F_COMBAT_CONTENT)).toBe(10000)
    for (const text of texts(effect)) {
      expect(text).toContain(
        statusId === 'suppress'
          ? 'Outgoing direct damage on activation'
          : 'Outgoing damage on activation',
      )
      expect(text).not.toContain('Outgoing damage from this effect')
    }
  },
)

it.each(['challenged', 'warded', 'hexed'])(
  'does not invent an unconditional combined damage multiplier for %s',
  (statusId) => {
    const state = cast(percentageDotEncounter(), statusId)
    expect(
      battleEffectInformation(row(state, statusId)).amounts.rows.some(
        (row) => row.label === 'Outgoing damage from this effect',
      ),
    ).toBe(false)
  },
)
it('keeps unsupported captured versions unavailable', () => {
  const state = cast(percentageDotEncounter(), 'inspired', 2000)
  const effect = { ...row(state, 'inspired'), statusVersion: 99 }
  for (const text of texts(effect)) {
    expect(text).toContain('Captured effect rules unavailable')
    expect(text).not.toContain('120%')
  }
})
it('keeps an unsafe native damage total unavailable without crashing the reader', () => {
  const state = cast(percentageDotEncounter(), 'inspired', 5000, 100)
  expect(() => conditionalDamageMultiplier(state, 'actor', 'enemy', PV1F_COMBAT_CONTENT)).toThrow(
    RangeError,
  )
  for (const text of texts(row(state, 'inspired')))
    expect(text).toContain('Combined damage multiplier unavailable')
})
it('keeps Covert strength facts hidden from a spectator', () => {
  const base: CombatEncounterState = percentageDotEncounter()
  base.effectTimingPolicy = { version: 1, modes: { inspired: 'instant', covert: 'instant' } }
  const state = cast(cast(base, 'inspired', 2000), 'covert')
  expect(row(state, 'inspired')).toBeUndefined()
})

it('keeps independent outgoing effect multipliers distinct from actual combined HP damage', () => {
  const state = cast(cast(percentageDotEncounter(), 'inspired', 2000), 'suppress', 4000)
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
    { kind: 'unit', combatantId: 'enemy' },
    PV1F_COMBAT_CONTENT,
  )
  expect(hit.state.tactical.battle.combatants.find((r) => r.id === 'enemy')!.hp).toBe(928)
  expect(battleEffectInformation(row(state, 'inspired')).amounts.rows).toContainEqual({
    label: 'Outgoing damage from this effect',
    magnitude: '120%',
  })
  expect(battleEffectInformation(row(state, 'suppress')).amounts.rows).toContainEqual({
    label: 'Outgoing direct damage from this effect',
    magnitude: '60%',
  })
})
it('bounds the reader for a large valid Inspired count without claiming the native total is zero', () => {
  const state = cast(percentageDotEncounter(), 'inspired', 100, 20_000)
  expect(() => conditionalDamageMultiplier(state, 'actor', 'enemy', PV1F_COMBAT_CONTENT)).toThrow(
    RangeError,
  )
  const report = battleEffectInformation(row(state, 'inspired'))
  expect(report.amounts.rows).toContainEqual({
    label: 'Outgoing damage from this effect',
    magnitude: 'Unavailable',
  })
  expect(report.explanation).toContain('Combined damage multiplier unavailable')
})
it('handles native exact-arithmetic capacity failure without an unbounded reader loop', () => {
  const state = cast(percentageDotEncounter(), 'fortified', 100, 1_000_000)
  expect(() => conditionalDamageMultiplier(state, 'actor', 'enemy', PV1F_COMBAT_CONTENT)).toThrow(
    RangeError,
  )
  const report = battleEffectInformation(row(state, 'fortified'))
  expect(report.amounts.rows).toHaveLength(2)
  expect(report.amounts.rows).toEqual(
    expect.arrayContaining([
      { label: 'Outgoing damage from this effect', magnitude: 'Unavailable' },
      { label: 'Incoming damage from this effect', magnitude: 'Unavailable' },
    ]),
  )
}, 15_000)
