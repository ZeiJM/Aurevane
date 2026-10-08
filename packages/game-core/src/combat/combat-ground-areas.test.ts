import { describe, expect, it } from 'vitest'
import {
  createCombatGroundArea,
  advanceCombatGroundAreas,
  validateCombatGroundAreas,
} from './combat-ground-areas'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { PHASE4_STATUSES } from './status-content'
import type { CombatActionDefinition, CombatEncounterState } from './actions'

const content = { statuses: PHASE4_STATUSES }
const tiles = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 2, y: 0 },
  { x: 0, y: 1 },
  { x: 2, y: 1 },
  { x: 0, y: 2 },
  { x: 1, y: 2 },
  { x: 2, y: 2 },
]
const action = {
  id: 'test.ground',
  version: 1,
  sourceType: 'discipline-skill' as const,
  tags: ['attack'],
  target: {
    kind: 'ground-tile' as const,
    teamPolicy: 'enemy' as const,
    geometryVersion: 2 as const,
    shape: { kind: 'circle' as const, radius: 1 },
    minimumRange: 0,
    maximumRange: 1,
    requiresLineOfSight: false,
    maximumElevationDifference: 2,
    friendlyFire: 'enemies-only' as const,
  },
  cost: { spendsAction: false, mp: 0 },
  requirements: [],
  effects: [
    {
      type: 'damage' as const,
      recipient: 'affected-units' as const,
      amount: 23,
      element: 'fire' as const,
    },
  ],
  groundArea: { durationRounds: 3, visualPresetId: 'embers' as const, entryEffectOrdinals: [0] },
}
function encounter() {
  return { ...percentageDotEncounter(), groundEffectPolicyVersion: 1 as const }
}
function area(state: CombatEncounterState | undefined) {
  return state?.groundAreas?.[0]
}
function atRound(state: CombatEncounterState, round: number) {
  return { ...state, tactical: { ...state.tactical, battle: { ...state.tactical.battle, round } } }
}

