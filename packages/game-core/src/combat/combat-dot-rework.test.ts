import { describe, expect, it } from 'vitest'
import {
  createCombatEncounterState,
  endCombatTurn,
  executeCombatAction,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEffectDefinition,
  type CombatEncounterState,
} from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState, selectCurrentFinalFacing } from './board'
import { PHASE4_STATUSES } from './status-content'

const CONTENT = { statuses: PHASE4_STATUSES }

function encounter() {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'current-dot-contract',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 42,
      combatants: [
        {
          id: 'actor',
          teamId: 'players',
          initiative: 20,
          baseMovementBudget: 10,
          hp: 30,
          maxHp: 30,
          mp: 20,
          maxMp: 20,
        },
        {
          id: 'target',
          teamId: 'enemies',
          initiative: 10,
          baseMovementBudget: 10,
          hp: 30,
          maxHp: 30,
          mp: 20,
          maxMp: 20,
        },
      ],
    }),
  ).state

  return createCombatEncounterState(
    createTacticalBattleState({
      battle,
      width: 3,
      height: 1,
      terrains: [{ id: 'open', traversalCost: 1 }],
      tiles: Array.from({ length: 3 }, (_, x) => ({
        position: { x, y: 0 },
        elevation: 0,
        terrainId: 'open',
      })),
      movementProfiles: [{ id: 'ground', maxElevationStep: 0, terrainCostOverrides: [] }],
      placements: [
        {
          combatantId: 'actor',
          position: { x: 0, y: 0 },
          facing: 'east',
          movementProfileId: 'ground',
        },
        {
          combatantId: 'target',
          position: { x: 1, y: 0 },
          facing: 'west',
          movementProfileId: 'ground',
        },
      ],
    }),
  )
}

function finishTurn(state: CombatEncounterState) {
  const faced = selectCurrentFinalFacing(state.tactical, 'east')
  return endCombatTurn({ ...state, tactical: faced.state }, CONTENT)
}

function action(
  effect: CombatEffectDefinition,
  id = 'test.current-poison',
): CombatActionDefinition {
  return {
    id,
    version: 1,
    sourceType: 'test',
    tags: ['test'],
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
    effects: [effect],
  }
}

const currentPoison: CombatEffectDefinition = {
  type: 'poison',
  recipient: 'primary-unit',
}

describe('current Poison runtime', () => {
  it('stores Poison in versioned effect state instead of the legacy timed status list', () => {
    const result = executeCombatAction(
      encounter(),
      action(currentPoison),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )

    expect(result.state.effectState?.poison).toEqual([
      {
        targetCombatantId: 'target',
        sourceCombatantId: 'actor',
        sourceActionId: 'test.current-poison',
        profileVersion: 1,
        movementRemainder: 0,
      },
    ])
    expect(
      result.state.statusState.find((row) => row.combatantId === 'target')?.statuses ?? [],
    ).toEqual([])
  })

  it('reapplication remains non-stacking and preserves movement progress', () => {
    const first = executeCombatAction(
      encounter(),
      action(currentPoison, 'test.poison-a'),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )
    const progressed = {
      ...first.state,
      effectState: {
        ...first.state.effectState!,
        poison: first.state.effectState!.poison.map((row) => ({ ...row, movementRemainder: 3 })),
      },
    }

    const reapplied = executeCombatAction(
      progressed,
      action(currentPoison, 'test.poison-b'),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )

    expect(reapplied.state.effectState?.poison).toEqual([
      {
        targetCombatantId: 'target',
        sourceCombatantId: 'actor',
        sourceActionId: 'test.poison-b',
        profileVersion: 1,
        movementRemainder: 3,
      },
    ])
  })

  it('deals the canonical 2 damage at each poisoned unit end-turn without expiring naturally', () => {
    const poisoned = executeCombatAction(
      encounter(),
      action(currentPoison),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )

    const targetTurn = finishTurn(poisoned.state)
    expect(targetTurn.state.tactical.battle.currentTurn?.combatantId).toBe('target')
    expect(targetTurn.state.tactical.battle.combatants.find((row) => row.id === 'target')?.hp).toBe(
      30,
    )

    const firstTick = finishTurn(targetTurn.state)
    expect(firstTick.state.tactical.battle.combatants.find((row) => row.id === 'target')?.hp).toBe(
      28,
    )
    expect(firstTick.state.effectState?.poison).toHaveLength(1)

    const secondTargetTurn = finishTurn(firstTick.state)
    const secondTick = finishTurn(secondTargetTurn.state)
    expect(secondTick.state.tactical.battle.combatants.find((row) => row.id === 'target')?.hp).toBe(
      26,
    )
    expect(secondTick.state.effectState?.poison).toHaveLength(1)
  })

  it('explicit Poison removal clears current state and a later fresh application restarts movement progress', () => {
    const poisoned = executeCombatAction(
      encounter(),
      action(currentPoison, 'test.poison-a'),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )
    const progressed = {
      ...poisoned.state,
      effectState: {
        ...poisoned.state.effectState!,
        poison: poisoned.state.effectState!.poison.map((row) => ({ ...row, movementRemainder: 4 })),
      },
    }

    const cleansed = executeCombatAction(
      progressed,
      action(
        { type: 'remove-status', recipient: 'primary-unit', statusIds: ['poison'] },
        'test.cleanse-poison',
      ),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )
    expect(cleansed.state.effectState?.poison).toEqual([])

    const fresh = executeCombatAction(
      cleansed.state,
      action(currentPoison, 'test.poison-b'),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )
    expect(fresh.state.effectState?.poison[0]?.movementRemainder).toBe(0)
  })

  it('rejects invalid or duplicate current Poison encounter state', () => {
    const state = encounter()
    const issues = validateCombatEncounterState({
      ...state,
      effectState: {
        ongoingRecovery: [],
        poison: [
          {
            targetCombatantId: 'target',
            sourceCombatantId: 'actor',
            sourceActionId: 'test.poison-a',
            profileVersion: 1,
            movementRemainder: 5,
          },
          {
            targetCombatantId: 'target',
            sourceCombatantId: 'missing-source',
            sourceActionId: 'test.poison-b',
            profileVersion: 1,
            movementRemainder: 0,
          },
        ],
        bleed: [],
        burn: [],
        temporarySkills: [],
        damageHistory: [],
      },
    })

    expect(issues.some((issue) => issue.field === 'effectState.poison')).toBe(true)
  })
})

