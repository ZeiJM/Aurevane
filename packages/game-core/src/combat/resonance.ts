import { battleFlavorTemplateIssues } from './battle-narration'
import { validateGameplayEffectMetadata } from './gameplay-tags'
import { ADVANCED_RESONANCES } from './advanced-resonances'
import { FOUNDATION_TRIO_RESONANCES } from './foundation-trio-resonances'
import { IRONFIST_RESONANCES } from './ironfist-content'
import { rebalanceResonanceDefinition } from './resonance-balance-v5'
import {
  convertV5ResonanceToV2,
  isResonanceDefinitionV2,
  normalizedResonanceMechanics,
  validateResonanceDefinitionV2,
  type ResonanceDefinitionV2,
} from './resonance-v2'
import {
  executeCombatAction,
  evaluateCombatAction,
  type CombatContentCatalog,
  type CombatEffectDefinition,
  type CombatEncounterState,
  type CombatResolutionEvent,
  type CombatTargetSelection,
} from './actions'
import {
  toCombatActionDefinition,
  type MatureSkillCombatContext,
  type MatureSkillDefinition,
} from './mature-skills'

export const RESONANCE_SCHEMA_VERSION = 1 as const

export interface ResonanceSkillMatcher {
  readonly sourceDisciplineId: string
  readonly requiredTags: readonly string[]
}

export interface ResonanceSkillSequenceTrigger {
  readonly kind: 'skill-sequence'
  readonly setup: ResonanceSkillMatcher
  readonly payoff: ResonanceSkillMatcher
  readonly payoffEffects: readonly CombatEffectDefinition[]
  readonly aiSetupUtilityBonus: number
  readonly aiPayoffUtilityBonus: number
}

export interface ResonanceMediaHooks {
  readonly iconKey: string | null
  readonly audioCueKey: string | null
  readonly vfxKey: string | null
}

export interface ResonanceDefinition {
  readonly id: string
  readonly contentVersion: number
  readonly enabled: boolean
  readonly disciplinePair: readonly [string, string]
  readonly name: string
  readonly description: string
  readonly flavorLine?: string
  readonly trigger: ResonanceSkillSequenceTrigger
  readonly media: ResonanceMediaHooks
  readonly authoring: {
    readonly schemaVersion: typeof RESONANCE_SCHEMA_VERSION
    readonly status: 'representative' | 'production'
    readonly validationTags: readonly string[]
  }
}

export type AnyResonanceDefinition = ResonanceDefinition | ResonanceDefinitionV2

export interface ResonanceSnapshotReference {
  readonly resonanceId: string
  readonly contentVersion: number
  readonly disciplinePair: readonly [string, string]
}

export interface ResonanceCombatState {
  readonly resonanceId: string
  readonly contentVersion: number
  readonly armedByActionId: string | null
}

export type ResonanceCombatEvent =
  | {
      readonly event: 'resonance_armed'
      readonly resonanceId: string
      readonly contentVersion: number
      readonly actorId: string
      readonly setupActionId: string
    }
  | {
      readonly event: 'resonance_activated'
      readonly resonanceId: string
      readonly contentVersion: number
      readonly actorId: string
      readonly setupActionId: string | null
      readonly triggerActionId: string
      readonly payoffActionId: string
    }
  | {
      readonly event: 'resonance_expired'
      readonly resonanceId: string
      readonly contentVersion: number
      readonly actorId: string
      readonly setupActionId: string
      readonly interruptedByActionId: string
    }

export interface ResonanceSkillForecast {
  readonly willArm: boolean
  readonly willActivate: boolean
  readonly willExpireArmedSetup: boolean
  readonly bonusEffects: readonly CombatEffectDefinition[]
  readonly explanation: string | null
}

export interface MatureSkillResonanceTransition {
  readonly state: CombatEncounterState
  readonly resonanceState: ResonanceCombatState
  readonly events: readonly (CombatResolutionEvent | ResonanceCombatEvent)[]
}

