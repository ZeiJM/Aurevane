import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { percentageDotEncounter } from '../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import { conditionalDamageMultiplier } from '@aurevane/game-core/combat/damage-modifiers'
import {
  executeCombatAction,
  endCombatTurn,
  type CombatActionDefinition,
  type CombatEncounterState,
} from '@aurevane/game-core/combat/actions'
import { selectCurrentFinalFacing } from '@aurevane/game-core/combat/board'
import { aggregateBattleStatusStacks } from '@/components/battle/battle-effect-summary'
import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  BattleEffectInformation,
  battleEffectInformation,
} from '@/components/battle/battle-effect-information'
vi.mock('server-only', () => ({}))
import { projectBattleStatusStateForViewer } from '@/server/battle/battle-live-viewer-projection'
import { createSpectatorBattleViewerEntitlement } from '@/server/battle/battle-viewer-entitlement'
const action: CombatActionDefinition = {
  id: 'test.conditional-reader',
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
function encounter(current = true): CombatEncounterState {
  const state: CombatEncounterState = {
    ...percentageDotEncounter(),
    effectTimingPolicy: {
      version: 1,
      modes: {
        warded: 'instant',
        challenged: 'instant',
        burn: 'instant',
        damage: 'instant',
        covert: 'instant',
      },
    },
  }
  if (!current) delete state.effectStackingPolicyVersion
  return state
}
function targetAction(effects: CombatActionDefinition['effects']): CombatActionDefinition {
  return {
    ...action,
    tags: ['attack'],
    target: {
      ...action.target,
      kind: 'unit',
      teamPolicy: 'enemy',
      maximumRange: 5,
      friendlyFire: 'enemies-only',
    },
    effects,
  }
}
function apply(state: CombatEncounterState, statusId: string, potencyBasisPoints?: number) {
  const effect = {
    type: 'apply-status' as const,
    recipient: statusId === 'warded' ? ('actor' as const) : ('primary-unit' as const),
    statusId,
    stacks: 1,
    durationTurns: 4,
    ...(potencyBasisPoints === undefined ? {} : { potencyBasisPoints }),
  }
  return executeCombatAction(
    state,
    statusId === 'warded' ? { ...action, effects: [effect] } : targetAction([effect]),
    statusId === 'warded' ? { kind: 'self' } : { kind: 'unit', combatantId: 'enemy' },
    PV1F_COMBAT_CONTENT,
  ).state
}
function row(state: CombatEncounterState, statusId: string) {
  return projectBattleStatusStateForViewer(state, createSpectatorBattleViewerEntitlement())
    .find((r) => r.combatantId === (statusId === 'warded' ? 'actor' : 'enemy'))!
    .statuses.find((r) => r.statusId === statusId)!
}
function texts(effect: ReturnType<typeof row>) {
  return [
    battleEffectInformation(effect).explanation,
    renderToStaticMarkup(<BattleEffectInformation effect={effect} />),
  ]
}
function end(state: CombatEncounterState) {
  return endCombatTurn(
    { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
    PV1F_COMBAT_CONTENT,
  ).state
}
function burn(state: CombatEncounterState) {
  return executeCombatAction(
    state,
    targetAction([
      { type: 'damage', recipient: 'primary-unit', amount: 20 },
      {
        type: 'burn',
        recipient: 'primary-unit',
        durationTurns: 2,
        damageProfile: { kind: 'attack-percentage', basisPoints: 2000 },
      },
    ]),
    { kind: 'unit', combatantId: 'enemy' },
    PV1F_COMBAT_CONTENT,
  ).state
}

it.each([
  { current: true, second: undefined, want: 6400, text: '64%' },
  { current: false, second: undefined, want: 8000, text: '80%' },
  { current: true, second: 3000, want: 5600, text: '56%' },
  { current: false, second: 3000, want: 7000, text: '70%' },
])(
  'shows Ward only under its Burn condition current=$current second=$second',
  ({ current, second, want, text }) => {
    let state = apply(apply(encounter(current), 'warded'), 'warded', second)
    expect(conditionalDamageMultiplier(state, 'enemy', 'actor', PV1F_COMBAT_CONTENT)).toBe(10000)
    state = burn(state)
    expect(conditionalDamageMultiplier(state, 'enemy', 'actor', PV1F_COMBAT_CONTENT)).toBe(want)
    const before = structuredClone(state)
    const effect = row(state, 'warded')
    expect(battleEffectInformation(effect).amounts.rows).toContainEqual({
      label: 'Incoming damage from this effect against burning opponents',
      magnitude: text,
    })
    for (const value of texts(effect)) {
      expect(value).toContain('against burning opponents')
      expect(value).toContain(text)
      expect(value).toContain('only when the stated condition is met')
    }
    expect(state).toEqual(before)
  },
)
it.each([true, false])(
  'matches actual Ward mitigation on an enemy attack current=%s',
  (current) => {
    let state = burn(apply(apply(encounter(current), 'warded'), 'warded'))
    state = end(state)
    const hit = executeCombatAction(
      state,
      targetAction([{ type: 'damage', recipient: 'primary-unit', amount: 100 }]),
      { kind: 'unit', combatantId: 'actor' },
      PV1F_COMBAT_CONTENT,
    )
    expect(hit.state.tactical.battle.combatants.find((r) => r.id === 'actor')!.hp).toBe(
      current ? 936 : 920,
    )
    expect(battleEffectInformation(row(hit.state, 'warded')).amounts.rows).toContainEqual({
      label: 'Incoming damage from this effect against burning opponents',
      magnitude: current ? '64%' : '80%',
    })
  },
)
it.each([
  { current: true, second: undefined, want: 5625, text: '56.25%' },
  { current: false, second: undefined, want: 7500, text: '75%' },
  { current: true, second: 2000, want: 6000, text: '60%' },
  { current: false, second: 2000, want: 8000, text: '80%' },
])(
  'qualifies Taunt by its common source current=$current second=$second',
  ({ current, second, want, text }) => {
    const state = apply(apply(encounter(current), 'challenged'), 'challenged', second)
    expect(conditionalDamageMultiplier(state, 'enemy', 'actor', PV1F_COMBAT_CONTENT)).toBe(10000)
    expect(conditionalDamageMultiplier(state, 'enemy', 'ally', PV1F_COMBAT_CONTENT)).toBe(want)
    const before = structuredClone(state)
    const effect = row(state, 'challenged')
    expect(battleEffectInformation(effect).amounts.rows).toContainEqual({
      label: 'Outgoing damage from this effect against targets other than the source',
      magnitude: text,
    })
    for (const value of texts(effect)) {
      expect(value).toContain('against targets other than the source')
      expect(value).toContain(text)
      expect(value).toContain('only when the stated condition is met')
    }
    expect(state).toEqual(before)
  },
)
it.each([true, false])(
  'does not combine incompatible Taunt source conditions current=%s',
  (current) => {
    let state = apply(encounter(current), 'challenged')
    for (let i = 0; i < 3; i++) state = end(state)
    expect(state.tactical.battle.currentTurn!.combatantId).toBe('ally')
    state = apply(state, 'challenged')
    const effect = row(state, 'challenged')
    const before = structuredClone(state)
    const report = battleEffectInformation(effect)
    expect(conditionalDamageMultiplier(state, 'enemy', 'actor', PV1F_COMBAT_CONTENT)).toBe(7500)
    expect(conditionalDamageMultiplier(state, 'enemy', 'ally', PV1F_COMBAT_CONTENT)).toBe(
      current ? 7500 : 10000,
    )
    expect(conditionalDamageMultiplier(state, 'enemy', 'other', PV1F_COMBAT_CONTENT)).toBe(
      current ? 5625 : 7500,
    )
    if (current) {
      expect(report.amounts.rows).toEqual([])
      for (const value of texts(effect))
        expect(value).toContain('Combined damage depends on which source is attacked')
      expect(report.applications).toHaveLength(2)
    } else
      expect(report.amounts.rows).toContainEqual({
        label: 'Outgoing damage from this effect against targets other than the source',
        magnitude: '75%',
      })
    for (const value of report.amounts.rows)
      expect(value.label).not.toMatch(/\b(actor|ally|enemy)\b/)
    expect(state).toEqual(before)
  },
)
it.each(
  [true, false].flatMap((current) =>
    ['warded', 'challenged'].map((statusId) => ({ current, statusId })),
  ),
)('keeps pending $statusId conditional and inactive current=$current', ({ current, statusId }) => {
  const base = encounter(current)
  base.effectTimingPolicy = { version: 1, modes: { [statusId]: 'next-round' } }
  const state = apply(base, statusId)
  const effect = row(state, statusId)
  expect(effect.timingState).toBe('pending')
  expect(conditionalDamageMultiplier(state, 'enemy', 'actor', PV1F_COMBAT_CONTENT)).toBe(10000)
  const report = battleEffectInformation(effect)
  expect(report.amounts.rows).toContainEqual(
    statusId === 'warded'
      ? { label: 'Incoming damage on activation against burning opponents', magnitude: '80%' }
      : {
          label: 'Outgoing damage on activation against targets other than the source',
          magnitude: '75%',
        },
  )
  for (const value of texts(effect))
    expect(value).toContain('only when the stated condition is met')
})
it.each([true, false])(
  'preserves different pending Taunt sources through actual card grouping current=%s',
  (current) => {
    const base = encounter(current)
    base.effectTimingPolicy = { version: 1, modes: { challenged: 'next-round' } }
    let state = apply(base, 'challenged')
    for (let i = 0; i < 3; i++) state = end(state)
    expect(state.tactical.battle.currentTurn!.combatantId).toBe('ally')
    state = apply(state, 'challenged')
    const before = structuredClone(state)
    const projected = projectBattleStatusStateForViewer(
      state,
      createSpectatorBattleViewerEntitlement(),
    ).find((r) => r.combatantId === 'enemy')!.statuses
    expect(projected.filter((r) => r.statusId === 'challenged')).toHaveLength(2)
    for (const target of ['actor', 'ally', 'other'])
      expect(conditionalDamageMultiplier(state, 'enemy', target, PV1F_COMBAT_CONTENT)).toBe(10000)
    const grouped = aggregateBattleStatusStacks(projected).filter(
      (r) => r.statusId === 'challenged',
    )
    expect(grouped).toHaveLength(2)
    expect(grouped.map((r) => r.sourceCombatantId)).toEqual(['actor', 'ally'])
    for (const effect of grouped) {
      expect(effect.stacks).toBe(1)
      expect(battleEffectInformation(effect).amounts.rows).toContainEqual({
        label: 'Outgoing damage on activation against targets other than the source',
        magnitude: '75%',
      })
      for (const value of texts(effect)) {
        expect(value).toContain('75%')
        expect(value).not.toContain('56.25%')
        expect(value).not.toMatch(/\b(actor|ally|enemy)\b/)
      }
    }
    expect(state).toEqual(before)
    state = end(state)
    expect(row(state, 'challenged').timingState).not.toBe('pending')
    expect(conditionalDamageMultiplier(state, 'enemy', 'actor', PV1F_COMBAT_CONTENT)).toBe(7500)
    expect(conditionalDamageMultiplier(state, 'enemy', 'ally', PV1F_COMBAT_CONTENT)).toBe(
      current ? 7500 : 10000,
    )
    expect(conditionalDamageMultiplier(state, 'enemy', 'other', PV1F_COMBAT_CONTENT)).toBe(
      current ? 5625 : 7500,
    )
  },
)
it.each([true, false])(
  'still combines same-source pending Taunts through card grouping current=%s',
  (current) => {
    const base = encounter(current)
    base.effectTimingPolicy = { version: 1, modes: { challenged: 'next-round' } }
    const state = apply(apply(base, 'challenged'), 'challenged')
    const projected = projectBattleStatusStateForViewer(
      state,
      createSpectatorBattleViewerEntitlement(),
    ).find((r) => r.combatantId === 'enemy')!.statuses
    const grouped = aggregateBattleStatusStacks(projected).filter(
      (r) => r.statusId === 'challenged',
    )
    expect(grouped).toHaveLength(1)
    expect(grouped[0]!.stacks).toBe(2)
    expect(battleEffectInformation(grouped[0]!).amounts.rows).toContainEqual({
      label: 'Outgoing damage on activation against targets other than the source',
      magnitude: current ? '56.25%' : '75%',
    })
  },
)
it.each(['warded', 'challenged'])(
  'does not borrow conditional strength for unknown %s versions',
  (statusId) => {
    const state = apply(encounter(), statusId)
    const effect = { ...row(state, statusId), statusVersion: 99 }
    expect(battleEffectInformation(effect).amounts.rows).toEqual([])
    for (const value of texts(effect)) expect(value).toContain('Captured effect rules unavailable')
  },
)
it('keeps a positive Ward concealed for a spectator under actual Covert', () => {
  const state = executeCombatAction(
    apply(encounter(), 'warded'),
    {
      ...action,
      effects: [{ type: 'apply-status', recipient: 'actor', statusId: 'covert', stacks: 1 }],
    },
    { kind: 'self' },
    PV1F_COMBAT_CONTENT,
  ).state
  expect(row(state, 'warded')).toBeUndefined()
})

it.each([true, false])('retains Ward protection-bypass truth current=%s', (current) => {
  const state = burn(apply(apply(encounter(current), 'warded'), 'warded'))
  expect(
    conditionalDamageMultiplier(state, 'enemy', 'actor', PV1F_COMBAT_CONTENT, 10_000, {
      ignoreIncomingMitigation: true,
    }),
  ).toBe(10_000)
  for (const value of texts(row(state, 'warded')))
    expect(value).toContain('Damage that bypasses incoming protection is unaffected by Burn Ward')
})
