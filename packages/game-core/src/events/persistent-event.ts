import { isWorldWeather, type WorldWeather } from '../world/weather'
import {
  PERSONAL_QUEST_GIVERS,
  isPersonalQuestGiver,
  isPersonalJourneyNpcId,
  type PersonalCombatDiscovery,
  type PersonalHuntJourney,
  type PersonalJourney,
  type PersonalInventoryDiscovery,
  type PersonalTravelJourney,
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
  readonly requiredWeather?: WorldWeather
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

export type EventRecurrence =
  | { readonly mode: 'rolling-24h' }
  | {
      readonly mode: 'calendar-day' | 'calendar-week'
      readonly timeZone: string
      readonly resetMinute: number
    }

export interface RepeatableTravel {
  readonly journey: PersonalTravelJourney | PersonalHuntJourney
  readonly recurrence: EventRecurrence
}

export interface MentorChallenge {
  readonly opponentNpcId: string
  readonly offer: string
  readonly victory: string
  readonly defeat: string
  readonly victoryRewardPackageRef: string
  readonly defeatRewardPackageRef: string
  readonly fastVictory?: { readonly withinSeconds: number; readonly rewardPackageRef: string }
  readonly recurrence: EventRecurrence
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
  readonly inventoryDiscovery?: PersonalInventoryDiscovery
  readonly combatDiscovery?: PersonalCombatDiscovery
  readonly mentorChallenge?: MentorChallenge
  readonly repeatableTravel?: RepeatableTravel
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

function isPersonalItemIdentity(value: unknown): value is string {
  return (
    typeof value === 'string' && value.length <= 160 && /^[a-z0-9]+([._-][a-z0-9]+)*$/.test(value)
  )
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

function validateInventoryRestoration(discovery: PersonalInventoryDiscovery): void {
  const { restoration } = discovery
  if (restoration === undefined) return
  const dialogueFields = ['offer', 'travel', 'ready', 'completed'] as const
  const allowedFields = [
    'giverNpcId',
    'checkpoint',
    'outputItemId',
    'trial',
    'recoveryRewardPackageRef',
    ...dialogueFields,
  ]
  if (
    !restoration ||
    typeof restoration !== 'object' ||
    Array.isArray(restoration) ||
    Object.keys(restoration).some((key) => !allowedFields.includes(key))
  ) {
    throw new TypeError('The restoration route must contain only supported fields.')
  }
  if (!isPersonalJourneyNpcId(restoration.giverNpcId)) {
    throw new TypeError('Choose a published World and Story NPC as the restoration giver.')
  }
  if (
    !isPersonalItemIdentity(restoration.outputItemId) ||
    restoration.outputItemId === discovery.firstItemId ||
    restoration.outputItemId === discovery.secondItemId
  ) {
    throw new TypeError('Choose a restoration weapon Item identity distinct from both fragments.')
  }
  const { checkpoint } = restoration
  if (
    !checkpoint ||
    typeof checkpoint !== 'object' ||
    Array.isArray(checkpoint) ||
    Object.keys(checkpoint).some((key) => !['sectorId', 'x', 'y'].includes(key)) ||
    !Number.isInteger(checkpoint.x) ||
    checkpoint.x < 0 ||
    checkpoint.x > 12 ||
    !Number.isInteger(checkpoint.y) ||
    checkpoint.y < 0 ||
    checkpoint.y > 8
  ) {
    throw new TypeError('Choose a restoration checkpoint with a World sector and valid grid cell.')
  }
  identity(checkpoint.sectorId, 'Restoration checkpoint sector')
  for (const field of dialogueFields) {
    shortText(restoration[field], `Restoration ${field} dialogue`, 800)
  }

  const { trial, recoveryRewardPackageRef } = restoration
  if (trial === undefined && recoveryRewardPackageRef === undefined) return
  if (trial === undefined || recoveryRewardPackageRef === undefined) {
    throw new TypeError(
      'Restoration trial and recovery Character XP packages must be set together.',
    )
  }
  const trialDialogueFields = ['offer', 'active', 'ready'] as const
  const trialFields = ['npcId', 'rewardPackageRef', ...trialDialogueFields]
  if (
    !trial ||
    typeof trial !== 'object' ||
    Array.isArray(trial) ||
    Object.keys(trial).some((key) => !trialFields.includes(key))
  ) {
    throw new TypeError('The restoration trial must contain only supported fields.')
  }
  if (!isPersonalJourneyNpcId(trial.npcId)) {
    throw new TypeError('For the restoration trial, choose a published World encounter NPC.')
  }
  for (const field of trialDialogueFields) {
    shortText(trial[field], `Restoration trial ${field} dialogue`, 800)
  }
  identity(recoveryRewardPackageRef, 'Restoration recovery reward package')
  identity(trial.rewardPackageRef, 'Restoration trial reward package')
  if (recoveryRewardPackageRef === trial.rewardPackageRef) {
    throw new TypeError('Restoration trial and recovery require different Character XP packages.')
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

function validatePrivateQuestPhase(
  definition: PersistentEventDefinition,
  subject = 'A personal journey',
): void {
  const { phases, aftermathRefs } = definition
  if (
    phases.length !== 1 ||
    phases[0]?.transition.type !== 'manual' ||
    phases[0].objectives.length ||
    phases[0].effects.length ||
    phases[0].cleanupEffects.length ||
    aftermathRefs.length
  ) {
    throw new TypeError(`${subject} uses one manual phase without shared objectives or effects.`)
  }
}

function validateCalendarReset(timeZone: string, resetMinute: number): void {
  try {
    if (typeof timeZone !== 'string' || !timeZone) throw new Error()
    new Intl.DateTimeFormat('en', { timeZone })
  } catch {
    throw new TypeError('Choose a valid calendar timezone.')
  }
  if (!Number.isInteger(resetMinute) || resetMinute < 0 || resetMinute > 1439) {
    throw new TypeError('Choose a calendar reset time from 00:00 to 23:59.')
  }
}

function validateMentorChallenge(
  definition: PersistentEventDefinition,
  mentor: MentorChallenge,
): void {
  if (
    resolveEventCategory(definition) !== 'repeatable-activities' ||
    definition.scope.type !== 'global' ||
    definition.personalJourney !== undefined ||
    definition.repeatableTravel !== undefined ||
    definition.combatDiscovery !== undefined ||
    definition.inventoryDiscovery !== undefined ||
    definition.rewardPackageRefs.length
  ) {
    throw new TypeError(
      'A Mentor challenge requires a global Repeatable Activity with its own rewards.',
    )
  }
  validatePrivateQuestPhase(definition, 'A Mentor challenge')
  if (!mentor || !isPersonalJourneyNpcId(mentor.opponentNpcId))
    throw new TypeError('Choose a published World encounter for the Mentor.')
  shortText(mentor.offer, 'Mentor offer', 800)
  shortText(mentor.victory, 'Victory dialogue', 800)
  shortText(mentor.defeat, 'Defeat dialogue', 800)
  const rewards = [mentor.victoryRewardPackageRef, mentor.defeatRewardPackageRef]
  if (mentor.fastVictory !== undefined) {
    const bonus = mentor.fastVictory
    if (
      !bonus ||
      !Number.isInteger(bonus.withinSeconds) ||
      bonus.withinSeconds < 1 ||
      bonus.withinSeconds > 3600
    )
      throw new TypeError('Choose a fast victory threshold from 1 to 3,600 seconds.')
    rewards.push(bonus.rewardPackageRef)
  }
  for (const reward of rewards) identity(reward, 'Mentor Character XP package')
  if (new Set(rewards).size !== rewards.length)
    throw new TypeError('Choose a different Character XP package for each Mentor reward.')
  const policy = mentor.recurrence
  if (!policy || !['rolling-24h', 'calendar-day', 'calendar-week'].includes(policy.mode))
    throw new TypeError('Choose a supported recurrence.')
  if (policy.mode !== 'rolling-24h') validateCalendarReset(policy.timeZone, policy.resetMinute)
}

function validateCombatDiscovery(definition: PersistentEventDefinition): void {
  const {
    combatDiscovery: discovery,
    inventoryDiscovery,
    personalJourney,
    repeatableTravel,
    scope,
    rewardPackageRefs,
  } = definition
  if (
    inventoryDiscovery !== undefined ||
    personalJourney !== undefined ||
    repeatableTravel !== undefined
  )
    throw new TypeError('Choose only one discovery or personal journey per Event.')
  if (resolveEventCategory(definition) !== 'hidden-discoveries' || scope.type !== 'global')
    throw new TypeError('A daily combat discovery requires a global Hidden Discovery.')
  validatePrivateQuestPhase(definition, 'A daily combat discovery')
  if (rewardPackageRefs.length)
    throw new TypeError('Choose the combat discovery XP packages without shared Event rewards.')
  const fields = [
    'npcTag',
    'requiredDefeats',
    'timeZone',
    'resetMinute',
    'opponentNpcId',
    'mode',
    'ready',
    'completed',
    'firstRewardPackageRef',
    'repeatRewardPackageRef',
  ]
  if (
    !discovery ||
    typeof discovery !== 'object' ||
    Array.isArray(discovery) ||
    Object.keys(discovery).some((field) => !fields.includes(field))
  )
    throw new TypeError('The daily combat discovery must contain only supported fields.')
  if (typeof discovery.npcTag !== 'string' || !/^[a-z][a-z0-9-]{1,31}$/.test(discovery.npcTag))
    throw new TypeError(
      'Enter a World encounter tag with 2–32 lowercase letters, digits or hyphens, starting with a letter.',
    )
  if (
    !Number.isInteger(discovery.requiredDefeats) ||
    discovery.requiredDefeats < 1 ||
    discovery.requiredDefeats > 50
  )
    throw new TypeError('Choose a required daily defeat count from 1 to 50.')
  if (typeof discovery.timeZone !== 'string' || !/^[A-Za-z]/.test(discovery.timeZone))
    throw new TypeError('Choose a valid calendar timezone.')
  validateCalendarReset(discovery.timeZone, discovery.resetMinute)
  if (!isPersonalJourneyNpcId(discovery.opponentNpcId))
    throw new TypeError('Choose a published World encounter NPC for the challenge.')
  if (discovery.mode !== 'evergreen' && discovery.mode !== 'seasonal')
    throw new TypeError('Choose Evergreen or Seasonal challenge availability.')
  shortText(discovery.ready, 'Challenge revealed dialogue', 800)
  shortText(discovery.completed, 'Challenge completed dialogue', 800)
  identity(discovery.firstRewardPackageRef, 'First-clear Character XP package')
  if (discovery.repeatRewardPackageRef !== undefined)
    identity(discovery.repeatRewardPackageRef, 'Repeat Character XP package')
}

function validateJourneyDialogue(journey: PersonalJourney | PersonalHuntJourney): void {
  for (const [label, text] of [
    ['Offer', journey.offer],
    ['In progress', journey.active],
    ['Ready', journey.ready],
    ['Completion', journey.completed],
  ] as const)
    shortText(text, `${label} dialogue`, 800)
}

function validateRepeatableHunt(
  journey: PersonalHuntJourney,
  definition: PersistentEventDefinition,
): void {
  const fields = [
    'type',
    'giverId',
    'npcTag',
    'requiredDefeats',
    'rewardPackageRef',
    'offer',
    'active',
    'ready',
    'completed',
  ]
  if (Object.keys(journey).some((field) => !fields.includes(field)))
    throw new TypeError('Unknown hunt field.')
  if (!isPersonalJourneyNpcId(journey.giverId))
    throw new TypeError('Choose a published World and Story NPC as the hunt giver.')
  if (typeof journey.npcTag !== 'string' || !/^[a-z][a-z0-9-]{1,31}$/.test(journey.npcTag))
    throw new TypeError(
      'Enter a World encounter tag with 2–32 lowercase letters, digits or hyphens, starting with a letter.',
    )
  if (
    !Number.isInteger(journey.requiredDefeats) ||
    journey.requiredDefeats < 1 ||
    journey.requiredDefeats > 25
  )
    throw new TypeError('Choose a required defeat count from 1 to 25.')
  identity(journey.rewardPackageRef, 'Hunt Character XP reward')
  if (definition.scope.type !== 'global')
    throw new TypeError('Choose Global audience in Setup for a World hunt.')
  validatePrivateQuestPhase(definition)
  validateJourneyDialogue(journey)
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
      if (
        objective.requiredWeather !== undefined &&
        (objective.completion !== 'world-arrival' || !isWorldWeather(objective.requiredWeather))
      ) {
        throw new TypeError('Choose a supported World weather condition for a confirmed arrival.')
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

  if (definition.mentorChallenge !== undefined)
    validateMentorChallenge(definition, definition.mentorChallenge)
  if (definition.combatDiscovery !== undefined) validateCombatDiscovery(definition)

  if (definition.inventoryDiscovery !== undefined) {
    const discovery = definition.inventoryDiscovery
    if (
      !discovery ||
      typeof discovery !== 'object' ||
      Object.keys(discovery).some(
        (key) => !['firstItemId', 'secondItemId', 'clue', 'restoration'].includes(key),
      ) ||
      !isPersonalItemIdentity(discovery.firstItemId) ||
      !isPersonalItemIdentity(discovery.secondItemId) ||
      discovery.firstItemId === discovery.secondItemId
    ) {
      throw new TypeError('Choose two different carried Item identities for the discovery.')
    }
    const { scope, phases, personalJourney, rewardPackageRefs, aftermathRefs } = definition
    if (
      resolveEventCategory(definition) !== 'hidden-discoveries' ||
      scope.type !== 'global' ||
      personalJourney !== undefined ||
      phases.length !== 1 ||
      phases[0]?.transition.type !== 'manual' ||
      phases[0].objectives.length ||
      phases[0].effects.length ||
      phases[0].cleanupEffects.length ||
      rewardPackageRefs.length ||
      aftermathRefs.length
    ) {
      throw new TypeError(
        'Carried Item discovery requires a global Hidden Discovery with one manual phase and no shared effects or rewards.',
      )
    }
    shortText(discovery.clue, 'Revealed clue', 800)
    validateInventoryRestoration(discovery)
  }

  if (definition.repeatableTravel !== undefined) {
    const repeatable = definition.repeatableTravel
    const journey = repeatable?.journey
    if (
      (journey?.type !== 'travel-and-report' && journey?.type !== 'defeat-and-report') ||
      definition.personalJourney !== undefined ||
      resolveEventCategory(definition) !== 'repeatable-activities'
    ) {
      throw new TypeError(
        'A repeatable journey requires a Repeatable Activity with one travel or defeat objective.',
      )
    }
    if (definition.rewardPackageRefs.length || definition.aftermathRefs.length) {
      throw new TypeError('Repeatable journeys cannot use shared rewards or aftermath.')
    }
    const policy = repeatable.recurrence
    if (!policy || !['rolling-24h', 'calendar-day', 'calendar-week'].includes(policy.mode))
      throw new TypeError('Choose a supported recurrence.')
    if (policy.mode !== 'rolling-24h') validateCalendarReset(policy.timeZone, policy.resetMinute)
    if (journey.type === 'defeat-and-report') validateRepeatableHunt(journey, definition)
    else
      validatePersistentEventDefinition({
        ...definition,
        category: 'story-campaigns',
        personalJourney: journey,
        repeatableTravel: undefined,
      })
  }

  if (definition.personalJourney !== undefined) {
    const journey = definition.personalJourney
    if (
      !journey ||
      (journey.type !== 'travel-and-report' && journey.type !== 'item-exchange') ||
      resolveEventCategory(definition) !== 'story-campaigns'
    ) {
      throw new TypeError('A personal journey needs a Story Campaign and a known quest giver.')
    }
    const realm = journey.type === 'item-exchange' ? journey.realm : undefined
    if (
      realm === undefined
        ? !isPersonalQuestGiver(journey.giverId)
        : !isPersonalJourneyNpcId(journey.giverId)
    ) {
      throw new TypeError(
        'Choose a published World and Story NPC for a realm, or a known Watch officer for a basic quest.',
      )
    }
    const giver = isPersonalQuestGiver(journey.giverId)
      ? PERSONAL_QUEST_GIVERS[journey.giverId].position
      : null
    const { scope, rewardPackageRefs } = definition
    if (
      scope.type !== 'global' &&
      (scope.type !== 'region' ||
        (giver !== null &&
          scope.key !== giver.sectorId &&
          scope.key !== `region.${giver.sectorId}`))
    ) {
      throw new TypeError('The audience must include the quest giver’s region.')
    }
    validatePrivateQuestPhase(definition)
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
        (giver &&
          destination.sectorId === giver.sectorId &&
          destination.x === giver.x &&
          destination.y === giver.y)
      ) {
        throw new TypeError('Choose a quest destination away from the giver.')
      }
      identity(destination.sectorId, 'Quest destination sector')
    } else {
      if (
        !isPersonalItemIdentity(journey.inputItemId) ||
        !isPersonalItemIdentity(journey.outputItemId) ||
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
      if (realm !== undefined) {
        if (
          !realm ||
          !isPersonalJourneyNpcId(realm.guardianNpcId) ||
          realm.guardianNpcId === journey.giverId
        ) {
          throw new TypeError('Choose a distinct published Story NPC as the realm guardian.')
        }
        if (!rewardPackageRefs.length)
          throw new TypeError(
            'Choose at least one approved Character XP reward for the guardian victory.',
          )
        for (const [label, text] of [
          ['Realm lore', realm.lore],
          ['Access', realm.access],
          ['Challenge', realm.challenge],
          ['Retry', realm.retry],
        ] as const)
          shortText(text, `${label} dialogue`, 800)
      } else if (rewardPackageRefs.length)
        throw new TypeError('An item exchange awards the selected Item and access.')
    }
    validateJourneyDialogue(journey)
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
