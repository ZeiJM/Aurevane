import type { CombatEffectDefinition, CombatStatusEffectTuning } from './actions'
import type { MatureSkillDefinition } from './mature-skills'
import type { ResonanceDefinition } from './resonance'

export type CombatBalanceTier = 'discipline' | 'essence'

const clamp = (minimum: number, maximum: number, value: number) =>
  Math.max(minimum, Math.min(maximum, value))

const roundToFive = (value: number) => Math.round(value / 5) * 5

export function combatPowerForAp(apCost: number, tier: CombatBalanceTier = 'discipline'): number {
  const premium = tier === 'essence' ? 2 : 0
  return clamp(1, 20, Math.round(apCost / 4) + premium)
}

export function balancedApCost(apCost: number, tier: CombatBalanceTier): number {
  const rounded = roundToFive(apCost)
  return tier === 'essence' ? clamp(55, 75, rounded) : clamp(25, 65, rounded)
}

function areaFactor(definition: MatureSkillDefinition): number {
  if (definition.target.shape.kind === 'circle') return 0.78
  if (definition.target.shape.kind === 'line') return 0.85
  return definition.effects.some(
    (effect) => 'recipient' in effect && effect.recipient === 'affected-units',
  )
    ? 0.82
    : 1
}

function requirementBonus(definition: MatureSkillDefinition): number {
  return definition.requirements.length > 0 ? 2 : 0
}

function extraEffectTax(definition: MatureSkillDefinition): number {
  if (!definition.tags.includes('attack')) return 0
  const nonDamage = definition.effects.filter((effect) => effect.type !== 'damage').length
  return Math.min(5, nonDamage * 2)
}

export function balancedCooldownOwnerTurns(
  definition: MatureSkillDefinition,
  tier: CombatBalanceTier = 'discipline',
): 1 | 2 | 3 {
  const apCost = balancedApCost(definition.apCost, tier)
  const basePower = combatPowerForAp(apCost, tier)
  const effectComplexity = Math.min(4, Math.max(0, definition.effects.length - 1))
  const areaComplexity = definition.target.shape.kind === 'single' ? 0 : 2
  const score = basePower + effectComplexity + areaComplexity
  if (score <= 9) return 1
  if (score <= 15) return 2
  return 3
}

function percentageFromPower(power: number, multiplier = 1): number {
  return clamp(5, 35, Math.round(power * multiplier))
}

export function statusTuningForPower(
  statusId: string,
  power: number,
): CombatStatusEffectTuning | undefined {
  const percent = percentageFromPower(power, 1.15)
  switch (statusId) {
    case 'guarded':
    case 'summoned':
    case 'warded':
      return { incomingDamageModifierBasisPoints: -percent * 100 }
    case 'exposed':
    case 'marked':
      return { incomingDamageModifierBasisPoints: percent * 100 }
    case 'inspired':
      return { outgoingDamageModifierBasisPoints: percent * 100 }
    case 'hexed':
      return {
        healingReceivedModifierBasisPoints: -percentageFromPower(power, 1.45) * 100,
      }
    case 'mark':
      return { accuracyModifierBasisPoints: clamp(500, 2_500, power * 100) }
    case 'reckless':
      return {
        outgoingDamageModifierBasisPoints: percentageFromPower(power, 1.8) * 100,
        incomingDamageModifierBasisPoints: percentageFromPower(power, 1.05) * 100,
      }
    case 'fortified':
      return {
        incomingDamageModifierBasisPoints: -percentageFromPower(power, 1.55) * 100,
        outgoingDamageModifierBasisPoints: -percentageFromPower(power, 0.85) * 100,
      }
    case 'challenged':
      return {
        outgoingDamageModifierBasisPoints: -percentageFromPower(power, 1.35) * 100,
      }
    default:
      return undefined
  }
}

function balancedEffectPower(
  definition: MatureSkillDefinition,
  tier: CombatBalanceTier,
): number {
  const apCost = balancedApCost(definition.apCost, tier)
  const base =
    combatPowerForAp(apCost, tier) +
    requirementBonus(definition) -
    extraEffectTax(definition) -
    (definition.target.maximumRange >= 5 ? 1 : 0)
  return clamp(1, 20, Math.round(base * areaFactor(definition)))
}

