import { describe, expect, it } from 'vitest'

import { createCombatEncounterState } from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { copiedSkillCommandId } from './combat-skill-copy'
import { createTacticalBattleState } from './board'
import {
  executePv1fCopiedSkill,
  executePv1fMatureSkill,
  evaluatePv1fCopiedSkill,
  evaluatePv1fMatureSkill,
} from './pv1f-action-economy'
import { resolveMatureSkillVersion, type MatureSkillDefinition } from './mature-skills'
import { createStatDrivenCombatEncounterState } from './stat-driven-combat'

const ACTOR = 'copy:actor'
const SOURCE = 'copy:source'

function staticSkill(id: string, version?: number): MatureSkillDefinition {
  const definition = resolveMatureSkillVersion(id, version)
  if (!definition) throw new Error(`Missing Skill fixture ${id}@${String(version)}.`)
  return definition
}

function copySkill(overrides: Partial<MatureSkillDefinition> = {}): MatureSkillDefinition {
  const base = staticSkill('vanguard.forceful-strike', 2)
  return {
    ...base,
    id: 'test.copy-skill',
    contentVersion: 1,
    apCost: 40,
    accuracyMode: 'automatic',
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 1,
      requiresLineOfSight: false,
      maximumElevationDifference: 1,
      friendlyFire: 'enemies-only',
    },
    effects: [{ type: 'copy', recipient: 'primary-unit' }],
    ...overrides,
  }
}

function state(seed = 0x4d415354) {
  const started = startBattle(
    createPendingBattle({
      battleId: 'battle:copy-test',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: seed,
      combatants: [
        {
          id: ACTOR,
          teamId: 'players',
          initiative: 20,
          baseMovementBudget: 2,
          hp: 100,
          maxHp: 100,
          mp: 20,
          maxMp: 20,
        },
        {
          id: SOURCE,
          teamId: 'enemies',
          initiative: 10,
          baseMovementBudget: 2,
          hp: 100,
          maxHp: 100,
          mp: 20,
          maxMp: 20,
        },
      ],
    }),
  ).state
  const tactical = createTacticalBattleState({
    battle: started,
    width: 3,
    height: 1,
    terrains: [{ id: 'open', traversalCost: 1 }],
    tiles: [0, 1, 2].map((x) => ({
      position: { x, y: 0 },
      elevation: 0,
      terrainId: 'open',
    })),
    movementProfiles: [{ id: 'ground', maxElevationStep: 1, terrainCostOverrides: [] }],
    placements: [
      {
        combatantId: ACTOR,
        position: { x: 0, y: 0 },
        facing: 'east',
        movementProfileId: 'ground',
      },
      {
        combatantId: SOURCE,
        position: { x: 1, y: 0 },
        facing: 'west',
        movementProfileId: 'ground',
      },
    ],
  })
  return createStatDrivenCombatEncounterState(createCombatEncounterState(tactical), [
    {
      combatantId: ACTOR,
      provenance: { kind: 'scenario', sourceId: 'scenario:copy:actor', sourceRulesVersion: 2 },
      accuracy: 10_000,
      evasion: 0,
      armor: 0,
      ward: 0,
      jump: 0,
      physicalPower: 10,
      mysticPower: 10,
    },
    {
      combatantId: SOURCE,
      provenance: { kind: 'scenario', sourceId: 'scenario:copy:source', sourceRulesVersion: 2 },
      accuracy: 10_000,
      evasion: 0,
      armor: 0,
      ward: 0,
      jump: 0,
      physicalPower: 10,
      mysticPower: 10,
    },
  ])
}

