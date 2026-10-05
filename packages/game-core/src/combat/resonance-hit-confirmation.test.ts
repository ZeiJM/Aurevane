import { describe, expect, it } from 'vitest'
import { createCombatEncounterState } from './actions'
import { normalizeCombatEffectState } from './combat-effect-state'
import { defaultCombatEffectTimingPolicy } from './combat-effect-timing'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import { attachCombatBuildBridge } from './build-snapshot'
import { resolveMatureSkillVersion } from './mature-skills'
import {
  createPv1fTemporaryResources,
  evaluatePv1fMatureSkill,
  executePv1fMatureSkill,
  finishPv1fTurn,
  PV1F_COMBAT_CONTENT,
} from './pv1f-action-economy'
import { executePv1fMatureSkillWithResonance } from './pv1f-resonance'
import {
  createResonanceCombatState,
  executeMatureSkillWithResonance,
  resonanceSnapshotReference,
  resolveResonanceForPair,
} from './resonance'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'

function skill(id: string) {
  const result = resolveMatureSkillVersion(id)
  if (!result) throw new Error(`Missing Skill ${id}`)
  return result
}

function encounter(pair: [string, string], setupId: string, triggerId: string, accuracy = 0) {
  const resonance = resolveResonanceForPair(...pair)!
  const setup = skill(setupId)
  const trigger = skill(triggerId)
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:resonance-hit-confirmation',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 54321,
      combatants: ['actor', 'enemy'].map((id, index) => ({
        id,
        teamId: id,
        initiative: 20 - index * 10,
        baseMovementBudget: 4,
        hp: index === 0 ? 30 : 50,
        maxHp: 50,
        mp: 10,
        maxMp: 50,
        temporaryResources: createPv1fTemporaryResources(16),
      })),
    }),
  ).state
  const state = createStatDrivenCombatEncounterState(
    createCombatEncounterState(
      createTacticalBattleState({
        battle,
        width: 2,
        height: 1,
        terrains: [{ id: 'open', traversalCost: 1 }],
        tiles: [0, 1].map((x) => ({ position: { x, y: 0 }, elevation: 0, terrainId: 'open' })),
        movementProfiles: [{ id: 'ground', maxElevationStep: 1, terrainCostOverrides: [] }],
        placements: ['actor', 'enemy'].map((combatantId, x) => ({
          combatantId,
          position: { x, y: 0 },
          facing: x === 0 ? ('east' as const) : ('west' as const),
          movementProfileId: 'ground',
        })),
      }),
    ),
    ['actor', 'enemy'].map((combatantId) => ({
      combatantId,
      provenance: {
        kind: 'scenario' as const,
        sourceId: `scenario:${combatantId}`,
        sourceRulesVersion: 1,
      },
      accuracy: combatantId === 'actor' ? accuracy : 10000,
      evasion: 0,
      armor: 0,
      ward: 0,
      jump: 1,
    })),
  )
  return attachCombatBuildBridge(state, [
    {
      combatantId: 'actor',
      characterId: '00000000-0000-4000-8000-000000000001',
      snapshot: {
        schemaVersion: 1,
        sourceBuildSchemaVersion: 2,
        sourceBuildVersion: 1,
        fingerprint: `sha256:${'c'.repeat(64)}`,
        primary: { disciplineId: pair[0], definitionVersion: 1, profileVersion: 1 },
        secondary: { disciplineId: pair[1], definitionVersion: 1 },
        disciplineSkills: [setup, trigger].map((definition, index) => ({
          slotIndex: index + 1,
          skillId: definition.id,
          contentVersion: definition.contentVersion,
          sourceDisciplineId: definition.sourceDisciplineId,
        })),
        extensions: {
          resonance: resonanceSnapshotReference(resonance),
          essence: null,
          equipmentSkills: [],
          supernatural: null,
          prestige: null,
        },
      },
    },
  ])
}

function actor(state: StatDrivenCombatEncounterState) {
  return state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!
}

function nextActorTurn(state: StatDrivenCombatEncounterState) {
  return finishPv1fTurn(finishPv1fTurn(state, 'east').state, 'west').state
}

function armed(state: StatDrivenCombatEncounterState, setupId: string) {
  return actor(state).temporaryResources.some(
    (resource) => resource.key === `p35.resonance-armed:${setupId}`,
  )
}

