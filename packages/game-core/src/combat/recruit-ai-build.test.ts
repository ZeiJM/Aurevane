import {
  capturedMatureSkillAbilitySource,
  capturedResonanceAbilitySource,
} from './combat-action-source'
import { reconcileCombatAbilitySources } from './combat-behavior-runtime'
import { validateAbilityDefinition, type AbilityDefinition } from './combat-definition'
import { ADVANCED_DISCIPLINES } from '../character/advanced-disciplines'
import { latestEnabledMatureSkills, resolveMatureSkillVersion } from './mature-skills'
import { resolveEssenceForBuild, essenceSnapshotReference } from './essence'
import { resolveResonanceForPair, resonanceSnapshotReference } from './resonance'
import { convertV5ResonanceToV2 } from './resonance-v2'
import {
  finishPv1fTurn,
  PV1F_BASIC_ATTACK_ID,
  PV1F_GUARD_ACTION_ID,
  PV1F_MP_RECOVER_ACTION_ID,
  PV1F_RECOVER_ACTION_ID,
} from './pv1f-action-economy'
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

  it('executes a committed Essence through canonical AP/repeat-use combat authority', () => {
    const result = executeBuildAwareRecruitAiAction(
      encounter(),
      'essence.vanguard.unbroken-strike',
      { kind: 'unit', combatantId: targetId },
    )

    expect(readPv1fActionEconomy(result.state, actorId)?.current).toBe(45)
    expect(result.state.tactical.battle.combatants.find((row) => row.id === targetId)?.hp).toBe(30)
    expect(result.events).not.toContainEqual(
      expect.objectContaining({
        event: 'skill_cooldown_started',
        actionId: 'essence.vanguard.unbroken-strike',
      }),
    )
    expect(result.events).toContainEqual(
      expect.objectContaining({
        event: 'action_economy_spent',
        combatantId: actorId,
        amount: 55,
        remaining: 45,
      }),
    )
  })

  it('fails closed when an uncommitted mature Skill is requested', () => {
    expect(() =>
      executeBuildAwareRecruitAiAction(encounter(), 'lifebinder.mending-light', { kind: 'self' }),
    ).toThrow('Unsupported PV-1F action lifebinder.mending-light.')
  })
})

it('Ironfist AI uses only its frozen Skills and executes its pure Essence legally', () => {
  const vanguard = pureSnapshot()
  const snapshot: CombatBuildSnapshot = {
    ...vanguard,
    primary: { disciplineId: 'ironfist', definitionVersion: 1, profileVersion: 1 },
    disciplineSkills: ['rising-fist', 'counter-palm', 'breakfall', 'hammer-knuckle'].map(
      (key, index) => ({
        slotIndex: index + 1,
        skillId: `ironfist.${key}`,
        contentVersion: 1,
        sourceDisciplineId: 'ironfist',
      }),
    ),
    extensions: {
      ...vanguard.extensions,
      essence: {
        essenceId: 'essence.ironfist.hundredfold-rush',
        contentVersion: 1,
        sourceDisciplineId: 'ironfist',
        skillId: 'essence.ironfist.hundredfold-rush',
        skillContentVersion: 1,
      },
    },
  }
  const state = attachCombatBuildBridge(encounter(false), [
    { combatantId: actorId, characterId: '00000000-0000-4000-8000-000000003731', snapshot },
  ])
  const decision = chooseBuildAwareRecruitAiDecision({
    state,
    profile: RECRUIT_STANDARD_PROFILE,
    tieBreakSeed: 73731,
  })
  expect(decision.intent).toEqual({
    kind: 'action',
    actionId: 'essence.ironfist.hundredfold-rush',
    target: { kind: 'unit', combatantId: targetId },
  })
  const result = executeBuildAwareRecruitAiAction(state, 'essence.ironfist.hundredfold-rush', {
    kind: 'unit',
    combatantId: targetId,
  })
  expect(readPv1fActionEconomy(result.state, actorId)?.current).toBe(40)
  expect(result.state.tactical.battle.combatants.find((row) => row.id === targetId)?.hp).toBe(29)
  expect(() =>
    executeBuildAwareRecruitAiAction(state, 'ironfist.focus-breath', { kind: 'self' }),
  ).toThrow()
})

