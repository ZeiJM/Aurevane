import { describe, expect, it } from 'vitest'
import {
  createCombatEncounterState,
  executeCombatAction,
  type CombatActionDefinition,
  type CombatEffectDefinition,
} from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import { pendingCombatStatusRows } from './combat-effect-timing'
import { advanceCurrentPoisonMovement } from './combat-dots'
import { latestEnabledMatureSkills } from './mature-skills'
import {
  createPv1fTemporaryResources,
  evaluatePv1fMovement,
  executePv1fAction,
  executePv1fMatureSkill,
  executePv1fMovement,
  finishPv1fTurn,
  PV1F_BASIC_ATTACK_ID,
  PV1F_COMBAT_CONTENT,
  readPv1fActionEconomy,
} from './pv1f-action-economy'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'

function encounter(casterHp = 100): StatDrivenCombatEncounterState {
  const ids = ['caster', 'quarry']
  const battle = startBattle(
    createPendingBattle({
      battleId: 'effect-tags-owner-audit',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 42,
      combatants: ids.map((id, index) => ({
        id,
        teamId: id,
        initiative: 20 - index * 10,
        baseMovementBudget: 2,
        hp: id === 'caster' ? casterHp : 100,
        maxHp: 100,
        mp: 20,
        maxMp: 20,
        temporaryResources: createPv1fTemporaryResources(10),
      })),
    }),
  ).state
  const state = createStatDrivenCombatEncounterState(
    createCombatEncounterState(
      createTacticalBattleState({
        battle,
        width: 4,
        height: 2,
        terrains: [{ id: 'open', traversalCost: 1 }],
        tiles: Array.from({ length: 8 }, (_, index) => ({
          position: { x: index % 4, y: Math.floor(index / 4) },
          elevation: 0,
          terrainId: 'open',
        })),
        movementProfiles: [{ id: 'ground', maxElevationStep: 0, terrainCostOverrides: [] }],
        placements: ids.map((combatantId, x) => ({
          combatantId,
          position: { x, y: 0 },
          facing: 'east' as const,
          movementProfileId: 'ground',
        })),
      }),
    ),
    ids.map((combatantId) => ({
      combatantId,
      provenance: { kind: 'scenario' as const, sourceId: 'scenario:audit', sourceRulesVersion: 1 },
      accuracy: 10000,
      evasion: 0,
      armor: 0,
      ward: 0,
      jump: 0,
    })),
  )
  return { ...state, effectTimingPolicy: { version: 1, modes: {} } }
}

function quarryRoot(state: StatDrivenCombatEncounterState) {
  return state.statusState
    .find((row) => row.combatantId === 'quarry')
    ?.statuses.find((status) => status.statusId === 'root')
}

const snare = latestEnabledMatureSkills().find((skill) => skill.id === 'wildwarden.snare')!

describe('authored Root obeys pinned timing and movement-only control', () => {
  it('allows movement while Snare is pending, then blocks until the full active turn ends', () => {
    let state = executePv1fMatureSkill(encounter(), snare, {
      kind: 'unit',
      combatantId: 'quarry',
    }).state
    expect(quarryRoot(state)).toBeUndefined()
    expect(pendingCombatStatusRows(state)).toContainEqual(
      expect.objectContaining({
        combatantId: 'quarry',
        status: expect.objectContaining({
          statusId: 'root',
          timingState: 'pending',
          activationRound: 2,
        }),
      }),
    )
    state = finishPv1fTurn(state, 'east').state
    const path = [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]
    expect(evaluatePv1fMovement(state, path).movement.legal).toBe(true)
    state = executePv1fMovement(state, path).state
    expect(readPv1fActionEconomy(state)?.current).toBe(80)

    state = JSON.parse(
      JSON.stringify(finishPv1fTurn(state, 'west').state),
    ) as StatDrivenCombatEncounterState
    expect(state.tactical.battle.round).toBe(2)
    expect(quarryRoot(state)).toMatchObject({ timingState: 'active', remainingOwnerTurnEnds: 1 })
    state = finishPv1fTurn(state, 'east').state
    const activePath = [
      { x: 1, y: 1 },
      { x: 1, y: 0 },
    ]
    expect(evaluatePv1fMovement(state, activePath).movement.legal).toBe(false)
    expect(() => executePv1fMovement(state, activePath)).toThrow(/Root/)
    expect(quarryRoot(state)).toBeDefined()
    state = finishPv1fTurn(state, 'north').state
    expect(state.tactical.placements.find((row) => row.combatantId === 'quarry')?.facing).toBe(
      'north',
    )
    expect(quarryRoot(state)).toBeUndefined()
    state = finishPv1fTurn(state, 'east').state
    expect(evaluatePv1fMovement(state, activePath).movement.legal).toBe(true)
  })

  it('keeps attacks and Skills available while Root is active, including an instant policy override', () => {
    let state = encounter()
    state.effectTimingPolicy = { version: 2, modes: { root: 'instant' } }
    state = executePv1fMatureSkill(state, snare, { kind: 'unit', combatantId: 'quarry' }).state
    expect(quarryRoot(state)).toMatchObject({ timingState: 'active', remainingOwnerTurnEnds: 1 })
    expect(state.pendingEffects ?? []).toEqual([])
    state = finishPv1fTurn(state, 'east').state
    const beforeHp = state.tactical.battle.combatants.find((unit) => unit.id === 'caster')!.hp
    state = executePv1fAction(state, PV1F_BASIC_ATTACK_ID, {
      kind: 'unit',
      combatantId: 'caster',
    }).state
    expect(state.tactical.battle.combatants.find((unit) => unit.id === 'caster')!.hp).toBeLessThan(
      beforeHp,
    )
    state = executePv1fMatureSkill(state, snare, { kind: 'unit', combatantId: 'caster' }).state
    expect(state.statusState.find((row) => row.combatantId === 'caster')?.statuses).toContainEqual(
      expect.objectContaining({ statusId: 'root', timingState: 'active' }),
    )
    expect(readPv1fActionEconomy(state)?.current).toBe(100 - 30 - snare.apCost)
    expect(() =>
      executePv1fMovement(state, [
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ]),
    ).toThrow(/Root/)
    state = finishPv1fTurn(state, 'south').state
    expect(quarryRoot(state)).toBeUndefined()
    expect(state.tactical.placements.find((row) => row.combatantId === 'quarry')?.facing).toBe(
      'south',
    )
  })
})

