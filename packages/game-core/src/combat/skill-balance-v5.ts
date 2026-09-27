import type { CombatEffectDefinition } from './actions'
import type { MatureSkillDefinition } from './mature-skills'

export const CURRENT_SKILL_POWER_MINIMUM = 1 as const
export const CURRENT_SKILL_POWER_MAXIMUM = 20 as const
export const CURRENT_EFFECT_DURATION_MAXIMUM_TURNS = 4 as const
export const CURRENT_SKILL_COOLDOWN_MAXIMUM_TURNS = 3 as const

export type RebalanceSkillKind = 'technique' | 'essence'

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value))

function roundedPower(value: number): number {
  return clamp(Math.round(value), CURRENT_SKILL_POWER_MINIMUM, CURRENT_SKILL_POWER_MAXIMUM)
}

function isAreaSkill(definition: MatureSkillDefinition): boolean {
  return definition.target.shape.kind !== 'single'
}

function defaultStatusDuration(statusId: string): number {
  switch (statusId) {
    case 'root':
    case 'hastened':
    case 'delayed':
    case 'borrowed-hour':
    case 'displaced':
      return 1
    case 'burn':
      return 3
    case 'poison':
      return 4
    case 'bleed':
      return 3
    default:
      return 2
  }
}

export function defaultEffectDurationTurns(effect: CombatEffectDefinition): number {
  if (effect.durationTurns !== undefined) return effect.durationTurns
  switch (effect.type) {
    case 'apply-status':
      return defaultStatusDuration(effect.statusId)
    case 'bleed':
      return effect.ticks
    case 'burn':
      return 3
    case 'poison':
      return 4
    case 'create-terrain':
      return 2
    default:
      return 0
  }
}

function defaultStatusPotencyBasisPoints(effect: CombatEffectDefinition, apCost: number): number | undefined {
  if (effect.type !== 'apply-status') return undefined
  if (effect.potencyBasisPoints !== undefined) return effect.potencyBasisPoints
  const scaled = clamp(1_000 + Math.floor(Math.max(0, apCost - 25) / 10) * 100, 1_000, 2_000)
  switch (effect.statusId) {
    case 'guarded':
    case 'exposed':
      return scaled
    case 'mark':
      return clamp(scaled, 1_000, 1_800)
    case 'hexed':
      return clamp(scaled + 500, 1_500, 2_500)
    case 'inspired':
    case 'summoned':
    case 'warded':
      return clamp(scaled, 800, 1_800)
    default:
      return undefined
  }
}

function tuneDamage(
  definition: MatureSkillDefinition,
  effect: Extract<CombatEffectDefinition, { type: 'damage' }>,
  damageEffects: number,
  nonDamageWeight: number,
  kind: RebalanceSkillKind,
): CombatEffectDefinition {
  const areaFactor = definition.target.shape.kind === 'circle' ? 0.78 : definition.target.shape.kind === 'line' ? 0.86 : 1
  const utilityFactor = Math.max(0.55, 1 - nonDamageWeight * 0.12)
  const requirementFactor = definition.requirements.length > 0 ? 1.12 : 1
  const essenceFactor = kind === 'essence' ? 1.12 : 1
  const commandBudget = definition.apCost / 3
  const perHit = (commandBudget * areaFactor * utilityFactor * requirementFactor * essenceFactor) / Math.max(1, Math.sqrt(damageEffects))
  return {
    ...effect,
    amount: roundedPower(effect.vengeance ? effect.amount : perHit),
    durationTurns: 0,
  }
}

