import { describe, expect, it } from 'vitest'

import { createCombatEncounterState } from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import { attachCombatBuildBridge, type CombatBuildSnapshot } from './build-snapshot'
import { createPv1fTemporaryResources, readPv1fActionEconomy } from './pv1f-action-economy'
import {
  chooseBuildAwareRecruitAiDecision,
  committedMatureSkills,
  executeBuildAwareRecruitAiAction,
} from './recruit-ai-build'
import { RECRUIT_STANDARD_PROFILE } from './recruit-ai'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
  type StatDrivenCombatProfile,
} from './stat-driven-combat'

const actorId = 'character:00000000-0000-4000-8000-000000003731'
const targetId = 'character:00000000-0000-4000-8000-000000003732'

function pureSnapshot(): CombatBuildSnapshot {
  return {
    schemaVersion: 1,
    sourceBuildSchemaVersion: 2,
    sourceBuildVersion: 11,
    fingerprint: `sha256:${'c'.repeat(64)}`,
    primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
    secondary: null,
    disciplineSkills: [
      {
        slotIndex: 1,
        skillId: 'vanguard.forceful-strike',
        contentVersion: 2,
        sourceDisciplineId: 'vanguard',
      },
    ],
    extensions: {
      resonance: null,
      essence: {
        essenceId: 'essence.vanguard.unbroken-strike',
        contentVersion: 1,
        sourceDisciplineId: 'vanguard',
        skillId: 'essence.vanguard.unbroken-strike',
        skillContentVersion: 1,
      },
      equipmentSkills: [],
      supernatural: null,
      prestige: null,
    },
  }
}

function encounter(withBuild = true): StatDrivenCombatEncounterState {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:p3.7-build-aware-ai',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: 73731,
      combatants: [
        {
          id: actorId,
          teamId: 'opponents',
          initiative: 20,
          baseMovementBudget: 4,
          hp: 100,
          maxHp: 100,
          mp: 40,
          maxMp: 40,
          temporaryResources: createPv1fTemporaryResources(16),
        },
        {
          id: targetId,
          teamId: 'players',
          initiative: 10,
          baseMovementBudget: 4,
          hp: 50,
          maxHp: 50,
          mp: 30,
          maxMp: 30,
          temporaryResources: createPv1fTemporaryResources(16),
        },
      ],
    }),
  ).state
  const tactical = createTacticalBattleState({
    battle,
    width: 2,
    height: 1,
    terrains: [{ id: 'open-ground', traversalCost: 1 }],
    tiles: [
      { position: { x: 0, y: 0 }, elevation: 0, terrainId: 'open-ground' },
      { position: { x: 1, y: 0 }, elevation: 0, terrainId: 'open-ground' },
    ],
    movementProfiles: [
      { id: 'actor-ground', maxElevationStep: 1, terrainCostOverrides: [] },
      { id: 'target-ground', maxElevationStep: 1, terrainCostOverrides: [] },
    ],
    placements: [
      {
        combatantId: actorId,
        position: { x: 0, y: 0 },
        facing: 'east',
        movementProfileId: 'actor-ground',
      },
      {
        combatantId: targetId,
        position: { x: 1, y: 0 },
        facing: 'west',
        movementProfileId: 'target-ground',
      },
    ],
  })
  const profiles: StatDrivenCombatProfile[] = [
    {
      combatantId: actorId,
      provenance: {
        kind: 'character-derived',
        sourceId: actorId,
        sourceRulesVersion: 1,
      },
      accuracy: 10_000,
      evasion: 0,
      armor: 0,
      ward: 0,
      jump: 1,
    },
    {
      combatantId: targetId,
      provenance: {
        kind: 'character-derived',
        sourceId: targetId,
        sourceRulesVersion: 1,
      },
      accuracy: 10_000,
      evasion: 0,
      armor: 0,
      ward: 0,
      jump: 1,
    },
  ]
  const base = createStatDrivenCombatEncounterState(createCombatEncounterState(tactical), profiles)
  return withBuild
    ? attachCombatBuildBridge(base, [
        {
          combatantId: actorId,
          characterId: '00000000-0000-4000-8000-000000003731',
          snapshot: pureSnapshot(),
        },
      ])
    : base
}

describe('P3.7 build-aware Recruit AI', () => {
  it('enumerates only mature Skills frozen in the active combatant snapshot', () => {
    expect(committedMatureSkills(encounter(), actorId).map((skill) => skill.id)).toEqual([
      'essence.vanguard.unbroken-strike',
      'vanguard.forceful-strike',
    ])
    expect(committedMatureSkills(encounter(false), actorId)).toEqual([])
  })

  it('chooses the committed Essence when its legal utility beats the basic-action baseline', () => {
    const decision = chooseBuildAwareRecruitAiDecision({
      state: encounter(),
      profile: RECRUIT_STANDARD_PROFILE,
      tieBreakSeed: 73731,
    })

    expect(decision.intent).toEqual({
      kind: 'action',
      actionId: 'essence.vanguard.unbroken-strike',
      target: { kind: 'unit', combatantId: targetId },
    })
    expect(decision.reason).toBe('legal-damage')
  })

  it('executes a committed Essence through canonical AP/cooldown combat authority', () => {
    const result = executeBuildAwareRecruitAiAction(
      encounter(),
      'essence.vanguard.unbroken-strike',
      { kind: 'unit', combatantId: targetId },
    )

    expect(readPv1fActionEconomy(result.state, actorId)?.current).toBe(45)
    expect(result.state.tactical.battle.combatants.find((row) => row.id === targetId)?.hp).toBe(30)
    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'skill_cooldown_started',
          actionId: 'essence.vanguard.unbroken-strike',
        }),
        expect.objectContaining({
          event: 'action_economy_spent',
          combatantId: actorId,
          amount: 55,
          remaining: 45,
        }),
      ]),
    )
  })

  it('fails closed when an uncommitted mature Skill is requested', () => {
    expect(() =>
      executeBuildAwareRecruitAiAction(encounter(), 'lifebinder.mending-light', { kind: 'self' }),
    ).toThrow('Unsupported PV-1F action lifebinder.mending-light.')
  })
})
