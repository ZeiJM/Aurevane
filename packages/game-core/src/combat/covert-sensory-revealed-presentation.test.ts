import { describe, expect, it } from 'vitest'

import { combatActionPresentationTags } from './gameplay-tags'
import type { CombatActionDefinition } from './actions'

describe('CSR-1 Sensory presentation metadata', () => {
  it('derives the Sensory tag from the typed effect', () => {
    const action: CombatActionDefinition = {
      id: 'test.sensory-tag',
      version: 1,
      sourceType: 'test',
      tags: ['test'],
      target: {
        kind: 'unit',
        teamPolicy: 'enemy',
        shape: { kind: 'single' },
        minimumRange: 1,
        maximumRange: 3,
        requiresLineOfSight: true,
        maximumElevationDifference: 2,
        friendlyFire: 'enemies-only',
      },
      cost: { spendsAction: true, mp: 0 },
      requirements: [],
      effects: [
        {
          type: 'sensory',
          recipient: 'primary-unit',
          revealedDurationOwnerTurnStarts: 2,
        },
      ],
    }

    expect(combatActionPresentationTags(action)).toEqual(['Enemy', 'Single', 'Sensory'])
  })
})
