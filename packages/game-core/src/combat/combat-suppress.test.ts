import { latestEnabledMatureSkills } from './mature-skills'
import { resolveEssenceForBuild, executePv1fEssenceSkill } from './essence'
import { describe, expect, it } from 'vitest'
import {
  endCombatTurn,
  evaluateCombatAction,
  executeCombatAction,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEncounterState,
  type CombatEffectDefinition,
} from './actions'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { PV1F_COMBAT_CONTENT, createPv1fTemporaryResources } from './pv1f-action-economy'
import { validateGameplayEffectMetadata, combatEffectPresentationTags } from './gameplay-tags'
import { applyCombatStatusCopies } from './combat-status-copy'
import { normalizeCombatRuntimeEncounterState } from './combat-runtime-state'
import { selectCurrentFinalFacing } from './board'
import { mergeSuppressStatus, scaleSuppressedDirectDamage } from './combat-suppress'
import {
  applyCurrentBurnState,
  applyCurrentPoisonState,
  applyCurrentBleedState,
} from './combat-dots'
import { forecastStatDrivenAttack } from './stat-driven-combat'
import { grantBarrier } from './combat-barrier'
const target = { kind: 'unit' as const, combatantId: 'enemy' }
const action = (
  effects: CombatEffectDefinition[],
  sourceType: CombatActionDefinition['sourceType'] = 'discipline-skill',
): CombatActionDefinition => ({
  id: 'test.suppress',
  version: 1,
  sourceType,
  tags: ['attack'],
  cost: { mp: 0, spendsAction: false },
  requirements: [],
  target: {
    kind: 'unit',
    teamPolicy: 'enemy',
    friendlyFire: 'enemies-only',
    shape: { kind: 'single' },
    minimumRange: 1,
    maximumRange: 4,
    requiresLineOfSight: false,
    maximumElevationDifference: null,
  },
  effects,
})
const suppress = (
  potencyBasisPoints = 2500,
  durationTurns = 2,
  recipient: 'actor' | 'primary-unit' = 'actor',
): CombatEffectDefinition => ({
  type: 'apply-status',
  recipient,
  statusId: 'suppress',
  stacks: 1,
  potencyBasisPoints,
  durationTurns,
})
const rows = (state: CombatEncounterState, id = 'actor') =>
  state.statusState.find((row) => row.combatantId === id)!.statuses
const apply = (state: CombatEncounterState, potency = 2500, turns = 2) =>
  executeCombatAction(state, action([suppress(potency, turns)]), target, PV1F_COMBAT_CONTENT).state
const damage = (
  state: CombatEncounterState,
  amount = 100,
  sourceType: CombatActionDefinition['sourceType'] = 'discipline-skill',
) =>
  executeCombatAction(
    state as ReturnType<typeof percentageDotEncounter>,
    action([{ type: 'damage', recipient: 'primary-unit', amount }], sourceType),
    target,
    PV1F_COMBAT_CONTENT,
  )
const hp = (state: CombatEncounterState, id = 'enemy') =>
  state.tactical.battle.combatants.find((unit) => unit.id === id)!.hp

