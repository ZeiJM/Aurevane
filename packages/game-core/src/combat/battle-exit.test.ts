import { describe, expect, it } from 'vitest'

import { abortPracticeBattle } from './battle-exit'
import { createPendingBattle, startBattle } from './battle-state'

function createActiveBattle() {
  return startBattle(
    createPendingBattle({
      battleId: 'battle:test-abort',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 1234,
      combatants: [
        {
          id: 'player',
          teamId: 'players',
          initiative: 10,
          baseMovementBudget: 4,
          hp: 100,
          maxHp: 100,
          mp: 20,
          maxMp: 20,
        },
        {
          id: 'recruit',
          teamId: 'opponents',
          initiative: 5,
          baseMovementBudget: 3,
          hp: 80,
          maxHp: 80,
          mp: 10,
          maxMp: 10,
        },
      ],
    }),
  ).state
}

describe('practice battle abort', () => {
  it('terminates an active practice battle without changing combat resources', () => {
    const active = createActiveBattle()
    const transition = abortPracticeBattle(active)

    expect(transition.state.lifecycle).toBe('abandoned')
    expect(transition.state.currentTurn).toBeNull()
    expect(transition.state.combatants).toEqual(active.combatants)
    expect(transition.state.round).toBe(active.round)
    expect(transition.state.turnNumber).toBe(active.turnNumber)
    expect(transition.events).toEqual([
      {
        event: 'battle_abandoned',
        outcome: 'aborted',
        reason: 'practice-aborted',
      },
    ])
  })

  it('cannot turn an already terminal battle into another abort', () => {
    const abandoned = abortPracticeBattle(createActiveBattle()).state
    expect(() => abortPracticeBattle(abandoned)).toThrow(
      'Only a pending or active practice battle can be aborted.',
    )
  })
})
