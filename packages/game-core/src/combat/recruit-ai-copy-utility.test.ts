import { describe, expect, it } from 'vitest'
import type {
  CombatActionEvaluation,
  CombatEffectDefinition,
  CombatEffectProjection,
} from './actions'
import * as recruitAiBuild from './recruit-ai-build'
import type { StatDrivenCombatEncounterState } from './stat-driven-combat'

type ProjectedCombatEffectUtility = (
  evaluation: CombatActionEvaluation,
  state: StatDrivenCombatEncounterState,
  effects: readonly CombatEffectDefinition[],
) => number

function utility(): ProjectedCombatEffectUtility | undefined {
  return (
    recruitAiBuild as unknown as {
      projectedCombatEffectUtility?: ProjectedCombatEffectUtility
    }
  ).projectedCombatEffectUtility
}

function state(): StatDrivenCombatEncounterState {
  return {
    tactical: {
      battle: {
        combatants: [
          { id: 'actor', teamId: 'players' },
          { id: 'ally', teamId: 'players' },
          { id: 'enemy', teamId: 'enemies' },
        ],
      },
    },
  } as unknown as StatDrivenCombatEncounterState
}

function evaluation(projectedEffects: readonly CombatEffectProjection[]): CombatActionEvaluation {
  return {
    legal: true,
    actionId: 'test.clone-ai',
    actorId: 'actor',
    primaryPosition: null,
    primaryCombatantId: 'enemy',
    affectedTiles: [],
    affectedCombatantIds: ['enemy'],
    projectedEffects,
    projectedTerrain: [],
    projectedEvents: [],
    mpCost: 0,
    spendsAction: true,
    issues: [],
  }
}

const amplify: readonly CombatEffectDefinition[] = [
  { type: 'copy-statuses', recipient: 'primary-unit', mode: 'amplify' },
]
const curse: readonly CombatEffectDefinition[] = [
  { type: 'copy-statuses', recipient: 'primary-unit', mode: 'curse' },
]

function copyProjection(
  combatantId: string,
  before = 'none',
  after = 'test.effect:1:2',
): CombatEffectProjection {
  return { effectType: 'copy-statuses', combatantId, before, after }
}

describe('P4.K4 clone-aware Recruit AI projected utility', () => {
  it('rewards Amplify projections that add eligible state to the acting side', () => {
    expect(utility()?.(evaluation([copyProjection('actor')]), state(), amplify)).toBe(8)
  })

  it('rewards Curse projections that add eligible negative state to an enemy', () => {
    expect(utility()?.(evaluation([copyProjection('enemy')]), state(), curse)).toBe(8)
  })

  it('penalizes Curse projections that would add eligible negative state to an ally', () => {
    expect(utility()?.(evaluation([copyProjection('ally')]), state(), curse)).toBe(-8)
  })

  it('scores each actual clone projection and gives an empty no-op clone no bonus', () => {
    expect(
      utility()?.(
        evaluation([copyProjection('enemy'), copyProjection('enemy', 'none', 'burn:2')]),
        state(),
        curse,
      ),
    ).toBe(16)
    expect(utility()?.(evaluation([]), state(), curse)).toBe(0)
    expect(utility()?.(evaluation([copyProjection('enemy', 'burn:2', 'burn:2')]), state(), curse)).toBe(0)
  })

  it('combines clone utility with ordinary projected damage without changing its existing sign', () => {
    const effects: readonly CombatEffectDefinition[] = [
      ...curse,
      { type: 'damage', recipient: 'primary-unit', amount: 7 },
    ]
    expect(
      utility()?.(
        evaluation([
          copyProjection('enemy'),
          { effectType: 'damage', combatantId: 'enemy', before: 50, after: 43 },
        ]),
        state(),
        effects,
      ),
    ).toBe(22)
  })

  it('does not infer cloning value from a projection when the authoritative effect list has no clone block', () => {
    const ordinary: readonly CombatEffectDefinition[] = [
      { type: 'damage', recipient: 'primary-unit', amount: 7 },
    ]
    expect(utility()?.(evaluation([copyProjection('enemy')]), state(), ordinary)).toBe(0)
  })
})