describe('Suppress percentage authority', () => {
  it('registers one negative copyable percentage tag without assigning any Skill', () => {
    expect(PV1F_COMBAT_CONTENT.statuses.find((status) => status.id === 'suppress')).toMatchObject({
      maximumStacks: 1,
      polarity: 'negative',
      curseCopyable: true,
    })
    expect(combatEffectPresentationTags(suppress())).toEqual(['Suppress [25%]'])
    for (const definition of [
      ...latestEnabledMatureSkills(),
      ...[...new Set(latestEnabledMatureSkills().map((skill) => skill.sourceDisciplineId))].flatMap(
        (id) => {
          const essence = resolveEssenceForBuild(id, null)
          return essence ? [essence.skill] : []
        },
      ),
    ])
      expect(
        definition.effects.some(
          (effect) => effect.type === 'apply-status' && effect.statusId === 'suppress',
        ),
      ).toBe(false)
  })
  it.each(['discipline-skill', 'basic-attack'] as const)(
    'reduces actual 100 direct damage to 75 for %s with preview parity',
    (sourceType) => {
      const state = apply(percentageDotEncounter())
      const hit = action([{ type: 'damage', recipient: 'primary-unit', amount: 100 }], sourceType)
      expect(hp(executeCombatAction(state, hit, target, PV1F_COMBAT_CONTENT).state)).toBe(925)
      expect(
        evaluateCombatAction(state, hit, target, PV1F_COMBAT_CONTENT).projectedEffects,
      ).toContainEqual(expect.objectContaining({ effectType: 'damage', before: 1000, after: 925 }))
    },
  )
  it('100% remains zero with Damage Up, Blindside and elemental amplification', () => {
    const state = apply(percentageDotEncounter(), 10000)
    state.tactical.placements.find((row) => row.combatantId === 'enemy')!.facing = 'east'
    const buffed = executeCombatAction(
      state,
      action([
        { type: 'apply-status', recipient: 'actor', statusId: 'inspired', stacks: 2 },
        { type: 'apply-status', recipient: 'actor', statusId: 'blindside', stacks: 1 },
        { type: 'apply-status', recipient: 'primary-unit', statusId: 'wet', stacks: 1 },
        { type: 'apply-status', recipient: 'primary-unit', statusId: 'conductive', stacks: 1 },
      ]),
      target,
      PV1F_COMBAT_CONTENT,
    ).state
    const hit = action([
      { type: 'damage', recipient: 'primary-unit', amount: 100, element: 'storm' },
    ])
    expect(hp(executeCombatAction(buffed, hit, target, PV1F_COMBAT_CONTENT).state)).toBe(1000)
  })
  it.each([
    [2000, 2, 4000, 1],
    [4000, 1, 2000, 2],
    [4000, 2, 2000, 4],
  ])('merges percentage and duration independently (%i/%i then %i/%i)', (a, at, b, bt) => {
    const state = apply(apply(percentageDotEncounter(), a, at), b, bt)
    expect(rows(state)).toEqual([
      expect.objectContaining({
        statusId: 'suppress',
        stacks: 1,
        potencyBasisPoints: Math.max(a, b),
        remainingOwnerTurnStarts: Math.max(at, bt) + 1,
      }),
    ])
    expect(rows(state)[0]!.applicationModifiers).toBeUndefined()
  })
  it('Copy Debuffs retains the greater captured percentage and remaining lifetime', () => {
    const state = apply(percentageDotEncounter(), 4000, 2)
    const recipient = executeCombatAction(
      state,
      action([suppress(2000, 4, 'primary-unit')]),
      target,
      PV1F_COMBAT_CONTENT,
    ).state
    const copied = applyCombatStatusCopies(
      recipient,
      'actor',
      'enemy',
      'test.curse',
      { type: 'copy-statuses', mode: 'curse', recipient: 'primary-unit' },
      PV1F_COMBAT_CONTENT,
    ).state
    expect(rows(copied, 'enemy')).toEqual([
      expect.objectContaining({ stacks: 1, potencyBasisPoints: 4000, remainingOwnerTurnStarts: 5 }),
    ])
  })
  it.each([100, 10000])('accepts %i basis points', (potency) =>
    expect(() => validateGameplayEffectMetadata(suppress(potency))).not.toThrow(),
  )
  it.each([0, 99, 10001, 2500.1, Number.NaN])('rejects invalid potency %s', (potency) =>
    expect(() => validateGameplayEffectMetadata(suppress(potency))).toThrow(),
  )
  it.each([0, 5, 1.5])('rejects invalid Suppress duration %s', (duration) =>
    expect(() => validateGameplayEffectMetadata(suppress(2500, duration))).toThrow(),
  )
  it('does not broaden other status potency constraints', () =>
    expect(() =>
      validateGameplayEffectMetadata({
        ...suppress(10000),
        statusId: 'guarded',
      } as CombatEffectDefinition),
    ).toThrow())
  it('restores captured percentage and rejects stacked or overlong Suppress state', () => {
    const state = apply(percentageDotEncounter(), 10000, 4)
    expect(
      normalizeCombatRuntimeEncounterState(JSON.parse(JSON.stringify(state))).statusState,
    ).toEqual(state.statusState)
    const invalid = {
      ...state,
      statusState: state.statusState.map((row) =>
        row.combatantId === 'actor'
          ? { ...row, statuses: row.statuses.map((status) => ({ ...status, stacks: 2 })) }
          : row,
      ),
    }
    expect(validateCombatEncounterState(invalid)).not.toEqual([])
  })
})

