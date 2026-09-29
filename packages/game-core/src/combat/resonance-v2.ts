import type { CombatEffectDefinition } from './actions'
import { validateGameplayEffectMetadata } from './gameplay-tags'
import type { ResonanceDefinition, ResonanceMediaHooks, ResonanceSkillMatcher } from './resonance'

export const RESONANCE_V2_SCHEMA_VERSION = 2 as const

export type ResonanceV2Mode = 'sequence' | 'immediate'

export interface ResonanceSkillTriggerV2 {
  readonly kind: 'skill-trigger-v2'
  readonly mode: ResonanceV2Mode
  readonly setup: ResonanceSkillMatcher | null
  readonly trigger: ResonanceSkillMatcher
  readonly resultEffects: readonly CombatEffectDefinition[]
  readonly aiSetupUtilityBonus: number
  readonly aiTriggerUtilityBonus: number
}

export interface ResonanceDefinitionV2 {
  readonly id: string
  readonly contentVersion: number
  readonly enabled: boolean
  readonly disciplinePair: readonly [string, string]
  readonly name: string
  readonly description: string
  readonly flavorLine?: string
  readonly trigger: ResonanceSkillTriggerV2
  readonly media: ResonanceMediaHooks
  readonly authoring: {
    readonly schemaVersion: typeof RESONANCE_V2_SCHEMA_VERSION
    readonly status: 'representative' | 'production'
    readonly validationTags: readonly string[]
  }
}

export interface NormalizedResonanceMechanics {
  readonly mode: ResonanceV2Mode
  readonly setup: ResonanceSkillMatcher | null
  readonly trigger: ResonanceSkillMatcher
  readonly resultEffects: readonly CombatEffectDefinition[]
  readonly aiSetupUtilityBonus: number
  readonly aiTriggerUtilityBonus: number
}

const STABLE_ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u

const IMMEDIATE_TRIGGER_DISCIPLINES = new Set(['chronist', 'farstrider', 'ironfist', 'shadehand'])

function matcherValid(matcher: ResonanceSkillMatcher): boolean {
  return (
    STABLE_ID_PATTERN.test(matcher.sourceDisciplineId) &&
    matcher.requiredTags.length >= 1 &&
    matcher.requiredTags.length <= 2 &&
    matcher.requiredTags.every((tag) => STABLE_ID_PATTERN.test(tag))
  )
}

function validateEffect(effect: CombatEffectDefinition): boolean {
  try {
    validateGameplayEffectMetadata(effect)
    return true
  } catch {
    return false
  }
}

function cloneDefinitionValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function scaledPositive(value: number, factor: number): number {
  return Math.max(1, Math.round(value * factor))
}

function weakenImmediateEffect(effect: CombatEffectDefinition): CombatEffectDefinition {
  switch (effect.type) {
    case 'damage':
    case 'healing':
    case 'barrier-change':
      return { ...effect, amount: scaledPositive(effect.amount, 0.65) }
    case 'resource-change':
      return {
        ...effect,
        delta:
          effect.delta === 0
            ? 0
            : Math.sign(effect.delta) * scaledPositive(Math.abs(effect.delta), 0.65),
      }
    case 'apply-status':
      return {
        ...effect,
        ...(effect.potencyBasisPoints === undefined
          ? {}
          : { potencyBasisPoints: scaledPositive(effect.potencyBasisPoints, 0.7) }),
        durationTurns: Math.max(1, Math.min(1, effect.durationTurns ?? 1)),
      }
    case 'bleed':
      return {
        ...effect,
        damagePerTick: scaledPositive(effect.damagePerTick, 0.65),
        ticks: Math.max(1, Math.min(2, effect.ticks)),
        durationTurns: Math.max(1, Math.min(2, effect.durationTurns ?? effect.ticks)),
      }
    case 'burn':
    case 'poison':
      return {
        ...effect,
        power: scaledPositive(effect.power ?? 3, 0.65),
        durationTurns: Math.max(1, Math.min(2, effect.durationTurns ?? 2)),
      }
    case 'displace':
      return { ...effect, distance: Math.min(1, effect.distance) }
    case 'remove-status':
      return { ...effect, statusIds: effect.statusIds.slice(0, 1) }
    default:
      return effect
  }
}

export function isResonanceDefinitionV2(
  definition: ResonanceDefinition | ResonanceDefinitionV2,
): definition is ResonanceDefinitionV2 {
  return definition.authoring.schemaVersion === RESONANCE_V2_SCHEMA_VERSION
}

export function normalizedResonanceMechanics(
  definition: ResonanceDefinition | ResonanceDefinitionV2,
): NormalizedResonanceMechanics {
  if (isResonanceDefinitionV2(definition)) {
    return {
      mode: definition.trigger.mode,
      setup: definition.trigger.setup,
      trigger: definition.trigger.trigger,
      resultEffects: definition.trigger.resultEffects,
      aiSetupUtilityBonus: definition.trigger.aiSetupUtilityBonus,
      aiTriggerUtilityBonus: definition.trigger.aiTriggerUtilityBonus,
    }
  }

  return {
    mode: 'sequence',
    setup: definition.trigger.setup,
    trigger: definition.trigger.payoff,
    resultEffects: definition.trigger.payoffEffects,
    aiSetupUtilityBonus: definition.trigger.aiSetupUtilityBonus,
    aiTriggerUtilityBonus: definition.trigger.aiPayoffUtilityBonus,
  }
}