describe('persisted typed Ground area state', () => {
  it.each(['level', 'physicalPower', 'missing-profile', 'null-profile'])(
    'rejects incomplete frozen bridge3 %s on reload',
    (missing) => {
      const initial = encounter()
      initial.statBridge = {
        ...initial.statBridge,
        schemaVersion: 3 as const,
        rulesVersion: 3 as const,
        combatants: initial.statBridge!.combatants.map((profile) => ({ ...profile, level: 50 })),
      }
      const placed = createCombatGroundArea(initial, 'enemy', action, tiles, content)
      const restored = JSON.parse(JSON.stringify(placed)) as CombatEncounterState
      const caster = restored.groundAreas![0]!.caster
      if (missing === 'missing-profile') delete caster.statProfile
      else if (missing === 'null-profile') Object.assign(caster, { statProfile: null })
      else delete caster.statProfile![missing as 'level' | 'physicalPower']
      expect(validateCombatGroundAreas(restored).length).toBeGreaterThan(0)
    },
  )
  it('keeps caster values and entry payload independent of later source mutations', () => {
    const original = encounter()
    const localAction = JSON.parse(JSON.stringify(action)) as typeof action
    const placed = createCombatGroundArea(original, 'actor', localAction, tiles, content)
    localAction.effects[0]!.amount = 99
    original.tactical.battle.combatants.find((row) => row.id === 'actor')!.hp = 0
    original.tactical.placements.find((row) => row.combatantId === 'actor')!.position = {
      x: 4,
      y: 4,
    }
    expect(placed.groundAreas![0]!.entryEffects[0]).toMatchObject({ amount: 23 })
    expect(placed.groundAreas![0]!.caster.combatant.hp).toBe(1000)
    expect(placed.groundAreas![0]!.caster.placement.position).toEqual({ x: 1, y: 1 })
  })
  it('accepts the current offensive accuracy ceiling without accepting impossible probabilities', () => {
    const original = encounter()
    const current = {
      ...original,
      statBalancePolicyVersion: 1 as const,
      statBridge: {
        ...original.statBridge,
        schemaVersion: 4 as const,
        rulesVersion: 4 as const,
        combatants: original.statBridge.combatants.map((profile) => ({
          ...profile,
          level: 50,
          criticalChance: 0,
          statusResistance: 0,
        })),
      },
    }
    const placed = createCombatGroundArea(current, 'actor', action, tiles, content)
    placed.groundAreas![0]!.caster.statProfile!.accuracy = 14000
    expect(validateCombatGroundAreas(placed)).toEqual([])
    placed.groundAreas![0]!.caster.statProfile!.accuracy = 14001
    expect(validateCombatGroundAreas(placed)).not.toEqual([])
  })
  it('rejects malformed frozen caster data on reload', () => {
    const placed = createCombatGroundArea(encounter(), 'actor', action, tiles, content)
    const corruptions = [
      (state: CombatEncounterState) => {
        state.groundAreas![0]!.caster.combatant.hp = -1
      },
      (state: CombatEncounterState) => {
        state.groundAreas![0]!.caster.placement.position = { x: 99, y: 99 }
      },
      (state: CombatEncounterState) => {
        state.groundAreas![0]!.caster.statProfile!.armor = NaN
      },
      (state: CombatEncounterState) => {
        state.groundAreas![0]!.caster.statuses = [
          {
            statusId: 'inspired',
            statusVersion: 999,
            sourceCombatantId: 'actor',
            stacks: 1,
            remainingOwnerTurnStarts: 2,
          },
        ]
      },
    ]
    for (const corrupt of corruptions) {
      const reloaded = JSON.parse(JSON.stringify(placed)) as CombatEncounterState
      corrupt(reloaded)
      expect(validateCombatGroundAreas(reloaded)).not.toEqual([])
    }
  })
  it('allocates distinct immutable instances and rejects invalid persisted footprint or payload', () => {
    const initial = encounter()
    const first = createCombatGroundArea(initial, 'actor', action, tiles, content)
    const second = createCombatGroundArea(first, 'actor', action, tiles, content)
    expect(second.groundAreas?.map((area) => area.id)).toEqual(['ground.area.1', 'ground.area.2'])
    for (const corrupt of [
      (state: CombatEncounterState) => {
        state.groundAreas![0]!.tiles = [tiles[0]!, tiles[0]!]
      },
      (state: CombatEncounterState) => {
        state.groundAreas![0]!.activationRound = 10
        state.groundAreas![0]!.expiresAtRound = 12
      },
      (state: CombatEncounterState) => {
        state.groundAreas![0]!.entryEffects = [
          { type: 'copy-statuses', recipient: 'primary-unit', mode: 'curse' },
        ]
      },
    ]) {
      const reloaded = JSON.parse(JSON.stringify(second)) as CombatEncounterState
      corrupt(reloaded)
      expect(validateCombatGroundAreas(reloaded)).not.toEqual([])
    }
  })
  it('pins exact footprint, next-round lifetime and entry payload once, including an empty cast', () => {
    const original = encounter()
    const placed = createCombatGroundArea(original, 'actor', action, tiles, content)
    expect(area(placed)).toMatchObject({
      id: 'ground.area.1',
      tiles,
      activationRound: 2,
      expiresAtRound: 5,
      visualPresetId: 'embers',
      entryEffects: [{ type: 'damage', amount: 23 }],
    })
    expect(original).not.toHaveProperty('groundAreas')
    expect(placed?.tactical.battle.rng).toEqual(original.tactical.battle.rng)
  })
  it('pins explicit Instant lifetime and expires at exactly its recorded boundary', () => {
    const placed = createCombatGroundArea(
      encounter(),
      'actor',
      {
        ...action,
        groundArea: { ...action.groundArea, timing: 'instant' },
      } as CombatActionDefinition,
      tiles,
      content,
    )
    expect(area(placed)).toMatchObject({ activationRound: 1, expiresAtRound: 4 })
    expect(area(placed && advanceCombatGroundAreas(atRound(placed, 3)))).toBeDefined()
    expect(area(placed && advanceCombatGroundAreas(atRound(placed, 4)))).toBeUndefined()
  })
  it('does not follow the caster or reroll after JSON reload', () => {
    const placed = createCombatGroundArea(encounter(), 'actor', action, tiles, content)
    const reloaded =
      placed && (JSON.parse(JSON.stringify(placed)) as CombatEncounterState | undefined)
    const moved = reloaded && {
      ...reloaded,
      tactical: {
        ...reloaded.tactical,
        placements: reloaded.tactical.placements.map((row) =>
          row.combatantId === 'actor' ? { ...row, position: { x: 4, y: 4 } } : row,
        ),
      },
    }
    expect(area(moved)).toMatchObject({ tiles, activationRound: 2, expiresAtRound: 5 })
    expect(moved && validateCombatGroundAreas(moved)).toEqual([])
  })
  it('retains historical encounters without areas and clears completed battles', () => {
    const old = percentageDotEncounter()
    expect(createCombatGroundArea(old, 'actor', action, tiles, content)).toEqual(old)
    const placed = createCombatGroundArea(encounter(), 'actor', action, tiles, content)
    const completed = placed && {
      ...placed,
      tactical: {
        ...placed.tactical,
        battle: { ...placed.tactical.battle, lifecycle: 'completed' as const, currentTurn: null },
      },
    }
    expect(area(completed && advanceCombatGroundAreas(completed))).toBeUndefined()
  })
})