const PRE_V5_RESONANCES = [
  {
    id: 'resonance.lifebinder-vanguard.mercys-edge',
    contentVersion: 1,
    enabled: true,
    disciplinePair: ['lifebinder', 'vanguard'],
    name: "Mercy's Edge",
    description:
      'Restore HP with a Lifebinder Discipline Skill to arm the Resonance. If the next Discipline Skill you use is a Vanguard melee attack, it deals 6 additional damage and consumes the setup.',
    trigger: {
      kind: 'skill-sequence',
      setup: { sourceDisciplineId: 'lifebinder', requiredTags: ['heal'] },
      payoff: { sourceDisciplineId: 'vanguard', requiredTags: ['attack', 'melee'] },
      payoffEffects: [{ type: 'damage', recipient: 'primary-unit', amount: 6 }],
      aiSetupUtilityBonus: 12,
      aiPayoffUtilityBonus: 30,
    },
    media: {
      iconKey: 'resonance.lifebinder-vanguard.mercys-edge.icon',
      audioCueKey: 'resonance.lifebinder-vanguard.mercys-edge.audio',
      vfxKey: 'resonance.lifebinder-vanguard.mercys-edge.vfx',
    },
    authoring: {
      schemaVersion: RESONANCE_SCHEMA_VERSION,
      status: 'representative',
      validationTags: ['p3.5', 'representative', 'skill-sequence', 'bounded'],
    },
  },
  ...FOUNDATION_TRIO_RESONANCES,
  ...IRONFIST_RESONANCES,
  ...ADVANCED_RESONANCES,
] as const satisfies readonly ResonanceDefinition[]

const V5_REBALANCED_RESONANCES = PRE_V5_RESONANCES.map(rebalanceResonanceDefinition)
const V51_REBALANCED_RESONANCES = V5_REBALANCED_RESONANCES.map(convertV5ResonanceToV2)

export const P35_REPRESENTATIVE_RESONANCES: readonly ResonanceDefinition[] = PRE_V5_RESONANCES

const CURRENT_RESONANCE_REGISTRY: readonly AnyResonanceDefinition[] = [
  ...P35_REPRESENTATIVE_RESONANCES,
  ...V5_REBALANCED_RESONANCES,
  ...V51_REBALANCED_RESONANCES,
]

const STABLE_ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/

export function canonicalResonancePair(
  firstDisciplineId: string,
  secondDisciplineId: string,
): readonly [string, string] {
  return firstDisciplineId.localeCompare(secondDisciplineId) <= 0
    ? [firstDisciplineId, secondDisciplineId]
    : [secondDisciplineId, firstDisciplineId]
}

