import { selectCurrentFinalFacing } from './board'
import { describe, expect, it } from 'vitest'
import {
  executeCombatAction,
  endCombatTurn,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEncounterState,
} from './actions'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { grantBarrier } from './combat-barrier'

const content = { statuses: [] }
function attack(reversed = false, multi = false): CombatActionDefinition {
  const damage = {
    type: 'damage' as const,
    recipient: 'primary-unit' as const,
    amount: 40,
    defenseKind: 'armor' as const,
  }
  const dot = {
    type: 'poison' as const,
    recipient: 'primary-unit' as const,
    durationTurns: 4,
    damageProfile: { kind: 'attack-percentage' as const, basisPoints: 1500 },
  }
  return {
    id: 'percentage-attack',
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
    effects: reversed
      ? [dot, damage, ...(multi ? [damage] : [])]
      : [damage, ...(multi ? [damage] : []), dot],
  }
}
function nextRound(state: CombatEncounterState): CombatEncounterState {
  const round = state.tactical.battle.round
  for (let i = 0; i < 8 && state.tactical.battle.round === round; i++)
    state = endCombatTurn(
      { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
      content,
    ).state
  return JSON.parse(JSON.stringify(state)) as CombatEncounterState
}

describe('percentage DoTs capture their originating attack', () => {
  for (const damage of ['instant', 'next-round'] as const)
    for (const poison of ['instant', 'next-round'] as const) {
      it(`binds ${damage} damage and ${poison} Poison through reconnect`, () => {
        const state = {
          ...percentageDotEncounter(),
          effectTimingPolicy: { version: 1, modes: { damage, poison } },
        }
        let result = executeCombatAction(
          state,
          attack(),
          { kind: 'unit', combatantId: 'enemy' },
          content,
        ).state
        if (damage === 'next-round' || poison === 'next-round') {
          expect(result.effectState?.poison ?? []).toHaveLength(0)
          expect(validateCombatEncounterState(JSON.parse(JSON.stringify(result)))).toEqual([])
          result = nextRound(result)
        }
        const hpDamage =
          1000 - result.tactical.battle.combatants.find((row) => row.id === 'enemy')!.hp
        expect(result.effectState?.poison).toHaveLength(1)
        expect(result.effectState?.poison[0]?.percentageDamage?.capturedDamage).toBe(hpDamage)
        expect(result.percentageDotCommands ?? []).toHaveLength(0)
      })
    }
  it('captures all direct hits when the authored DoT precedes damage', () => {
    const result = executeCombatAction(
      percentageDotEncounter(),
      attack(true, true),
      { kind: 'unit', combatantId: 'enemy' },
      content,
    )
    const loss =
      1000 - result.state.tactical.battle.combatants.find((row) => row.id === 'enemy')!.hp
    expect(result.state.effectState?.poison[0]?.percentageDamage?.capturedDamage).toBe(loss)
    expect(loss).toBeGreaterThan(40)
  })
  it('captures HP after Barrier and does not replace on zero damage', () => {
    let state = grantBarrier(percentageDotEncounter(), 'enemy', 'enemy', 'barrier', 30).state
    let result = executeCombatAction(
      state,
      attack(),
      { kind: 'unit', combatantId: 'enemy' },
      content,
    ).state
    expect(result.effectState?.poison[0]?.percentageDamage?.capturedDamage).toBe(10)
    state = grantBarrier(result, 'enemy', 'enemy', 'barrier', 100).state
    result = executeCombatAction(
      state,
      attack(),
      { kind: 'unit', combatantId: 'enemy' },
      content,
    ).state
    expect(result.effectState?.poison[0]?.percentageDamage?.capturedDamage).toBe(10)
  })
  it('keeps delayed casts separate and the latest valid recipient application wins', () => {
    const state = {
      ...percentageDotEncounter(),
      effectTimingPolicy: {
        version: 1,
        modes: { damage: 'next-round' as const, poison: 'instant' as const },
      },
    }
    let result = executeCombatAction(
      state,
      attack(),
      { kind: 'unit', combatantId: 'enemy' },
      content,
    ).state
    const second = {
      ...attack(),
      effects: [
        {
          type: 'damage' as const,
          recipient: 'primary-unit' as const,
          amount: 20,
          defenseKind: 'armor' as const,
        },
        attack().effects[1]!,
      ],
    }
    result = executeCombatAction(
      result,
      second,
      { kind: 'unit', combatantId: 'enemy' },
      content,
    ).state
    expect(result.percentageDotCommands?.map((row) => row.id)).toEqual([1, 2])
    result = nextRound(result)
    expect(result.effectState?.poison).toHaveLength(1)
    expect(result.effectState?.poison[0]?.percentageDamage?.capturedDamage).toBe(20)
  })
  it('does not apply a DoT to a defeated recipient after overkill', () => {
    const original = percentageDotEncounter()
    const state = {
      ...original,
      tactical: {
        ...original.tactical,
        battle: {
          ...original.tactical.battle,
          combatants: original.tactical.battle.combatants.map((row) =>
            row.id === 'enemy' ? { ...row, hp: 10 } : row,
          ),
        },
      },
    }
    const result = executeCombatAction(
      state,
      attack(),
      { kind: 'unit', combatantId: 'enemy' },
      content,
    ).state
    expect(result.effectState?.poison ?? []).toHaveLength(0)
    expect(result.percentageDotCommands ?? []).toHaveLength(0)
  })
  it('captures unequal AoE mitigation independently for each hostile recipient', () => {
    const original = percentageDotEncounter()
    const state = {
      ...original,
      statBridge: {
        ...original.statBridge!,
        combatants: original.statBridge!.combatants.map((row) =>
          row.combatantId === 'other' ? { ...row, armor: 20 } : row,
        ),
      },
    }
    const single = attack()
    const area: CombatActionDefinition = {
      ...single,
      target: { ...single.target, shape: { kind: 'circle', radius: 1 } },
      effects: [
        { type: 'damage', recipient: 'affected-units', amount: 40, defenseKind: 'armor' },
        {
          type: 'poison',
          recipient: 'affected-units',
          durationTurns: 4,
          damageProfile: { kind: 'attack-percentage', basisPoints: 1500 },
        },
      ],
    }
    const result = executeCombatAction(
      state,
      area,
      { kind: 'unit', combatantId: 'enemy' },
      content,
    ).state
    expect(
      result.effectState?.poison.map((row) => [
        row.targetCombatantId,
        row.percentageDamage?.capturedDamage,
      ]),
    ).toEqual([
      ['enemy', 40],
      ['other', 33],
    ])
  })
  it('uses the critical HP receipt without rerolling at delayed activation', () => {
    const original = percentageDotEncounter()
    const state: CombatEncounterState = {
      ...original,
      effectTimingPolicy: { version: 1, modes: { poison: 'next-round' } },
      statBridge: {
        ...original.statBridge!,
        rulesVersion: 4,
        combatants: original.statBridge!.combatants.map((row) => ({
          ...row,
          criticalChance: row.combatantId === 'actor' ? 10000 : 0,
          level: 1,
        })),
      },
    }
    const cast = executeCombatAction(
      state,
      attack(),
      { kind: 'unit', combatantId: 'enemy' },
      content,
    )
    const loss = 1000 - cast.state.tactical.battle.combatants.find((row) => row.id === 'enemy')!.hp
    expect(loss).toBeGreaterThan(40)
    const rng = cast.state.tactical.battle.rng
    const activated = nextRound(cast.state)
    expect(activated.effectState?.poison[0]?.percentageDamage?.capturedDamage).toBe(loss)
    expect(activated.tactical.battle.rng).toEqual(rng)
  })
  it('leaves no application or dependency after a complete miss', () => {
    const original = percentageDotEncounter()
    const state = {
      ...original,
      statBridge: {
        ...original.statBridge!,
        combatants: original.statBridge!.combatants.map((row) =>
          row.combatantId === 'actor' ? { ...row, accuracy: 0 } : row,
        ),
      },
    }
    const result = executeCombatAction(
      state,
      { ...attack(), accuracyMode: 'per-target' },
      { kind: 'unit', combatantId: 'enemy' },
      content,
    )
    expect(result.events.some((row) => row.event === 'combat_accuracy_resolved' && !row.hit)).toBe(
      true,
    )
    expect(result.state.effectState?.poison ?? []).toHaveLength(0)
    expect(result.state.percentageDotCommands ?? []).toHaveLength(0)
  })
  it.each(['instant', 'next-round'] as const)(
    'cancels an unresolved application after its source is defeated (%s damage)',
    (damage) => {
      const original = percentageDotEncounter()
      const state = {
        ...original,
        effectTimingPolicy: { version: 1, modes: { damage, poison: 'next-round' as const } },
      }
      const cast = executeCombatAction(
        state,
        attack(),
        { kind: 'unit', combatantId: 'enemy' },
        content,
      ).state
      const after = {
        ...cast,
        tactical: {
          ...cast.tactical,
          battle: {
            ...cast.tactical.battle,
            combatants: cast.tactical.battle.combatants.map((row) =>
              row.id === 'actor' ? { ...row, hp: 0 } : row,
            ),
          },
        },
      }
      const activated = nextRound(endCombatTurn(after, content, true).state)
      expect(activated.tactical.battle.combatants.find((row) => row.id === 'enemy')!.hp).toBe(
        damage === 'instant' ? 960 : 1000,
      )
      expect(activated.effectState?.poison ?? []).toHaveLength(0)
      expect(activated.percentageDotCommands ?? []).toHaveLength(0)
    },
  )
  it('records resistance once and keeps resisted delayed applications absent', () => {
    const original = percentageDotEncounter()
    let resisted = 0
    for (let seed = 1; seed <= 30; seed++) {
      const state: CombatEncounterState = {
        ...original,
        statBalancePolicyVersion: 1,
        effectTimingPolicy: { version: 1, modes: { poison: 'next-round' } },
        tactical: {
          ...original.tactical,
          battle: {
            ...original.tactical.battle,
            rng: { ...original.tactical.battle.rng, seed, state: seed },
          },
        },
        statBridge: {
          ...original.statBridge!,
          rulesVersion: 4,
          combatants: original.statBridge!.combatants.map((row) => ({
            ...row,
            criticalChance: 0,
            level: 1,
            statusResistance: row.combatantId === 'enemy' ? 1500 : 0,
          })),
        },
      }
      const cast = executeCombatAction(
        state,
        { ...attack(), sourceType: 'discipline-skill' },
        { kind: 'unit', combatantId: 'enemy' },
        content,
      )
      const receipt = cast.events.find((row) => row.event === 'combat_status_resistance_resolved')
      expect(receipt).toBeDefined()
      if (receipt?.event !== 'combat_status_resistance_resolved' || !receipt.resisted) continue
      resisted++
      const activated = nextRound(cast.state)
      expect(activated.effectState?.poison ?? []).toHaveLength(0)
      expect(activated.tactical.battle.rng).toEqual(cast.state.tactical.battle.rng)
    }
    expect(resisted).toBeGreaterThan(0)
  })
  it('captures before Absorb and excludes reflected damage receipts', () => {
    const original = percentageDotEncounter()
    const reflect = {
      id: 'test.reflect',
      version: 1,
      maximumStacks: 1,
      durationOwnerTurnStarts: 2,
      damageTakenMultiplierBasisPoints: 10000,
      polarity: 'positive' as const,
      reactionClass: 'reactive' as const,
      reflectBasisPoints: 2500,
    }
    const absorb = {
      ...reflect,
      id: 'test.absorb',
      reflectBasisPoints: undefined,
      absorbHpBasisPoints: 2500,
    }
    const state = {
      ...original,
      tactical: {
        ...original.tactical,
        battle: {
          ...original.tactical.battle,
          combatants: original.tactical.battle.combatants.map((row) =>
            row.id === 'actor' ? { ...row, hp: 900 } : row,
          ),
        },
      },
      statusState: original.statusState.map((row) => ({
        ...row,
        statuses:
          row.combatantId === 'enemy'
            ? [
                {
                  statusId: reflect.id,
                  statusVersion: 1,
                  sourceCombatantId: 'enemy',
                  stacks: 1,
                  remainingOwnerTurnStarts: 2,
                },
              ]
            : row.combatantId === 'actor'
              ? [
                  {
                    statusId: absorb.id,
                    statusVersion: 1,
                    sourceCombatantId: 'actor',
                    stacks: 1,
                    remainingOwnerTurnStarts: 2,
                  },
                ]
              : [],
      })),
    }
    const result = executeCombatAction(
      state,
      attack(),
      { kind: 'unit', combatantId: 'enemy' },
      { statuses: [reflect, absorb] },
    )
    expect(result.state.effectState?.poison[0]?.percentageDamage?.capturedDamage).toBe(40)
    expect(result.state.effectState?.poison).toHaveLength(1)
    expect(
      result.events.some(
        (row) => row.event === 'damage_applied' && row.actionId === 'status.reflect.current.v1',
      ),
    ).toBe(true)
  })
  it('rejects orphan dependency identities and unsafe counters', () => {
    const state = {
      ...percentageDotEncounter(),
      effectTimingPolicy: { version: 1, modes: { damage: 'next-round' as const } },
    }
    const result = executeCombatAction(
      state,
      attack(),
      { kind: 'unit', combatantId: 'enemy' },
      content,
    ).state
    expect(validateCombatEncounterState({ ...result, percentageDotCommands: [] })).not.toEqual([])
    expect(() =>
      executeCombatAction(
        { ...state, nextPercentageDotCommandId: Number.MAX_SAFE_INTEGER },
        attack(),
        { kind: 'unit', combatantId: 'enemy' },
        content,
      ),
    ).toThrow()
  })
})
