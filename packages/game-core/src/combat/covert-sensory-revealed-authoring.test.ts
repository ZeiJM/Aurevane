import { describe, expect, it } from 'vitest'

import type { CombatActionDefinition } from './actions'
import { validateCombatActionDefinition } from './combat-authoring-validation'

function sensoryAction(
  duration = 2,
  patch: Partial<CombatActionDefinition> = {},
): CombatActionDefinition {
  return {
    id: 'test.sensory-authoring',
    version: 1,
    sourceType: 'test',
    tags: ['test'],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 3,
      requiresLineOfSight: false,
      maximumElevationDifference: 1,
      friendlyFire: 'enemies-only',
    },
    cost: { spendsAction: true, mp: 4 },
    requirements: [],
    effects: [
      {
        type: 'sensory',
        recipient: 'primary-unit',
        revealedDurationOwnerTurnStarts: duration,
      },
    ],
    ...patch,
  }
}

describe('CSR-1 authoring validation', () => {
  it('accepts a single primary-unit Sensory with a bounded Revealed duration', () => {
    expect(() => validateCombatActionDefinition(sensoryAction(1))).not.toThrow()
    expect(() => validateCombatActionDefinition(sensoryAction(4))).not.toThrow()
  })

  it.each([0, 5, -1, 1.5])('rejects invalid Sensory Revealed duration %s', (duration) => {
    expect(() => validateCombatActionDefinition(sensoryAction(duration))).toThrow(
      'Sensory Revealed duration must be an integer from 1 to 4 owner-turn starts.',
    )
  })

  it('rejects Sensory on anything except a primary-unit unit target', () => {
    const invalid = sensoryAction(2, {
      target: {
        kind: 'self',
        teamPolicy: 'self',
        shape: { kind: 'single' },
        minimumRange: 0,
        maximumRange: 0,
        requiresLineOfSight: false,
        maximumElevationDifference: null,
        friendlyFire: 'allies-only',
      },
    })

    expect(() => validateCombatActionDefinition(invalid)).toThrow(
      'Sensory requires a primary-unit effect on a unit-targeting Skill.',
    )
  })

  it('rejects multiple Sensory operations in one action', () => {
    const action = sensoryAction()
    action.effects = [...action.effects, ...action.effects]
    expect(() => validateCombatActionDefinition(action)).toThrow(
      'A combat action may contain at most one Sensory effect.',
    )
  })

  it('rejects unrestricted direct Revealed application', () => {
    const action: CombatActionDefinition = {
      ...sensoryAction(),
      id: 'test.illegal-revealed',
      effects: [
        {
          type: 'apply-status',
          recipient: 'primary-unit',
          statusId: 'revealed',
          stacks: 1,
        },
      ],
    }

    expect(() => validateCombatActionDefinition(action)).toThrow(
      'Revealed may only be applied by a successful Sensory effect.',
    )
  })
})