describe('Warded recognizes actual current Burn instances', () => {
  const action: CombatActionDefinition = {
    id: 'test.warded-burn',
    version: 1,
    sourceType: 'test',
    tags: [],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 1,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      friendlyFire: 'enemies-only',
    },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    effects: [
      { type: 'apply-status', recipient: 'actor', statusId: 'warded', stacks: 1, durationTurns: 4 },
      { type: 'burn', recipient: 'primary-unit', power: 4, durationTurns: 2 },
    ],
  }

  it('reduces damage from a burning attacker and removes that reduction after Cleanse', () => {
    let state = encounter()
    state.effectTimingPolicy = {
      version: 2,
      modes: { warded: 'instant', burn: 'instant', 'remove-status': 'instant' },
    }
    state = {
      ...executeCombatAction(
        state,
        action,
        { kind: 'unit', combatantId: 'quarry' },
        PV1F_COMBAT_CONTENT,
      ).state,
      statBridge: state.statBridge,
    }
    expect(state.effectState?.burn).toHaveLength(1)
    expect(state.statusState.find((row) => row.combatantId === 'quarry')?.statuses).toEqual([])
    state = finishPv1fTurn(state, 'east').state
    const attack = {
      ...action,
      id: 'test.damage',
      effects: [{ type: 'damage' as const, recipient: 'primary-unit' as const, amount: 10 }],
    }
    const hit = executeCombatAction(
      state,
      attack,
      { kind: 'unit', combatantId: 'caster' },
      PV1F_COMBAT_CONTENT,
    )
    expect(hit.state.tactical.battle.combatants.find((unit) => unit.id === 'caster')?.hp).toBe(92)
    const cleanse = {
      ...action,
      id: 'test.cleanse',
      effects: [
        { type: 'remove-status' as const, recipient: 'actor' as const, statusIds: ['burn'] },
      ],
    }
    const cleaned = executeCombatAction(
      state,
      cleanse,
      { kind: 'unit', combatantId: 'caster' },
      PV1F_COMBAT_CONTENT,
    ).state
    expect(cleaned.effectState?.burn).toEqual([])
    const cleanHit = executeCombatAction(
      cleaned,
      attack,
      { kind: 'unit', combatantId: 'caster' },
      PV1F_COMBAT_CONTENT,
    )
    expect(cleanHit.state.tactical.battle.combatants.find((unit) => unit.id === 'caster')?.hp).toBe(
      90,
    )
  })

  it.each(['burn', 'poison', 'bleed'] as const)(
    'matches current %s only while its authored instance is active',
    (type) => {
      const content = {
        statuses: PV1F_COMBAT_CONTENT.statuses.map((definition) =>
          definition.id === 'warded'
            ? {
                ...definition,
                damageModifiers: [
                  {
                    direction: 'incoming' as const,
                    multiplierBasisPoints: 8000,
                    condition: { kind: 'opponent-status' as const, statusId: type },
                  },
                ],
              }
            : definition,
        ),
      }
      const dot: CombatEffectDefinition =
        type === 'bleed'
          ? { type, recipient: 'primary-unit', damagePerTick: 2, ticks: 1 }
          : { type, recipient: 'primary-unit', power: 2, durationTurns: 1 }
      const setup = { ...action, effects: [action.effects[0]!, dot] }
      const attack = {
        ...action,
        id: 'test.damage',
        effects: [{ type: 'damage' as const, recipient: 'primary-unit' as const, amount: 10 }],
      }
      const cast = (instant: boolean) => {
        let state = encounter()
        state.effectTimingPolicy = {
          version: 2,
          modes: { warded: 'instant', [type]: instant ? 'instant' : 'next-round' },
        }
        state = {
          ...executeCombatAction(state, setup, { kind: 'unit', combatantId: 'quarry' }, content)
            .state,
          statBridge: state.statBridge,
        }
        return finishPv1fTurn(state, 'east').state
      }
      let active = cast(true)
      expect(
        executeCombatAction(active, attack, { kind: 'unit', combatantId: 'caster' }, content).state
          .tactical.battle.combatants[0]?.hp,
      ).toBe(92)
      active = finishPv1fTurn(active, 'west').state
      expect(active.effectState?.[type]).toEqual([])
      active = finishPv1fTurn(active, 'east').state
      expect(
        active.statusState.find((row) => row.combatantId === 'caster')?.statuses,
      ).toContainEqual(expect.objectContaining({ statusId: 'warded' }))
      expect(
        executeCombatAction(active, attack, { kind: 'unit', combatantId: 'caster' }, content).state
          .tactical.battle.combatants[0]?.hp,
      ).toBe(90)
      const pending = cast(false)
      expect(pending.pendingEffects).toHaveLength(1)
      expect(
        executeCombatAction(pending, attack, { kind: 'unit', combatantId: 'caster' }, content).state
          .tactical.battle.combatants[0]?.hp,
      ).toBe(90)
    },
  )
})