function prime(state: StatDrivenCombatEncounterState, setupId: string) {
  return {
    ...state,
    tactical: {
      ...state.tactical,
      battle: {
        ...state.tactical.battle,
        combatants: state.tactical.battle.combatants.map((unit) =>
          unit.id === 'actor'
            ? {
                ...unit,
                temporaryResources: [
                  ...unit.temporaryResources,
                  { key: `p35.resonance-armed:${setupId}`, current: 1, maximum: 1 },
                ].sort((left, right) => left.key.localeCompare(right.key)),
              }
            : unit,
        ),
      },
    },
  }
}

describe('Resonance requires a confirmed hostile hit', () => {
  it('preserves earned priming on a miss and activates once on a later hit while spending normal costs', () => {
    const setupId = 'lifebinder.mending-light'
    const trigger = skill('vanguard.forceful-strike')
    const setup = executePv1fMatureSkill(
      encounter(['vanguard', 'lifebinder'], setupId, trigger.id),
      skill(setupId),
      { kind: 'self' },
    )
    const ready = nextActorTurn(setup.state)
    expect(armed(ready, setupId)).toBe(true)
    const saved = JSON.stringify(ready)
    const preview = evaluatePv1fMatureSkill(ready, trigger, { kind: 'unit', combatantId: 'enemy' })
    expect(preview.evaluation.targetHitChances).toEqual([
      { targetCombatantId: 'enemy', hitChanceBasisPoints: 0 },
    ])
    expect(preview.evaluation.projectionsAssumeHits).toBe(true)
    expect(JSON.stringify(ready)).toBe(saved)
    const missed = executePv1fMatureSkill(ready, trigger, { kind: 'unit', combatantId: 'enemy' })
    expect(missed.events).toContainEqual(
      expect.objectContaining({ event: 'combat_accuracy_resolved', hit: false }),
    )
    expect(actor(missed.state).hp).toBe(actor(ready).hp)
    expect(armed(missed.state, setupId)).toBe(true)
    expect(missed.events).not.toContainEqual(
      expect.objectContaining({ event: 'resonance_activated' }),
    )
    expect(missed.events).toContainEqual(
      expect.objectContaining({ event: 'skill_cooldown_started', actionId: trigger.id }),
    )
    expect(missed.events).toContainEqual(
      expect.objectContaining({ event: 'action_economy_spent', amount: 45 }),
    )
    expect(missed.state.tactical.battle.rng.draws).toBe(ready.tactical.battle.rng.draws + 1)
    let later = nextActorTurn(nextActorTurn(nextActorTurn(missed.state)))
    later = {
      ...later,
      statBridge: {
        ...later.statBridge,
        combatants: later.statBridge.combatants.map((profile) =>
          profile.combatantId === 'actor' ? { ...profile, accuracy: 10000 } : profile,
        ),
      },
    }
    const hit = executePv1fMatureSkill(later, trigger, { kind: 'unit', combatantId: 'enemy' })
    expect(hit.events).toContainEqual(
      expect.objectContaining({ event: 'combat_accuracy_resolved', hit: true }),
    )
    expect(
      hit.events.filter(
        (event) =>
          typeof event === 'object' &&
          event !== null &&
          'event' in event &&
          event.event === 'resonance_activated',
      ),
    ).toHaveLength(1)
    expect(actor(hit.state).hp).toBe(Math.min(actor(later).maxHp, actor(later).hp + 4))
    expect(armed(hit.state, setupId)).toBe(false)
  })

  it.each([
    {
      pair: ['vanguard', 'wildwarden'] as [string, string],
      setupId: 'wildwarden.hunters-mark',
      triggerId: 'vanguard.forceful-strike',
      field: 'mp' as const,
    },
    {
      pair: ['vanguard', 'bastion'] as [string, string],
      setupId: 'bastion.fortress',
      triggerId: 'vanguard.forceful-strike',
      field: 'hp' as const,
    },
  ])(
    'skips actor payoff effects on a missed $pair attack',
    ({ pair, setupId, triggerId, field }) => {
      const initial = prime(encounter(pair, setupId, triggerId), setupId)
      const result = executePv1fMatureSkill(initial, skill(triggerId), {
        kind: 'unit',
        combatantId: 'enemy',
      })
      expect(actor(result.state)[field]).toBe(actor(initial)[field])
      expect(result.state.statusState).toEqual(initial.statusState)
      expect(result.state.pendingEffects ?? []).toEqual([])
      expect(result.events).not.toContainEqual(
        expect.objectContaining({ event: 'resonance_activated' }),
      )
      expect(armed(result.state, setupId)).toBe(true)
    },
  )

  it('does not activate an immediate Resonance on a miss', () => {
    const initial = encounter(
      ['shadehand', 'lifebinder'],
      'lifebinder.mending-light',
      'shadehand.feint',
    )
    const result = executePv1fMatureSkill(initial, skill('shadehand.feint'), {
      kind: 'unit',
      combatantId: 'enemy',
    })
    expect(actor(result.state).hp).toBe(30)
    expect(result.events).not.toContainEqual(
      expect.objectContaining({ event: 'resonance_activated' }),
    )
  })

  it('does not schedule a missed Resonance status while retaining ordinary caster recovery', () => {
    const setupId = 'bastion.fortress'
    const initial = {
      ...prime(encounter(['wildwarden', 'bastion'], setupId, 'wildwarden.close-quarry'), setupId),
      effectTimingPolicy: defaultCombatEffectTimingPolicy(),
    }
    const result = executePv1fMatureSkill(initial, skill('wildwarden.close-quarry'), {
      kind: 'unit',
      combatantId: 'enemy',
    })
    expect(actor(result.state).mp).toBe(17)
    expect(result.state.pendingEffects ?? []).toEqual([])
    expect(result.state.statusState).toEqual(initial.statusState)
    expect(armed(result.state, setupId)).toBe(true)
    expect(result.events).not.toContainEqual(
      expect.objectContaining({ event: 'resonance_activated' }),
    )
  })

  it.each(['mature', 'pv1f', 'committed-pv1f'] as const)(
    'preserves explicit %s sequence state when the trigger misses',
    (path) => {
      const setupId = 'lifebinder.mending-light'
      const state = prime(
        encounter(['vanguard', 'lifebinder'], setupId, 'vanguard.forceful-strike'),
        setupId,
      )
      const uncommitted = { ...state }
      Reflect.deleteProperty(uncommitted, 'buildBridge')
      const resonance = resolveResonanceForPair('vanguard', 'lifebinder')!
      const input = {
        state: path === 'committed-pv1f' ? state : uncommitted,
        resonance,
        resonanceState: { ...createResonanceCombatState(resonance), armedByActionId: setupId },
        skill: skill('vanguard.forceful-strike'),
        combatContext: 'pve' as const,
        selection: { kind: 'unit' as const, combatantId: 'enemy' },
      }
      const result =
        path === 'mature'
          ? executeMatureSkillWithResonance({ ...input, content: PV1F_COMBAT_CONTENT })
          : executePv1fMatureSkillWithResonance(input)
      expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.hp).toBe(
        30,
      )
      expect(result.resonanceState.armedByActionId).toBe(setupId)
      expect(result.events).not.toContainEqual(
        expect.objectContaining({ event: 'resonance_activated' }),
      )
    },
  )

  it('activates when a confirmed hit is fully absorbed by Barrier', () => {
    const setupId = 'lifebinder.mending-light'
    const initial = prime(
      encounter(['vanguard', 'lifebinder'], setupId, 'vanguard.forceful-strike', 10000),
      setupId,
    )
    const barrier = {
      ...initial,
      effectState: {
        ...normalizeCombatEffectState(initial.effectState),
        barriers: [
          {
            targetCombatantId: 'enemy',
            sourceCombatantId: 'enemy',
            sourceActionId: 'test.barrier',
            amount: 50,
          },
        ],
      },
    }
    const result = executePv1fMatureSkill(barrier, skill('vanguard.forceful-strike'), {
      kind: 'unit',
      combatantId: 'enemy',
    })
    expect(result.events).toContainEqual(
      expect.objectContaining({ event: 'combat_accuracy_resolved', hit: true }),
    )
    expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.hp).toBe(50)
    expect(actor(result.state).hp).toBe(34)
    expect(result.events).toContainEqual(expect.objectContaining({ event: 'resonance_activated' }))
    expect(armed(result.state, setupId)).toBe(false)
  })
})
