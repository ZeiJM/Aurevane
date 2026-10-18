import { describe, expect, it } from 'vitest'
import { validateCombatEncounterState, type CombatEncounterState } from './actions'
import { source } from './combat-behavior.test-utils'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import {
  createCurrentStatDrivenCombatEncounterState,
  reattachStatDrivenCombatBridge,
} from './stat-driven-combat'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
} from './combat-behavior-runtime'
import { prepareCombatAbilityCommand, commitCombatAbilityCommand } from './combat-ability-command'
import { finishPv1fTurn, preparePv1fTurnEconomy, PV1F_COMBAT_CONTENT } from './pv1f-action-economy'

function fixture({ covert = true, miss = false, queued = false, eligible = true } = {}) {
  const base = percentageDotEncounter()
  const initial = preparePv1fTurnEconomy(
    createCurrentStatDrivenCombatEncounterState(
      base,
      base.statBridge.combatants.map((profile) => ({
        ...profile,
        physicalPower: 20,
        mysticPower: 20,
        level: 1,
        criticalChance: 0,
        statusResistance: 0,
      })),
    ),
  )
  const captured = captureCombatAbilitySource({
    ...source({
      classification: 'utility',
      attackFamily: undefined,
      costs: [
        { resource: 'ap', amount: 30 },
        { resource: 'mp', amount: 2 },
      ],
      accuracy: { kind: 'fixed', chanceBasisPoints: miss ? 0 : 10000 },
      effects: [
        {
          id: 'observe',
          timing: queued ? 'next-round' : 'instant',
          requirements: {
            kind: 'resource-state',
            subject: 'owner',
            resource: 'mp',
            comparison: 'at-least',
            amount: eligible ? 2 : 21,
          },
          payload: {
            type: 'sensory',
            recipient: 'primary-unit',
            revealedDurationOwnerTurnStarts: 1,
          },
        },
        {
          id: 'mark',
          timing: 'instant',
          payload: {
            type: 'apply-status',
            recipient: 'primary-unit',
            statusId: 'mark',
            stacks: 1,
            durationTurns: 2,
          },
        },
      ],
    }),
    abilityId: 'test.canonical-sensory',
    tags: [],
  })
  const state = reattachStatDrivenCombatBridge(
    reconcileCombatAbilitySources(
      {
        ...initial,
        effectTimingPolicy: { version: 1, modes: {} },
        statusState: initial.statusState.map((row) => ({
          ...row,
          statuses:
            row.combatantId === 'enemy' && covert
              ? [
                  {
                    statusId: 'covert',
                    statusVersion: 1,
                    sourceCombatantId: 'enemy',
                    stacks: 1,
                    remainingOwnerTurnStarts: 2,
                  },
                ]
              : row.statuses,
        })),
      },
      [captured],
    ),
    initial.statBridge,
  )
  return {
    state,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source: captured },
    selection: { kind: 'unit' as const, combatantId: 'enemy' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, captured),
  }
}

function statuses(state: CombatEncounterState) {
  return state.statusState.find((row) => row.combatantId === 'enemy')!.statuses
}

describe('canonical Sensory packet materialization', () => {
  it('quotes without mutation and commits expanded Sensory before the following Mark packet', () => {
    const input = fixture()
    const before = JSON.stringify(input)
    expect(prepareCombatAbilityCommand(input).evaluation.legal).toBe(true)
    expect(JSON.stringify(input)).toBe(before)
    const out = commitCombatAbilityCommand(input)
    expect(statuses(out.state).map((row) => row.statusId)).toEqual(
      expect.arrayContaining(['revealed', 'mark']),
    )
    expect(statuses(out.state).some((row) => row.statusId === 'covert')).toBe(false)
    expect(out.state.tactical.battle.combatants.find((row) => row.id === 'actor')!.mp).toBe(18)
    expect(JSON.stringify(input)).toBe(before)
  })

  it('keeps the following packet legal when Sensory finds no Covert and expands to no effects', () => {
    const input = fixture({ covert: false })
    expect(prepareCombatAbilityCommand(input).evaluation.legal).toBe(true)
    const out = commitCombatAbilityCommand(input)
    expect(statuses(out.state).map((row) => row.statusId)).toEqual(['mark'])
  })

  it('a missed Sensory command neither purges Covert nor leaks Mark or Revealed', () => {
    const input = fixture({ miss: true })
    expect(prepareCombatAbilityCommand(input).evaluation.legal).toBe(true)
    const out = commitCombatAbilityCommand(input)
    expect(statuses(out.state).map((row) => row.statusId)).toEqual(['covert'])
    expect(out.state.pendingEffects ?? []).toEqual([])
  })

  it('an ineligible Sensory packet cannot purge or reveal while its eligible Mark still resolves', () => {
    const input = fixture({ eligible: false })
    expect(prepareCombatAbilityCommand(input).evaluation.legal).toBe(true)
    const out = commitCombatAbilityCommand(input)
    expect(statuses(out.state).map((row) => row.statusId)).toEqual(
      expect.arrayContaining(['covert', 'mark']),
    )
    expect(statuses(out.state).some((row) => row.statusId === 'revealed')).toBe(false)
  })

  it('keeps expanded purge/reveal timing and packet eligibility through JSON restore and a real round', () => {
    const input = fixture({ queued: true })
    expect(prepareCombatAbilityCommand(input).evaluation.legal).toBe(true)
    const out = commitCombatAbilityCommand(input)
    expect(validateCombatEncounterState(out.state)).toEqual([])
    expect(statuses(out.state).some((row) => row.statusId === 'covert')).toBe(true)
    expect(statuses(out.state).some((row) => row.statusId === 'revealed')).toBe(false)
    expect(statuses(out.state).some((row) => row.statusId === 'mark')).toBe(true)
    let state = reattachStatDrivenCombatBridge(
      JSON.parse(JSON.stringify(out.state)) as CombatEncounterState,
      input.state.statBridge,
    )
    for (let index = 0; index < 4; index++) {
      state = finishPv1fTurn(state, 'east').state
      expect(validateCombatEncounterState(state)).toEqual([])
    }
    expect(statuses(state).some((row) => row.statusId === 'covert')).toBe(false)
    expect(statuses(state).some((row) => row.statusId === 'revealed')).toBe(true)
    expect(state.pendingEffects ?? []).toEqual([])
  })
})
