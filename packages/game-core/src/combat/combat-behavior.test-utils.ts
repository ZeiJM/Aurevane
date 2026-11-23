import type { CapturedCombatAbilitySource } from './combat-behavior-capture'
import type { AbilityBehavior } from './combat-definition'

export function source(
  behavior: Partial<AbilityBehavior> = {},
  id = 'source-a',
): CapturedCombatAbilitySource {
  return {
    schemaVersion: 1,
    sourceInstanceId: id,
    ownerCombatantId: 'actor',
    abilityId: 'test.ability',
    contentVersion: 1,
    sourceKind: 'discipline-skill',
    sourceDisciplineId: 'vanguard',
    tags: ['attack'],
    definition: {
      schemaVersion: 1,
      behaviors: [
        {
          id: 'strike',
          activation: 'manual',
          mode: 'action',
          classification: 'attack',
          attackFamily: 'physical',
          costs: [
            { resource: 'ap', amount: 11 },
            { resource: 'mp', amount: 2 },
            { resource: 'hp', amount: 1 },
          ],
          cooldown: null,
          requirements: null,
          targeting: {
            kind: 'unit',
            teamPolicy: 'enemy',
            friendlyFire: 'enemies-only',
            shape: { kind: 'single' },
            minimumRange: 1,
            maximumRange: 4,
            requiresLineOfSight: false,
            maximumElevationDifference: null,
            maximumSelections: 1,
          },
          effects: [
            { id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 10 } },
          ],
          ...behavior,
        },
      ],
    },
  }
}
