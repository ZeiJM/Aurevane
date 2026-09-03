import {
  executeCombatAction,
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
  readonly trigger: ResonanceSkillSequenceTrigger
  readonly media: ResonanceMediaHooks
  readonly authoring: {
    readonly schemaVersion: typeof RESONANCE_SCHEMA_VERSION
    readonly status: 'representative' | 'production'
    readonly validationTags: readonly string[]
  }
}

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
      readonly setupActionId: string
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

export const P35_REPRESENTATIVE_RESONANCES = [
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
] as const satisfies readonly ResonanceDefinition[]

const STABLE_ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/

export function canonicalResonancePair(
  firstDisciplineId: string,
  secondDisciplineId: string,
): readonly [string, string] {
  return firstDisciplineId.localeCompare(secondDisciplineId) <= 0
    ? [firstDisciplineId, secondDisciplineId]
    : [secondDisciplineId, firstDisciplineId]
}

export function validateResonanceDefinition(
  definition: ResonanceDefinition,
): readonly string[] {
  const issues: string[] = []
  if (!STABLE_ID_PATTERN.test(definition.id)) issues.push('id')
  if (!Number.isSafeInteger(definition.contentVersion) || definition.contentVersion < 1) {
    issues.push('contentVersion')
  }
  if (!definition.name.trim()) issues.push('name')
  if (!definition.description.trim()) issues.push('description')

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
  if (
    definition.trigger.payoffEffects.length < 1 ||
    definition.trigger.payoffEffects.length > 3
  ) {
    issues.push('trigger.payoffEffects')
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
  contentVersion?: number,
): ResonanceDefinition | null {
  if (secondaryDisciplineId === null || primaryDisciplineId === secondaryDisciplineId) return null
  const pair = canonicalResonancePair(primaryDisciplineId, secondaryDisciplineId)
  const candidates = P35_REPRESENTATIVE_RESONANCES.filter(
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
  definition: ResonanceDefinition,
): ResonanceSnapshotReference {
  assertUsableResonance(definition)
  return {
    resonanceId: definition.id,
    contentVersion: definition.contentVersion,
    disciplinePair: [...definition.disciplinePair],
  }
}

export function createResonanceCombatState(
  definition: ResonanceDefinition,
): ResonanceCombatState {
  assertUsableResonance(definition)
  return {
    resonanceId: definition.id,
    contentVersion: definition.contentVersion,
    armedByActionId: null,
  }
}

export function forecastResonanceForSkill(
  definition: ResonanceDefinition,
  state: ResonanceCombatState,
  skill: MatureSkillDefinition,
): ResonanceSkillForecast {
  assertMatchingState(definition, state)
  const setup = matchesSkill(skill, definition.trigger.setup)
  const payoff = state.armedByActionId !== null && matchesSkill(skill, definition.trigger.payoff)
  const expires = state.armedByActionId !== null && !payoff

  return {
    willArm: setup,
    willActivate: payoff,
    willExpireArmedSetup: expires,
    bonusEffects: payoff ? definition.trigger.payoffEffects : [],
    explanation: payoff
      ? `${definition.name} is armed: this Skill gains the Resonance payoff.`
      : setup
        ? `${definition.name} will arm after this Skill resolves successfully.`
        : expires
          ? `${definition.name}'s armed setup will expire if this Discipline Skill is used.`
          : null,
  }
}

export function resonanceAiUtilityBonus(
  definition: ResonanceDefinition,
  state: ResonanceCombatState,
  skill: MatureSkillDefinition,
): number {
  const forecast = forecastResonanceForSkill(definition, state, skill)
  if (forecast.willActivate) return definition.trigger.aiPayoffUtilityBonus
  if (forecast.willArm) return definition.trigger.aiSetupUtilityBonus
  return 0
}

export function executeMatureSkillWithResonance(input: {
  readonly state: CombatEncounterState
  readonly resonance: ResonanceDefinition
  readonly resonanceState: ResonanceCombatState
  readonly skill: MatureSkillDefinition
  readonly combatContext: MatureSkillCombatContext
  readonly selection: CombatTargetSelection
  readonly content: CombatContentCatalog
}): MatureSkillResonanceTransition {
  assertMatchingState(input.resonance, input.resonanceState)
  const forecast = forecastResonanceForSkill(input.resonance, input.resonanceState, input.skill)
  const baseAction = toCombatActionDefinition(input.skill, input.combatContext)
  const action = forecast.willActivate
    ? { ...baseAction, effects: [...baseAction.effects, ...forecast.bonusEffects] }
    : baseAction

  const resolution = executeCombatAction(input.state, action, input.selection, input.content)
  const actorId = resolution.events.find((event) => event.event === 'combat_action_used')?.actorId
  if (!actorId) throw new Error('Resonance Skill resolution did not emit a combat action event.')

  const resonanceEvents: ResonanceCombatEvent[] = []
  let nextArmedByActionId = input.resonanceState.armedByActionId

  if (forecast.willActivate && input.resonanceState.armedByActionId) {
    resonanceEvents.push({
      event: 'resonance_activated',
      resonanceId: input.resonance.id,
      contentVersion: input.resonance.contentVersion,
      actorId,
      setupActionId: input.resonanceState.armedByActionId,
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

function assertUsableResonance(definition: ResonanceDefinition): void {
  const issues = validateResonanceDefinition(definition)
  if (issues.length > 0) throw new TypeError(`Invalid Resonance definition: ${issues.join(', ')}.`)
  if (!definition.enabled) throw new RangeError('That Resonance version is disabled.')
}

function assertMatchingState(
  definition: ResonanceDefinition,
  state: ResonanceCombatState,
): void {
  assertUsableResonance(definition)
  if (
    state.resonanceId !== definition.id ||
    state.contentVersion !== definition.contentVersion
  ) {
    throw new RangeError('Resonance combat state does not match the active definition version.')
  }
}
