import type { AbilityDefinition } from '@aurevane/game-core/combat/combat-definition'

/** A small, editable starting point; it is never applied to a retained power on read. */
export function newResonanceAbility(): AbilityDefinition {
  return {
    schemaVersion: 1,
    behaviors: [
      {
        id: 'main',
        activation: 'automatic',
        mode: 'action',
        classification: 'utility',
        costs: [],
        cooldown: null,
        requirements: null,
        requirementMode: 'simple',
        automaticTrigger: 'turn-started',
        automaticTarget: { subject: 'owner' },
        activationLimits: ['once-per-owner-turn'],
        targeting: {
          kind: 'self',
          teamPolicy: 'self',
          shape: { kind: 'single' },
          minimumRange: 0,
          maximumRange: 0,
          maximumElevationDifference: 0,
          requiresLineOfSight: false,
          friendlyFire: 'all-units',
          maximumSelections: 1,
        },
        effects: [
          {
            id: 'effect-1',
            payload: {
              type: 'barrier-change',
              recipient: 'actor',
              target: 'self',
              amount: 5,
              basis: 'maximum-hp-percent',
              durationTurns: 2,
            },
          },
        ],
      },
    ],
  }
}