export function validateResonanceDefinition(definition: AnyResonanceDefinition): readonly string[] {
  if (isResonanceDefinitionV2(definition)) {
    return validateResonanceDefinitionV2(definition)
  }

  const issues: string[] = []
  if (!STABLE_ID_PATTERN.test(definition.id)) issues.push('id')
  if (!Number.isSafeInteger(definition.contentVersion) || definition.contentVersion < 1) {
    issues.push('contentVersion')
  }
  if (!definition.name.trim()) issues.push('name')
  if (!definition.description.trim()) issues.push('description')
  if (
    definition.flavorLine !== undefined &&
    battleFlavorTemplateIssues(definition.flavorLine).length > 0
  ) {
    issues.push('flavorLine')
  }
  if (
    definition.authoring.validationTags.includes('owner-rebalance-v5') &&
    !definition.flavorLine?.trim()
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

  for (const [field, matcher] of [
    ['trigger.setup', definition.trigger.setup],
    ['trigger.payoff', definition.trigger.payoff],
  ] as const) {
    if (!STABLE_ID_PATTERN.test(matcher.sourceDisciplineId)) {
      issues.push(`${field}.sourceDisciplineId`)
    }
    if (
      matcher.requiredTags.length === 0 ||
      matcher.requiredTags.some((tag) => !STABLE_ID_PATTERN.test(tag))
    ) {
      issues.push(`${field}.requiredTags`)
    }
  }

  if (
    !definition.disciplinePair.includes(definition.trigger.setup.sourceDisciplineId) ||
    !definition.disciplinePair.includes(definition.trigger.payoff.sourceDisciplineId)
  ) {
    issues.push('trigger.sourceDiscipline')
  }
  if (definition.trigger.payoffEffects.length < 1 || definition.trigger.payoffEffects.length > 3) {
    issues.push('trigger.payoffEffects')
  } else {
    try {
      for (const effect of definition.trigger.payoffEffects) validateGameplayEffectMetadata(effect)
    } catch {
      issues.push('trigger.payoffEffects')
    }
  }
  if (
    !Number.isFinite(definition.trigger.aiSetupUtilityBonus) ||
    definition.trigger.aiSetupUtilityBonus < 0 ||
    !Number.isFinite(definition.trigger.aiPayoffUtilityBonus) ||
    definition.trigger.aiPayoffUtilityBonus < 0
  ) {
    issues.push('trigger.aiUtility')
  }
  if (definition.authoring.schemaVersion !== RESONANCE_SCHEMA_VERSION) {
    issues.push('authoring.schemaVersion')
  }
  return issues
}

export function resolveResonanceForPair(
  primaryDisciplineId: string,
  secondaryDisciplineId: string | null,
  contentVersion: 1 | 2,
): ResonanceDefinition | null
export function resolveResonanceForPair(
  primaryDisciplineId: string,
  secondaryDisciplineId: string | null,
  contentVersion?: number,
): AnyResonanceDefinition | null
export function resolveResonanceForPair(
  primaryDisciplineId: string,
  secondaryDisciplineId: string | null,
  contentVersion?: number,
): AnyResonanceDefinition | null {
  if (secondaryDisciplineId === null || primaryDisciplineId === secondaryDisciplineId) return null
  const pair = canonicalResonancePair(primaryDisciplineId, secondaryDisciplineId)
  const candidates = CURRENT_RESONANCE_REGISTRY.filter(
    (definition) =>
      definition.enabled &&
      definition.disciplinePair[0] === pair[0] &&
      definition.disciplinePair[1] === pair[1],
  )
  if (contentVersion !== undefined) {
    return candidates.find((definition) => definition.contentVersion === contentVersion) ?? null
  }
  return (
    [...candidates].sort((left, right) => right.contentVersion - left.contentVersion)[0] ?? null
  )
}

export function resonanceSnapshotReference(
  definition: AnyResonanceDefinition,
): ResonanceSnapshotReference {
  assertUsableResonance(definition)
  return {
    resonanceId: definition.id,
    contentVersion: definition.contentVersion,
    disciplinePair: [...definition.disciplinePair],
  }
}

export function createResonanceCombatState(
  definition: AnyResonanceDefinition,
): ResonanceCombatState {
  assertUsableResonance(definition)
  return {
    resonanceId: definition.id,
    contentVersion: definition.contentVersion,
    armedByActionId: null,
  }
}

export function forecastResonanceForSkill(
  definition: AnyResonanceDefinition,
  state: ResonanceCombatState,
  skill: MatureSkillDefinition,
): ResonanceSkillForecast {
  assertMatchingState(definition, state)
  const mechanics = normalizedResonanceMechanics(definition)
  const setupMatches = mechanics.setup ? matchesSkill(skill, mechanics.setup) : false
  const triggerMatches = matchesSkill(skill, mechanics.trigger)
  const immediate = mechanics.mode === 'immediate'
  const activates = immediate ? triggerMatches : state.armedByActionId !== null && triggerMatches
  const expires = !immediate && state.armedByActionId !== null && !activates
  const arms = !immediate && setupMatches

  return {
    willArm: arms,
    willActivate: activates,
    willExpireArmedSetup: expires,
    bonusEffects: activates ? mechanics.resultEffects : [],
    explanation: activates
      ? immediate
        ? `${definition.name} triggers immediately: this Skill gains the Resonance Result.`
        : `${definition.name} is armed: this Skill triggers the Resonance Result.`
      : arms
        ? `${definition.name} will arm its Setup after this Skill resolves successfully.`
        : expires
          ? `${definition.name}'s armed Setup will expire if this Discipline Skill is used.`
          : null,
  }
}

/** Historical single-unit payoffs require unit selection; ground casts preserve the armed setup.
 * An attack on empty ground cannot collect an actor-only payoff either.
 */
export function constrainResonanceForecastToTarget(
  forecast: ReturnType<typeof forecastResonanceForSkill>,
  skill: MatureSkillDefinition,
  selection: CombatTargetSelection,
  affectedCombatantIds: readonly string[],
): ReturnType<typeof forecastResonanceForSkill> {
  if (!forecast.willActivate || selection.kind !== 'tile') return forecast
  if (
    !forecast.bonusEffects.some((effect) => effect.recipient === 'primary-unit') &&
    (!skill.tags.includes('attack') || affectedCombatantIds.length > 0)
  )
    return forecast
  return {
    ...forecast,
    willActivate: false,
    willExpireArmedSetup: false,
    willArm: false,
    bonusEffects: [],
    explanation: forecast.bonusEffects.some((effect) => effect.recipient === 'primary-unit')
      ? 'This single-unit Resonance payoff requires a unit-targeted Skill. The armed setup is preserved.'
      : 'An attack payoff requires an eligible affected unit. The armed setup is preserved.',
  }
}

export function resonanceAiUtilityBonus(
  definition: AnyResonanceDefinition,
  state: ResonanceCombatState,
  skill: MatureSkillDefinition,
): number {
  const forecast = forecastResonanceForSkill(definition, state, skill)
  const mechanics = normalizedResonanceMechanics(definition)
  if (forecast.willActivate) return mechanics.aiTriggerUtilityBonus
  if (forecast.willArm) return mechanics.aiSetupUtilityBonus
  return 0
}

export function executeMatureSkillWithResonance(input: {
  readonly state: CombatEncounterState
  readonly resonance: AnyResonanceDefinition
  readonly resonanceState: ResonanceCombatState
  readonly skill: MatureSkillDefinition
  readonly combatContext: MatureSkillCombatContext
  readonly selection: CombatTargetSelection
  readonly content: CombatContentCatalog
}): MatureSkillResonanceTransition {
  assertMatchingState(input.resonance, input.resonanceState)
  const baseAction = toCombatActionDefinition(input.skill, input.combatContext)
  const forecast = constrainResonanceForecastToTarget(
    forecastResonanceForSkill(input.resonance, input.resonanceState, input.skill),
    input.skill,
    input.selection,
    evaluateCombatAction(input.state, baseAction, input.selection, input.content)
      .affectedCombatantIds,
  )
  const action = forecast.willActivate
    ? { ...baseAction, effects: [...baseAction.effects, ...forecast.bonusEffects] }
    : baseAction

  const resolution = executeCombatAction(input.state, action, input.selection, input.content)
  const actorId = resolution.events.find((event) => event.event === 'combat_action_used')?.actorId
  if (!actorId) throw new Error('Resonance Skill resolution did not emit a combat action event.')

  const resonanceEvents: ResonanceCombatEvent[] = []
  let nextArmedByActionId = input.resonanceState.armedByActionId

  if (forecast.willActivate) {
    resonanceEvents.push({
      event: 'resonance_activated',
      resonanceId: input.resonance.id,
      contentVersion: input.resonance.contentVersion,
      actorId,
      setupActionId: input.resonanceState.armedByActionId,
      triggerActionId: input.skill.id,
      payoffActionId: input.skill.id,
    })
    nextArmedByActionId = null
  } else if (forecast.willExpireArmedSetup && input.resonanceState.armedByActionId) {
    resonanceEvents.push({
      event: 'resonance_expired',
      resonanceId: input.resonance.id,
      contentVersion: input.resonance.contentVersion,
      actorId,
      setupActionId: input.resonanceState.armedByActionId,
      interruptedByActionId: input.skill.id,
    })
    nextArmedByActionId = null
  }

  if (forecast.willArm) {
    resonanceEvents.push({
      event: 'resonance_armed',
      resonanceId: input.resonance.id,
      contentVersion: input.resonance.contentVersion,
      actorId,
      setupActionId: input.skill.id,
    })
    nextArmedByActionId = input.skill.id
  }

  return {
    state: resolution.state,
    resonanceState: {
      resonanceId: input.resonance.id,
      contentVersion: input.resonance.contentVersion,
      armedByActionId: nextArmedByActionId,
    },
    events: insertResonanceEventsAfterActionUse(resolution.events, resonanceEvents),
  }
}

function insertResonanceEventsAfterActionUse(
  combatEvents: readonly CombatResolutionEvent[],
  resonanceEvents: readonly ResonanceCombatEvent[],
): readonly (CombatResolutionEvent | ResonanceCombatEvent)[] {
  if (resonanceEvents.length === 0) return combatEvents
  const actionIndex = combatEvents.findIndex((event) => event.event === 'combat_action_used')
  if (actionIndex < 0) return [...resonanceEvents, ...combatEvents]
  return [
    ...combatEvents.slice(0, actionIndex + 1),
    ...resonanceEvents,
    ...combatEvents.slice(actionIndex + 1),
  ]
}

function matchesSkill(skill: MatureSkillDefinition, matcher: ResonanceSkillMatcher): boolean {
  return (
    skill.sourceDisciplineId === matcher.sourceDisciplineId &&
    matcher.requiredTags.every((tag) => skill.tags.includes(tag))
  )
}

function assertUsableResonance(definition: AnyResonanceDefinition): void {
  const issues = validateResonanceDefinition(definition)
  if (issues.length > 0) throw new TypeError(`Invalid Resonance definition: ${issues.join(', ')}.`)
  if (!definition.enabled) throw new RangeError('That Resonance version is disabled.')
}

function assertMatchingState(
  definition: AnyResonanceDefinition,
  state: ResonanceCombatState,
): void {
  assertUsableResonance(definition)
  if (state.resonanceId !== definition.id || state.contentVersion !== definition.contentVersion) {
    throw new RangeError('Resonance combat state does not match the active definition version.')
  }
}
