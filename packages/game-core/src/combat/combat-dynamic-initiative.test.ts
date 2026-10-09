import { spawnCombatSummon, removeCombatSummon } from './combat-summons'
import {
  createCurrentStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'
import { resolveMatureSkillVersion } from './mature-skills'
import { describe, it, expect } from 'vitest'
import {
  executeCombatAction,
  validateCombatEncounterState,
  defeatCombatActionActor,
  type CombatEncounterState,
} from './actions'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { PV1F_COMBAT_CONTENT, finishPv1fTurn } from './pv1f-action-economy'
import { defaultCombatEffectTimingPolicy } from './combat-effect-timing'
import { validateBattleState } from './battle-state'
const base = (): CombatEncounterState => {
  const state = percentageDotEncounter()
  return {
    ...state,
    elementalDamagePolicyVersion: 1,
    dynamicInitiativePolicyVersion: 1,
    tactical: {
      ...state.tactical,
      battle: {
        ...state.tactical.battle,
        effectStackingPolicyVersion: 1,
        combatants: state.tactical.battle.combatants.map((u) => ({
          ...u,
          initiative: u.id === 'actor' ? 100 : u.id === 'enemy' ? 90 : u.id === 'other' ? 85 : 80,
        })),
      },
    },
  }
}
const action = {
  id: 'test.water',
  version: 1,
  sourceType: 'discipline-skill' as const,
  tags: ['attack'],
  cost: { mp: 0, spendsAction: false },
  requirements: [],
  target: {
    kind: 'unit' as const,
    teamPolicy: 'enemy' as const,
    friendlyFire: 'enemies-only' as const,
    shape: { kind: 'single' as const },
    minimumRange: 1,
    maximumRange: 4,
    requiresLineOfSight: false,
    maximumElevationDifference: null,
  },
  effects: [
    {
      type: 'damage' as const,
      recipient: 'primary-unit' as const,
      amount: 10,
      element: 'water' as const,
    },
  ],
}
const finish = (s: CombatEncounterState) =>
  finishPv1fTurn(s as ReturnType<typeof percentageDotEncounter>, 'west').state
const cast = (s: CombatEncounterState) =>
  executeCombatAction(s, action, { kind: 'unit', combatantId: 'enemy' }, PV1F_COMBAT_CONTENT).state

describe('active Initiative safe round progress', () => {
  it('Drenched reorders only the unacted remainder and never mutates base Initiative', () => {
    const out = cast(base())
    expect(out.tactical.battle.currentTurn?.combatantId).toBe('actor')
    expect(out.tactical.battle.initiativeOrder).toEqual(['actor', 'other', 'enemy', 'ally'])
    expect(out.tactical.battle.combatants.find((u) => u.id === 'enemy')?.initiative).toBe(90)
    expect(finish(out).tactical.battle.currentTurn?.combatantId).toBe('other')
  })
  it('stacked Drenched applies one reduction and JSON restore gives each living actor exactly one turn', () => {
    let state = cast(cast(base()))
    const turns = ['actor']
    for (let i = 0; i < 3; i++) {
      state = finish(JSON.parse(JSON.stringify(state)))
      turns.push(state.tactical.battle.currentTurn!.combatantId)
    }
    expect(turns).toEqual(['actor', 'other', 'enemy', 'ally'])
    expect(new Set(turns).size).toBe(4)
    state = finish(state)
    expect(state.tactical.battle.round).toBe(2)
    expect(state.tactical.battle.currentTurn?.combatantId).toBe('actor')
    expect(validateBattleState(state.tactical.battle)).toEqual([])
  })
  it('removal immediately restores future order and expiry restores following rounds', () => {
    let state = cast(base())
    const removed = executeCombatAction(
      state,
      {
        ...action,
        effects: [{ type: 'remove-status', recipient: 'primary-unit', statusIds: ['wet'] }],
      },
      { kind: 'unit', combatantId: 'enemy' },
      PV1F_COMBAT_CONTENT,
    ).state
    expect(removed.tactical.battle.initiativeOrder).toEqual(['actor', 'enemy', 'other', 'ally'])
    for (let i = 0; i < 8; i++) state = finish(state)
    expect(state.tactical.battle.round).toBe(3)
    expect(state.tactical.battle.initiativeOrder).toEqual(['actor', 'enemy', 'other', 'ally'])
  })
  it('Drenched reduces base plus frozen tempo once and expiry changes the next round first actor', () => {
    let state = base()
    state = {
      ...state,
      tactical: {
        ...state.tactical,
        battle: {
          ...state.tactical.battle,
          roundInitiativeModifiers: [{ combatantId: 'enemy', amount: 40 }],
        },
      },
    }
    // Keep initial historical ordering valid while this active round is explicitly prepared.
    state.tactical.battle.initiativeOrder = ['enemy', 'actor', 'other', 'ally']
    state.tactical.battle.currentTurn = {
      ...state.tactical.battle.currentTurn!,
      combatantId: 'enemy',
      initiativeIndex: 0,
    }
    const selfWater = {
      ...action,
      target: {
        ...action.target,
        teamPolicy: 'any' as const,
        friendlyFire: 'all-units' as const,
        minimumRange: 0,
      },
      effects: [
        {
          type: 'apply-status' as const,
          recipient: 'primary-unit' as const,
          statusId: 'wet',
          stacks: 1,
          durationTurns: 2,
        },
      ],
    }
    state = executeCombatAction(
      state,
      selfWater,
      { kind: 'unit', combatantId: 'enemy' },
      PV1F_COMBAT_CONTENT,
    ).state
    expect(state.tactical.battle.activeInitiativeModifiers).toEqual([
      { combatantId: 'enemy', amount: -13 },
    ])
    for (let i = 0; i < 4; i++) state = finish(state)
    expect(state.tactical.battle.round).toBe(2)
    expect(state.tactical.battle.currentTurn?.combatantId).toBe('actor')
  })
  it('activates pending Drenched before choosing the next round first actor', () => {
    let state = base()
    state = {
      ...state,
      effectTimingPolicy: { ...defaultCombatEffectTimingPolicy(), modes: { wet: 'next-round' } },
      tactical: {
        ...state.tactical,
        battle: {
          ...state.tactical.battle,
          combatants: state.tactical.battle.combatants.map((u) =>
            u.id === 'enemy' ? { ...u, initiative: 95 } : u,
          ),
        },
      },
    }
    const apply = {
      ...action,
      target: {
        ...action.target,
        teamPolicy: 'any' as const,
        friendlyFire: 'all-units' as const,
        minimumRange: 0,
      },
      effects: [
        {
          type: 'apply-status' as const,
          recipient: 'primary-unit' as const,
          statusId: 'wet',
          stacks: 1,
          durationTurns: 2,
        },
      ],
    }
    state = executeCombatAction(
      state,
      apply,
      { kind: 'unit', combatantId: 'actor' },
      PV1F_COMBAT_CONTENT,
    ).state
    expect(state.tactical.battle.activeInitiativeModifiers ?? []).toEqual([])
    for (let i = 0; i < 4; i++) state = finish(state)
    expect(state.tactical.battle.round).toBe(2)
    expect(state.tactical.battle.currentTurn?.combatantId).toBe('enemy')
    expect(state.tactical.battle.initiativeOrder).toEqual(['enemy', 'actor', 'other', 'ally'])
  })
  it('a defeated future actor is skipped without an extra turn or duplicated round progress', () => {
    let state = cast(base())
    const killed = executeCombatAction(
      state,
      { ...action, effects: [{ type: 'damage', recipient: 'primary-unit', amount: 2000 }] },
      { kind: 'unit', combatantId: 'enemy' },
      PV1F_COMBAT_CONTENT,
    ).state
    state = finish(killed)
    expect(state.tactical.battle.currentTurn?.combatantId).toBe('other')
    state = finish(state)
    expect(state.tactical.battle.currentTurn?.combatantId).toBe('ally')
    state = finish(state)
    expect(state.tactical.battle.round).toBe(2)
    expect(state.tactical.battle.turnNumber).toBe(4)
    expect(state.tactical.battle.currentTurn?.combatantId).toBe('actor')
    expect(validateBattleState(state.tactical.battle)).toEqual([])
  })
  it('a completed battle normalizes order after a fixed acted prefix diverges from current Initiative', () => {
    let state: CombatEncounterState = finish(cast(base()))
    state = executeCombatAction(
      state,
      {
        ...action,
        target: {
          ...action.target,
          teamPolicy: 'any',
          friendlyFire: 'all-units',
          minimumRange: 0,
          maximumRange: 10,
        },
        effects: [{ type: 'remove-status', recipient: 'primary-unit', statusIds: ['wet'] }],
      },
      { kind: 'unit', combatantId: 'enemy' },
      PV1F_COMBAT_CONTENT,
    ).state
    const lethal = {
      ...action,
      target: {
        ...action.target,
        teamPolicy: 'any' as const,
        friendlyFire: 'all-units' as const,
        minimumRange: 0,
        maximumRange: 10,
      },
      effects: [{ type: 'damage' as const, recipient: 'primary-unit' as const, amount: 2000 }],
    }
    state = executeCombatAction(
      state,
      lethal,
      { kind: 'unit', combatantId: 'actor' },
      PV1F_COMBAT_CONTENT,
    ).state
    state = executeCombatAction(
      state,
      lethal,
      { kind: 'unit', combatantId: 'ally' },
      PV1F_COMBAT_CONTENT,
    ).state
    expect(state.tactical.battle.lifecycle).toBe('completed')
    expect(validateCombatEncounterState(state)).toEqual([])
  })
  it('reaction knockout at a round boundary settles pending Initiative before selecting the first actor', () => {
    let state = base()
    state = {
      ...state,
      effectTimingPolicy: { version: 7, modes: { wet: 'next-round' } },
      tactical: {
        ...state.tactical,
        battle: {
          ...state.tactical.battle,
          combatants: state.tactical.battle.combatants.map((u) =>
            u.id === 'enemy' ? { ...u, initiative: 95 } : u,
          ),
        },
      },
    }
    state = executeCombatAction(
      state,
      {
        ...action,
        target: { ...action.target, teamPolicy: 'any', friendlyFire: 'all-units', minimumRange: 0 },
        effects: [
          {
            type: 'apply-status',
            recipient: 'primary-unit',
            statusId: 'wet',
            stacks: 1,
            durationTurns: 2,
          },
        ],
      },
      { kind: 'unit', combatantId: 'actor' },
      PV1F_COMBAT_CONTENT,
    ).state
    for (let i = 0; i < 3; i++) state = finish(state)
    const out = defeatCombatActionActor(state, 'ally', PV1F_COMBAT_CONTENT)
    expect(out.state.tactical.battle.round).toBe(2)
    expect(out.state.tactical.battle.currentTurn?.combatantId).toBe('enemy')
    expect(out.state.tactical.battle.turnNumber).toBe(5)
    expect(validateCombatEncounterState(out.state)).toEqual([])
  })
  it('new summons join once next round and removal prunes persisted progress safely', () => {
    const source = base() as ReturnType<typeof percentageDotEncounter>
    let state: StatDrivenCombatEncounterState = createCurrentStatDrivenCombatEncounterState(
      source,
      source.statBridge!.combatants.map((u) => ({
        ...u,
        physicalPower: u.physicalPower ?? 20,
        mysticPower: u.mysticPower ?? 20,
        level: 1,
        criticalChance: 0,
      })),
    )
    state = cast(state) as typeof state
    const skill = resolveMatureSkillVersion('wildwarden.renewing-herbs')!
    const spawned = spawnCombatSummon(state, {
      ownerCombatantId: 'actor',
      sourceSkillId: skill.id,
      sourceSkillVersion: skill.contentVersion,
      profile: skill.summonProfile!,
      position: { x: 0, y: 1 },
      facing: 'east',
    })
    state = spawned.state
    const summonId = state.effectState!.summons![0]!.combatantId
    const turns = ['actor']
    for (let i = 0; i < 3; i++) {
      state = finish(state) as typeof state
      turns.push(state.tactical.battle.currentTurn!.combatantId)
    }
    expect(turns).not.toContain(summonId)
    state = finish(state) as typeof state
    const next = []
    for (let i = 0; i < 5; i++) {
      next.push(state.tactical.battle.currentTurn!.combatantId)
      state = finish(state) as typeof state
    }
    expect(next.filter((id) => id === summonId)).toHaveLength(1)
    state = removeCombatSummon(state, summonId, 'expired').state
    expect(state.tactical.battle.initiativeOrder).not.toContain(summonId)
    expect(state.tactical.battle.actedCombatantIds).not.toContain(summonId)
    expect(validateCombatEncounterState(state)).toEqual([])
  })
  it('absence keeps frozen historical initiative order', () => {
    const s = base()
    delete s.dynamicInitiativePolicyVersion
    expect(cast(s).tactical.battle.initiativeOrder).toEqual(['actor', 'enemy', 'other', 'ally'])
  })
})
