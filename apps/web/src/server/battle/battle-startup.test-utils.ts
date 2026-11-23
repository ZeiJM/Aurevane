import { resolveEssenceForBuild, type EssenceDefinition } from '@aurevane/game-core/combat/essence'

/** Published fixture with an observable, once-only MP payment at battle startup. */
export function startupEssence(): EssenceDefinition {
  const original = structuredClone(resolveEssenceForBuild('vanguard', null)!)
  return {
    ...original,
    contentVersion: 77,
    skill: { ...original.skill, contentVersion: 77 },
    ability: {
      schemaVersion: 1,
      behaviors: [
        {
          id: 'start',
          activation: 'automatic',
          mode: 'action',
          classification: 'recovery',
          costs: [{ resource: 'mp', amount: 1 }],
          cooldown: null,
          requirements: { kind: 'event', eventType: 'battle_started', phase: 'after' },
          automaticTarget: { subject: 'owner' },
          targeting: {
            kind: 'self',
            teamPolicy: 'self',
            friendlyFire: 'allies-only',
            shape: { kind: 'single' },
            minimumRange: 0,
            maximumRange: 0,
            requiresLineOfSight: false,
            maximumElevationDifference: null,
            maximumSelections: 1,
          },
          effects: [{ id: 'heal', payload: { type: 'healing', recipient: 'actor', amount: 1 } }],
        },
      ],
    },
  }
}
