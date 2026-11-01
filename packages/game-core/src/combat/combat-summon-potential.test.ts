import { captureBasicSkillSources, defaultBasicSkills } from './combat-basic-actions'
import { commitCombatAbilityCommand } from './combat-ability-command'
import { interceptCombatReversal } from './combat-reversal-interception'
import { applyCommittedReflect } from './combat-reflect'
import { describe, expect, it } from 'vitest'
import { validateCombatEncounterState, type CombatEffectDefinition } from './actions'
import { source } from './combat-behavior.test-utils'
import {
  reconcileCombatAbilitySources,
  combatAbilityCommandContext,
} from './combat-behavior-runtime'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import {
  createCurrentStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'
import { spawnCombatSummon, removeCombatSummon } from './combat-summons'
import { resolveMatureSkillVersion } from './mature-skills'
import {
  finishPv1fTurn,
  executePv1fSummonAbility,
  evaluatePv1fSummonAbility,
  preparePv1fTurnEconomy,
} from './pv1f-action-economy'
import { PV1F_COMBAT_CONTENT } from './pv1f-combat-content'
import { createCombatGroundArea } from './combat-ground-areas'
import { capSummonDamage } from './combat-summon-potency'
import { combatantDamagePotential, summonPotentialBudget } from './combat-summon-potential'

function encounter(): StatDrivenCombatEncounterState {
  const base = percentageDotEncounter()
  return {
    ...preparePv1fTurnEconomy(
      createCurrentStatDrivenCombatEncounterState(
        base,
        base.statBridge.combatants.map((row) => ({
          ...row,
          physicalPower: 20,
          mysticPower: 20,
          level: 1,
          criticalChance: 0,
        })),
      ),
    ),
    summonPotencyPolicyVersion: 1,
  }
}
function offensive(
  state: StatDrivenCombatEncounterState,
  owner: string,
  amount: number,
  options: { ap?: number; mp?: number; once?: boolean } = {},
) {
  const captured = {
    ...source(
      {
        costs: [
          { resource: 'ap', amount: options.ap ?? 50 },
          { resource: 'mp', amount: options.mp ?? 0 },
        ],
        activationLimits: options.once ? ['once-per-owner-turn' as const] : [],
        effects: Array.from({ length: Math.max(1, Math.ceil(amount / 20)) }, (_, index) => ({
          id: `damage-${index}`,
          payload: {
            type: 'damage' as const,
            recipient: 'primary-unit' as const,
            amount: Math.max(1, Math.min(20, amount - index * 20)),
          },
        })),
      },
      `potential-${owner}`,
    ),
    ownerCombatantId: owner,
  }
  return reconcileCombatAbilitySources(state, [
    ...(state.capturedAbilitySources ?? []),
    captured,
  ]) as StatDrivenCombatEncounterState
}
function configured(
  state = encounter(),
  potency: number | null = 4000,
  effects?: readonly CombatEffectDefinition[],
) {
  const original = resolveMatureSkillVersion('wildwarden.renewing-herbs')!.summonProfile!
  const { potencyBasisPoints: _previous, ...base } = original
  void _previous
  const profile = {
    ...base,
    ...(potency === null ? {} : { potencyBasisPoints: potency }),
    maxHp: 1000,
    maxMp: 100,
    stats: { ...base.stats, accuracy: 10000, physicalPower: 1000, mysticPower: 1000 },
    abilities: [
      {
        ...base.abilities[0]!,
        apCost: 1,
        mpCost: 0,
        target: {
          ...base.abilities[0]!.target,
          kind: 'unit' as const,
          teamPolicy: 'enemy' as const,
          friendlyFire: 'enemies-only' as const,
          shape: { kind: 'circle' as const, radius: 2 },
          minimumRange: 0,
          maximumRange: 5,
          requiresLineOfSight: false,
          maximumElevationDifference: null,
        },
        effects: effects ?? [
          { type: 'damage' as const, recipient: 'affected-units' as const, amount: 999 },
          { type: 'damage' as const, recipient: 'affected-units' as const, amount: 999 },
        ],
      },
    ],
  }
  return spawnCombatSummon(state, {
    ownerCombatantId: 'actor',
    sourceSkillId: 'test.summon',
    sourceSkillVersion: 1,
    profile,
    position: { x: 0, y: 1 },
    facing: 'east',
  })
}
function ready(state: StatDrivenCombatEncounterState) {
  const id = state.effectState!.summons![0]!.combatantId
  for (let n = 0; n < 12 && state.tactical.battle.currentTurn?.combatantId !== id; n++)
    state = finishPv1fTurn(state, 'east').state
  expect(state.tactical.battle.currentTurn?.combatantId).toBe(id)
  return state
}
function damage(events: readonly unknown[], id: string) {
  return events.reduce<number>((sum, value) => {
    const row = value as { event: string; amount?: number; sourceCombatantId?: string }
    return (
      sum + (row.event === 'damage_applied' && row.sourceCombatantId === id ? (row.amount ?? 0) : 0)
    )
  }, 0)
}
function sourceRow(state: StatDrivenCombatEncounterState) {
  return state.effectState!.summonDamageSources![0]!
}

describe('current encounter-based Summon damage potential', () => {
  it('keeps the fractional geometric mean until final percentage rounding', () => {
    expect(summonPotentialBudget(2, 100, 9990)).toBe(14)
    expect(summonPotentialBudget(100, 1000, 4000)).toBe(126)
    expect(summonPotentialBudget(1000, 100, 99900)).toBe(3159)
    expect(summonPotentialBudget(0, 100, 4000)).toBe(0)
  })
  it('uses strongest legal offensive Skill rather than strongest Basic Attack or weakest foe', () => {
    let state = offensive(offensive(encounter(), 'actor', 40), 'enemy', 100)
    expect(combatantDamagePotential(state, 'actor')).toBe(80)
    expect(combatantDamagePotential(state, 'enemy')).toBe(200)
    expect(combatantDamagePotential(state, 'other')).toBe(27)
    const spawned = configured(state).state
    expect(sourceRow(spawned)).toMatchObject({
      potencyPolicyVersion: 1,
      damageBudgetPerRound: 50,
      spentThisRound: 0,
    })
    state = {
      ...state,
      tactical: {
        ...state.tactical,
        battle: {
          ...state.tactical.battle,
          combatants: state.tactical.battle.combatants.map((row) =>
            row.id === 'enemy' ? { ...row, hp: 0 } : row,
          ),
        },
      },
    }
    expect(sourceRow(configured(state).state)).toMatchObject({ damageBudgetPerRound: 18 })
  })
  it('ignores depleted MP/AP but honors maximum capacity and legal activation counts', () => {
    let state = offensive(encounter(), 'enemy', 100, { ap: 10, mp: 5 })
    expect(combatantDamagePotential(state, 'enemy')).toBe(400)
    state = {
      ...state,
      tactical: {
        ...state.tactical,
        battle: {
          ...state.tactical.battle,
          combatants: state.tactical.battle.combatants.map((row) => ({
            ...row,
            mp: 0,
            temporaryResources: row.temporaryResources.map((resource) => ({
              ...resource,
              current: 0,
            })),
          })),
        },
      },
    }
    expect(combatantDamagePotential(state, 'enemy')).toBe(400)
    state = {
      ...state,
      tactical: {
        ...state.tactical,
        battle: {
          ...state.tactical.battle,
          combatants: state.tactical.battle.combatants.map((row) =>
            row.id === 'enemy' ? { ...row, maxMp: 4 } : row,
          ),
        },
      },
    }
    expect(combatantDamagePotential(state, 'enemy')).toBe(27)
    expect(combatantDamagePotential(offensive(encounter(), 'enemy', 100, { ap: 0 }), 'enemy')).toBe(
      100,
    )
    expect(
      combatantDamagePotential(
        offensive(encounter(), 'enemy', 100, { ap: 1, once: true }),
        'enemy',
      ),
    ).toBe(100)
  })
  it('uses committed power scaling and eligible effects without sampling combat RNG', () => {
    let state = offensive(encounter(), 'actor', 0)
    const captured = state.capturedAbilitySources![0]!
    state = reconcileCombatAbilitySources(
      { ...state, capturedAbilitySources: [], abilityRuntime: undefined },
      [
        {
          ...captured,
          definition: {
            schemaVersion: 1,
            behaviors: [
              {
                ...captured.definition.behaviors[0]!,
                effects: [
                  {
                    id: 'scaled',
                    payload: {
                      type: 'damage',
                      recipient: 'primary-unit',
                      amount: 2,
                      scaling: { source: 'physical-power', coefficientBasisPoints: 10000 },
                    },
                  },
                ],
              },
            ],
          },
        },
      ],
    ) as StatDrivenCombatEncounterState
    const snapshot = JSON.stringify(state)
    expect(combatantDamagePotential(state, 'actor')).toBe(44)
    expect(JSON.stringify(state)).toBe(snapshot)
    const geared = {
      ...state,
      statBridge: {
        ...state.statBridge,
        combatants: state.statBridge.combatants.map((row) =>
          row.combatantId === 'actor' ? { ...row, physicalPower: 50 } : row,
        ),
      },
    }
    expect(combatantDamagePotential(geared, 'actor')).toBe(104)
  })
  it.each([
    [40, 100, 50],
    [100, 40, 50],
    [40, 40, 32],
  ])(
    'freezes owner/enemy relationship %i/%i without a hidden ceiling',
    (owner, enemy, expected) => {
      const state = configured(
        offensive(offensive(encounter(), 'actor', owner), 'enemy', enemy),
      ).state
      expect(sourceRow(state)).toMatchObject({ damageBudgetPerRound: expected })
    },
  )
  it('shares a round budget across multiple hits, targets and later commands, then renews next round', () => {
    let state = ready(
      configured(offensive(offensive(encounter(), 'actor', 40), 'enemy', 100)).state,
    )
    const summon = state.effectState!.summons![0]!
    const before = JSON.stringify(state)
    const result = executePv1fSummonAbility(state, summon, summon.profile.abilities[0]!.id, {
      kind: 'unit',
      combatantId: 'enemy',
    })
    expect(damage(result.events, summon.combatantId)).toBe(50)
    expect(JSON.stringify(state)).toBe(before)
    expect(capSummonDamage(result.state, summon.combatantId, 'other', 999).amount).toBe(0)
    state = {
      ...result.state,
      tactical: {
        ...result.state.tactical,
        battle: { ...result.state.tactical.battle, round: result.state.tactical.battle.round + 1 },
      },
    }
    expect(capSummonDamage(state, summon.combatantId, 'other', 999).amount).toBe(50)
  })
  it('retains captured basis through reload, foe defeat and later offensive stat changes', () => {
    let state = configured(offensive(offensive(encounter(), 'actor', 40), 'enemy', 100)).state
    const id = state.effectState!.summons![0]!.combatantId
    state = JSON.parse(JSON.stringify(capSummonDamage(state, id, 'enemy', 20).state))
    state = {
      ...state,
      tactical: {
        ...state.tactical,
        battle: {
          ...state.tactical.battle,
          combatants: state.tactical.battle.combatants.map((row) =>
            row.id === 'enemy' ? { ...row, hp: 0 } : row,
          ),
        },
      },
      statBridge: {
        ...state.statBridge,
        combatants: state.statBridge.combatants.map((row) => ({ ...row, physicalPower: 999 })),
      },
    }
    expect(validateCombatEncounterState(state)).toEqual([])
    expect(capSummonDamage(state, id, 'other', 999).amount).toBe(30)
  })
  it('preserves uncapped omission and legacy per-command Basic limits', () => {
    const uncapped = configured(encounter(), null).state
    expect(uncapped.effectState!.summonDamageSources).toBeUndefined()
    const legacy = { ...encounter(), summonPotencyPolicyVersion: undefined }
    expect(sourceRow(configured(legacy).state)).not.toHaveProperty('potencyPolicyVersion')
  })
  it('keeps private round budgets after source expiry while persistent Ground remains', () => {
    let state = {
      ...configured(encounter()).state,
      groundEffectPolicyVersion: 1 as const,
      groundContactPolicyVersion: 1 as const,
    }
    const id = state.effectState!.summons![0]!.combatantId
    const summon = state.effectState!.summons![0]!
    state = createCombatGroundArea(
      state,
      id,
      {
        id: 'summon.ground',
        version: 1,
        sourceType: 'test',
        tags: [],
        cost: { mp: 0, spendsAction: false },
        requirements: [],
        target: {
          kind: 'ground-tile',
          teamPolicy: 'enemy',
          friendlyFire: 'enemies-only',
          shape: { kind: 'single' },
          minimumRange: 0,
          maximumRange: 5,
          requiresLineOfSight: false,
          maximumElevationDifference: null,
        },
        effects: [{ type: 'damage', recipient: 'affected-units', amount: 99 }],
        groundArea: { durationRounds: 3, visualPresetId: 'embers', entryEffectOrdinals: [0] },
      },
      [{ x: 2, y: 1 }],
      PV1F_COMBAT_CONTENT,
    ) as typeof state
    state = capSummonDamage(state, id, 'enemy', 5).state as typeof state
    state = removeCombatSummon(state, id, 'expired').state as typeof state
    expect(state.effectState!.summons).not.toContainEqual(summon)
    expect(validateCombatEncounterState(JSON.parse(JSON.stringify(state)))).toEqual([])
    expect(capSummonDamage(state, id, 'enemy', 999).amount).toBe(5)
  })

  it('normalizes HP as well as MP/AP when evaluating structural resource requirements', () => {
    let state = offensive(encounter(), 'actor', 40)
    const captured = state.capturedAbilitySources![0]!
    state = reconcileCombatAbilitySources(
      { ...state, capturedAbilitySources: [], abilityRuntime: undefined },
      [
        {
          ...captured,
          definition: {
            schemaVersion: 1,
            behaviors: [
              {
                ...captured.definition.behaviors[0]!,
                requirements: {
                  kind: 'resource-state',
                  subject: 'owner',
                  resource: 'hp',
                  comparison: 'at-least',
                  basisPoints: 9000,
                },
              },
            ],
          },
        },
      ],
    ) as StatDrivenCombatEncounterState
    expect(combatantDamagePotential(state, 'actor')).toBe(80)
    state = {
      ...state,
      tactical: {
        ...state.tactical,
        battle: {
          ...state.tactical.battle,
          combatants: state.tactical.battle.combatants.map((row) => ({ ...row, hp: 1, mp: 0 })),
        },
      },
    }
    expect(combatantDamagePotential(state, 'actor')).toBe(80)
  })
  it('shares the budget with native DoT ticks across two recipients and leaves previews pure', () => {
    let state = ready(
      configured(encounter(), 4000, [
        { type: 'poison', recipient: 'affected-units', power: 20, durationTurns: 3 },
      ]).state,
    )
    const summon = state.effectState!.summons![0]!
    const before = JSON.stringify(state)
    evaluatePv1fSummonAbility(state, summon, summon.profile.abilities[0]!.id, {
      kind: 'unit',
      combatantId: 'enemy',
    })
    expect(JSON.stringify(state)).toBe(before)
    const result = executePv1fSummonAbility(state, summon, summon.profile.abilities[0]!.id, {
      kind: 'unit',
      combatantId: 'enemy',
    })
    state = result.state
    expect(
      state.effectState!.poison.filter((row) => row.sourceCombatantId === summon.combatantId),
    ).toHaveLength(2)
    const totals = new Map<number, number>()
    for (let n = 0; n < 9; n++) {
      const round = state.tactical.battle.round
      const step = finishPv1fTurn(state, 'east')
      totals.set(round, (totals.get(round) ?? 0) + damage(step.events, summon.combatantId))
      state = step.state
    }
    expect([...totals.values()].some((value) => value === 10)).toBe(true)
    expect([...totals.values()].every((value) => value <= 10)).toBe(true)
  })
  it('models native Summon abilities once per turn, includes native scaling and HP capacity', () => {
    let state = configured(encounter(), 4000, [
      { type: 'damage', recipient: 'primary-unit', amount: 10 },
    ]).state
    state = { ...state, skillPacketPolicyVersion: 1 }
    const summon = state.effectState!.summons![0]!
    expect(combatantDamagePotential(state, summon.combatantId)).toBe(260)
    state = {
      ...state,
      effectState: {
        ...state.effectState!,
        summons: [
          {
            ...summon,
            profile: {
              ...summon.profile,
              abilities: [{ ...summon.profile.abilities[0]!, hpCost: 1000 }],
            },
          },
        ],
      },
    }
    expect(combatantDamagePotential(state, summon.combatantId)).toBe(0)
  })
  it('does not impose an opponent ceiling at high authored potency', () => {
    const state = configured(encounter(), 200000).state
    expect(sourceRow(state)).toMatchObject({ damageBudgetPerRound: 540 })
  })

  it('captures the private basis through a genuine canonical Summon command and JSON reload', () => {
    let state = offensive(offensive(encounter(), 'actor', 40), 'enemy', 100)
    const profile = configured(state, 4000, [
      { type: 'damage', recipient: 'primary-unit', amount: 10 },
    ]).state.effectState!.summons![0]!.profile
    const captured = {
      ...source(
        {
          classification: 'utility',
          attackFamily: undefined,
          costs: [{ resource: 'ap', amount: 10 }],
          targeting: {
            kind: 'empty-tile',
            geometryVersion: 3,
            categories: ['ground'],
            maximumSelections: 1,
            teamPolicy: 'any',
            friendlyFire: 'all-units',
            shape: { kind: 'single' },
            minimumRange: 0,
            maximumRange: 5,
            requiresLineOfSight: false,
            maximumElevationDifference: null,
          },
          effects: [
            { id: 'spawn', payload: { type: 'summon', recipient: 'selected-tile', profile } },
          ],
        },
        'canonical-summon',
      ),
      abilityId: 'test.canonical-summon',
    }
    state = reconcileCombatAbilitySources(state, [
      ...state.capturedAbilitySources!,
      captured,
    ]) as StatDrivenCombatEncounterState
    const before = JSON.stringify(state)
    const result = commitCombatAbilityCommand({
      state,
      actorId: 'actor',
      root: { kind: 'canonical', source: captured },
      selection: { kind: 'tile', position: { x: 0, y: 1 } },
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(state, captured),
    })
    expect(JSON.stringify(state)).toBe(before)
    const restored = JSON.parse(JSON.stringify(result.state)) as StatDrivenCombatEncounterState
    expect(validateCombatEncounterState(restored)).toEqual([])
    expect(sourceRow(restored)).toMatchObject({ potencyPolicyVersion: 1, damageBudgetPerRound: 50 })
  })
  it('spends the same round remainder on a native Reversal return', () => {
    const initial = encounter()
    const profile = configured(initial).state.effectState!.summons![0]!.profile
    const reversal = {
      type: 'reversal',
      recipient: 'actor',
      version: 1,
      family: 'physical',
      reflectionBasisPoints: 10000,
      attackerMaxHpCapBasisPoints: 10000,
      defenderMaxHpCapBasisPoints: 10000,
    } as const
    const ability = {
      ...profile.abilities[0]!,
      tags: ['utility'],
      target: {
        kind: 'self' as const,
        teamPolicy: 'self' as const,
        friendlyFire: 'allies-only' as const,
        shape: { kind: 'single' as const },
        minimumRange: 0,
        maximumRange: 0,
        requiresLineOfSight: false,
        maximumElevationDifference: null,
      },
      effects: [reversal],
    }
    let state = ready(
      spawnCombatSummon(
        { ...initial, reversalPolicyVersion: 1 },
        {
          ownerCombatantId: 'actor',
          sourceSkillId: 'test.reversal-summon',
          sourceSkillVersion: 1,
          profile: { ...profile, abilities: [ability] },
          position: { x: 0, y: 1 },
          facing: 'east',
        },
      ).state,
    )
    const summon = state.effectState!.summons![0]!
    state = capSummonDamage(state, summon.combatantId, 'enemy', 6)
      .state as StatDrivenCombatEncounterState
    const armed = executePv1fSummonAbility(state, summon, ability.id, { kind: 'self' }).state
    const result = interceptCombatReversal(armed, {
      actorId: 'enemy',
      recipientId: summon.combatantId,
      actionId: 'test.incoming',
      family: 'physical',
      wouldHpDamage: 100,
      content: PV1F_COMBAT_CONTENT,
    })!
    expect(result).toBeDefined()
    expect(result.events).toContainEqual(
      expect.objectContaining({ event: 'reversal_triggered', returnedDamage: 4 }),
    )
    expect(sourceRow(result.state as StatDrivenCombatEncounterState)).toMatchObject({
      spentThisRound: 10,
    })
    expect(capSummonDamage(result.state, summon.combatantId, 'other', 99).amount).toBe(0)
  })
  it('spends the same round remainder on incoming native Reflect and subsequent direct damage', () => {
    let state = configured(encounter()).state
    const id = state.effectState!.summons![0]!.combatantId
    state = capSummonDamage(state, id, 'enemy', 6).state as StatDrivenCombatEncounterState
    const reflect = {
      id: 'test.reflect',
      version: 1,
      maximumStacks: 1,
      durationOwnerTurnStarts: 3,
      damageTakenMultiplierBasisPoints: 10000,
      reflectBasisPoints: 10000,
      polarity: 'positive' as const,
      reactionClass: 'reactive' as const,
    }
    state = {
      ...state,
      statusState: state.statusState.map((row) =>
        row.combatantId === id
          ? {
              ...row,
              statuses: [
                {
                  statusId: reflect.id,
                  statusVersion: 1,
                  stacks: 1,
                  remainingOwnerTurnStarts: 3,
                  sourceCombatantId: id,
                },
              ],
            }
          : row,
      ),
    }
    const result = applyCommittedReflect(
      state,
      [
        {
          event: 'damage_applied',
          sourceCombatantId: 'enemy',
          targetCombatantId: id,
          actionId: 'test.incoming',
          amount: 100,
          hpBefore: 1000,
          hpAfter: 900,
        },
      ],
      { statuses: [...PV1F_COMBAT_CONTENT.statuses, reflect] },
      { sourceCombatantId: 'enemy', actionId: 'test.incoming' },
      undefined,
      true,
    )
    expect(damage(result.events, id)).toBe(4)
    expect(capSummonDamage(result.state, id, 'other', 999).amount).toBe(0)
  })
  it('uses genuine admitted Basic captures without trying to execute the walking facade', () => {
    const state = reconcileCombatAbilitySources(
      encounter(),
      captureBasicSkillSources({
        ownerCombatantId: 'actor',
        supportActionId: 'basic.guard',
        definitions: defaultBasicSkills(),
      }),
    ) as StatDrivenCombatEncounterState
    expect(combatantDamagePotential(state, 'actor')).toBe(27)
    expect(sourceRow(configured(state).state)).toMatchObject({ damageBudgetPerRound: 10 })
  })
  it('excludes a captured disabled Basic without restoring a native Basic fallback', () => {
    const state = reconcileCombatAbilitySources(
      encounter(),
      captureBasicSkillSources({
        ownerCombatantId: 'actor',
        supportActionId: 'basic.guard',
        definitions: defaultBasicSkills().map((row) =>
          row.id === 'unarmed.basic' ? { ...row, enabled: false } : row,
        ),
      }),
    ) as StatDrivenCombatEncounterState
    expect(combatantDamagePotential(state, 'actor')).toBe(0)
  })
  it('repeats once-per-action manual commands while retaining owner-turn limits', () => {
    let state = offensive(encounter(), 'actor', 20, { ap: 20 })
    const captured = state.capturedAbilitySources![0]!
    state = reconcileCombatAbilitySources(
      { ...state, capturedAbilitySources: [], abilityRuntime: undefined },
      [
        {
          ...captured,
          definition: {
            schemaVersion: 1,
            behaviors: [
              { ...captured.definition.behaviors[0]!, activationLimits: ['once-per-action'] },
            ],
          },
        },
      ],
    ) as StatDrivenCombatEncounterState
    expect(combatantDamagePotential(state, 'actor')).toBe(100)
  })
  it('uses captured global timing when normalizing template limits', () => {
    const state = offensive(encounter(), 'actor', 20, { ap: 20 })
    const captured = state.capturedAbilitySources![0]!
    const normalized = reconcileCombatAbilitySources(
      { ...state, capturedAbilitySources: [], abilityRuntime: undefined },
      [
        {
          ...captured,
          definition: {
            schemaVersion: 1,
            behaviors: [
              { ...captured.definition.behaviors[0]!, activationLimits: ['once-per-battle'] },
            ],
          },
        },
      ],
    ) as StatDrivenCombatEncounterState
    expect(
      combatantDamagePotential(
        {
          ...normalized,
          effectTimingPolicy: { version: 1, tagAuthority: 'global', modes: { damage: 'instant' } },
        },
        'actor',
      ),
    ).toBe(100)
    expect(
      combatantDamagePotential(
        {
          ...normalized,
          effectTimingPolicy: {
            version: 1,
            tagAuthority: 'global',
            modes: { damage: 'controlled' },
          },
        },
        'actor',
      ),
    ).toBe(27)
  })
  it('rejects missing active capped source rows instead of turning current damage uncapped', () => {
    const state = JSON.parse(
      JSON.stringify(configured(encounter()).state),
    ) as StatDrivenCombatEncounterState
    delete state.effectState!.summonDamageSources
    expect(validateCombatEncounterState(state)).toContainEqual(
      expect.objectContaining({ field: 'summonDamageSources' }),
    )
    expect(
      validateCombatEncounterState({ ...state, summonPotencyPolicyVersion: undefined }),
    ).toEqual([])
  })
  it('rejects JSON-stripped current budgets instead of downgrading them to historical Basic caps', () => {
    const state = JSON.parse(
      JSON.stringify(configured(encounter()).state),
    ) as StatDrivenCombatEncounterState
    const original = sourceRow(state)
    state.effectState!.summonDamageSources = [
      {
        combatantId: original.combatantId,
        ownerCombatantId: original.ownerCombatantId,
        potencyBasisPoints: original.potencyBasisPoints!,
      },
    ]
    expect(validateCombatEncounterState(state)).toContainEqual(
      expect.objectContaining({ field: 'summonDamageSources' }),
    )
    expect(
      validateCombatEncounterState({ ...state, summonPotencyPolicyVersion: undefined }),
    ).toEqual([])
  })
  it('rejects malformed policy and frozen budget state', () => {
    const state = configured(encounter()).state
    expect(
      validateCombatEncounterState({ ...state, summonPotencyPolicyVersion: 2 } as never),
    ).toContainEqual(expect.objectContaining({ field: 'summonPotencyPolicyVersion' }))
    const malformed = {
      ...state,
      effectState: {
        ...state.effectState!,
        summonDamageSources: [{ ...sourceRow(state), spentThisRound: -1 }],
      },
    }
    expect(validateCombatEncounterState(malformed as never)).toContainEqual(
      expect.objectContaining({ field: 'summonDamageSources' }),
    )
  })
})
