import type { MatureSkillDefinition, MatureSkillEffectDefinition } from './mature-skills'
import {
  CURRENT_EFFECT_DURATION_MAXIMUM_TURNS,
  CURRENT_SKILL_POWER_MAXIMUM,
  CURRENT_SKILL_POWER_MINIMUM,
  defaultEffectDurationTurns,
  type RebalanceSkillKind,
} from './skill-balance-v5'

export type V51SkillRole = 'attack' | 'utility' | 'recovery'

const TARGET_RANGE_FACTORS = [1, 1.12, 1.06, 1, 0.94, 0.88] as const
const ELEVATION_FACTORS = [1, 0.95, 0.88] as const

const V51_ELEVATION_TWO_SKILL_IDS = new Set([
  'aetherist.arc-bolt',
  'farstrider.longshot',
  'stormsinger.lightning-line',
  'essence.farstrider.deadeye-barrage',
])

const V51_ELEVATION_ONE_SKILL_IDS = new Set([
  'aetherist.chain-spark',
  'chronist.temporal-bolt',
  'cinderweaver.cinder-bolt',
  'farstrider.aimed-shot',
  'farstrider.volley',
  'frostweaver.ice-lance',
  'stormsinger.conductive-bolt',
  'essence.aetherist.aether-nova',
  'essence.stormsinger.skybreak',
  'essence.cinderweaver.phoenix-wake',
])

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value))

const roundToFive = (value: number): number => Math.round(value / 5) * 5

export function classifyV51SkillRole(definition: MatureSkillDefinition): V51SkillRole {
  if (
    definition.tags.includes('attack') ||
    definition.effects.some((effect) => effect.type === 'damage')
  ) {
    return 'attack'
  }
  if (definition.effects.some((effect) => effect.type === 'healing')) return 'recovery'
  return 'utility'
}

function techniqueApBand(role: V51SkillRole): readonly [number, number] {
  return role === 'utility' ? [35, 50] : [45, 60]
}

function tunedTechniqueApCost(definition: MatureSkillDefinition): number {
  const [minimum, maximum] = techniqueApBand(classifyV51SkillRole(definition))
  return clamp(roundToFive(definition.apCost), minimum, maximum)
}

function tunedEssenceApCost(definition: MatureSkillDefinition): number {
  return clamp(Math.max(55, roundToFive(definition.apCost)), 55, 75)
}

export function applyV51CurrentTechniqueTargeting(
  definition: MatureSkillDefinition,
): MatureSkillDefinition {
  if (definition.target.kind === 'self') {
    return {
      ...definition,
      target: {
        ...definition.target,
        minimumRange: 0,
        maximumRange: 0,
        maximumElevationDifference: null,
      },
    }
  }

  const maximumRange = clamp(Math.round(definition.target.maximumRange), 1, 5)
  const maximumElevationDifference = V51_ELEVATION_TWO_SKILL_IDS.has(definition.id)
    ? 2
    : V51_ELEVATION_ONE_SKILL_IDS.has(definition.id)
      ? 1
      : 0

  return {
    ...definition,
    target: {
      ...definition.target,
      minimumRange: Math.min(definition.target.minimumRange, maximumRange),
      maximumRange,
      maximumElevationDifference,
    },
  }
}

export function v51TargetingMagnitudeFactor(definition: MatureSkillDefinition): number {
  if (definition.target.kind === 'self') return 1

  const range = clamp(Math.round(definition.target.maximumRange), 1, 5)
  const rangeFactor = TARGET_RANGE_FACTORS[range] ?? TARGET_RANGE_FACTORS[3]
  const elevation =
    definition.target.maximumElevationDifference === null
      ? 0
      : clamp(Math.round(definition.target.maximumElevationDifference), 0, 2)
  const elevationFactor = ELEVATION_FACTORS[elevation] ?? ELEVATION_FACTORS[0]
  const lineOfSightFactor = definition.target.requiresLineOfSight ? 1 : 0.9

  return rangeFactor * elevationFactor * lineOfSightFactor
}

export function v51TargetingValueWeight(definition: MatureSkillDefinition): number {
  if (definition.target.kind === 'self') return 0

  const range = clamp(Math.round(definition.target.maximumRange), 1, 5)
  const elevation =
    definition.target.maximumElevationDifference === null
      ? 0
      : clamp(Math.round(definition.target.maximumElevationDifference), 0, 2)
  const rangeWeight = Math.max(0, range - 1) * 1.5
  const elevationWeight = elevation === 2 ? 7 : elevation === 1 ? 3 : 0
  const lineOfSightWeight = definition.target.requiresLineOfSight ? 0 : 4

  return rangeWeight + elevationWeight + lineOfSightWeight
}

