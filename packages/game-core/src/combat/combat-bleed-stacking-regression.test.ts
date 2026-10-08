import { describe, expect, it } from 'vitest'
import {
  executeCombatAction,
  endCombatTurn,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEncounterState,
} from './actions'
import { selectCurrentFinalFacing } from './board'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'

const content = { statuses: [] }
const severingCut: CombatActionDefinition = {
  id: 'test.same-severing-cut',
  version: 1,
  sourceType: 'test',
  tags: ['attack'],
  cost: { spendsAction: false, mp: 0 },
  requirements: [],
  target: {
    kind: 'unit',
    teamPolicy: 'enemy',
    shape: { kind: 'single' },
    minimumRange: 0,
    maximumRange: 5,
    requiresLineOfSight: false,
    maximumElevationDifference: null,
    friendlyFire: 'enemies-only',
  },
  effects: [
    { type: 'damage', recipient: 'primary-unit', amount: 20 },
    {
      type: 'bleed',
      recipient: 'primary-unit',
      ticks: 3,
      damageProfile: { kind: 'attack-percentage', basisPoints: 1500 },
    },
  ],
}
function round(state: CombatEncounterState) {
  const initial = state.tactical.battle.round
  while (state.tactical.battle.round === initial) {
    state = endCombatTurn(
      { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
      content,
    ).state
  }
  return JSON.parse(JSON.stringify(state)) as CombatEncounterState
}

describe('unlimited independent same-Skill Bleed applications', () => {
  it('keeps eight captured stacks across activation, reload and three independent ticks', () => {
    let state: CombatEncounterState = {
      ...percentageDotEncounter(),
      effectTimingPolicy: { version: 1, modes: {} },
    }
    for (let i = 0; i < 8; i++)
      state = executeCombatAction(
        state,
        severingCut,
        { kind: 'unit', combatantId: 'enemy' },
        content,
      ).state
    expect(state.effectState?.bleed ?? []).toHaveLength(0)
    state = round(state)
    expect(validateCombatEncounterState(state)).toEqual([])
    expect(state.effectState?.bleed).toHaveLength(8)
    expect(state.effectState?.bleed.map((row) => row.percentageDamage?.capturedDamage)).toEqual(
      Array(8).fill(20),
    )
    for (const hp of [816, 792, 768]) {
      state = round(state)
      expect(state.tactical.battle.combatants.find((row) => row.id === 'enemy')!.hp).toBe(hp)
    }
    expect(state.effectState?.bleed ?? []).toHaveLength(0)
    state = round(state)
    expect(state.tactical.battle.combatants.find((row) => row.id === 'enemy')!.hp).toBe(768)
  })
})