const end = (state: CombatEncounterState) =>
  endCombatTurn(
    { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
    PV1F_COMBAT_CONTENT,
  ).state
const round = (state: CombatEncounterState, wanted: number) => {
  while (state.tactical.battle.round < wanted) state = JSON.parse(JSON.stringify(end(state)))
  return state
}
const timed = (): CombatEncounterState => ({
  ...percentageDotEncounter(),
  effectTimingPolicy: { version: 7, modes: { suppress: 'instant', 'remove-status': 'instant' } },
})

it.each(['next-round', 'delayed'] as const)(
  'merges only at actual %s activation and restores the captured percentage',
  (mode) => {
    let state = executeCombatAction(
      timed(),
      action([suppress(2000, 4, 'primary-unit')]),
      target,
      PV1F_COMBAT_CONTENT,
    ).state
    state = { ...state, effectTimingPolicy: { version: 8, modes: { suppress: mode } } }
    state = executeCombatAction(
      state,
      action([suppress(4000, 1, 'primary-unit')]),
      target,
      PV1F_COMBAT_CONTENT,
    ).state
    expect(rows(state, 'enemy')[0]!.potencyBasisPoints).toBe(2000)
    expect(state.pendingEffects![0]!.effect).toMatchObject({
      potencyBasisPoints: 4000,
      durationTurns: 1,
    })
    const activated = round(state, mode === 'delayed' ? 3 : 2)
    expect(rows(activated, 'enemy')).toEqual([
      expect.objectContaining({
        stacks: 1,
        potencyBasisPoints: 4000,
        remainingOwnerTurnEnds: mode === 'delayed' ? 2 : 3,
      }),
    ])
    expect(activated.pendingEffects).toHaveLength(0)
  },
)
it('compares actual remaining clocks including equal counters and the current-turn skip', () => {
  const base = {
    statusId: 'suppress',
    statusVersion: 1,
    stacks: 1,
    sourceCombatantId: 'actor',
    potencyBasisPoints: 4000,
    timingState: 'active' as const,
    remainingOwnerTurnStarts: 2,
    remainingOwnerTurnEnds: 2,
  }
  const global = {
    ...base,
    durationScope: 'rounds' as const,
    remainingRoundBoundaries: 2,
    potencyBasisPoints: 2000,
  }
  expect(mergeSuppressStatus(base, global, timed(), 'actor')).toMatchObject({
    durationScope: 'rounds',
    potencyBasisPoints: 4000,
  })
  expect(
    mergeSuppressStatus({ ...base, skipCurrentOwnerTurnEnd: true }, global, timed(), 'actor'),
  ).toMatchObject({ skipCurrentOwnerTurnEnd: true, potencyBasisPoints: 4000 })
  expect(
    mergeSuppressStatus({ ...base, skipCurrentOwnerTurnEnd: true }, global, timed(), 'actor')
      .durationScope,
  ).toBeUndefined()
})
it('does not turn a retained three-turn clock into three future turns during weaker reapplication', () => {
  let state = apply(timed(), 4000, 3)
  state.statusState.find(
    (row) => row.combatantId === 'actor',
  )!.statuses[0]!.skipCurrentOwnerTurnEnd = undefined
  state = apply(state, 2000, 2)
  expect(rows(state)[0]!.remainingOwnerTurnEnds).toBe(3)
  expect(rows(state)[0]!.skipCurrentOwnerTurnEnd).not.toBe(true)
  expect(rows(end(state))[0]!.remainingOwnerTurnEnds).toBe(2)
})
it('repeated packets and different sources never stack Suppress', () => {
  let state = executeCombatAction(
    timed(),
    action([suppress(2000, 2, 'primary-unit'), suppress(4000, 1, 'primary-unit')]),
    target,
    PV1F_COMBAT_CONTENT,
  ).state
  state = end(state)
  const differentSource = {
    ...action([suppress(1000, 4)]),
    target: {
      ...action([]).target,
      minimumRange: 0,
      teamPolicy: 'any' as const,
      friendlyFire: 'all-units' as const,
    },
  }
  state = executeCombatAction(
    state,
    differentSource,
    { kind: 'unit', combatantId: 'actor' },
    PV1F_COMBAT_CONTENT,
  ).state
  expect(rows(state, 'enemy')).toEqual([
    expect.objectContaining({ stacks: 1, potencyBasisPoints: 4000, remainingOwnerTurnEnds: 4 }),
  ])
})
it('Cleanse removes Suppress while Dispel retains it', () => {
  const state = executeCombatAction(
    timed(),
    action([suppress(2500, 2, 'primary-unit')]),
    target,
    PV1F_COMBAT_CONTENT,
  ).state
  const dispelled = executeCombatAction(
    state as ReturnType<typeof percentageDotEncounter>,
    action([{ type: 'remove-status', recipient: 'primary-unit', statusIds: ['guarded'] }]),
    target,
    PV1F_COMBAT_CONTENT,
  ).state
  expect(rows(dispelled, 'enemy')).toHaveLength(1)
  const cleansed = executeCombatAction(
    state,
    action([
      {
        type: 'remove-status',
        recipient: 'primary-unit',
        statusIds: ['burn', 'bleed', 'poison', 'slow', 'root', 'exposed', 'mark', 'challenged'],
      },
    ]),
    target,
    PV1F_COMBAT_CONTENT,
  )
  expect(rows(cleansed.state, 'enemy')).toHaveLength(0)
  expect(cleansed.events).toContainEqual(
    expect.objectContaining({ event: 'status_removed', statusId: 'suppress' }),
  )
})
it.each(['burn', 'poison', 'bleed'] as const)(
  'new %s captures suppressed actual HP loss and cannot apply on 100% suppression',
  (type) => {
    const dot: CombatEffectDefinition =
      type === 'bleed'
        ? {
            type,
            recipient: 'primary-unit',
            ticks: 2,
            damageProfile: { kind: 'attack-percentage', basisPoints: 2000 },
          }
        : {
            type,
            recipient: 'primary-unit',
            durationTurns: 2,
            damageProfile: {
              kind: 'attack-percentage',
              basisPoints: 2000,
              ...(type === 'burn' ? { decayBasisPointsPerTick: 500 } : {}),
            },
          }
    const hit = action([{ type: 'damage', recipient: 'primary-unit', amount: 100 }, dot])
    const reduced = executeCombatAction(
      apply(percentageDotEncounter()),
      hit,
      target,
      PV1F_COMBAT_CONTENT,
    ).state
    expect(reduced.effectState![type][0]!.percentageDamage!.capturedDamage).toBe(75)
    const stopped = executeCombatAction(
      apply(percentageDotEncounter(), 10000),
      hit,
      target,
      PV1F_COMBAT_CONTENT,
    ).state
    expect(stopped.effectState?.[type] ?? []).toHaveLength(0)
    expect(hp(stopped)).toBe(1000)
  },
)

it('already captured Burn/Poison/Bleed tick normally and zero outgoing damage causes no Burn backlash', () => {
  const captured = {
    capturedDamage: 100,
    profile: { kind: 'attack-percentage' as const, basisPoints: 2000 },
  }
  let state: CombatEncounterState = apply(percentageDotEncounter(), 10000, 4)
  state = { ...state, dotTriggerPolicyVersion: 2 }
  state = applyCurrentPoisonState(
    state,
    'enemy',
    'actor',
    'test.poison',
    true,
    undefined,
    2,
    captured,
  )
  state = applyCurrentBleedState(state, 'enemy', 'actor', 'test.bleed', 20, 2, true, captured)
  state = applyCurrentBurnState(
    state,
    'enemy',
    'actor',
    'test.burn',
    true,
    undefined,
    2,
    { ...captured, profile: { ...captured.profile, decayBasisPointsPerTick: 500 } },
    1000,
  )
  state = damage(JSON.parse(JSON.stringify(state))).state
  expect(hp(state, 'actor')).toBe(1000)
  expect(hp(end(state), 'actor')).toBe(940)
})
it('Burn backlash uses only the actual suppressed outgoing damage', () => {
  let state: CombatEncounterState = {
    ...apply(percentageDotEncounter()),
    dotTriggerPolicyVersion: 2,
  }
  state = applyCurrentBurnState(
    state,
    'enemy',
    'actor',
    'test.burn',
    true,
    undefined,
    2,
    {
      capturedDamage: 100,
      profile: { kind: 'attack-percentage', basisPoints: 2000, decayBasisPointsPerTick: 500 },
    },
    1000,
  )
  const hit = damage(state)
  expect(hp(hit.state)).toBe(925)
  expect(hp(hit.state, 'actor')).toBe(993)
})
it.each([true, false])(
  'pending direct damage reads active Suppress at settlement (still active=%s)',
  (active) => {
    let state: CombatEncounterState = apply(timed(), 10000, active ? 4 : 1)
    state = {
      ...state,
      effectTimingPolicy: { version: 8, modes: { damage: 'delayed', suppress: 'instant' } },
    }
    state = damage(state).state
    expect(hp(state)).toBe(1000)
    const settled = round(JSON.parse(JSON.stringify(state)), 3)
    expect(hp(settled)).toBe(active ? 1000 : 900)
  },
)
it.each(['next-round', 'delayed'] as const)(
  '%s Copy Debuffs merges captured potency and lifetime only on activation, with its round clock',
  (mode) => {
    let state = apply(timed(), 4000, 2)
    state = {
      ...state,
      effectTimingPolicy: {
        version: 8,
        modes: { suppress: 'instant', 'copy-statuses': mode },
      },
    }
    state = executeCombatAction(
      state,
      action([suppress(2000, 1, 'primary-unit')]),
      target,
      PV1F_COMBAT_CONTENT,
    ).state
    state = executeCombatAction(
      state,
      action([{ type: 'copy-statuses', mode: 'curse', recipient: 'primary-unit' }]),
      target,
      PV1F_COMBAT_CONTENT,
    ).state
    expect(rows(state, 'enemy')[0]!.potencyBasisPoints).toBe(2000)
    const activated = round(JSON.parse(JSON.stringify(state)), mode === 'delayed' ? 3 : 2)
    expect(rows(activated, 'enemy')).toEqual([
      expect.objectContaining({
        stacks: 1,
        potencyBasisPoints: 4000,
        durationScope: 'rounds',
        remainingRoundBoundaries: 2,
      }),
    ])
  },
)

it('Suppressed Basic on-hit forecast preserves its pre-Barrier, pre-HP-clamp meaning', () => {
  let state = apply(percentageDotEncounter())
  state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.hp = 3
  state = grantBarrier(state, 'enemy', 'enemy', 'test.barrier', 100).state as typeof state
  const forecast = forecastStatDrivenAttack(
    state as ReturnType<typeof percentageDotEncounter>,
    action([{ type: 'damage', recipient: 'primary-unit', amount: 100 }], 'basic-attack'),
    target,
    PV1F_COMBAT_CONTENT,
  )
  expect(forecast.mitigatedBaseDamage).toBe(75)
  expect(forecast.evaluation.projectedEffects).toContainEqual(
    expect.objectContaining({ effectType: 'damage', before: 3, after: 3 }),
  )
})

it.each([0, 99, 10001, 2500.1])(
  'restore rejects invalid Suppress magnitude %s',
  (potencyBasisPoints) => {
    const state = apply(timed())
    rows(state)[0]!.potencyBasisPoints = potencyBasisPoints
    expect(() => normalizeCombatRuntimeEncounterState(JSON.parse(JSON.stringify(state)))).toThrow()
  },
)
it.each([0, 5, 1.5])(
  'restore rejects invalid Suppress round duration %s',
  (remainingRoundBoundaries) => {
    const state = apply(timed())
    Object.assign(rows(state)[0]!, { durationScope: 'rounds', remainingRoundBoundaries })
    expect(() => normalizeCombatRuntimeEncounterState(JSON.parse(JSON.stringify(state)))).toThrow()
  },
)

it('rounds Suppress once at the final modifier boundary and preserves the 1% minimum authored percentage', () => {
  expect(scaleSuppressedDirectDamage(3, 15000, 2500)).toBe(3)
  expect(hp(damage(apply(percentageDotEncounter(), 100)).state)).toBe(901)
})

it('100% suppression survives an actual guaranteed critical receipt', () => {
  const base = percentageDotEncounter()
  base.statBridge.rulesVersion = 4
  for (const profile of base.statBridge.combatants)
    Object.assign(profile, {
      level: 50,
      criticalChance: profile.combatantId === 'actor' ? 10000 : 0,
    })
  const state = apply(base, 10000)
  const result = damage(state)
  expect(result.events).toContainEqual(
    expect.objectContaining({ event: 'combat_critical_resolved', critical: true }),
  )
  expect(hp(result.state)).toBe(1000)
})

it.each([
  { potencyBasisPoints: undefined },
  { sourceScopedMark: true },
  { blindsideModifiersBasisPoints: { side: 16000, rear: 22000 } },
])('restore rejects non-percentage Suppress metadata %s', (metadata) => {
  const state = apply(timed())
  Object.assign(rows(state)[0]!, metadata)
  expect(() => normalizeCombatRuntimeEncounterState(JSON.parse(JSON.stringify(state)))).toThrow()
})

it('100% suppresses direct damage through the actual Essence command and preserves its costs', () => {
  const base = percentageDotEncounter()
  base.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.temporaryResources = [
    ...createPv1fTemporaryResources(16),
  ]
  const essence = resolveEssenceForBuild('vanguard', null)!
  const run = (state: CombatEncounterState) =>
    executePv1fEssenceSkill({
      state: state as ReturnType<typeof percentageDotEncounter>,
      essence,
      primaryDisciplineId: 'vanguard',
      secondaryDisciplineId: null,
      combatContext: 'pve',
      selection: target,
    })
  expect(hp(run(base).state)).toBeLessThan(1000)
  const stopped = run(apply(base, 10000))
  expect(hp(stopped.state)).toBe(1000)
  expect(stopped.events).toContainEqual(
    expect.objectContaining({ event: 'action_economy_spent', amount: essence.skill.apCost }),
  )
  expect(stopped.events).toContainEqual(
    expect.objectContaining({ event: 'skill_cooldown_started', actionId: essence.skill.id }),
  )
})

it('Instant reapplication forecasts retain the stronger live percentage and longer actual duration', () => {
  const state = executeCombatAction(
    timed(),
    action([suppress(4000, 4, 'primary-unit')]),
    target,
    PV1F_COMBAT_CONTENT,
  ).state
  const preview = evaluateCombatAction(
    state,
    action([suppress(2000, 1, 'primary-unit')]),
    target,
    PV1F_COMBAT_CONTENT,
  )
  expect(preview.projectedEffects).toContainEqual(
    expect.objectContaining({
      statusId: 'suppress',
      potencyBasisPoints: 4000,
      remainingOwnerTurnEnds: 4,
    }),
  )
  expect(preview.projectedEvents).toContainEqual(
    expect.objectContaining({
      event: 'status_applied',
      potencyBasisPoints: 4000,
      remainingOwnerTurnStarts: 4,
    }),
  )
})