describe('PV-1F temporary Skill Copy integration', () => {
  it('previews the eligible pool without consuming the authoritative Copy RNG draw', () => {
    const before = state()
    const evaluated = evaluatePv1fMatureSkill(
      before,
      copySkill(),
      { kind: 'unit', combatantId: SOURCE },
      'pve',
      {
        copyContext: {
          sourceCombatantId: SOURCE,
          sourceSkills: [staticSkill('vanguard.cleave', 1), staticSkill('vanguard.guard-break', 1)],
        },
      },
    )

    expect(evaluated.evaluation.legal).toBe(true)
    expect(evaluated.evaluation.skillCopy).toEqual({
      sourceCombatantId: SOURCE,
      random: true,
      eligibleSkills: [
        { skillId: 'vanguard.cleave', contentVersion: 1 },
        { skillId: 'vanguard.guard-break', contentVersion: 1 },
      ],
      issues: [],
    })
    expect(before.tactical.battle.rng.draws).toBe(0)
  })

  it('forecasts and rolls Copy-only per-target accuracy without revealing the Copy roll', () => {
    const before = state()
    const definition = copySkill({
      accuracyMode: 'per-target',
      accuracyModifierBasisPoints: 0,
    })
    const options = {
      copyContext: {
        sourceCombatantId: SOURCE,
        sourceSkills: [staticSkill('vanguard.cleave', 1)],
      },
    }

    const evaluated = evaluatePv1fMatureSkill(
      before,
      definition,
      { kind: 'unit', combatantId: SOURCE },
      'pve',
      options,
    )
    expect(evaluated.evaluation.targetHitChances).toEqual([
      { targetCombatantId: SOURCE, hitChanceBasisPoints: 10_000 },
    ])
    expect(before.tactical.battle.rng.draws).toBe(0)

    const committed = executePv1fMatureSkill(
      before,
      definition,
      { kind: 'unit', combatantId: SOURCE },
      'pve',
      options,
    )
    expect(committed.state.tactical.battle.rng.draws).toBe(2)
    expect(committed.events).toContainEqual(
      expect.objectContaining({
        event: 'combat_accuracy_resolved',
        targetCombatantId: SOURCE,
        hit: true,
      }),
    )
    expect(committed.events).toContainEqual(
      expect.objectContaining({ event: 'temporary_skill_copied' }),
    )
  })

  it('commits exactly one deterministic Copy draw and persists the selected pinned Skill', () => {
    const result = executePv1fMatureSkill(
      state(),
      copySkill(),
      { kind: 'unit', combatantId: SOURCE },
      'pve',
      {
        copyContext: {
          sourceCombatantId: SOURCE,
          sourceSkills: [staticSkill('vanguard.cleave', 1), staticSkill('vanguard.guard-break', 1)],
        },
      },
    )

    expect(result.state.tactical.battle.rng.draws).toBe(1)
    expect(result.state.effectState?.temporarySkills).toHaveLength(1)
    expect(result.events).toContainEqual(
      expect.objectContaining({
        event: 'temporary_skill_copied',
        combatantId: ACTOR,
        sourceCombatantId: SOURCE,
      }),
    )
  })

  it('does not consume a Copy draw or grant a Skill when the selected target misses', () => {
    const before = state()
    before.statBridge.combatants = before.statBridge.combatants.map((profile) =>
      profile.combatantId === ACTOR
        ? { ...profile, accuracy: 0 }
        : profile.combatantId === SOURCE
          ? { ...profile, evasion: 10_000 }
          : profile,
    )
    const result = executePv1fMatureSkill(
      before,
      copySkill({ accuracyMode: 'per-target', accuracyModifierBasisPoints: -3_000 }),
      { kind: 'unit', combatantId: SOURCE },
      'pve',
      {
        copyContext: {
          sourceCombatantId: SOURCE,
          sourceSkills: [staticSkill('vanguard.cleave', 1)],
        },
      },
    )

    expect(result.state.tactical.battle.rng.draws).toBe(1)
    expect(result.state.effectState?.temporarySkills ?? []).toHaveLength(0)
    expect(result.events).not.toContainEqual(
      expect.objectContaining({ event: 'temporary_skill_copied' }),
    )
  })

  it('executes a granted copied Skill at half AP rounded up while preserving its MP cost', () => {
    const definition = {
      ...staticSkill('vanguard.forceful-strike', 2),
      apCost: 25,
      mpCost: 3,
    }
    const before = state()
    before.effectState = {
      ongoingRecovery: [],
      poison: [],
      bleed: [],
      burn: [],
      temporarySkills: [
        {
          combatantId: ACTOR,
          sourceCombatantId: SOURCE,
          skillId: definition.id,
          contentVersion: definition.contentVersion,
        },
      ],
      damageHistory: [],
    }

    const evaluated = evaluatePv1fCopiedSkill(
      before,
      definition,
      { kind: 'unit', combatantId: SOURCE },
      'pve',
    )
    expect(evaluated.cost).toBe(13)
    expect(evaluated.action.id).toBe(copiedSkillCommandId(definition.id, definition.contentVersion))
    expect(evaluated.evaluation.actionId).toBe(
      copiedSkillCommandId(definition.id, definition.contentVersion),
    )
    expect(evaluated.evaluation.mpCost).toBe(3)

    const result = executePv1fCopiedSkill(
      before,
      definition,
      { kind: 'unit', combatantId: SOURCE },
      'pve',
    )
    expect(result.state.effectState?.temporarySkills).toHaveLength(1)
  })
  it('omits the discrete Copy grant on a consecutive repeat', () => {
    const definition = copySkill()
    const copyContext = {
      sourceCombatantId: SOURCE,
      sourceSkills: [staticSkill('vanguard.cleave', 1), staticSkill('vanguard.guard-break', 1)],
    }
    const first = executePv1fMatureSkill(
      state(),
      definition,
      { kind: 'unit', combatantId: SOURCE },
      'pve',
      { copyContext },
    )

    const repeated = executePv1fMatureSkill(
      first.state,
      definition,
      { kind: 'unit', combatantId: SOURCE },
      'pve',
      { copyContext },
    )

    expect(repeated.state.effectState?.temporarySkills).toHaveLength(1)
    expect(repeated.events).not.toContainEqual(
      expect.objectContaining({ event: 'temporary_skill_copied' }),
    )
    expect(repeated.events).toContainEqual(
      expect.objectContaining({ event: 'skill_repeat_penalty_applied' }),
    )
  })
})
