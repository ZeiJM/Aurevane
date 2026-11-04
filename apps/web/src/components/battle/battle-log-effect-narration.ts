import { damageUpTypeSummary } from '@aurevane/game-core/combat/combat-damage-up'
import { sealCategorySummary } from '@aurevane/game-core/combat/combat-seal'
import { combatStatusDetails } from '@aurevane/game-core/combat/status-content'
import type { BattleLogEntry } from '@/server/battle/battle-log-service'

/** Mechanical prose uses only sanitized committed application values, never current definitions. */
export function narrateBattleEffect(
  entry: BattleLogEntry,
  target: string,
  pending = false,
  duration?: string,
): string | null {
  const id = entry.statusId ?? entry.templateValues.statusId
  if (!id || !entry.targetCombatantId) return null
  const strength = entry.effectStrength
  const potency =
    id === 'suppress'
      ? (entry.potencyBasisPoints ?? strength?.potencyBasisPoints)
      : strength?.potencyBasisPoints
  const percent = potency === undefined ? undefined : potency / 100
  const label = combatStatusDetails(id).name
  const verb = (present: string, future: string) => (pending ? `will ${future}` : present)
  const andVerb = (present: string, future: string) => (pending ? future : present)
  const byPercent = (rate: number | undefined) => (rate === undefined ? '' : ` by ${rate}%`)
  const reduce = (subject: string, property: string, rate: number | undefined) =>
    `${subject} ${verb('cuts', 'cut')} ${target}'s ${property}${byPercent(rate)}`
  switch (id) {
    case 'suppress':
      return reduce(label, 'direct damage', percent)
    case 'seal':
      return `${label} ${verb('blocks', 'block')} ${target}'s ${strength?.sealedCategories ? sealCategorySummary(strength.sealedCategories) : 'selected'} discipline skills`
    case 'blind':
      return `${label} ${verb('cuts', 'cut')} ${target}'s Accuracy${percent === undefined ? '' : ` by ${percent} percentage points`}`
    case 'mark':
      return `${label} ${verb('boosts', 'boost')} its source's Accuracy against ${target}${percent === undefined ? '' : ` by ${percent} percentage points`}`
    case 'inspired':
      return `${label} ${verb('boosts', 'boost')} ${target}'s ${strength?.damageTypes ? `${damageUpTypeSummary(strength.damageTypes)} ` : ''}damage${byPercent(percent)}`
    case 'guarded':
      return reduce(label, 'damage taken', percent)
    case 'hexed':
      return reduce(label, 'HP and MP recovery', percent)
    case 'lowered-guard':
      return strength?.damageTakenMultiplierBasisPoints === undefined
        ? null
        : `${label} ${verb('makes', 'make')} ${target} take ${strength.damageTakenMultiplierBasisPoints / 100}% of normal damage`
    case 'exposed':
    case 'marked':
      return `${label} ${verb('boosts', 'boost')} ${target}'s damage taken${id === 'marked' ? ' from its source' : ''}${byPercent(percent)}`
    case 'conductive':
      return `${label} ${verb('boosts', 'boost')} ${target}'s Storm damage taken${byPercent(percent)}`
    case 'wet': {
      const initiative = strength?.initiativeReductionBasisPoints
      return initiative === undefined
        ? `${label} ${verb('boosts', 'boost')} ${target}'s Storm damage taken${byPercent(percent)}`
        : `${reduce(label, 'Initiative', initiative / 100)} and ${andVerb('boosts', 'boost')} Storm damage taken${byPercent(percent)}`
    }
    case 'haste':
    case 'slow':
      return `${label} ${verb(id === 'haste' ? 'cuts' : 'raises', id === 'haste' ? 'cut' : 'raise')} ${target}'s movement cost${strength?.movementApAdjustment === undefined ? '' : ` by ${strength.movementApAdjustment} AP`} per tile`
    case 'root':
      return `${label} ${verb('locks', 'lock')} ${target}'s movement`
    case 'frozen':
      return `${label} ${verb('locks', 'lock')} ${target}'s final facing`
    case 'invisible':
      return `${target} ${verb('becomes', 'become')} Invisible`
    case 'covert':
      return `${label} ${verb('hides', 'hide')} ${target}'s beneficial effects`
    case 'airborne':
      return `${target} ${verb('becomes', 'become')} Airborne`
    case 'burn':
      return `${target} ${verb('starts burning', 'start burning')}`
    case 'poison':
      return `${target} ${verb('is poisoned', 'be poisoned')}`
    case 'bleed':
      return `${target} ${verb('starts bleeding', 'start bleeding')}`
    case 'warded':
      return `${label} ${verb('cuts', 'cut')} ${target}'s damage taken from burning opponents${byPercent(percent)}`
    case 'challenged':
      return `${label} ${verb('cuts', 'cut')} ${target}'s damage against anyone except its source${byPercent(percent)}`
    case 'reckless':
      return `${label} ${verb('boosts', 'boost')} ${target}'s damage dealt and taken${byPercent(percent)}`
    case 'fortified':
      return strength?.defenseIncreaseBasisPoints !== undefined
        ? `${label} ${verb('boosts', 'boost')} ${target}'s Physical and Mystic Defense by ${strength.defenseIncreaseBasisPoints / 100}% and ${andVerb('cuts', 'cut')} damage dealt by ${strength.defenseIncreaseBasisPoints / 100}%`
        : `${label} ${verb('boosts', 'boost')} ${target}'s defenses and ${andVerb('cuts', 'cut')} damage dealt${byPercent(percent)}`
    case 'revealed':
      return `${target} ${verb('is', 'be')} Revealed${strength?.increasedDamageTakenBasisPoints === undefined ? '' : ` and ${andVerb('takes', 'take')} ${strength.increasedDamageTakenBasisPoints / 100}% more damage`}`
    case 'counter': {
      const counter = strength?.counter
      const family =
        counter?.kind === 'physical' ? 'Physical' : counter?.kind === 'mystic' ? 'Mystic' : 'all'
      const name =
        counter?.kind === 'physical'
          ? 'Physical Reflect'
          : counter?.kind === 'mystic'
            ? 'Magical Reflect'
            : counter
              ? 'Full Reflect'
              : 'Reflect'
      const basis =
        strength?.reflectBarrierPolicyVersion === 1 ? 'HP and Barrier damage' : 'HP damage'
      return `${name} ${verb('returns', 'return')} ${counter ? `${counter.basisPoints / 100}% of ${family} ${basis} taken by ${target}` : `matching ${basis} taken by ${target} to its source`}`
    }
    case 'blindside':
    case 'blindside-vulnerability': {
      const profile = strength?.blindsideModifiersBasisPoints
      return `${label} ${verb('boosts', 'boost')} ${target}'s side/rear Skill damage ${id === 'blindside' ? 'dealt' : 'taken'}${profile ? ` to ${profile.side / 100}%/${profile.rear / 100}% of normal` : ''}`
    }
    case 'endure':
      return `${label} ${verb('locks', 'lock')} ${target}'s attacks and ${andVerb('stores', 'store')} received damage for ${strength?.endureReleaseBasisPoints === undefined ? 'a burst' : `${String(strength.endureReleaseBasisPoints / 100).startsWith('8') ? 'an' : 'a'} ${strength.endureReleaseBasisPoints / 100}% burst`}${duration ? ` after ${duration}` : ' when it expires'}`
    default:
      return null
  }
}
