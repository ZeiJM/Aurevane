import { describe, expect, it, vi } from 'vitest'

import {
  advanceBattleRng,
  createBattleRngState,
  createPendingBattle,
  endTurn,
  selectFinalFacing,
  spendAction,
  spendMovement,
  startBattle,
  validateBattleState,
  type BattleState,
  type CreatePendingBattleInput,
} from './battle-state'

function battleInput(): CreatePendingBattleInput {
  return {
    battleId: 'battle-alpha',
    rulesVersion: 1,
    contentVersion: 3,
    rngSeed: 0x1234abcd,
    combatants: [
      {
        id: 'wayfarer',
        teamId: 'players',
        initiative: 12,
        baseMovementBudget: 4,
        hp: 164,
        maxHp: 164,
        mp: 90,
        maxMp: 90,
      },
      {
        id: 'recruit',
        teamId: 'opponents',
        initiative: 8,
        baseMovementBudget: 3,
        hp: 120,
        maxHp: 120,
        mp: 30,
        maxMp: 30,
        temporaryResources: [
          { key: 'stance', current: 1, maximum: 2 },
          { key: 'focus', current: 0, maximum: 3 },
        ],
      },
    ],
  }
}

describe('P2.1 deterministic battle state', () => {
  it('creates byte-stable equivalent pending snapshots from identical inputs', () => {
    const first = createPendingBattle(battleInput())
    const second = createPendingBattle(battleInput())

    expect(first).toEqual(second)
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    expect(first).toMatchObject({
      schemaVersion: 1,
      battleId: 'battle-alpha',
      rulesVersion: 1,
      contentVersion: 3,
      lifecycle: 'pending',
      round: 0,
      turnNumber: 0,
      currentTurn: null,
      initiativeOrder: ['wayfarer', 'recruit'],
    })
    expect(first.combatants[1].temporaryResources.map((resource) => resource.key)).toEqual([
      'focus',
      'stance',
    ])
    expect(validateBattleState(first)).toEqual([])
  })

  it('sorts initiative deterministically and uses stable combatant identity for ties', () => {
    const state = createPendingBattle({
      ...battleInput(),
      combatants: [
        { ...battleInput().combatants[0], id: 'charlie', initiative: 9 },
        { ...battleInput().combatants[1], id: 'bravo', initiative: 12 },
        {
          ...battleInput().combatants[1],
          id: 'alpha',
          teamId: 'third-team',
          initiative: 12,
        },
      ],
    })

    expect(state.initiativeOrder).toEqual(['alpha', 'bravo', 'charlie'])
  })

  it('starts a deterministic turn with Movement Budget and one ready Action', () => {
    const transition = startBattle(createPendingBattle(battleInput()))

    expect(transition.state).toMatchObject({
      lifecycle: 'active',
      round: 1,
      turnNumber: 1,
      currentTurn: {
        combatantId: 'wayfarer',
        initiativeIndex: 0,
        movementMaximum: 4,
        movementRemaining: 4,
        movementSpent: 0,
        actionState: 'ready',
        finalFacing: null,
      },
    })
    expect(transition.events).toEqual([
      {
        event: 'battle_started',
        battleId: 'battle-alpha',
        rulesVersion: 1,
        contentVersion: 3,
      },
      { event: 'round_started', round: 1 },
      { event: 'turn_started', round: 1, turnNumber: 1, combatantId: 'wayfarer' },
    ])
  })

  it('preserves split movement after the Action is spent', () => {
    let state = startBattle(createPendingBattle(battleInput())).state

    state = spendMovement(state, 2).state
    state = spendAction(state).state

    expect(state.currentTurn).toMatchObject({
      movementRemaining: 2,
      movementSpent: 2,
      actionState: 'spent',
    })

    state = spendMovement(state, 1).state
    state = selectFinalFacing(state, 'east').state

    expect(state.currentTurn).toMatchObject({
      movementMaximum: 4,
      movementRemaining: 1,
      movementSpent: 3,
      actionState: 'spent',
      finalFacing: 'east',
    })
  })

  it('rejects Movement overspend and double-spending the Action', () => {
    const state = startBattle(createPendingBattle(battleInput())).state

    expect(() => spendMovement(state, 5)).toThrow(RangeError)
    expect(() => spendMovement(state, 0)).toThrow(RangeError)

    const afterAction = spendAction(state).state
    expect(() => spendAction(afterAction)).toThrow('already been spent')
  })

  it('advances turns and rounds deterministically while refreshing the next turn economy', () => {
    let state = startBattle(createPendingBattle(battleInput())).state
    state = spendMovement(state, 3).state
    state = spendAction(state).state

    const recruitTurn = endTurn(state)
    expect(recruitTurn.state).toMatchObject({
      round: 1,
      turnNumber: 2,
      currentTurn: {
        combatantId: 'recruit',
        initiativeIndex: 1,
        movementMaximum: 3,
        movementRemaining: 3,
        movementSpent: 0,
        actionState: 'ready',
        finalFacing: null,
      },
    })
    expect(recruitTurn.events).toEqual([
      { event: 'turn_ended', round: 1, turnNumber: 1, combatantId: 'wayfarer' },
      { event: 'turn_started', round: 1, turnNumber: 2, combatantId: 'recruit' },
    ])

    const nextRound = endTurn(recruitTurn.state)
    expect(nextRound.state).toMatchObject({
      round: 2,
      turnNumber: 3,
      currentTurn: {
        combatantId: 'wayfarer',
        initiativeIndex: 0,
        movementRemaining: 4,
        actionState: 'ready',
      },
    })
    expect(nextRound.events).toEqual([
      { event: 'turn_ended', round: 1, turnNumber: 2, combatantId: 'recruit' },
      { event: 'round_started', round: 2 },
      { event: 'turn_started', round: 2, turnNumber: 3, combatantId: 'wayfarer' },
    ])
  })

  it('skips defeated combatants without changing deterministic initiative order', () => {
    const state = createPendingBattle({
      ...battleInput(),
      combatants: [
        {
          ...battleInput().combatants[0],
          id: 'fallen-first',
          initiative: 20,
          hp: 0,
        },
        { ...battleInput().combatants[0], id: 'wayfarer', initiative: 12 },
        { ...battleInput().combatants[1], id: 'recruit', initiative: 8 },
      ],
    })

    const started = startBattle(state)
    expect(started.state.initiativeOrder).toEqual(['fallen-first', 'wayfarer', 'recruit'])
    expect(started.state.currentTurn?.combatantId).toBe('wayfarer')

    const recruitTurn = endTurn(started.state).state
    const nextRound = endTurn(recruitTurn).state
    expect(nextRound.round).toBe(2)
    expect(nextRound.currentTurn?.combatantId).toBe('wayfarer')
  })

  it('uses explicit deterministic RNG state without Math.random authority', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be used by deterministic battle rules.')
    })

    try {
      const firstInitial = createBattleRngState(0x1234abcd)
      const secondInitial = createBattleRngState(0x1234abcd)
      const firstDraw = advanceBattleRng(firstInitial)
      const secondDraw = advanceBattleRng(secondInitial)
      const firstSecondDraw = advanceBattleRng(firstDraw.state)
      const secondSecondDraw = advanceBattleRng(secondDraw.state)

      expect(firstDraw).toEqual(secondDraw)
      expect(firstSecondDraw).toEqual(secondSecondDraw)
      expect(firstDraw.value).not.toBe(firstSecondDraw.value)
      expect(firstSecondDraw.state.draws).toBe(2)
      expect(randomSpy).not.toHaveBeenCalled()
    } finally {
      randomSpy.mockRestore()
    }
  })

  it('fails closed on malformed identities, resources, RNG and active-turn invariants', () => {
    expect(() => createPendingBattle({ ...battleInput(), battleId: ' battle ' })).toThrow(TypeError)
    expect(() => createBattleRngState(0)).toThrow(RangeError)
    expect(() =>
      createPendingBattle({
        ...battleInput(),
        combatants: [battleInput().combatants[0], battleInput().combatants[0]],
      }),
    ).toThrow('Combatant IDs must be unique')

    expect(() =>
      createPendingBattle({
        ...battleInput(),
        combatants: [
          { ...battleInput().combatants[0], hp: 165 },
          battleInput().combatants[1],
        ],
      }),
    ).toThrow('Current resource cannot exceed')

    const active = startBattle(createPendingBattle(battleInput())).state
    const malformed: BattleState = {
      ...active,
      currentTurn: active.currentTurn
        ? { ...active.currentTurn, movementRemaining: active.currentTurn.movementRemaining + 1 }
        : null,
    }

    expect(validateBattleState(malformed)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'currentTurn.movementRemaining',
          message: expect.stringContaining('Remaining plus spent movement'),
        }),
      ]),
    )
    expect(() => spendAction(malformed)).toThrow('Invalid battle state')
  })

  it('requires at least two active teams before battle start', () => {
    const state = createPendingBattle({
      ...battleInput(),
      combatants: [
        battleInput().combatants[0],
        { ...battleInput().combatants[1], teamId: 'players' },
      ],
    })

    expect(() => startBattle(state)).toThrow('at least two active teams')
  })
})