describe('Phase 4 advanced AI through committed builds', () => {
  it.each(ADVANCED_DISCIPLINES)(
    '$name chooses and executes a legal committed Skill or Essence',
    (discipline) => {
      const library = latestEnabledMatureSkills()
        .filter(
          (skill) =>
            skill.sourceDisciplineId === discipline.id &&
            skill.requirements.length === 0 &&
            !skill.effects.some((effect) => effect.type === 'return-to-turn-start'),
        )
        .slice(0, 4)
      const essence = resolveEssenceForBuild(discipline.id, null)!
      const snapshot: CombatBuildSnapshot = {
        ...pureSnapshot(),
        primary: { disciplineId: discipline.id, definitionVersion: 1, profileVersion: 1 },
        disciplineSkills: library.map((skill, index) => ({
          slotIndex: index + 1,
          skillId: skill.id,
          contentVersion: skill.contentVersion,
          sourceDisciplineId: discipline.id,
        })),
        extensions: { ...pureSnapshot().extensions, essence: essenceSnapshotReference(essence) },
      }
      let state = encounter(false)
      state = {
        ...state,
        tactical: {
          ...state.tactical,
          width: 4,
          tiles: Array.from({ length: 4 }, (_, x) => ({
            position: { x, y: 0 },
            elevation: 0,
            terrainId: 'open-ground',
          })),
          placements: state.tactical.placements.map((unit) =>
            unit.combatantId === targetId
              ? {
                  ...unit,
                  position: { x: ['ravager', 'edgedancer'].includes(discipline.id) ? 1 : 3, y: 0 },
                }
              : unit,
          ),
          battle: {
            ...state.tactical.battle,
            combatants: state.tactical.battle.combatants.map((unit) =>
              unit.id === actorId ? { ...unit, hp: 25 } : unit,
            ),
          },
        },
      }
      state = attachCombatBuildBridge(state, [
        { combatantId: actorId, characterId: '00000000-0000-4000-8000-000000003731', snapshot },
      ])
      const decision = chooseBuildAwareRecruitAiDecision({
        state,
        profile: RECRUIT_STANDARD_PROFILE,
        tieBreakSeed: 7,
      })
      expect(decision.intent.kind).toBe('action')
      if (decision.intent.kind !== 'action') throw new Error('Expected a committed Skill choice')
      expect([
        ...library.map((skill) => skill.id),
        essence.skill.id,
        PV1F_BASIC_ATTACK_ID,
        PV1F_GUARD_ACTION_ID,
        PV1F_RECOVER_ACTION_ID,
        PV1F_MP_RECOVER_ACTION_ID,
      ]).toContain(decision.intent.actionId)
      const before = JSON.stringify(state)
      const result = executeBuildAwareRecruitAiAction(
        state,
        decision.intent.actionId,
        decision.intent.target,
      )
      expect(JSON.stringify(state)).toBe(before)
      expect(readPv1fActionEconomy(result.state, actorId)!.current).toBeLessThan(100)
      expect(result.events).toContainEqual(
        expect.objectContaining({
          event: 'combat_action_used',
          actorId,
          actionId: decision.intent.actionId,
        }),
      )
    },
  )
  it('chooses the armed cross-library payoff after reload and consumes it on the normal AI path', () => {
    const resonance = resolveResonanceForPair('chronist', 'vanguard')!
    const ids = ['chronist.haste', 'vanguard.forceful-strike']
    const snapshot: CombatBuildSnapshot = {
      ...pureSnapshot(),
      primary: { disciplineId: 'chronist', definitionVersion: 1, profileVersion: 1 },
      secondary: { disciplineId: 'vanguard', definitionVersion: 1 },
      disciplineSkills: ids.map((id, index) => ({
        slotIndex: index + 1,
        skillId: id,
        contentVersion: resolveMatureSkillVersion(id)!.contentVersion,
        sourceDisciplineId: id.split('.')[0]!,
      })),
      extensions: {
        ...pureSnapshot().extensions,
        essence: null,
        resonance: resonanceSnapshotReference(resonance),
      },
    }
    let state: StatDrivenCombatEncounterState = attachCombatBuildBridge(encounter(false), [
      { combatantId: actorId, characterId: '00000000-0000-4000-8000-000000003731', snapshot },
    ])
    state = executeBuildAwareRecruitAiAction(state, 'chronist.haste', {
      kind: 'unit',
      combatantId: actorId,
    }).state
    state = finishPv1fTurn(finishPv1fTurn(state, 'east').state, 'west').state
    state = JSON.parse(JSON.stringify(state))
    const choice = chooseBuildAwareRecruitAiDecision({
      state,
      profile: RECRUIT_STANDARD_PROFILE,
      tieBreakSeed: 7,
    })
    expect(choice.intent).toEqual({
      kind: 'action',
      actionId: 'vanguard.forceful-strike',
      target: { kind: 'unit', combatantId: targetId },
    })
    if (choice.intent.kind !== 'action') throw new Error('Expected payoff')
    const result = executeBuildAwareRecruitAiAction(
      state,
      choice.intent.actionId,
      choice.intent.target,
    )
    expect(result.events).toContainEqual(expect.objectContaining({ event: 'resonance_activated' }))
  })
})

