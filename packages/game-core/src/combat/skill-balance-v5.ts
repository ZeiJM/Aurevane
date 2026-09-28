import type { CombatEffectDefinition } from './actions'
import type { MatureSkillDefinition, MatureSkillEffectDefinition } from './mature-skills'

export const CURRENT_SKILL_POWER_MINIMUM = 1 as const
export const CURRENT_SKILL_POWER_MAXIMUM = 20 as const
export const CURRENT_EFFECT_DURATION_MAXIMUM_TURNS = 4 as const
export const CURRENT_SKILL_COOLDOWN_MAXIMUM_TURNS = 3 as const

export type RebalanceSkillKind = 'technique' | 'essence'

function title(value: string): string {
  return value
    .split(/[._-]/gu)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function v5SkillFlavorLine(definition: MatureSkillDefinition): string {
  const discipline = title(definition.sourceDisciplineId)
  const effects = definition.effects
  const statuses = effects.flatMap((effect) =>
    effect.type === 'apply-status' ? [effect.statusId] : [],
  )
  const hasDamage = effects.some((effect) => effect.type === 'damage')
  const restoresHp = effects.some((effect) => effect.type === 'healing')
  const restoresMp = effects.some((effect) => effect.type === 'resource-change' && effect.delta > 0)
  const drainsMp = effects.some((effect) => effect.type === 'resource-change' && effect.delta < 0)

  if (definition.sourceDisciplineId === 'chronist' && hasDamage) {
    return 'Rend a seam in time and drive the strike through before the enemy can recover.'
  }
  if (hasDamage && statuses.some((status) => ['root', 'slow', 'exposed'].includes(status))) {
    return `Drive ${discipline} force through the hit, turning pain into an opening the enemy cannot ignore.`
  }
  if (hasDamage && drainsMp) {
    return `Cut into the enemy's momentum and tear away the reserve they need to answer back.`
  }
  if (hasDamage && definition.target.shape.kind !== 'single') {
    return `Unleash ${discipline} force across the field and catch every foe inside the sweep.`
  }
  if (hasDamage && definition.tags.includes('mystic')) {
    return `Gather ${discipline} power into a focused strike that tears through the enemy's guard.`
  }
  if (hasDamage) {
    return `Drive ${discipline} technique through the opening with a decisive, committed strike.`
  }
  if (restoresHp && restoresMp) {
    return 'Draw breath, will, and inner reserve back into alignment before the next exchange.'
  }
  if (restoresHp) {
    return `Call on ${discipline} discipline to turn a wounded moment back toward survival.`
  }
  if (statuses.includes('guarded')) {
    return `Set a ${discipline} stance that steadies the line and blunts the next exchange.`
  }
  if (statuses.some((status) => ['root', 'slow'].includes(status))) {
    return `Bind the enemy's momentum and force their next move into a narrower path.`
  }
  if (effects.some((effect) => effect.type === 'remove-status')) {
    return `Break hostile influence with a clean ${discipline} release and reclaim control.`
  }
  if (restoresMp) {
    return `Settle into ${discipline} rhythm and refill the reserve needed for the next technique.`
  }
  return `Shape ${discipline} technique into a precise advantage before the next exchange.`
}
const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value))

function roundedPower(value: number): number {
  return clamp(Math.round(value), CURRENT_SKILL_POWER_MINIMUM, CURRENT_SKILL_POWER_MAXIMUM)
}

function isAreaSkill(definition: MatureSkillDefinition): boolean {
  return definition.target.shape.kind !== 'single'
}

