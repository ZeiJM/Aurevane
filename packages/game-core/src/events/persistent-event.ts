export const PERSISTENT_EVENT_SCHEMA_VERSION = 1 as const

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

export interface EventObjectiveDefinition {
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
  ended: ['archived'],
  archived: [],
  cancelled: ['archived'],
  'emergency-stopped': ['archived'],
}

function identity(value: string, label: string): void {
  if (!/^[a-z0-9][a-z0-9._:-]{1,159}$/.test(value)) {
    throw new TypeError(`${label} must be a stable lowercase identity.`)
  }
}

function shortText(value: string, label: string, max: number): void {
  if (value.trim() !== value || value.length < 1 || value.length > max) {
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

    if (phase.objectives.length > 48) throw new RangeError('A phase may define at most 48 objectives.')
    const phaseObjectiveIds = new Set<string>()
    for (const objective of phase.objectives) {
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
