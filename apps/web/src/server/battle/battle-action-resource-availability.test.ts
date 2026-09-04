import { describe, expect, it } from 'vitest'

import { PV1F_MP_RECOVER_ACTION_ID } from '@aurevane/game-core/combat/pv1f-skills'
import type { StatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'

import { battleActionResourceIssue } from './battle-action-resource-availability'

function stateWithMp(mp: number, maxMp = 20): StatDrivenCombatEncounterState {
  return {
    tactical: {
      battle: {
        currentTurn: { combatantId: 'player' },
        combatants: [{ id: 'player', mp, maxMp }],
      },
    },
  } as unknown as StatDrivenCombatEncounterState
}

describe('battleActionResourceIssue', () => {
  it('rejects MP Recovery when the active combatant already has full MP', () => {
    expect(
      battleActionResourceIssue(stateWithMp(20), {
        kind: 'action',
        actionId: PV1F_MP_RECOVER_ACTION_ID,
        target: { kind: 'self' },
      }),
    ).toEqual({ code: 'actor-mp-full', message: 'MP is already full.' })
  })

  it('allows MP Recovery when the active combatant is below maximum MP', () => {
    expect(
      battleActionResourceIssue(stateWithMp(19), {
        kind: 'action',
        actionId: PV1F_MP_RECOVER_ACTION_ID,
        target: { kind: 'self' },
      }),
    ).toBeNull()
  })

  it('does not gate unrelated actions', () => {
    expect(
      battleActionResourceIssue(stateWithMp(20), {
        kind: 'action',
        actionId: 'basic.guard',
        target: { kind: 'self' },
      }),
    ).toBeNull()
  })
})
