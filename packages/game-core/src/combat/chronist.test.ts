import { describe, expect, it } from 'vitest'
import { createPendingBattle, startBattle, validateBattleState } from './battle-state'
import { createTacticalBattleState } from './board'
import { createCombatEncounterState, type CombatEncounterState } from './actions'
import {
  createPv1fTemporaryResources,
  executePv1fMatureSkill,
  evaluatePv1fMatureSkill,
  finishPv1fTurn,
  executePv1fMovement,
  readPv1fActionEconomy,
  PV1F_COMBAT_CONTENT,
} from './pv1f-action-economy'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'
import { resolveMatureSkillVersion } from './mature-skills'
import { resolveResonanceForPair, resonanceSnapshotReference } from './resonance'
import { attachCombatBuildBridge, type CombatBuildSnapshot } from './build-snapshot'
function encounter(): StatDrivenCombatEncounterState {
  const ids = ['actor', 'enemy', 'other', 'ally']
  const battle = startBattle(
    createPendingBattle({
      battleId: 'phase4-effects',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 42,
      combatants: ids.map((id, index) => ({
        id,
        teamId: id === 'actor' || id === 'ally' ? 'players' : 'enemies',
        initiative: 40 - index * 10,
        baseMovementBudget: 4,
        hp: 25,
        maxHp: 50,
        mp: 10,
        maxMp: 20,
        temporaryResources: createPv1fTemporaryResources(10),
      })),
    }),
  ).state
  const positions = [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 1, y: 2 },
  ]
  return createStatDrivenCombatEncounterState(
    createCombatEncounterState(
      createTacticalBattleState({
        battle,
        width: 5,
        height: 4,
        terrains: [{ id: 'open', traversalCost: 1 }],
        tiles: Array.from({ length: 20 }, (_, i) => ({
          position: { x: i % 5, y: Math.floor(i / 5) },
          elevation: 0,
          terrainId: 'open',
        })),
        movementProfiles: [{ id: 'ground', maxElevationStep: 0, terrainCostOverrides: [] }],
        placements: ids.map((combatantId, i) => ({
          combatantId,
          position: positions[i]!,
          facing: 'west' as const,
          movementProfileId: 'ground',
        })),
      }),
    ),
    ids.map((combatantId) => ({
      combatantId,
      provenance: { kind: 'scenario' as const, sourceId: 'scenario:phase4', sourceRulesVersion: 1 },
      accuracy: 10000,
      evasion: 0,
      armor: 0,
      ward: 0,
      jump: 0,
    })),
  )
}
function withStatus<T extends CombatEncounterState>(
  state: T,
  owner: string,
  statusId: string,
  source = 'actor',
): T {
  const definition = PV1F_COMBAT_CONTENT.statuses.find((status) => status.id === statusId)!
  return {
    ...state,
    statusState: state.statusState.map((row) =>
      row.combatantId === owner
        ? {
            ...row,
            statuses: [
              ...row.statuses.filter((status) => status.statusId !== statusId),
              {
                statusId,
                statusVersion: 1,
                stacks: 1,
                remainingOwnerTurnStarts: definition.durationOwnerTurnStarts,
                sourceCombatantId: source,
              },
            ].sort((a, b) => a.statusId.localeCompare(b.statusId)),
          }
        : row,
    ),
  }
}