describe('authored Poison power controls movement damage and lethal stop', () => {
  function poisoned(casterHp: number, power: number): StatDrivenCombatEncounterState {
    const initial = encounter(casterHp)
    initial.effectTimingPolicy = { version: 2, modes: { poison: 'instant' } }
    const applied = executeCombatAction(
      initial,
      {
        id: 'test.authored-poison',
        version: 1,
        sourceType: 'test',
        tags: [],
        target: {
          kind: 'self',
          teamPolicy: 'self',
          shape: { kind: 'single' },
          minimumRange: 0,
          maximumRange: 0,
          requiresLineOfSight: false,
          maximumElevationDifference: null,
          friendlyFire: 'all-units',
        },
        cost: { spendsAction: false, mp: 0 },
        requirements: [],
        effects: [{ type: 'poison', recipient: 'actor', power, durationTurns: 2 }],
      },
      { kind: 'self' },
      { statuses: [] },
    ).state
    return {
      ...advanceCurrentPoisonMovement(applied, 'caster', 4).state,
      statBridge: initial.statBridge,
    }
  }

  const path = [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ]

  it('forecasts instance damage and stops exactly at the tile where stronger Poison is lethal', () => {
    const state = poisoned(4, 5)
    const before = JSON.parse(JSON.stringify(state))
    const preview = evaluatePv1fMovement(state, path)
    expect(preview.poisonForecast).toEqual({
      traversedTiles: 1,
      triggeredTicks: 1,
      damage: 4,
      willDefeat: true,
    })
    expect(preview.movement.destination).toEqual({ x: 0, y: 1 })
    expect(preview.economyCost).toBe(20)
    expect(state).toEqual(before)
    const result = executePv1fMovement(state, path)
    expect(
      result.state.tactical.placements.find((row) => row.combatantId === 'caster')?.position,
    ).toEqual({ x: 0, y: 1 })
    expect(result.state.tactical.battle.combatants.find((row) => row.id === 'caster')?.hp).toBe(0)
    expect(readPv1fActionEconomy(result.state, 'caster')?.current).toBe(80)
    expect(result.state.tactical.battle.lifecycle).toBe('completed')
  })

  it('continues and charges the complete path when weaker Poison leaves the actor alive', () => {
    const state = poisoned(2, 1)
    const preview = evaluatePv1fMovement(state, path)
    expect(preview.poisonForecast).toEqual({
      traversedTiles: 2,
      triggeredTicks: 1,
      damage: 1,
      willDefeat: false,
    })
    expect(preview.economyCost).toBe(40)
    const result = executePv1fMovement(state, path)
    expect(
      result.state.tactical.placements.find((row) => row.combatantId === 'caster')?.position,
    ).toEqual({ x: 1, y: 1 })
    expect(result.state.tactical.battle.combatants.find((row) => row.id === 'caster')?.hp).toBe(1)
    expect(readPv1fActionEconomy(result.state, 'caster')?.current).toBe(60)
    expect(result.state.tactical.battle.lifecycle).toBe('active')
  })
})