function targetReachFactor(definition: MatureSkillDefinition): number {
  if (definition.target.kind === 'self') return 1
  const maximumRange = Math.max(0, definition.target.maximumRange)
  if (maximumRange <= 1) return 1
  return Math.max(0.78, 1 - Math.min(6, maximumRange - 1) * 0.04)
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

export function defaultEffectDurationTurns(effect: MatureSkillEffectDefinition): number {
  if (effect.durationTurns !== undefined) return effect.durationTurns
  switch (effect.type) {
    case 'apply-status':
      return defaultStatusDuration(effect.statusId)
    case 'healing':
      return Math.max(0, (effect.ticks ?? 1) - 1)
    case 'resource-change':
      return effect.delta > 0 ? Math.max(0, (effect.ticks ?? 1) - 1) : 0
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

function defaultStatusPotencyBasisPoints(
  effect: CombatEffectDefinition,
  apCost: number,
): number | undefined {
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
  const areaFactor =
    definition.target.shape.kind === 'circle'
      ? 0.78
      : definition.target.shape.kind === 'line'
        ? 0.86
        : 1
  const utilityFactor = Math.max(0.55, 1 - nonDamageWeight * 0.12)
  const reachFactor = targetReachFactor(definition)
  const requirementFactor = definition.requirements.length > 0 ? 1.12 : 1
  const essenceFactor = kind === 'essence' ? 1.12 : 1
  const commandBudget = definition.apCost / 3
  const perHit =
    (commandBudget * areaFactor * reachFactor * utilityFactor * requirementFactor * essenceFactor) /
    Math.max(1, Math.sqrt(damageEffects))
  return {
    ...effect,
    amount: roundedPower(effect.vengeance ? effect.amount : perHit),
    durationTurns: 0,
  }
}

function tuneEffect(
  definition: MatureSkillDefinition,
  effect: MatureSkillEffectDefinition,
  damageEffects: number,
  nonDamageWeight: number,
  kind: RebalanceSkillKind,
): MatureSkillEffectDefinition {
  if (effect.type === 'summon') return effect
  if (effect.type === 'damage') {
    return tuneDamage(definition, effect, damageEffects, nonDamageWeight, kind)
  }

  const durationTurns = defaultEffectDurationTurns(effect)
  const durationWeight = Math.max(1, durationTurns)
  const essenceFactor = kind === 'essence' ? 1.12 : 1
  const areaFactor = isAreaSkill(definition) ? 0.82 : 1
  const reachFactor = targetReachFactor(definition)

  switch (effect.type) {
    case 'healing':
      return {
        ...effect,
        amount: roundedPower(
          ((definition.apCost / 4) * areaFactor * reachFactor * essenceFactor) /
            Math.sqrt(durationWeight),
        ),
        durationTurns,
      }
    case 'resource-change': {
      const sign = effect.delta < 0 ? -1 : 1
      return {
        ...effect,
        delta:
          sign *
          roundedPower(
            ((definition.apCost / 7) * areaFactor * reachFactor * essenceFactor) /
              Math.sqrt(durationWeight),
          ),
        durationTurns,
      }
    }
    case 'barrier-change':
      return {
        ...effect,
        amount: roundedPower(
          ((definition.apCost / 4) * areaFactor * reachFactor * essenceFactor) /
            Math.sqrt(durationWeight),
        ),
        durationTurns,
      }
    case 'bleed':
      return {
        ...effect,
        damagePerTick: roundedPower(
          ((definition.apCost / 14) * areaFactor * reachFactor * essenceFactor) /
            Math.sqrt(durationWeight),
        ),
        ticks: clamp(durationTurns, 1, CURRENT_EFFECT_DURATION_MAXIMUM_TURNS),
        durationTurns,
      }
    case 'burn':
    case 'poison':
      return {
        ...effect,
        power: roundedPower(
          ((definition.apCost / 12) * areaFactor * reachFactor * essenceFactor) /
            Math.sqrt(durationWeight),
        ),
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

function effectWeight(effect: MatureSkillEffectDefinition): number {
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
    case 'summon':
      return 0
  }
}

function effectMagnitudeWeight(effect: MatureSkillEffectDefinition): number {
  switch (effect.type) {
    case 'damage':
      return effect.amount * 0.3
    case 'healing':
    case 'barrier-change':
      return effect.amount * 0.22
    case 'resource-change':
      return Math.abs(effect.delta) * 0.18
    case 'bleed':
      return effect.damagePerTick * effect.ticks * 0.12
    case 'burn':
    case 'poison':
      return (effect.power ?? 3) * Math.max(1, defaultEffectDurationTurns(effect)) * 0.1
    case 'apply-status':
      return (effect.potencyBasisPoints ?? 0) / 1_000
    case 'summon':
      return 0
    default:
      return 0
  }
}

function cooldownReachWeight(definition: MatureSkillDefinition): number {
  if (definition.target.kind === 'self') return 0
  return Math.min(6, Math.max(0, definition.target.maximumRange - 1)) * 1.25
}

function cooldownTurns(
  definition: MatureSkillDefinition,
  effects: readonly MatureSkillEffectDefinition[],
  kind: RebalanceSkillKind,
): 1 | 2 | 3 | null {
  if (definition.requirements.length > 0) return null

  const persistentWeight = effects.reduce((sum, effect) => sum + effectWeight(effect), 0)
  const magnitudeWeight = effects.reduce((sum, effect) => sum + effectMagnitudeWeight(effect), 0)
  const areaWeight = isAreaSkill(definition) ? 6 : 0
  const reachWeight = cooldownReachWeight(definition)
  const essenceWeight = kind === 'essence' ? 10 : 0
  const score =
    definition.apCost +
    persistentWeight * 4 +
    magnitudeWeight +
    areaWeight +
    reachWeight +
    essenceWeight
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
    flavorLine: v5SkillFlavorLine(definition),
    effects,
    cooldown: cooldown === null ? null : { key: definition.id, ownerTurns: cooldown },
    overrides: Object.fromEntries(
      Object.entries(definition.overrides).map(([context, override]) => [
        context,
        {
          ...override,
          ...(override?.apCost === undefined
            ? {}
            : {
                apCost: clamp(
                  Math.round(override.apCost / 5) * 5,
                  25,
                  kind === 'essence' ? 80 : 70,
                ),
              }),
          ...(cooldown === null
            ? { cooldownOwnerTurns: undefined }
            : { cooldownOwnerTurns: cooldown }),
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