function scalePower(value: number, factor: number, minimum = 1): number {
  const scaled = value * factor
  const rounded =
    factor < 1 ? Math.floor(scaled) : factor > 1 ? Math.ceil(scaled) : Math.round(scaled)
  return clamp(rounded, minimum, CURRENT_SKILL_POWER_MAXIMUM)
}

function tuneEffectMagnitude(
  effect: MatureSkillEffectDefinition,
  factor: number,
): MatureSkillEffectDefinition {
  if (effect.type === 'summon') return effect
  switch (effect.type) {
    case 'damage':
      return {
        ...effect,
        amount: effect.vengeance
          ? effect.amount
          : scalePower(effect.amount, factor, CURRENT_SKILL_POWER_MINIMUM),
      }
    case 'healing':
    case 'barrier-change':
      return { ...effect, amount: scalePower(effect.amount, factor) }
    case 'resource-change': {
      const sign = effect.delta < 0 ? -1 : 1
      return { ...effect, delta: sign * scalePower(Math.abs(effect.delta), factor) }
    }
    case 'bleed':
      return {
        ...effect,
        damagePerTick: scalePower(effect.damagePerTick, factor),
        ticks: clamp(effect.ticks, 1, CURRENT_EFFECT_DURATION_MAXIMUM_TURNS),
      }
    case 'burn':
    case 'poison':
      return {
        ...effect,
        ...(effect.power === undefined ? {} : { power: scalePower(effect.power, factor) }),
      }
    case 'apply-status':
      return {
        ...effect,
        ...(effect.potencyBasisPoints === undefined
          ? {}
          : {
              potencyBasisPoints: clamp(Math.round(effect.potencyBasisPoints * factor), 100, 5_000),
            }),
      }
    default:
      return effect
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

function cooldownTurns(
  definition: MatureSkillDefinition,
  effects: readonly MatureSkillEffectDefinition[],
  kind: RebalanceSkillKind,
): 1 | 2 | 3 | null {
  if (definition.requirements.length > 0) return null

  const persistentWeight = effects.reduce((sum, effect) => sum + effectWeight(effect), 0)
  const magnitudeWeight = effects.reduce((sum, effect) => sum + effectMagnitudeWeight(effect), 0)
  const areaWeight = definition.target.shape.kind === 'single' ? 0 : 6
  const targetingWeight = v51TargetingValueWeight(definition)
  const essenceWeight = kind === 'essence' ? 10 : 0
  const score =
    definition.apCost +
    persistentWeight * 4 +
    magnitudeWeight +
    areaWeight +
    targetingWeight +
    essenceWeight

  if (score < 50) return 1
  if (score < 70) return 2
  return 3
}

function currentMysticMpCost(apCost: number): number {
  return Math.max(2, Math.floor(apCost / 15))
}

export function rebalanceMatureSkillDefinitionV51(
  definition: MatureSkillDefinition,
  kind: RebalanceSkillKind = 'technique',
): MatureSkillDefinition {
  const apCost =
    kind === 'essence' ? tunedEssenceApCost(definition) : tunedTechniqueApCost(definition)
  const apFactor = apCost / Math.max(1, definition.apCost)
  const targetFactor = v51TargetingMagnitudeFactor(definition)
  const rawMagnitudeFactor = apFactor * targetFactor
  const damageEffectCount = definition.effects.filter((effect) => effect.type === 'damage').length
  const magnitudeFactor =
    kind === 'essence' && damageEffectCount > 1 && Math.abs(rawMagnitudeFactor - 1) < 0.05
      ? 1
      : rawMagnitudeFactor
  const effects = definition.effects.map((effect) => tuneEffectMagnitude(effect, magnitudeFactor))
  const withCostAndEffects: MatureSkillDefinition = {
    ...definition,
    apCost,
    mpCost: definition.tags.includes('mystic') ? currentMysticMpCost(apCost) : definition.mpCost,
    effects,
  }
  const cooldown = cooldownTurns(withCostAndEffects, effects, kind)

  return {
    ...withCostAndEffects,
    contentVersion: definition.contentVersion + 1,
    cooldown: cooldown === null ? null : { key: definition.id, ownerTurns: cooldown },
    overrides: Object.fromEntries(
      Object.entries(definition.overrides).map(([context, override]) => [
        context,
        {
          ...override,
          ...(override?.apCost === undefined
            ? {}
            : {
                apCost:
                  kind === 'essence'
                    ? clamp(roundToFive(override.apCost), 55, 75)
                    : clamp(
                        roundToFive(override.apCost),
                        ...techniqueApBand(classifyV51SkillRole(definition)),
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
        Math.round(
          definition.ai.baseUtility * 0.6 + apCost * 0.65 + v51TargetingValueWeight(definition),
        ),
        20,
        120,
      ),
    },
    authoring: {
      ...definition.authoring,
      validationTags: [
        ...new Set([
          ...definition.authoring.validationTags,
          'owner-rebalance-v5-1',
          'target-budget-v5-1',
        ]),
      ],
    },
  }
}
