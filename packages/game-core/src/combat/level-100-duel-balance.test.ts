import { describe, expect, it } from 'vitest'
import { calculateDerivedStats } from '../character/derived-stats'
import type { CharacterAttributes } from '../character/creation'
import {
  foundationDisciplineAttributePolicy,
  validateAttributeAllocation,
} from '../character/attribute-allocation'
import { createCombatEncounterState } from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import { defaultCombatEffectTimingPolicy } from './combat-effect-timing'
import {
  createCharacterDerivedCombatProfile,
  createDuelBalancedCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'
import { resolveMatureSkillVersion } from './mature-skills'
import {
  calculatePv1fBasicAttackDamage,
  createPv1fTemporaryResources,
  evaluatePv1fAction,
  evaluatePv1fMatureSkill,
  executePv1fAction,
  executePv1fMatureSkill,
  finishPv1fTurn,
  readPv1fActionEconomy,
  PV1F_BASIC_ATTACK_ID,
} from './pv1f-action-economy'

const references: readonly {
  discipline: 'vanguard' | 'aetherist'
  attributes: CharacterAttributes
  skills: readonly string[]
}[] = [
  {
    discipline: 'vanguard',
    attributes: { might: 40, finesse: 15, vitality: 40, agility: 13, intellect: 3, resolve: 24 },
    skills: ['guard-break', 'forceful-strike', 'cleave', 'sweeping-strike'],
  },
  {
    discipline: 'aetherist',
    attributes: { might: 2, finesse: 15, vitality: 40, agility: 13, intellect: 40, resolve: 25 },
    skills: ['mana-burst', 'chain-spark', 'overchannel', 'arc-bolt'],
  },
]

function directDuel(reference: (typeof references)[number], seed: number): number {
  expect(
    validateAttributeAllocation({
      attributes: reference.attributes,
      level: 100,
      policy: foundationDisciplineAttributePolicy(reference.discipline),
      requireFullPool: true,
    }),
  ).toEqual([])
  const snapshot = calculateDerivedStats({ attributes: reference.attributes, level: 100 })
  const stats = snapshot.stats
  expect(stats.maxHp.value).toBe(500)
  const battle = startBattle(
    createPendingBattle({
      battleId: 'duel:reference',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: seed,
      combatants: ['a', 'b'].map((id, index) => ({
        id,
        teamId: id,
        initiative: stats.initiative.value + 1 - index,
        baseMovementBudget: stats.movement.value,
        hp: stats.maxHp.value,
        maxHp: stats.maxHp.value,
        mp: stats.maxMp.value,
        maxMp: stats.maxMp.value,
        temporaryResources: createPv1fTemporaryResources(
          calculatePv1fBasicAttackDamage({ physicalPower: stats.physicalPower.value }),
        ),
      })),
    }),
  ).state
  const base = createCombatEncounterState(
    createTacticalBattleState({
      battle,
      width: 2,
      height: 1,
      terrains: [{ id: 'ground', traversalCost: 1 }],
      tiles: [0, 1].map((x) => ({ position: { x, y: 0 }, terrainId: 'ground', elevation: 0 })),
      movementProfiles: [
        { id: 'ground', maxElevationStep: stats.jump.value, terrainCostOverrides: [] },
      ],
      placements: ['a', 'b'].map((combatantId, x) => ({
        combatantId,
        position: { x, y: 0 },
        facing: x === 0 ? 'east' : 'west',
        movementProfileId: 'ground',
      })),
    }),
  )
  let state: StatDrivenCombatEncounterState = createDuelBalancedCombatEncounterState(
    {
      ...base,
      effectStackingPolicyVersion: 1,
      effectTimingPolicy: defaultCombatEffectTimingPolicy(),
    },
    ['a', 'b'].map((id) => createCharacterDerivedCombatProfile(id, id, 100, snapshot)),
  )
  const skills = reference.skills.map((id) => {
    const skill = resolveMatureSkillVersion(`${reference.discipline}.${id}`)
    if (!skill) throw new Error('Reference Skill is missing.')
    return skill
  })
  for (let turn = 0; turn < 120; turn += 1) {
    const actor = state.tactical.battle.currentTurn?.combatantId
    if (!actor) throw new Error('Reference duel unexpectedly lost its acting combatant.')
    const selection = { kind: 'unit', combatantId: actor === 'a' ? 'b' : 'a' } as const
    for (const skill of skills) {
      const preview = evaluatePv1fMatureSkill(state, skill, selection)
      if (
        !preview.evaluation.legal ||
        !preview.prepared ||
        preview.cost > (readPv1fActionEconomy(preview.prepared, actor)?.current ?? 0)
      )
        continue
      state = executePv1fMatureSkill(state, skill, selection).state
      if (state.tactical.battle.combatants.some((unit) => unit.hp === 0))
        return state.tactical.battle.round
    }
    while (evaluatePv1fAction(state, PV1F_BASIC_ATTACK_ID, selection).evaluation.legal) {
      state = executePv1fAction(state, PV1F_BASIC_ATTACK_ID, selection).state
      if (state.tactical.battle.combatants.some((unit) => unit.hp === 0))
        return state.tactical.battle.round
    }
    state = finishPv1fTurn(state, actor === 'a' ? 'east' : 'west').state
  }
  throw new Error('Reference duel exceeded sixty rounds.')
}

describe('Level100 ordinary four-Skill direct-pressure balance', () => {
  it('keeps legal physical and mystic Core40/HP40 mirrors near twelve rounds across seeded hits and cooldowns', () => {
    const averages = references.map((reference) => {
      const rounds = Array.from({ length: 100 }, (_, index) =>
        directDuel(reference, 100001 + index * 7919),
      )
      const mean = rounds.reduce((sum, round) => sum + round, 0) / rounds.length
      expect(mean, reference.discipline).toBeGreaterThanOrEqual(10.5)
      expect(mean, reference.discipline).toBeLessThanOrEqual(13.5)
      expect(new Set(rounds).size).toBeGreaterThan(1)
      return mean
    })
    // Automatic Mystic Basic Attack now uses Mystic Defense in the mystic mirror.
    // Keep the natural twelve-round target without tuning damage to a scripted finish.
    expect((averages[0]! + averages[1]!) / 2).toBeGreaterThanOrEqual(11)
    expect((averages[0]! + averages[1]!) / 2).toBeLessThanOrEqual(13)
  }, 60_000)
})
