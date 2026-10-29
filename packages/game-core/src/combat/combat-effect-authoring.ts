export {
  AUTHORABLE_EFFECT_TAGS,
  combatEffectIdentity as effectAuthoringTag,
  type AuthorableEffectTag,
} from './combat-effect-identities'
import { AUTHORABLE_EFFECT_TAGS } from './combat-effect-identities'
import type { AbilityActivation, AbilityMode } from './combat-definition'
import { validateCombatTagPayload, type CombatTagPayload } from './combat-tag-registry'
import { isBlindsideStatusId } from './combat-blindside'
import { CLEANSE_STATUS_IDS } from './combat-cleanse'
import type { SummonProfileDefinition } from './summon-content'

export const DEFAULT_DISPEL_STATUS_IDS = [
  'guarded',
  'inspired',
  'haste',
  'invisible',
  'airborne',
  'warded',
  'covert',
  'blindside',
] as const
export interface EffectAuthoringContext {
  readonly summonProfile?: SummonProfileDefinition
}
export function createAuthorableEffectPayload(
  id: string,
  context: EffectAuthoringContext = {},
): CombatTagPayload | null {
  const tag = AUTHORABLE_EFFECT_TAGS.find((tag) => tag.id === id)
  if (!tag || tag.unavailableReason) return null
  if (tag.opcode === 'apply-status')
    return {
      type: 'apply-status',
      recipient: tag.statusId === 'blindside' ? 'actor' : 'primary-unit',
      statusId: tag.statusId!,
      stacks: 1,
      durationTurns: isBlindsideStatusId(tag.statusId!) ? 1 : 2,
    }
  switch (id) {
    case 'damage':
      return { type: 'damage', recipient: 'primary-unit', amount: 1 }
    case 'pierce':
      return { type: 'pierce', recipient: 'primary-unit', amount: 1, armorIgnoredBasisPoints: 2500 }
    case 'vengeance':
      return {
        type: 'damage',
        recipient: 'primary-unit',
        amount: 0,
        vengeance: { conversionBasisPoints: 10000, maximumDamage: 20 },
      }
    case 'hp-recovery':
    case 'mp-recovery':
      return {
        type: 'percentage-recovery',
        recipient: 'actor',
        resource: id === 'mp-recovery' ? 'mp' : 'hp',
        percentageBasisPoints: 1000,
        ticks: 1,
      }
    case 'healing':
      return { type: 'healing', recipient: 'actor', amount: 1, ticks: 1 }
    case 'mp-restore':
    case 'mp-drain':
      return {
        type: 'resource-change',
        recipient: id === 'mp-drain' ? 'primary-unit' : 'actor',
        resource: 'mp',
        delta: id === 'mp-drain' ? -1 : 1,
        ticks: 1,
      }
    case 'barrier':
      return {
        type: 'barrier-change',
        recipient: 'actor',
        basis: 'maximum-hp-percent',
        amount: 5,
        durationTurns: 2,
      }
    case 'burn':
      return {
        type: 'burn',
        recipient: 'primary-unit',
        durationTurns: 3,
        damageProfile: {
          kind: 'attack-percentage',
          basisPoints: 2500,
          decayBasisPointsPerTick: 500,
        },
      }
    case 'poison':
      return {
        type: 'poison',
        recipient: 'primary-unit',
        durationTurns: 4,
        damageProfile: { kind: 'attack-percentage', basisPoints: 1500 },
      }
    case 'bleed':
      return {
        type: 'bleed',
        recipient: 'primary-unit',
        ticks: 3,
        durationTurns: 3,
        damageProfile: { kind: 'attack-percentage', basisPoints: 2000 },
      }
    case 'copy-buffs':
    case 'copy-debuffs':
      return {
        type: 'copy-statuses',
        recipient: 'primary-unit',
        mode: id === 'copy-buffs' ? 'amplify' : 'curse',
      }
    case 'cleanse':
      return {
        type: 'remove-status',
        recipient: 'primary-unit',
        statusIds: [...CLEANSE_STATUS_IDS],
      }
    case 'dispel':
      return {
        type: 'remove-status',
        recipient: 'primary-unit',
        statusIds: [...DEFAULT_DISPEL_STATUS_IDS],
        removalMode: 'specified',
      }
    case 'conditional-cleanse':
      return {
        type: 'remove-status',
        recipient: 'primary-unit',
        statusIds: ['burn'],
        removalMode: 'specified',
      }
    case 'cleanse-chilled':
      return { type: 'remove-status', recipient: 'actor', statusIds: ['frozen'] }
    case 'reveal':
      return { type: 'sensory', recipient: 'primary-unit', revealedDurationOwnerTurnStarts: 2 }
    case 'rewind':
      return { type: 'return-to-turn-start', recipient: 'actor', anchorMode: 'cast-position' }
    case 'freeze-ground':
      return { type: 'create-terrain', recipient: 'affected-tiles', terrain: 'frozen' }
    case 'push':
    case 'pull':
      return { type: 'displace', recipient: 'primary-unit', direction: id, distance: 1 }
    case 'move':
      return { type: 'move', recipient: 'actor', maximumTiles: 1 }
    case 'damage-bonus':
      return { type: 'damage-bonus', recipient: 'actor', multiplierBasisPoints: 11250 }
    case 'summon':
      return context.summonProfile
        ? {
            type: 'summon',
            recipient: 'selected-tile',
            profile: structuredClone(context.summonProfile),
          }
        : null
  }
  return null
}
export function effectAuthoringIssue(
  id: string,
  combination: { activation: AbilityActivation; mode: AbilityMode },
  context: EffectAuthoringContext = {},
): string | null {
  const unavailable = AUTHORABLE_EFFECT_TAGS.find((tag) => tag.id === id)?.unavailableReason
  if (unavailable) return unavailable
  const payload = createAuthorableEffectPayload(id, context)
  if (!payload)
    return id === 'summon'
      ? 'Choose a supported Summon profile before adding this tag.'
      : 'This tag is unavailable.'
  return validateCombatTagPayload(payload, combination)[0]?.message ?? null
}