export function validateResonanceDefinitionV2(
  definition: ResonanceDefinitionV2,
): readonly string[] {
  const issues: string[] = []

  if (!STABLE_ID_PATTERN.test(definition.id)) issues.push('id')
  if (!Number.isSafeInteger(definition.contentVersion) || definition.contentVersion < 1) {
    issues.push('contentVersion')
  }
  if (!definition.name.trim()) issues.push('name')
  if (!definition.description.trim()) issues.push('description')
  if (
    definition.flavorLine !== undefined &&
    (definition.flavorLine.trim().length === 0 ||
      definition.flavorLine.length > 160 ||
      /[\r\n]/u.test(definition.flavorLine))
  ) {
    issues.push('flavorLine')
  }

  const [first, second] = definition.disciplinePair
  if (
    !STABLE_ID_PATTERN.test(first) ||
    !STABLE_ID_PATTERN.test(second) ||
    first === second ||
    first.localeCompare(second) > 0
  ) {
    issues.push('disciplinePair')
  }

  if (definition.trigger.kind !== 'skill-trigger-v2') issues.push('trigger.kind')
  if (definition.trigger.mode === 'sequence') {
    if (definition.trigger.setup === null || !matcherValid(definition.trigger.setup)) {
      issues.push('trigger.setup')
    }
  } else if (definition.trigger.mode === 'immediate') {
    if (definition.trigger.setup !== null) issues.push('trigger.setup')
  } else {
    issues.push('trigger.mode')
  }

  if (!matcherValid(definition.trigger.trigger)) issues.push('trigger.trigger')

  const matcherDisciplines = [
    ...(definition.trigger.setup ? [definition.trigger.setup.sourceDisciplineId] : []),
    definition.trigger.trigger.sourceDisciplineId,
  ]
  if (
    matcherDisciplines.some((disciplineId) => !definition.disciplinePair.includes(disciplineId))
  ) {
    issues.push('trigger.sourceDiscipline')
  }

  if (
    definition.trigger.resultEffects.length < 1 ||
    definition.trigger.resultEffects.length > 2 ||
    definition.trigger.resultEffects.some((effect) => !validateEffect(effect))
  ) {
    issues.push('trigger.resultEffects')
  }

  if (
    !Number.isFinite(definition.trigger.aiSetupUtilityBonus) ||
    definition.trigger.aiSetupUtilityBonus < 0 ||
    !Number.isFinite(definition.trigger.aiTriggerUtilityBonus) ||
    definition.trigger.aiTriggerUtilityBonus < 0
  ) {
    issues.push('trigger.aiUtility')
  }
  if (definition.trigger.mode === 'immediate' && definition.trigger.aiSetupUtilityBonus !== 0) {
    issues.push('trigger.aiSetupUtilityBonus')
  }
  if (definition.authoring.schemaVersion !== RESONANCE_V2_SCHEMA_VERSION) {
    issues.push('authoring.schemaVersion')
  }

  return [...new Set(issues)]
}

export function convertV5ResonanceToV2(definition: ResonanceDefinition): ResonanceDefinitionV2 {
  const immediate = IMMEDIATE_TRIGGER_DISCIPLINES.has(definition.trigger.payoff.sourceDisciplineId)
  const resultEffects = definition.trigger.payoffEffects
    .slice(0, 2)
    .map((effect) => (immediate ? weakenImmediateEffect(effect) : cloneDefinitionValue(effect)))

  const setup = immediate ? null : cloneDefinitionValue(definition.trigger.setup)
  const trigger = cloneDefinitionValue(definition.trigger.payoff)
  const setupLabel = setup
    ? `${setup.sourceDisciplineId} ${setup.requiredTags.join(' + ')}`
    : 'No setup'
  const triggerLabel = `${trigger.sourceDisciplineId} ${trigger.requiredTags.join(' + ')}`

  return {
    ...definition,
    contentVersion: definition.contentVersion + 1,
    description: immediate
      ? `${definition.name} triggers immediately from ${triggerLabel}; its Result is intentionally lighter because no Setup is required.`
      : `${definition.name} uses Setup ${setupLabel}, then Trigger ${triggerLabel}, to produce its authored Result.`,
    trigger: {
      kind: 'skill-trigger-v2',
      mode: immediate ? 'immediate' : 'sequence',
      setup,
      trigger,
      resultEffects,
      aiSetupUtilityBonus: immediate ? 0 : definition.trigger.aiSetupUtilityBonus,
      aiTriggerUtilityBonus: immediate
        ? Math.max(1, Math.round(definition.trigger.aiPayoffUtilityBonus * 0.7))
        : definition.trigger.aiPayoffUtilityBonus,
    },
    authoring: {
      schemaVersion: RESONANCE_V2_SCHEMA_VERSION,
      status: definition.authoring.status,
      validationTags: [
        ...new Set([
          ...definition.authoring.validationTags,
          'owner-rebalance-v5-1',
          immediate ? 'resonance-immediate-v2' : 'resonance-sequence-v2',
          'setup-trigger-result',
        ]),
      ],
    },
  }
}