const skill = (id: string) => resolveMatureSkillVersion(id)!
function nextRound(state: StatDrivenCombatEncounterState) {
  const round = state.tactical.battle.round
  const actors: string[] = []
  do {
    actors.push(state.tactical.battle.currentTurn!.combatantId)
    state = finishPv1fTurn(state, 'west').state
  } while (state.tactical.battle.round === round)
  return { state, actors }
}
describe('Chronist authoritative tempo', () => {
  it('freezes each round, consumes tempo once, returns to base order without duplicate turns', () => {
    let state = executePv1fMatureSkill(encounter(), skill('chronist.haste'), {
      kind: 'unit',
      combatantId: 'ally',
    }).state
    expect(state.tactical.battle.initiativeOrder).toEqual(['actor', 'enemy', 'other', 'ally'])
    const round1 = nextRound(JSON.parse(JSON.stringify(state)))
    expect(round1.actors).toEqual(['actor', 'enemy', 'other', 'ally'])
    state = round1.state
    expect(state.tactical.battle.initiativeOrder).toEqual(['actor', 'ally', 'enemy', 'other'])
    expect(
      state.statusState
        .flatMap((row) => row.statuses)
        .some((status) => status.statusId === 'hastened'),
    ).toBe(false)
    const round2 = nextRound(state)
    expect(round2.actors).toEqual(['actor', 'ally', 'enemy', 'other'])
    expect(round2.state.tactical.battle.initiativeOrder).toEqual([
      'actor',
      'enemy',
      'other',
      'ally',
    ])
    expect(validateBattleState(round2.state.tactical.battle)).toEqual([])
  })
  it('does not spend AP or change ordering in previews; repeated discrete tempo is omitted', () => {
    const state = encounter(),
      saved = JSON.stringify(state)
    const preview = evaluatePv1fMatureSkill(state, skill('chronist.delay'), {
      kind: 'unit',
      combatantId: 'enemy',
    })
    expect(preview.evaluation.legal).toBe(true)
    expect(JSON.stringify(state)).toBe(saved)
    const first = executePv1fMatureSkill(state, skill('chronist.delay'), {
      kind: 'unit',
      combatantId: 'enemy',
    })
    const repeat = evaluatePv1fMatureSkill(first.state, skill('chronist.delay'), {
      kind: 'unit',
      combatantId: 'enemy',
    })
    expect(repeat.action.effects).toEqual([])
    expect(repeat.cost).toBe(preview.cost)
    expect(nextRound(first.state).state.tactical.battle.initiativeOrder).toEqual([
      'actor',
      'other',
      'ally',
      'enemy',
    ])
  })
  it('caps combined tempo and ignores defeated units when selecting turns', () => {
    let state = withStatus(withStatus(encounter(), 'ally', 'hastened'), 'ally', 'borrowed-hour')
    state = {
      ...state,
      tactical: {
        ...state.tactical,
        battle: {
          ...state.tactical.battle,
          combatants: state.tactical.battle.combatants.map((unit) =>
            unit.id === 'enemy' ? { ...unit, hp: 0 } : unit,
          ),
        },
      },
    }
    const result = nextRound(state)
    expect(result.actors).toEqual(['actor', 'other', 'ally'])
    expect(result.state.tactical.battle.currentTurn?.combatantId).toBe('ally')
    expect(result.state.tactical.battle.roundInitiativeModifiers).toEqual([
      { combatantId: 'ally', amount: 40 },
    ])
    const turns = nextRound(result.state).actors
    expect(new Set(turns).size).toBe(3)
    expect(turns).not.toContain('enemy')
  })
  it('does not select a tempo-boosted last actor after its lethal end-of-turn tick', () => {
    let state = withStatus(withStatus(encounter(), 'ally', 'borrowed-hour'), 'ally', 'poison')
    state = {
      ...state,
      tactical: {
        ...state.tactical,
        battle: {
          ...state.tactical.battle,
          combatants: state.tactical.battle.combatants.map((unit) =>
            unit.id === 'ally' ? { ...unit, hp: 1 } : unit,
          ),
        },
      },
    }
    const result = nextRound(state)
    expect(result.actors).toEqual(['actor', 'enemy', 'other', 'ally'])
    expect(result.state.tactical.battle.currentTurn?.combatantId).toBe('actor')
    expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'ally')!.hp).toBe(0)
    expect(validateBattleState(result.state.tactical.battle)).toEqual([])
  })
  it('rejects malformed schedule offsets and wrong initiative permutations', () => {
    const battle = encounter().tactical.battle
    expect(
      validateBattleState({
        ...battle,
        roundInitiativeModifiers: [{ combatantId: 'actor', amount: 41 }],
      }),
    ).not.toEqual([])
    expect(
      validateBattleState({
        ...battle,
        roundInitiativeModifiers: [{ combatantId: 'unknown', amount: 10 }],
      }),
    ).not.toEqual([])
    expect(
      validateBattleState({ ...battle, initiativeOrder: [...battle.initiativeOrder].reverse() }),
    ).not.toEqual([])
  })
  it('rewinds only position to this turn origin without refunds, preserving reloads and Root legality', () => {
    const definition = skill('chronist.rewind-step')
    expect(
      evaluatePv1fMatureSkill(encounter(), definition, { kind: 'self' }).evaluation.legal,
    ).toBe(false)
    const moved = executePv1fMovement(encounter(), [
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ]).state
    const loaded = JSON.parse(JSON.stringify(moved)) as StatDrivenCombatEncounterState
    const before = readPv1fActionEconomy(loaded)!.current
    const preview = evaluatePv1fMatureSkill(loaded, definition, { kind: 'self' })
    expect(preview.evaluation.projectedEffects).toContainEqual({
      effectType: 'return-to-turn-start',
      combatantId: 'actor',
      before: '0,1',
      after: '1,1',
    })
    const returned = executePv1fMatureSkill(loaded, definition, { kind: 'self' }).state
    expect(
      returned.tactical.placements.find((unit) => unit.combatantId === 'actor')!.position,
    ).toEqual({ x: 1, y: 1 })
    expect(readPv1fActionEconomy(returned)!.current).toBe(before - definition.apCost)
    expect(returned.tactical.battle.currentTurn!.movementRemaining).toBe(
      moved.tactical.battle.currentTurn!.movementRemaining,
    )
    expect(
      evaluatePv1fMatureSkill(withStatus(moved, 'actor', 'root'), definition, { kind: 'self' })
        .evaluation.legal,
    ).toBe(false)
    const occupied = {
      ...moved,
      tactical: {
        ...moved.tactical,
        placements: moved.tactical.placements.map((unit) =>
          unit.combatantId === 'ally' ? { ...unit, position: { x: 1, y: 1 } } : unit,
        ),
      },
    }
    expect(evaluatePv1fMatureSkill(occupied, definition, { kind: 'self' }).evaluation.legal).toBe(
      false,
    )
  })
})
function mixed(state = encounter()) {
  const resonance = resolveResonanceForPair('chronist', 'vanguard')!
  const snapshot: CombatBuildSnapshot = {
    schemaVersion: 1,
    sourceBuildSchemaVersion: 2,
    sourceBuildVersion: 1,
    fingerprint: `sha256:${'c'.repeat(64)}`,
    primary: { disciplineId: 'chronist', definitionVersion: 1, profileVersion: 1 },
    secondary: { disciplineId: 'vanguard', definitionVersion: 1 },
    disciplineSkills: ['chronist.haste', 'chronist.delay', 'vanguard.forceful-strike'].map(
      (id, index) => ({
        slotIndex: index + 1,
        skillId: id,
        contentVersion: skill(id).contentVersion,
        sourceDisciplineId: skill(id).sourceDisciplineId,
      }),
    ),
    extensions: {
      resonance: resonanceSnapshotReference(resonance),
      essence: null,
      equipmentSkills: [],
      supernatural: null,
      prestige: null,
    },
  }
  return attachCombatBuildBridge(state, [
    { combatantId: 'actor', characterId: '00000000-0000-4000-8000-000000000001', snapshot },
  ])
}
describe('Committed Resonance uses normal battle execution', () => {
  for (const context of ['pve', 'pvp'] as const)
    it(`${context}: setup survives reload/turns and payoff commits exactly once`, () => {
      const armed = executePv1fMatureSkill(
        mixed(),
        skill('chronist.haste'),
        { kind: 'unit', combatantId: 'ally' },
        context,
      )
      expect(armed.events).toContainEqual(expect.objectContaining({ event: 'resonance_armed' }))
      const loaded = nextRound(JSON.parse(JSON.stringify(armed.state))).state
      const saved = JSON.stringify(loaded)
      const forecast = evaluatePv1fMatureSkill(
        loaded,
        skill('vanguard.forceful-strike'),
        { kind: 'unit', combatantId: 'enemy' },
        context,
      )
      expect(forecast.action.effects).toContainEqual({
        type: 'apply-status',
        recipient: 'actor',
        statusId: 'hastened',
        stacks: 1,
      })
      expect(JSON.stringify(loaded)).toBe(saved)
      const result = executePv1fMatureSkill(
        loaded,
        skill('vanguard.forceful-strike'),
        { kind: 'unit', combatantId: 'enemy' },
        context,
      )
      expect(result.events).toContainEqual(
        expect.objectContaining({ event: 'resonance_activated', actorId: 'actor' }),
      )
      expect(
        evaluatePv1fMatureSkill(
          result.state,
          skill('vanguard.forceful-strike'),
          { kind: 'unit', combatantId: 'enemy' },
          context,
        ).action.effects.some(
          (effect) => effect.type === 'apply-status' && effect.statusId === 'hastened',
        ),
      ).toBe(false)
    })
  it('does not infer a pair from Skill names on a battle without committed build authority', () => {
    const armed = executePv1fMatureSkill(encounter(), skill('chronist.haste'), {
      kind: 'unit',
      combatantId: 'ally',
    })
    expect(
      armed.events.some((event) => (event as { event: string }).event.startsWith('resonance_')),
    ).toBe(false)
  })
})
