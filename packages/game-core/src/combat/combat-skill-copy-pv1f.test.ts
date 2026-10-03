import { describe, expect, it } from 'vitest'

import { createCombatEncounterState } from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { copiedSkillApCost, copiedSkillCommandId } from './combat-skill-copy'
import { createTacticalBattleState } from './board'
import { currentSkillDamageScaling } from './damage-scaling'
import {
  executePv1fCopiedSkill,
  executePv1fMatureSkill,
  evaluatePv1fCopiedSkill,
  evaluatePv1fMatureSkill,
  finishPv1fTurn,
} from './pv1f-action-economy'
import { resolveMatureSkillVersion, type MatureSkillDefinition } from './mature-skills'
import {
  createStatDrivenCombatEncounterState,
  STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_VERSION,
  STAT_DRIVEN_COMBAT_RULES_VERSION,
} from './stat-driven-combat'

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

function currentState() {
  const before = state()
  return {
    ...before,
    statBridge: {
      schemaVersion: STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_VERSION,
      rulesVersion: STAT_DRIVEN_COMBAT_RULES_VERSION,
      combatants: before.statBridge.combatants.map((profile) => ({
        ...profile,
        level: 50,
        physicalPower: 100,
        mysticPower: 100,
        criticalChance: 0,
      })),
    },
  }
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
      expect.objectContaining({
        event: 'combat_action_used',
        audioCueKey: 'skill.vanguard.forceful-strike.audio',
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

  it('weights current copied-Skill Power scaling by the copied half-AP command cost', () => {
    const definition = staticSkill('vanguard.forceful-strike')
    const before = currentState()
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
    const damage = evaluated.action.effects.find((effect) => effect.type === 'damage')

    expect(evaluated.cost).toBe(copiedSkillApCost(definition, 'pve'))
    expect(damage).toMatchObject({
      scaling: currentSkillDamageScaling('physical-power', 1, evaluated.cost),
    })
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
it('pins the selected copied Skill but grants access only in the following global round', () => {
  const result = executePv1fMatureSkill(
    { ...state(), effectTimingPolicy: { version: 1, modes: {} } },
    copySkill(),
    { kind: 'unit', combatantId: SOURCE },
    'pve',
    {
      copyContext: {
        sourceCombatantId: SOURCE,
        sourceSkills: [staticSkill('vanguard.cleave', 1)],
        actorCommittedSkills: [],
      },
    },
  )
  expect(result.state.effectState?.temporarySkills ?? []).toHaveLength(0)
  expect(result.state.pendingSkillGrants).toHaveLength(1)
})

it('forecasts Copy activation and battle lifetime without selecting the random Skill', () => {
  const encounter = { ...state(), effectTimingPolicy: { version: 1, modes: {} } }
  const before = JSON.parse(JSON.stringify(encounter))
  const preview = evaluatePv1fMatureSkill(
    encounter,
    copySkill(),
    { kind: 'unit', combatantId: SOURCE },
    'pve',
    {
      copyContext: {
        sourceCombatantId: SOURCE,
        sourceSkills: [staticSkill('vanguard.cleave', 1)],
        actorCommittedSkills: [],
      },
    },
  )
  expect(preview.evaluation.projectedEffects).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        effectType: 'copy',
        statusId: 'copy',
        after: 'pending',
        activationRound: 2,
        durationScope: 'battle',
      }),
    ]),
  )
  expect(encounter).toEqual(before)
})