function balancedEffects(
  definition: MatureSkillDefinition,
  tier: CombatBalanceTier,
): readonly CombatEffectDefinition[] {
  const attack = definition.tags.includes('attack')
  const power = balancedEffectPower(definition, tier)
  const damageEffects = definition.effects.filter((effect) => effect.type === 'damage')
  const damageShare =
    damageEffects.length === 0 ? 0 : Math.max(1, Math.round(power / damageEffects.length))

  return definition.effects.map((effect) => {
    switch (effect.type) {
      case 'damage':
        if ('vengeance' in effect && effect.vengeance !== undefined) return effect
        return { ...effect, amount: clamp(1, 20, damageShare) }
      case 'healing': {
        const recoveryPower = attack ? Math.round(power * 0.55) : power
        return { ...effect, amount: clamp(1, 20, recoveryPower) }
      }
      case 'barrier-change': {
        const barrierPower = attack ? Math.round(power * 0.55) : power
        return {
          ...effect,
          amount:
            effect.amount < 0
              ? -clamp(1, 20, Math.abs(barrierPower))
              : clamp(1, 20, barrierPower),
        }
      }
      case 'resource-change': {
        const magnitude = clamp(1, 20, Math.round(power * (attack ? 0.45 : 0.65)))
        return { ...effect, delta: effect.delta < 0 ? -magnitude : magnitude }
      }
      case 'bleed': {
        const ticks = clamp(1, 4, effect.ticks)
        const total = clamp(1, 20, Math.round(power * (attack ? 0.55 : 0.8)))
        return {
          ...effect,
          ticks,
          damagePerTick: clamp(1, 5, Math.max(1, Math.round(total / ticks))),
        }
      }
      case 'displace':
        return { ...effect, distance: clamp(1, 3, Math.round(power / 6)) }
      case 'apply-status': {
        const tuning = statusTuningForPower(effect.statusId, attack ? Math.max(1, power - 2) : power)
        return tuning ? { ...effect, tuning } : effect
      }
      default:
        return effect
    }
  })
}

export function createCombatRebalancedSkillVersion(
  definition: MatureSkillDefinition,
  tier: CombatBalanceTier = 'discipline',
): MatureSkillDefinition {
  const contentVersion = definition.contentVersion + 1
  const apCost = balancedApCost(definition.apCost, tier)
  const cooldownOwnerTurns = balancedCooldownOwnerTurns(
    { ...definition, apCost } as MatureSkillDefinition,
    tier,
  )

  const next: MatureSkillDefinition = {
    ...definition,
    contentVersion,
    apCost,
    ...(definition.tags.includes('mystic')
      ? { mpCost: Math.max(2, Math.floor(apCost / 15)) }
      : { mpCost: undefined }),
    effects: balancedEffects({ ...definition, apCost } as MatureSkillDefinition, tier),
    cooldown: { ...definition.cooldown, ownerTurns: cooldownOwnerTurns },
    overrides: Object.fromEntries(
      Object.entries(definition.overrides).map(([context, override]) => [
        context,
        override
          ? {
              ...override,
              ...(override.apCost === undefined
                ? {}
                : { apCost: balancedApCost(override.apCost, tier) }),
              ...(override.cooldownOwnerTurns === undefined
                ? {}
                : { cooldownOwnerTurns }),
            }
          : override,
      ]),
    ) as MatureSkillDefinition['overrides'],
    authoring: {
      ...definition.authoring,
      validationTags: [
        ...new Set([
          ...definition.authoring.validationTags,
          'owner-combat-rebalance-v2',
          'power-scale-1-20',
          definition.requirements.length > 0 ? 'requirement-no-runtime-cooldown' : 'cooldown-1-3',
        ]),
      ],
    },
  }
  return next
}

function resonanceSeed(definition: ResonanceDefinition): number {
  let hash = 0
  for (const char of definition.id) hash = (hash * 31 + char.charCodeAt(0)) % 997
  return hash
}

export function createCombatRebalancedResonanceVersion(
  definition: ResonanceDefinition,
): ResonanceDefinition {
  const complexity =
    definition.trigger.setup.requiredTags.length + definition.trigger.payoff.requiredTags.length
  const basePower = clamp(6, 16, 7 + complexity + (resonanceSeed(definition) % 4))
  const payoffEffects = definition.trigger.payoffEffects.map((effect, index) => {
    const effectPower = clamp(1, 20, basePower + (index % 2))
    switch (effect.type) {
      case 'damage':
        return { ...effect, amount: clamp(1, 20, Math.max(effect.amount, effectPower)) }
      case 'healing':
        return { ...effect, amount: clamp(1, 20, Math.max(effect.amount, effectPower)) }
      case 'barrier-change':
        return {
          ...effect,
          amount:
            effect.amount < 0
              ? -clamp(1, 20, Math.max(Math.abs(effect.amount), effectPower))
              : clamp(1, 20, Math.max(effect.amount, effectPower)),
        }
      case 'resource-change': {
        const magnitude = clamp(1, 20, Math.max(Math.abs(effect.delta), Math.round(effectPower * 0.65)))
        return { ...effect, delta: effect.delta < 0 ? -magnitude : magnitude }
      }
      case 'apply-status': {
        const tuning = statusTuningForPower(effect.statusId, effectPower)
        return tuning ? { ...effect, tuning } : effect
      }
      case 'displace':
        return { ...effect, distance: clamp(1, 3, Math.max(effect.distance, Math.round(effectPower / 6))) }
      default:
        return effect
    }
  })

  return {
    ...definition,
    contentVersion: definition.contentVersion + 1,
    trigger: {
      ...definition.trigger,
      payoffEffects,
      aiSetupUtilityBonus: Math.max(definition.trigger.aiSetupUtilityBonus, basePower),
      aiPayoffUtilityBonus: Math.max(definition.trigger.aiPayoffUtilityBonus, basePower * 2),
    },
    authoring: {
      ...definition.authoring,
      validationTags: [
        ...new Set([
          ...definition.authoring.validationTags,
          'owner-combat-rebalance-v2',
          'varied-resonance-payoff',
        ]),
      ],
    },
  }
}
