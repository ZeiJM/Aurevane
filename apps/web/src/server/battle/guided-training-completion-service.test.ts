import type { BattleEventRecord } from '@aurevane/db/battle-session'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  readGuidedTrainingCompletionDisposition,
  readGuidedTrainingProgress,
} from './guided-training-completion-service'

const CONTROLLED_COMBATANT_ID = 'character:player'
const CREATED_AT = '2026-08-25T16:00:00.000Z'

function record(battleVersion: number, eventIndex: number, event: unknown): BattleEventRecord {
  return {
    battleVersion,
    eventIndex,
    event,
    createdAt: CREATED_AT,
  }
}

describe('guided training completion disposition', () => {
  it('treats player defeat as a loss even when the battle is already completed', () => {
    const events = [
      record(2, 0, {
        event: 'guided_training_completed',
        combatantId: CONTROLLED_COMBATANT_ID,
        criteria: ['move', 'attack', 'guard', 'facing'],
      }),
      record(2, 1, { event: 'battle_completed', winningTeamId: 'recruits' }),
    ]

    expect(() =>
      readGuidedTrainingCompletionDisposition(
        {
          lifecycle: 'completed',
          combatants: [{ id: CONTROLLED_COMBATANT_ID, hp: 0 }],
        },
        events,
        CONTROLLED_COMBATANT_ID,
      ),
    ).toThrowError('Guided training is lost when your combatant is defeated.')
  })

  it('does not reinterpret an unrelated completed battle as a training victory', () => {
    expect(() =>
      readGuidedTrainingCompletionDisposition(
        {
          lifecycle: 'completed',
          combatants: [{ id: CONTROLLED_COMBATANT_ID, hp: 12 }],
        },
        [record(7, 0, { event: 'battle_completed', winningTeamId: 'recruits' })],
        CONTROLLED_COMBATANT_ID,
      ),
    ).toThrowError('That guided exercise ended without a training victory.')
  })

  it('still recognizes a legitimate prior guided-training completion as a replay', () => {
    expect(
      readGuidedTrainingCompletionDisposition(
        {
          lifecycle: 'completed',
          combatants: [{ id: CONTROLLED_COMBATANT_ID, hp: 12 }],
        },
        [
          record(7, 0, {
            event: 'guided_training_completed',
            combatantId: CONTROLLED_COMBATANT_ID,
            criteria: ['move', 'attack', 'guard', 'facing'],
          }),
        ],
        CONTROLLED_COMBATANT_ID,
      ),
    ).toBe('replayed')
  })
})

describe('guided training completion progress', () => {
  it('does not count timer-expiry facing as intentional facing', () => {
    const progress = readGuidedTrainingProgress(
      [
        record(7, 0, {
          event: 'ai_turn_timed_out',
          combatantId: CONTROLLED_COMBATANT_ID,
          consecutiveMisses: 1,
        }),
        record(7, 1, {
          event: 'final_facing_selected',
          combatantId: CONTROLLED_COMBATANT_ID,
          facing: 'east',
        }),
        record(7, 2, {
          event: 'combatant_facing_changed',
          combatantId: CONTROLLED_COMBATANT_ID,
          facing: 'east',
        }),
      ],
      CONTROLLED_COMBATANT_ID,
    )

    expect(progress.facing).toBe(false)
  })

  it('still counts an explicitly committed final facing', () => {
    const progress = readGuidedTrainingProgress(
      [
        record(8, 0, {
          event: 'final_facing_selected',
          combatantId: CONTROLLED_COMBATANT_ID,
          facing: 'north',
        }),
        record(8, 1, {
          event: 'combatant_facing_changed',
          combatantId: CONTROLLED_COMBATANT_ID,
          facing: 'north',
        }),
      ],
      CONTROLLED_COMBATANT_ID,
    )

    expect(progress.facing).toBe(true)
  })

  it('cannot complete all fundamentals when the only facing came from a timeout', () => {
    const progress = readGuidedTrainingProgress(
      [
        record(2, 0, {
          event: 'combatant_moved',
          combatantId: CONTROLLED_COMBATANT_ID,
          from: { x: 0, y: 0 },
          to: { x: 1, y: 0 },
          movementCost: 1,
        }),
        record(3, 0, {
          event: 'combat_action_used',
          actorId: CONTROLLED_COMBATANT_ID,
          actionId: 'basic.attack.unarmed.basic',
        }),
        record(4, 0, {
          event: 'combat_action_used',
          actorId: CONTROLLED_COMBATANT_ID,
          actionId: 'basic.guard',
        }),
        record(5, 0, {
          event: 'ai_turn_timed_out',
          combatantId: CONTROLLED_COMBATANT_ID,
          consecutiveMisses: 1,
        }),
        record(5, 1, {
          event: 'final_facing_selected',
          combatantId: CONTROLLED_COMBATANT_ID,
          facing: 'west',
        }),
        record(5, 2, {
          event: 'combatant_facing_changed',
          combatantId: CONTROLLED_COMBATANT_ID,
          facing: 'west',
        }),
      ],
      CONTROLLED_COMBATANT_ID,
    )

    expect(progress).toEqual({
      move: true,
      attack: true,
      guard: true,
      facing: false,
    })
  })
})