describe('current beneficial effect Copy policy', () => {
  function beneficialState(modes: Record<string, 'instant' | 'next-round'> = { copy: 'instant' }) {
    const initial = state()
    return {
      ...initial,
      copyPolicyVersion: 1 as const,
      effectTimingPolicy: { version: 1, modes },
      statusState: initial.statusState.map((entry) => ({
        ...entry,
        statuses:
          entry.combatantId === SOURCE
            ? ['airborne', 'fortified', 'guarded', 'hexed', 'regeneration', 'warded'].map(
                (statusId) => ({
                  statusId,
                  statusVersion: 1,
                  stacks: statusId === 'guarded' ? 2 : 1,
                  sourceCombatantId: SOURCE,
                  remainingOwnerTurnStarts: 1,
                  remainingOwnerTurnEnds: 1,
                  timingState: 'active' as const,
                }),
              )
            : entry.combatantId === ACTOR
              ? [
                  {
                    statusId: 'guarded',
                    statusVersion: 1,
                    stacks: 2,
                    sourceCombatantId: ACTOR,
                    remainingOwnerTurnStarts: 1,
                    remainingOwnerTurnEnds: 1,
                    timingState: 'active' as const,
                  },
                ]
              : entry.statuses,
      })),
    }
  }
  function currentCopy() {
    return copySkill({
      flavorLine: 'Borrow the blessing.',
      authoring: { ...copySkill().authoring, validationTags: ['owner-rebalance-v5'] },
    })
  }
  it('supports an authored occupied ground-tile Copy source and rejects an empty tile', () => {
    const before = beneficialState()
    const skill: MatureSkillDefinition = {
      ...currentCopy(),
      target: { ...currentCopy().target, kind: 'ground-tile', maximumRange: 2 },
    }
    const target = { kind: 'tile' as const, position: { x: 1, y: 0 } }
    expect(evaluatePv1fMatureSkill(before, skill, target).evaluation.legal).toBe(true)
    expect(
      executePv1fMatureSkill(before, skill, target)
        .state.statusState.find((row) => row.combatantId === ACTOR)
        ?.statuses.map((row) => row.statusId),
    ).toEqual(['airborne', 'guarded', 'regeneration', 'warded'])
    expect(
      evaluatePv1fMatureSkill(before, skill, { kind: 'tile', position: { x: 2, y: 0 } }).evaluation
        .legal,
    ).toBe(false)
  })
  it('spends normal AP on a missed hostile Copy without transferring effects or drawing a Skill roll', () => {
    const before = beneficialState()
    before.statBridge = {
      ...before.statBridge,
      combatants: before.statBridge.combatants.map((profile) =>
        profile.combatantId === SOURCE ? { ...profile, evasion: 10_000 } : profile,
      ),
    }
    const skill: MatureSkillDefinition = {
      ...currentCopy(),
      accuracyMode: 'per-target',
      accuracyModifierBasisPoints: 0,
    }
    const preview = evaluatePv1fMatureSkill(before, skill, { kind: 'unit', combatantId: SOURCE })
    expect(preview.evaluation.targetHitChances).toEqual([
      { targetCombatantId: SOURCE, hitChanceBasisPoints: 0 },
    ])
    const result = executePv1fMatureSkill(before, skill, { kind: 'unit', combatantId: SOURCE })
    expect(result.state.statusState).toEqual(before.statusState)
    expect(result.state.tactical.battle.rng.draws).toBe(1)
    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: 'action_economy_spent', amount: 40, remaining: 60 }),
      ]),
    )
    expect(
      result.events.some(
        (event) =>
          typeof event === 'object' &&
          event !== null &&
          'event' in event &&
          event.event === 'temporary_skill_copied',
      ),
    ).toBe(false)
  })
  it('keeps composed authored effect origins aligned when the Copy operation is materialized first', () => {
    const before = beneficialState()
    const copyOrigin = { family: 'skill' as const, contentId: 'copy-origin', contentVersion: 1 }
    const damageOrigin = { family: 'skill' as const, contentId: 'damage-origin', contentVersion: 1 }
    const skill: MatureSkillDefinition = {
      ...currentCopy(),
      effects: [{ type: 'damage', recipient: 'primary-unit', amount: 5 }, ...currentCopy().effects],
    }
    const result = evaluatePv1fMatureSkill(
      before,
      skill,
      { kind: 'unit', combatantId: SOURCE },
      'pve',
      { effectOrigins: [damageOrigin, copyOrigin] },
    )
    expect(result.evaluation.legal).toBe(true)
    expect(result.action.effectOrigins).toEqual([copyOrigin, damageOrigin])
    expect(result.action.effectTimingTags).toEqual(['copy', 'damage'])
  })
  it('preserves authored positive potency when copying a named effect', () => {
    const before = beneficialState()
    before.statusState = before.statusState.map((row) =>
      row.combatantId === SOURCE
        ? { ...row, statuses: [{ ...row.statuses[0]!, potencyBasisPoints: 2500 }] }
        : row,
    )
    const result = executePv1fMatureSkill(before, currentCopy(), {
      kind: 'unit',
      combatantId: SOURCE,
    })
    expect(
      result.state.statusState
        .find((row) => row.combatantId === ACTOR)
        ?.statuses.find((status) => status.statusId === 'airborne')?.potencyBasisPoints,
    ).toBe(2500)
  })
  it('copies Covert under current Copy while pending donor tags remain inactive', () => {
    const before = beneficialState()
    before.statusState = before.statusState.map((row) =>
      row.combatantId === SOURCE
        ? {
            ...row,
            statuses: [
              { ...row.statuses[0]!, timingState: 'pending' as const, activationRound: 2 },
              { ...row.statuses[0]!, statusId: 'covert', statusVersion: 1 },
            ],
          }
        : row,
    )
    const result = executePv1fMatureSkill(before, currentCopy(), {
      kind: 'unit',
      combatantId: SOURCE,
    })
    expect(
      result.state.statusState
        .find((row) => row.combatantId === ACTOR)
        ?.statuses.map((status) => status.statusId),
    ).toEqual(['covert', 'guarded'])
  })
  it('previews and commits all positive named effects without Skills, RNG or donor mutation', () => {
    const before = beneficialState()
    const frozen = JSON.stringify(before)
    const preview = evaluatePv1fMatureSkill(before, currentCopy(), {
      kind: 'unit',
      combatantId: SOURCE,
    })
    expect(preview.evaluation.legal).toBe(true)
    expect(preview.evaluation.skillCopy).toBeUndefined()
    expect(
      preview.evaluation.projectedEffects.filter((row) => row.effectType === 'copy-statuses'),
    ).toHaveLength(4)
    const result = executePv1fMatureSkill(before, currentCopy(), {
      kind: 'unit',
      combatantId: SOURCE,
    })
    expect(result.state.statusState.find((row) => row.combatantId === ACTOR)?.statuses).toEqual([
      expect.objectContaining({ statusId: 'airborne', stacks: 1, remainingOwnerTurnEnds: 1 }),
      expect.objectContaining({ statusId: 'guarded', stacks: 3, remainingOwnerTurnEnds: 1 }),
      expect.objectContaining({ statusId: 'regeneration', stacks: 1, remainingOwnerTurnEnds: 1 }),
      expect.objectContaining({ statusId: 'warded', stacks: 1, remainingOwnerTurnEnds: 1 }),
    ])
    expect(result.state.effectState?.temporarySkills ?? []).toEqual([])
    expect(result.state.tactical.battle.rng.draws).toBe(0)
    expect(result.state.statusState.find((row) => row.combatantId === SOURCE)).toEqual(
      before.statusState.find((row) => row.combatantId === SOURCE),
    )
    expect(JSON.stringify(before)).toBe(frozen)
  })
  it('rejects an empty or exclusively negative donor before spending', () => {
    const before = beneficialState()
    before.statusState = before.statusState.map((row) =>
      row.combatantId === SOURCE
        ? { ...row, statuses: row.statuses.filter((status) => status.statusId === 'hexed') }
        : row,
    )
    expect(
      evaluatePv1fMatureSkill(before, currentCopy(), { kind: 'unit', combatantId: SOURCE })
        .evaluation.legal,
    ).toBe(false)
    expect(() =>
      executePv1fMatureSkill(before, currentCopy(), { kind: 'unit', combatantId: SOURCE }),
    ).toThrow(/eligible active statuses/)
  })
  it('schedules Copy using its own timing override and captures remaining lifetimes', () => {
    const before = beneficialState({ 'copy-statuses': 'instant' })
    const preview = evaluatePv1fMatureSkill(before, currentCopy(), {
      kind: 'unit',
      combatantId: SOURCE,
    })
    expect(preview.evaluation.projectedEffects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          effectType: 'copy-statuses',
          statusId: 'beneficial-copy',
          after: 'pending',
          activationRound: 2,
          combatantId: ACTOR,
        }),
      ]),
    )
    let result = executePv1fMatureSkill(before, currentCopy(), {
      kind: 'unit',
      combatantId: SOURCE,
    }).state
    expect(result.pendingEffects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          timingTag: 'copy',
          activationRound: 2,
          effect: expect.objectContaining({ type: 'copy-statuses', beneficialEffects: true }),
        }),
      ]),
    )
    result = finishPv1fTurn(result, 'east').state
    result = finishPv1fTurn(result, 'west').state
    expect(result.tactical.battle.round).toBe(2)
    expect(result.statusState.find((row) => row.combatantId === SOURCE)?.statuses).toHaveLength(0)
    expect(result.statusState.find((row) => row.combatantId === ACTOR)?.statuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ statusId: 'airborne', remainingOwnerTurnEnds: 1 }),
      ]),
    )
    result = finishPv1fTurn(result, 'east').state
    expect(result.statusState.find((row) => row.combatantId === ACTOR)?.statuses).toHaveLength(0)
  })
})
