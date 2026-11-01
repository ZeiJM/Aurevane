import { combatStatusDetails } from '@aurevane/game-core/combat/status-content'
import type { BattleLogEntry } from '@/server/battle/battle-log-service'

/** Mechanical prose uses only sanitized committed application values, never current definitions. */
export function narrateBattleEffect(
  entry: BattleLogEntry,
  target: string,
  pending = false,
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
  const reduce = (subject: string, property: string, rate: number | undefined) =>
    `${subject} ${verb('reduces', 'reduce')} ${target}'s ${property}${rate === undefined ? '' : rate >= 100 ? ` to 0 (${rate}% reduction)` : ` by ${rate}%`}`
  switch (id) {
    case 'suppress':
      return reduce(label, 'outgoing direct damage', percent)
    case 'blind':
      return `${label} ${verb('reduces', 'reduce')} ${target}'s Accuracy${percent === undefined ? '' : ` by ${percent} percentage points${percent >= 100 ? ', to a minimum of 0%' : ''}`}`
    case 'mark':
      return `${label} ${verb('increases', 'increase')} its source's Accuracy against ${target}${percent === undefined ? '' : ` by ${percent} percentage points`}`
    case 'inspired':
      return `${label} ${verb('increases', 'increase')} ${target}'s outgoing damage${percent === undefined ? '' : ` by ${percent}%`}`
    case 'guarded':
      return reduce(label, 'incoming damage', percent)
    case 'hexed':
      return reduce(label, 'HP and MP recovery', percent)
    case 'lowered-guard':
      return strength?.damageTakenMultiplierBasisPoints === undefined
        ? null
        : `${label} ${verb('makes', 'make')} ${target} take ${strength.damageTakenMultiplierBasisPoints / 100}% of normal incoming damage`
    case 'exposed':
    case 'marked':
      return `${label} ${verb('increases', 'increase')} damage taken by ${target}${percent === undefined ? '' : ` by ${percent}%`}${id === 'marked' ? ' from its source' : ''}`
    case 'conductive':
      return `${label} ${verb('increases', 'increase')} Storm damage taken by ${target}${percent === undefined ? '' : ` by ${percent}%`}`
    case 'wet': {
      const initiative = strength?.initiativeReductionBasisPoints
      return initiative === undefined
        ? `${label} ${verb('increases', 'increase')} Storm damage taken by ${target}${percent === undefined ? '' : ` by ${percent}%`}`
        : `${reduce(label, 'Initiative', initiative / 100)} and ${verb('increases', 'increase')} Storm damage taken${percent === undefined ? '' : ` by ${percent}%`}`
    }
    case 'haste':
    case 'slow':
      return `${label} ${verb(id === 'haste' ? 'reduces' : 'increases', id === 'haste' ? 'reduce' : 'increase')} ${target}'s movement cost${strength?.movementApAdjustment === undefined ? '' : ` by ${strength.movementApAdjustment} AP`} per entered tile`
    case 'root':
      return `${label} ${verb('prevents', 'prevent')} ${target} from moving`
    case 'frozen':
      return `${label} ${verb('prevents', 'prevent')} ${target} from changing final facing`
    case 'invisible':
      return `${target} ${verb('becomes', 'become')} Invisible`
    case 'covert':
      return `${label} ${verb('conceals', 'conceal')} ${target}'s beneficial effects`
    case 'airborne':
      return `${target} ${verb('becomes', 'become')} Airborne`
    case 'burn':
      return `${target} ${verb('begins burning', 'begin burning')}`
    case 'poison':
      return `Poison ${verb('takes hold', 'take hold')} on ${target}`
    case 'bleed':
      return `${target} ${verb('begins bleeding', 'begin bleeding')}`
    case 'warded':
      return `${label} ${verb('reduces', 'reduce')} damage taken by ${target} from burning opponents${percent === undefined ? '' : ` by ${percent}%${percent >= 100 ? ', to a minimum of 0' : ''}`}`
    case 'challenged':
      return `${label} ${verb('reduces', 'reduce')} ${target}'s damage against anyone except its source${percent === undefined ? '' : ` by ${percent}%${percent >= 100 ? ', to a minimum of 0' : ''}`}`
    case 'reckless':
      return `${label} ${verb('increases', 'increase')} ${target}'s damage dealt and taken${percent === undefined ? '' : ` by ${percent}%`}`
    case 'fortified':
      return strength?.defenseIncreaseBasisPoints !== undefined
        ? `${label} ${verb('increases', 'increase')} ${target}'s Physical and Mystic Defense by ${strength.defenseIncreaseBasisPoints / 100}% and ${verb('reduces', 'reduce')} outgoing damage by the same percentage${strength.defenseIncreaseBasisPoints >= 10000 ? ', to a minimum of 0' : ''}`
        : `${label} ${verb('strengthens', 'strengthen')} ${target}'s defenses and ${verb('reduces', 'reduce')} outgoing damage${percent === undefined ? '' : ` by ${percent}%${percent >= 100 ? ', to a minimum of 0' : ''}`}`
    case 'revealed':
      return `${target} ${verb('is', 'be')} Revealed${strength?.increasedDamageTakenBasisPoints === undefined ? '' : ` and ${verb('takes', 'take')} ${strength.increasedDamageTakenBasisPoints / 100}% more damage`}`
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
      return `${name} ${verb('returns', 'return')} ${counter ? `${counter.basisPoints / 100}% of ${family} HP damage received by ${target}` : `matching HP damage received by ${target} to its source`}`
    }
    case 'blindside':
    case 'blindside-vulnerability': {
      const profile = strength?.blindsideModifiersBasisPoints
      return `${label} ${verb('increases', 'increase')} ${id === 'blindside' ? `Skill damage dealt by ${target}` : `Skill damage taken by ${target}`} from the side and rear${profile ? ` to ${profile.side / 100}% and ${profile.rear / 100}% of normal, respectively` : ''}`
    }
    case 'endure':
      return `${label} ${verb('prevents', 'prevent')} ${target} from using damage-dealing actions${strength?.endureReleaseBasisPoints === undefined ? ' while storing received HP damage' : ` and ${verb('releases', 'release')} ${strength.endureReleaseBasisPoints / 100}% of stored HP damage on natural expiry`}`
    default:
      return null
  }
}
