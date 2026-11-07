import {
  PERSONAL_QUEST_GIVERS,
  isPersonalQuestGiver,
  type PersonalJourney,
} from './personal-journey'

export * from './personal-journey'

export const PERSISTENT_EVENT_SCHEMA_VERSION = 1 as const

export const EVENT_CATEGORY_LABELS = {
  'world-events': 'World Events',
  'story-campaigns': 'Story Campaigns',
  'repeatable-activities': 'Repeatable Activities',
  'hidden-discoveries': 'Hidden Discoveries',
} as const

export type EventCategory = keyof typeof EVENT_CATEGORY_LABELS

export const EVENT_CATEGORIES = Object.keys(EVENT_CATEGORY_LABELS) as EventCategory[]

export function isEventCategory(value: unknown): value is EventCategory {
  return typeof value === 'string' && Object.hasOwn(EVENT_CATEGORY_LABELS, value)
}

export function resolveEventCategory(definition: {
  readonly category?: unknown
  readonly family?: unknown
}): EventCategory {
  if (isEventCategory(definition.category)) return definition.category
  // Legacy snapshots predate categories. Family remains the only categorization signal.
  if (definition.family === 'narrative-event') return 'story-campaigns'
  if (definition.family === 'lore-revelation') return 'hidden-discoveries'
  return 'world-events'
}

export const EVENT_FAMILIES = [
  'world-crisis',
  'regional-event',
  'narrative-event',
  'community-objective',
  'legendary-hunt',
  'expedition-event',
  'pvp-event',
  'seasonal-event',
  'nation-event',
  'profession-event',
  'micro-event',
  'lore-revelation',
] as const

export type EventFamily = (typeof EVENT_FAMILIES)[number]

export type EventScope =
  | { readonly type: 'global' }
  | { readonly type: 'region'; readonly key: string }
  | { readonly type: 'node'; readonly key: string }
  | { readonly type: 'cohort'; readonly key: string }

export const EVENT_EFFECT_TYPES = [
  'map-marker',
  'event-node',
  'encounter-pool',
  'quest-package',
  'npc-presentation',
  'temporary-vendor',
  'world-pulse',
  'ambience',
  'reward-modifier',
  'region-presentation',
] as const

export type EventEffectType = (typeof EVENT_EFFECT_TYPES)[number]

export interface EventEffectReference {
  readonly type: EventEffectType
  readonly referenceKey: string
  readonly enabled: boolean
}

export const EVENT_OBJECTIVE_TYPES = [
  'defeat',
  'quest',
  'expedition',
  'pvp',
  'gather',
  'craft',
  'discover',
  'interact',
  'protect',
  'community-threshold',
  'narrative-choice',
  'lore-discovery',
] as const

export type EventObjectiveType = (typeof EVENT_OBJECTIVE_TYPES)[number]

export interface EventWorldNavigation {
  readonly sectorId: string
  readonly x: number
  readonly y: number
  readonly autoPath: boolean
  readonly guidance: 'exact' | 'clue'
}

export interface EventObjectiveDefinition {
  readonly worldNavigation?: EventWorldNavigation | null
  readonly completion?: 'world-arrival'
  readonly id: string
  readonly type: EventObjectiveType
  readonly referenceKey: string
  readonly target: number
}

export type EventPhaseTransition =
  | { readonly type: 'manual' }
  | { readonly type: 'elapsed'; readonly afterSeconds: number }
  | { readonly type: 'scheduled'; readonly at: string }
  | { readonly type: 'objective-threshold'; readonly objectiveId: string }

export interface PersistentEventPhaseDefinition {
  readonly id: string
  readonly name: string
  readonly objectives: readonly EventObjectiveDefinition[]
  readonly effects: readonly EventEffectReference[]
  readonly cleanupEffects: readonly EventEffectReference[]
  readonly transition: EventPhaseTransition
}

export interface PersistentEventDefinition {
  readonly schemaVersion: typeof PERSISTENT_EVENT_SCHEMA_VERSION
  readonly eventKey: string
  readonly templateKey: string
  readonly contentVersion: number
  readonly title: string
  readonly summary: string
  readonly internalNotes: string
  readonly family: EventFamily
  readonly category?: EventCategory
  readonly personalJourney?: PersonalJourney
  readonly scope: EventScope
  readonly phases: readonly PersistentEventPhaseDefinition[]
  readonly rewardPackageRefs: readonly string[]
  readonly aftermathRefs: readonly string[]
}

export const EVENT_RUN_STATUSES = [
  'preview',
  'scheduled',
  'live',
  'paused',
  'resolving',
  'ended',
  'archived',
  'cancelled',
  'emergency-stopped',
] as const

export type EventRunStatus = (typeof EVENT_RUN_STATUSES)[number]

