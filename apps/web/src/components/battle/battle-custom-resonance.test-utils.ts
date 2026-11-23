import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { parseAbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import type { FinalizedContentImage } from '@aurevane/game-core/combat/content-media'
import {
  resolveResonanceForPair,
  type AnyResonanceDefinition,
} from '@aurevane/game-core/combat/resonance'

// Descriptor-only fixture: tests create no media files or hosted content.
export const customResonanceArtwork: FinalizedContentImage = {
  id: 'f6ba91b3-6887-4197-8cc6-22f0aa48361b',
  kind: 'image',
  checksum: 'a'.repeat(64),
  byteLength: 1024,
  contentType: 'image/png',
  width: 128,
  height: 128,
  sourceWidth: 128,
  sourceHeight: 128,
  crop: { x: 0, y: 0, size: 128 },
}

export function customAutomaticResonance(
  contentVersion = 2,
  name = 'Ultra Instinct',
): AnyResonanceDefinition {
  const guard = defaultBasicSkills().find((basic) => basic.id === 'basic.guard')!.ability
    .behaviors[0]!
  return {
    ...resolveResonanceForPair('wildwarden', 'edgedancer')!,
    id: 'resonance.fe1e7439-f541-4169-99a9-1d9ea83bdd70',
    contentVersion,
    name,
    disciplinePair: ['aetherist', 'discipline.f60c5dc7-abf2-4e03-8b10-428dee7fc4c2'],
    description: 'On taking damage below 25% HP, gain Barrier and Full Reflect.',
    flavorLine: undefined,
    presentation: undefined,
    authoring: { schemaVersion: 2, status: 'production', validationTags: [] },
    trigger: {
      kind: 'skill-trigger-v2',
      mode: 'immediate',
      setup: null,
      trigger: { sourceDisciplineId: 'aetherist', requiredTags: [] },
      resultEffects: [
        {
          type: 'barrier-change',
          recipient: 'actor',
          amount: 100,
          basis: 'maximum-hp-percent',
          durationTurns: 2,
        },
      ],
      aiSetupUtilityBonus: 0,
      aiTriggerUtilityBonus: 0,
    },
    media: { iconKey: null, audioCueKey: null, vfxKey: null, artwork: customResonanceArtwork },
    ability: parseAbilityDefinition({
      schemaVersion: 1,
      behaviors: [
        {
          ...guard,
          id: 'main',
          activation: 'automatic',
          classification: 'utility',
          requirementMode: 'simple',
          automaticTrigger: 'damage-taken',
          requirements: {
            kind: 'resource-state',
            subject: 'owner',
            resource: 'hp',
            comparison: 'less-than',
            basisPoints: 2500,
          },
          costs: [],
          cooldown: null,
          effects: [
            {
              id: 'barrier',
              payload: {
                type: 'barrier-change',
                recipient: 'actor',
                amount: 100,
                basis: 'maximum-hp-percent',
                durationTurns: 2,
              },
            },
            {
              id: 'reflect',
              payload: {
                type: 'apply-status',
                recipient: 'actor',
                statusId: 'counter',
                stacks: 1,
                counter: { kind: 'full', basisPoints: 10000 },
                durationTurns: 2,
              },
            },
          ],
        },
      ],
    }),
  }
}