it('100% Suppress never invents damaging moves and ends after legal useful support is exhausted', () => {
  let state = encounter()
  state.statusState.find((row) => row.combatantId === actorId)!.statuses = [
    {
      statusId: 'suppress',
      statusVersion: 1,
      stacks: 1,
      sourceCombatantId: targetId,
      potencyBasisPoints: 10000,
      remainingOwnerTurnStarts: 3,
    },
  ]
  for (let count = 0; count < 8; count++) {
    const choice = chooseBuildAwareRecruitAiDecision({
      state,
      profile: RECRUIT_STANDARD_PROFILE,
      tieBreakSeed: 42,
    })
    if (choice.intent.kind === 'face') {
      expect(
        finishPv1fTurn(state, choice.intent.facing).state.tactical.battle.currentTurn?.combatantId,
      ).toBe(targetId)
      return
    }
    if (choice.intent.kind === 'end-turn') {
      expect(count).toBeLessThan(8)
      return
    }
    expect(choice.intent.kind).toBe('action')
    if (choice.intent.kind !== 'action') throw new Error('Unexpected move on fully occupied map')
    expect([PV1F_GUARD_ACTION_ID, PV1F_RECOVER_ACTION_ID, PV1F_MP_RECOVER_ACTION_ID]).toContain(
      choice.intent.actionId,
    )
    state = executeBuildAwareRecruitAiAction(
      state,
      choice.intent.actionId,
      choice.intent.target,
    ).state
  }
  throw new Error('AI failed to finish its turn')
})

it.each(['skill', 'essence', 'resonance-v1', 'resonance-v2'] as const)(
  'chooses a legal explicit Manual behavior from immutable canonical %s and commits it once after JSON reconnect',
  (kind) => {
    const initial = encounter()
    const original = JSON.parse(
      JSON.stringify(resolveMatureSkillVersion('vanguard.forceful-strike', 2)!),
    ) as import('./mature-skills').MatureSkillDefinition
    const targeting = { ...original.target, maximumSelections: 1 }
    const base = {
      activation: 'manual' as const,
      mode: 'action' as const,
      classification: 'attack' as const,
      attackFamily: 'physical' as const,
      costs: [{ resource: 'ap' as const, amount: 12 }],
      cooldown: null,
      activationLimits: ['once-per-battle' as const],
      requirements: null,
      targeting,
      accuracy: { kind: 'fixed' as const, chanceBasisPoints: 10000 },
    }
    const ability: AbilityDefinition = {
      schemaVersion: 1,
      behaviors: [
        {
          ...base,
          id: 'small',
          effects: [
            { id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 1 } },
          ],
        },
        {
          ...base,
          id: 'strike',
          effects: [
            { id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 20 } },
          ],
        },
      ],
    }
    expect(validateAbilityDefinition(ability)).toEqual([])
    const definition = { ...original, ability }
    const resonance = resolveResonanceForPair('vanguard', 'lifebinder', 1)!
    const source =
      kind === 'skill'
        ? capturedMatureSkillAbilitySource(initial, definition)!
        : kind === 'essence'
          ? capturedMatureSkillAbilitySource(initial, {
              ...resolveEssenceForBuild('vanguard', null)!.skill,
              ability,
            })!
          : capturedResonanceAbilitySource(
              initial,
              actorId,
              {
                ...(kind === 'resonance-v2' ? convertV5ResonanceToV2(resonance) : resonance),
                ability,
              },
              ['vanguard', 'lifebinder'],
            )!
    const state = JSON.parse(
      JSON.stringify(reconcileCombatAbilitySources(initial, [source])),
    ) as StatDrivenCombatEncounterState
    definition.enabled = false
    definition.ability = { schemaVersion: 1, behaviors: [] }
    const before = JSON.stringify(state)
    const decision = chooseBuildAwareRecruitAiDecision({
      state,
      tieBreakSeed: 1,
      profile: RECRUIT_STANDARD_PROFILE,
      skillOptions: { committedSkills: [definition] },
    })
    expect(decision.intent).toMatchObject({
      kind: 'action',
      actionId: source.abilityId,
      behaviorId: 'strike',
      target: { kind: 'unit', combatantId: targetId },
    })
    expect(JSON.stringify(state)).toBe(before)
    if (decision.intent.kind !== 'action') throw new Error('Expected a canonical action.')
    const committed = executeBuildAwareRecruitAiAction(
      state,
      decision.intent.actionId,
      decision.intent.target,
      { committedSkills: [definition] },
      { behaviorId: decision.intent.behaviorId },
    )
    expect(readPv1fActionEconomy(committed.state)!.current).toBe(88)
    expect(committed.state.capturedAbilitySources![0]!.definition).toEqual(ability)
    expect(
      committed.events.filter(
        (event) =>
          typeof event === 'object' &&
          event !== null &&
          'event' in event &&
          event.event === 'combat_action_used',
      ),
    ).toHaveLength(1)
  },
)