const EVENT_RUN_TRANSITIONS: Readonly<Record<EventRunStatus, readonly EventRunStatus[]>> = {
  preview: ['cancelled', 'archived'],
  scheduled: ['live', 'cancelled', 'emergency-stopped'],
  live: ['paused', 'resolving', 'emergency-stopped'],
  paused: ['live', 'resolving', 'emergency-stopped'],
  resolving: ['ended', 'emergency-stopped'],
  ended: ['archived', 'emergency-stopped'],
  archived: [],
  cancelled: ['archived'],
  'emergency-stopped': ['archived'],
}

function identity(value: string, label: string): void {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9._:-]{1,159}$/.test(value)) {
    throw new TypeError(`${label} must be a stable lowercase identity.`)
  }
}

function shortText(value: string, label: string, max: number): void {
  if (
    typeof value !== 'string' ||
    value.trim() !== value ||
    value.length < 1 ||
    value.length > max
  ) {
    throw new TypeError(`${label} must be 1–${max} characters with no outer whitespace.`)
  }
}

function positiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive safe integer.`)
  }
}

function isoTimestamp(value: string, label: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new TypeError(`${label} must be an ISO timestamp.`)
}

export function validatePersistentEventDefinition(definition: PersistentEventDefinition): void {
  if (definition.schemaVersion !== PERSISTENT_EVENT_SCHEMA_VERSION) {
    throw new TypeError('Unsupported persistent event schema version.')
  }
  identity(definition.eventKey, 'Event key')
  identity(definition.templateKey, 'Template key')
  positiveSafeInteger(definition.contentVersion, 'Content version')
  shortText(definition.title, 'Event title', 120)
  shortText(definition.summary, 'Event summary', 600)
  if (definition.internalNotes.length > 4000) {
    throw new TypeError('Internal notes must be 4000 characters or fewer.')
  }
  if (!(EVENT_FAMILIES as readonly string[]).includes(definition.family)) {
    throw new TypeError('Unknown event family.')
  }

  if (definition.category !== undefined && !isEventCategory(definition.category)) {
    throw new TypeError('Unknown event category.')
  }

  if (!['global', 'region', 'node', 'cohort'].includes(definition.scope.type)) {
    throw new TypeError('Unknown event scope type.')
  }
  if (definition.scope.type !== 'global') identity(definition.scope.key, 'Event scope key')

  if (definition.phases.length < 1 || definition.phases.length > 24) {
    throw new RangeError('An event requires 1–24 phases.')
  }
  const phaseIds = new Set<string>()
  const objectiveIds = new Set<string>()
  for (const phase of definition.phases) {
    identity(phase.id, 'Phase id')
    shortText(phase.name, 'Phase name', 100)
    if (phaseIds.has(phase.id)) throw new TypeError(`Duplicate event phase ${phase.id}.`)
    phaseIds.add(phase.id)

    if (phase.objectives.length > 48) {
      throw new RangeError('A phase may define at most 48 objectives.')
    }
    const phaseObjectiveIds = new Set<string>()
    for (const objective of phase.objectives) {
      if (objective.worldNavigation != null) {
        const navigation = objective.worldNavigation
        identity(navigation.sectorId, 'World sector')
        if (
          !Number.isInteger(navigation.x) ||
          navigation.x < 0 ||
          navigation.x > 12 ||
          !Number.isInteger(navigation.y) ||
          navigation.y < 0 ||
          navigation.y > 8 ||
          typeof navigation.autoPath !== 'boolean' ||
          !['exact', 'clue'].includes(navigation.guidance)
        ) {
          throw new TypeError(
            'World navigation requires a square-grid destination, guidance and auto-path policy.',
          )
        }
      }
      if (objective.completion !== undefined) {
        const sectorId = objective.worldNavigation?.sectorId
        const scope = definition.scope
        const publicScope =
          scope.type === 'global' ||
          (scope.type === 'region' &&
            (scope.key === sectorId || scope.key === `region.${sectorId}`))
        if (
          objective.completion !== 'world-arrival' ||
          objective.type !== 'discover' ||
          !sectorId ||
          !publicScope ||
          resolveEventCategory(definition) !== 'world-events'
        ) {
          throw new TypeError(
            'Reach a location needs a map destination inside a public World Event audience.',
          )
        }
      }
      identity(objective.id, 'Objective id')
      identity(objective.referenceKey, 'Objective reference')
      positiveSafeInteger(objective.target, 'Objective target')
      if (!(EVENT_OBJECTIVE_TYPES as readonly string[]).includes(objective.type)) {
        throw new TypeError('Unknown event objective type.')
      }
      if (objectiveIds.has(objective.id)) {
        throw new TypeError(`Duplicate event objective ${objective.id}.`)
      }
      objectiveIds.add(objective.id)
      phaseObjectiveIds.add(objective.id)
    }

    for (const effect of [...phase.effects, ...phase.cleanupEffects]) {
      identity(effect.referenceKey, 'Event effect reference')
      if (!(EVENT_EFFECT_TYPES as readonly string[]).includes(effect.type)) {
        throw new TypeError('Unknown event effect type.')
      }
      if (typeof effect.enabled !== 'boolean') {
        throw new TypeError('Event effect enabled must be boolean.')
      }
    }

    if (phase.transition.type === 'elapsed') {
      positiveSafeInteger(phase.transition.afterSeconds, 'Elapsed phase transition seconds')
    } else if (phase.transition.type === 'scheduled') {
      isoTimestamp(phase.transition.at, 'Scheduled phase transition')
    } else if (phase.transition.type === 'objective-threshold') {
      identity(phase.transition.objectiveId, 'Transition objective id')
      if (!phaseObjectiveIds.has(phase.transition.objectiveId)) {
        throw new TypeError(
          'Objective-threshold transition must reference an objective in the same phase.',
        )
      }
    }
  }

  if (definition.personalJourney !== undefined) {
    const journey = definition.personalJourney
    if (
      !journey ||
      (journey.type !== 'travel-and-report' && journey.type !== 'item-exchange') ||
      !isPersonalQuestGiver(journey.giverId) ||
      resolveEventCategory(definition) !== 'story-campaigns'
    ) {
      throw new TypeError('A personal journey needs a Story Campaign and a known quest giver.')
    }
    const giver = PERSONAL_QUEST_GIVERS[journey.giverId].position
    const { scope, phases, rewardPackageRefs } = definition
    if (
      scope.type !== 'global' &&
      (scope.type !== 'region' ||
        (scope.key !== giver.sectorId && scope.key !== `region.${giver.sectorId}`))
    ) {
      throw new TypeError('The audience must include the quest giver’s region.')
    }
    if (
      phases.length !== 1 ||
      phases[0]?.transition.type !== 'manual' ||
      phases[0].objectives.length ||
      phases[0].effects.length ||
      phases[0].cleanupEffects.length ||
      definition.aftermathRefs.length
    ) {
      throw new TypeError(
        'A personal journey uses one manual phase without shared objectives or effects.',
      )
    }
    if (
      rewardPackageRefs.length > 8 ||
      new Set(rewardPackageRefs).size !== rewardPackageRefs.length
    ) {
      throw new TypeError('Choose at most eight distinct fixed XP reward packages.')
    }
    if (journey.type === 'travel-and-report') {
      const destination = journey.destination
      if (
        !destination ||
        !Number.isInteger(destination.x) ||
        destination.x < 0 ||
        destination.x > 12 ||
        !Number.isInteger(destination.y) ||
        destination.y < 0 ||
        destination.y > 8 ||
        (destination.sectorId === giver.sectorId &&
          destination.x === giver.x &&
          destination.y === giver.y)
      ) {
        throw new TypeError('Choose a quest destination away from the giver.')
      }
      identity(destination.sectorId, 'Quest destination sector')
    } else {
      const itemId = /^[a-z0-9]+([._-][a-z0-9]+)*$/
      if (
        typeof journey.inputItemId !== 'string' ||
        typeof journey.outputItemId !== 'string' ||
        journey.inputItemId.length > 160 ||
        journey.outputItemId.length > 160 ||
        !itemId.test(journey.inputItemId) ||
        !itemId.test(journey.outputItemId) ||
        journey.inputItemId === journey.outputItemId
      ) {
        throw new TypeError('Choose two different Items for the exchange.')
      }
      if (
        !Number.isInteger(journey.inputQuantity) ||
        journey.inputQuantity < 1 ||
        journey.inputQuantity > 999
      ) {
        throw new TypeError('Choose an exchange quantity from 1 to 999.')
      }
      if (rewardPackageRefs.length)
        throw new TypeError('An item exchange awards the selected Item and access.')
    }
    for (const [label, text] of [
      ['Offer', journey.offer],
      ['In progress', journey.active],
      ['Ready', journey.ready],
      ['Completion', journey.completed],
    ] as const) {
      shortText(text, `${label} dialogue`, 800)
    }
  }

  for (const ref of [...definition.rewardPackageRefs, ...definition.aftermathRefs]) {
    identity(ref, 'Referenced content key')
  }
}

export function assertEventRunTransition(from: EventRunStatus, to: EventRunStatus): void {
  if (!EVENT_RUN_TRANSITIONS[from].includes(to)) {
    throw new TypeError(`Event run cannot transition from ${from} to ${to}.`)
  }
}

export function isTerminalEventRunStatus(status: EventRunStatus): boolean {
  return status === 'archived'
}