describe('Combat v5 authored duration lifecycle', () => {
  function persistentRows(state: CombatEncounterState, kind: 'poison' | 'bleed' | 'burn') {
    return state.effectState?.[kind] ?? []
  }

  it.each([
    [
      'Poison',
      {
        type: 'poison',
        recipient: 'primary-unit',
        power: 3,
        durationTurns: 2,
      } satisfies CombatEffectDefinition,
      'poison' as const,
    ],
    [
      'Bleed',
      {
        type: 'bleed',
        recipient: 'primary-unit',
        damagePerTick: 3,
        ticks: 2,
        durationTurns: 2,
      } satisfies CombatEffectDefinition,
      'bleed' as const,
    ],
    [
      'Burn',
      {
        type: 'burn',
        recipient: 'primary-unit',
        power: 5,
        durationTurns: 2,
      } satisfies CombatEffectDefinition,
      'burn' as const,
    ],
  ])(
    '%s starts on the following target turn and expires after two target turns',
    (_name, effect, kind) => {
      const applied = executeCombatAction(
        encounter(),
        action(effect, `test.v5-duration-${kind}`),
        { kind: 'unit', combatantId: 'target' },
        CONTENT,
      )
      expect(persistentRows(applied.state, kind)[0]?.remainingTicks).toBe(2)

      const targetTurn = finishTurn(applied.state).state
      expect(targetTurn.tactical.battle.currentTurn?.combatantId).toBe('target')
      expect(targetTurn.tactical.battle.combatants.find((row) => row.id === 'target')?.hp).toBe(30)

      const firstTick = finishTurn(targetTurn).state
      const hpAfterFirstTick =
        firstTick.tactical.battle.combatants.find((row) => row.id === 'target')?.hp ?? 30
      expect(hpAfterFirstTick).toBeLessThan(30)
      expect(persistentRows(firstTick, kind)[0]?.remainingTicks).toBe(1)

      const secondTargetTurn = finishTurn(firstTick).state
      expect(secondTargetTurn.tactical.battle.currentTurn?.combatantId).toBe('target')
      const expired = finishTurn(secondTargetTurn).state
      expect(
        expired.tactical.battle.combatants.find((row) => row.id === 'target')?.hp,
      ).toBeLessThan(hpAfterFirstTick)
      expect(persistentRows(expired, kind)).toHaveLength(0)
    },
  )

  it.each([
    ['root', 1],
    ['slow', 2],
  ] as const)(
    '%s begins on the following target turn and lasts exactly %i turn(s)',
    (statusId, durationTurns) => {
      const applied = executeCombatAction(
        encounter(),
        action(
          {
            type: 'apply-status',
            recipient: 'primary-unit',
            statusId,
            stacks: 1,
            durationTurns,
          },
          `test.v5-status-duration-${statusId}`,
        ),
        { kind: 'unit', combatantId: 'target' },
        CONTENT,
      )
      const appliedStatus = applied.state.statusState
        .find((row) => row.combatantId === 'target')
        ?.statuses.find((status) => status.statusId === statusId)
      expect(appliedStatus?.remainingOwnerTurnStarts).toBe(durationTurns + 1)

      let state = finishTurn(applied.state).state
      for (let ownerTurn = 1; ownerTurn <= durationTurns; ownerTurn += 1) {
        const active = state.statusState
          .find((row) => row.combatantId === 'target')
          ?.statuses.find((status) => status.statusId === statusId)
        expect(state.tactical.battle.currentTurn?.combatantId).toBe('target')
        expect(active?.remainingOwnerTurnStarts).toBe(durationTurns + 1 - ownerTurn)

        state = finishTurn(state).state
        state = finishTurn(state).state
      }

      expect(
        state.statusState
          .find((row) => row.combatantId === 'target')
          ?.statuses.some((status) => status.statusId === statusId),
      ).toBe(false)
    },
  )
})