function tuneEffect(
  definition: MatureSkillDefinition,
  effect: CombatEffectDefinition,
  damageEffects: number,
  nonDamageWeight: number,
  kind: RebalanceSkillKind,
): CombatEffectDefinition {
  if (effect.type === 'damage') {
    return tuneDamage(definition, effect, damageEffects, nonDamageWeight, kind)
  }

  const durationTurns = defaultEffectDurationTurns(effect)
  const durationWeight = Math.max(1, durationTurns)
  const essenceFactor = kind === 'essence' ? 1.12 : 1
  const areaFactor = isAreaSkill(definition) ? 0.82 : 1

  switch (effect.type) {
    case 'healing':
      return {
        ...effect,
        amount: roundedPower((definition.apCost / 4) * areaFactor * essenceFactor / Math.sqrt(durationWeight)),
        durationTurns,
      }
    case 'resource-change': {
      const sign = effect.delta < 0 ? -1 : 1
      return {
        ...effect,
        delta:
          sign *
          roundedPower((definition.apCost / 7) * areaFactor * essenceFactor / Math.sqrt(durationWeight)),
        durationTurns,
      }
    }
    case 'barrier-change':
      return {
        ...effect,
        amount: roundedPower((definition.apCost / 4) * areaFactor * essenceFactor / Math.sqrt(durationWeight)),
        durationTurns,
      }
    case 'bleed':
      return {
        ...effect,
        damagePerTick: clamp(
          Math.round((definition.apCost / 14) * areaFactor * essenceFactor),
          1,
          5,
        ),
        ticks: clamp(durationTurns, 1, CURRENT_EFFECT_DURATION_MAXIMUM_TURNS),
        durationTurns,
      }
    case 'apply-status': {
      const potencyBasisPoints = defaultStatusPotencyBasisPoints(effect, definition.apCost)
      return {
        ...effect,
        durationTurns,
        ...(potencyBasisPoints === undefined ? {} : { potencyBasisPoints }),
      }
    }
    default:
      return { ...effect, durationTurns }
  }
}

function effectWeight(effect: CombatEffectDefinition): number {
  const duration = defaultEffectDurationTurns(effect)
  switch (effect.type) {
    case 'apply-status':
      return 1 + duration * 0.35 + (effect.potencyBasisPoints ?? 0) / 5_000
    case 'remove-status':
    case 'displace':
    case 'create-terrain':
    case 'return-to-turn-start':
    case 'copy-statuses':
    case 'copy':
    case 'sensory':
      return 1.3 + duration * 0.25
    case 'healing':
    case 'resource-change':
    case 'barrier-change':
      return 0.7 + duration * 0.25
    case 'poison':
    case 'burn':
    case 'bleed':
      return 1 + duration * 0.35
    case 'damage':
      return 0
  }
}

function cooldownTurns(
  definition: MatureSkillDefinition,
  effects: readonly CombatEffectDefinition[],
  kind: RebalanceSkillKind,
): 1 | 2 | 3 | null {
  if (definition.requirements.length > 0) return null

  const persistentWeight = effects.reduce((sum, effect) => sum + effectWeight(effect), 0)
  const areaWeight = isAreaSkill(definition) ? 6 : 0
  const essenceWeight = kind === 'essence' ? 10 : 0
  const score = definition.apCost + persistentWeight * 4 + areaWeight + essenceWeight
  if (score < 45) return 1
  if (score < 65) return 2
  return 3
}

export function rebalanceMatureSkillDefinition(
  definition: MatureSkillDefinition,
  kind: RebalanceSkillKind = 'technique',
): MatureSkillDefinition {
  const apCost =
    kind === 'essence'
      ? clamp(Math.max(55, Math.round(definition.apCost / 5) * 5), 55, 75)
      : clamp(Math.round(definition.apCost / 5) * 5, 25, 65)
  const withCost = { ...definition, apCost }
  const damageEffects = definition.effects.filter((effect) => effect.type === 'damage').length
  const nonDamageWeight = definition.effects.reduce(
    (sum, effect) => sum + (effect.type === 'damage' ? 0 : effectWeight(effect)),
    0,
  )
  const effects = definition.effects.map((effect) =>
    tuneEffect(withCost, effect, damageEffects, nonDamageWeight, kind),
  )
  const cooldown = cooldownTurns(withCost, effects, kind)

  return {
    ...definition,
    contentVersion: definition.contentVersion + 1,
    apCost,
    effects,
    cooldown: cooldown === null ? null : { key: definition.id, ownerTurns: cooldown },
    overrides: Object.fromEntries(
      Object.entries(definition.overrides).map(([context, override]) => [
        context,
        {
          ...override,
          ...(override?.apCost === undefined
            ? {}
            : { apCost: clamp(Math.round(override.apCost / 5) * 5, 25, kind === 'essence' ? 80 : 70) }),
          ...(cooldown === null ? { cooldownOwnerTurns: undefined } : { cooldownOwnerTurns: cooldown }),
        },
      ]),
    ),
    ai: {
      ...definition.ai,
      baseUtility: clamp(
        Math.round(definition.ai.baseUtility * 0.55 + apCost * 0.8 + nonDamageWeight * 4),
        20,
        120,
      ),
    },
    authoring: {
      ...definition.authoring,
      validationTags: [
        ...new Set([
          ...definition.authoring.validationTags,
          'owner-rebalance-v5',
          'power-1-20',
          'duration-aware',
          'cooldown-1-3',
        ]),
      ],
    },
  }
}
