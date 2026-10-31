import { expect, it } from 'vitest'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import {
  createCurrentStatDrivenCombatEncounterState,
  reattachStatDrivenCombatBridge,
} from './stat-driven-combat'
import { spawnCombatSummon } from './combat-summons'
import { resolveMatureSkillVersion } from './mature-skills'
import { source } from './combat-behavior.test-utils'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import {
  reconcileCombatAbilitySources,
  primeCombatControlledAbility,
} from './combat-behavior-runtime'
import {
  executePv1fSummonAbility,
  preparePv1fTurnEconomy,
  PV1F_COMBAT_CONTENT,
} from './pv1f-action-economy'
import { validateCombatEncounterState } from './actions'

function reactingSummonTurn(reaction: 'reversal' | 'counter') {
  const base = percentageDotEncounter()
  const initial = createCurrentStatDrivenCombatEncounterState(
    base,
    base.statBridge.combatants.map((row) => ({
      ...row,
      physicalPower: row.physicalPower ?? 20,
      mysticPower: row.mysticPower ?? 20,
      level: 1,
      criticalChance: 0,
    })),
  )
  const template = resolveMatureSkillVersion('wildwarden.renewing-herbs')!.summonProfile!
  const ability = {
    ...template.abilities[0]!,
    tags: ['attack', 'physical'],
    apCost: 45,
    target: {
      ...template.abilities[0]!.target,
      teamPolicy: 'enemy' as const,
      minimumRange: 1,
      maximumRange: 20,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
    },
    effects: [{ type: 'damage' as const, recipient: 'primary-unit' as const, amount: 40 }],
  }
  const spawned = spawnCombatSummon(initial, {
    ownerCombatantId: 'enemy',
    sourceSkillId: 'test.summon',
    sourceSkillVersion: 1,
    profile: {
      ...template,
      initiative: 1,
      stats: { ...template.stats, accuracy: 10000 },
      abilities: [ability],
    },
    position: { x: 0, y: 1 },
    facing: 'south',
  })
  const summon = spawned.state.effectState!.summons![0]!
  let prepared = preparePv1fTurnEconomy(spawned.state)
  if (reaction === 'reversal') {
    const captured = captureCombatAbilitySource(
      source({
        id: 'prepare',
        classification: 'utility',
        attackFamily: undefined,
        costs: [
          { resource: 'ap', amount: 50 },
          { resource: 'mp', amount: 5 },
        ],
        targeting: {
          kind: 'self',
          teamPolicy: 'self',
          friendlyFire: 'allies-only',
          shape: { kind: 'single' },
          minimumRange: 0,
          maximumRange: 0,
          requiresLineOfSight: false,
          maximumElevationDifference: null,
          maximumSelections: 1,
        },
        effects: [
          {
            id: 'reversal',
            timing: 'controlled',
            payload: {
              type: 'reversal',
              recipient: 'actor',
              version: 1,
              family: 'physical',
              reflectionBasisPoints: 10000,
              attackerMaxHpCapBasisPoints: 2000,
              defenderMaxHpCapBasisPoints: 2500,
            },
          },
        ],
      }),
    )
    const reconciled = reconcileCombatAbilitySources(prepared, [captured])
    const primed = primeCombatControlledAbility({
      state: reconciled,
      actorId: 'actor',
      sourceInstanceId: captured.sourceInstanceId,
      behaviorId: 'prepare',
      content: PV1F_COMBAT_CONTENT,
    })
    prepared = reattachStatDrivenCombatBridge(primed.state, prepared.statBridge)
  } else {
    prepared = {
      ...prepared,
      statusState: prepared.statusState.map((row) =>
        row.combatantId !== 'actor'
          ? row
          : {
              ...row,
              statuses: [
                ...row.statuses,
                {
                  statusId: 'counter',
                  statusVersion: 1,
                  stacks: 1,
                  remainingOwnerTurnStarts: 2,
                  sourceCombatantId: 'actor',
                  counter: { kind: 'full', basisPoints: 10000 },
                },
              ],
            },
      ),
    }
  }
  const battle = prepared.tactical.battle
  const state = {
    ...prepared,
    frozenGroundPolicyVersion: 1 as const,
    terrainOverlays: [
      {
        kind: 'frozen' as const,
        frozenGroundPolicyVersion: 1 as const,
        position: { x: 0, y: 1 },
        sourceCombatantId: 'actor',
        remainingRoundBoundaries: 2,
        skillApSurcharge: 27,
      },
    ],
    tactical: {
      ...prepared.tactical,
      battle: {
        ...battle,
        initiativeOrder: [...battle.initiativeOrder, summon.combatantId],
        deferredInitiativeCombatantIds: [],
        currentTurn: {
          ...battle.currentTurn!,
          combatantId: summon.combatantId,
          initiativeIndex: battle.initiativeOrder.length,
          movementMaximum: summon.profile.movementBudget,
          movementRemaining: summon.profile.movementBudget,
          movementSpent: 0,
          actionState: 'ready' as const,
        },
        combatants: battle.combatants.map((unit) =>
          unit.id === summon.combatantId ? { ...unit, hp: 1 } : unit,
        ),
      },
    },
  }
  return { state, summon, ability }
}

it.each(['reversal', 'counter'] as const)(
  'settles the native Summon Skill payment before cleanup when %s defeats its caster',
  (reaction) => {
    const { state, summon, ability } = reactingSummonTurn(reaction)
    expect(validateCombatEncounterState(state)).toEqual([])
    const result = executePv1fSummonAbility(state, summon, ability.id, {
      kind: 'unit',
      combatantId: 'actor',
    })
    expect(
      result.state.tactical.battle.combatants.some((unit) => unit.id === summon.combatantId),
    ).toBe(false)
    expect(
      result.state.effectState?.summons?.some((row) => row.combatantId === summon.combatantId),
    ).toBe(false)
    expect(result.events).toContainEqual(
      expect.objectContaining({
        event: 'action_economy_spent',
        combatantId: summon.combatantId,
        amount: 72,
        remaining: 28,
      }),
    )
    expect(result.events).toContainEqual(
      expect.objectContaining({
        event: 'summon_ability_used',
        combatantId: summon.combatantId,
        actionId: ability.id,
      }),
    )
    expect(
      result.events.filter((event) => (event as { event: string }).event === 'summon_defeated'),
    ).toHaveLength(1)
    expect(validateCombatEncounterState(result.state)).toEqual([])
  },
)
