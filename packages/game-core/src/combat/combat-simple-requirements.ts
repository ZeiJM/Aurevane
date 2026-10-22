import type { AbilityBehavior, AbilityEffect } from './combat-definition'
import type { AbilityRequirementSubject, RequirementNode } from './combat-requirements'
import { validateAbilityRequirements } from './combat-requirements'
import { PHASE4_STATUSES, combatStatusDetails } from './status-content'
import { isRetiredCombatStatusId } from './retired-combat-statuses'
import { combatTargetUnitCategoryAllowed } from './combat-targeting-shapes'

/** Finite native status choices, independent of the legacy trigger-module catalogue. */
const statusOptions = [
  ...new Set([
    ...PHASE4_STATUSES.map(({ id }) => id),
    'guarded',
    'exposed',
    'covert',
    'revealed',
    'lowered-guard',
  ]),
]
  .filter((id) => !isRetiredCombatStatusId(id) && id !== 'displaced')
  .map((id) => ({ id, label: combatStatusDetails(id).name }))
const statusIds = new Set(statusOptions.map(({ id }) => id))
export const SIMPLE_REQUIREMENT_TAG_OPTIONS = Object.freeze([
  { id: 'none', label: 'None' },
  ...statusOptions,
  { id: 'primed', label: 'Primed' },
  { id: 'hp-less-than', label: 'HP less than' },
  { id: 'hp-more-than', label: 'HP more than' },
  { id: 'mp-less-than', label: 'MP less than' },
  { id: 'mp-more-than', label: 'MP more than' },
])
export const SIMPLE_AUTOMATIC_TRIGGER_OPTIONS = [
  { id: 'after-action', targetSubject: 'selected', label: 'After Your Action' },
  { id: 'damage-dealt', targetSubject: 'affected', label: 'Damage Dealt' },
  { id: 'damage-taken', targetSubject: 'triggering', label: 'Damage Taken' },
  { id: 'ally-damage-taken', targetSubject: 'affected', label: 'Ally Takes Damage' },
  { id: 'enemy-turn-started', targetSubject: 'triggering', label: 'Enemy Turn Starts' },
  { id: 'enemy-turn-ended', targetSubject: 'triggering', label: 'Enemy Turn Ends' },
  { id: 'healed', targetSubject: 'affected', label: 'Friendly Healing Applied' },
  { id: 'resource-changed', targetSubject: 'affected', label: 'Resource Changed' },
  { id: 'turn-started', targetSubject: 'owner', label: 'Your Turn Starts' },
  { id: 'barrier-hit', targetSubject: 'triggering', label: 'Your Barrier Absorbs Damage' },
  { id: 'displaced', targetSubject: 'affected', label: 'Your Displacement Applies' },
  { id: 'rewound', targetSubject: 'affected', label: 'Your Rewind Completes' },
] as const
export type SimpleAutomaticTriggerId = (typeof SIMPLE_AUTOMATIC_TRIGGER_OPTIONS)[number]['id']
export interface SimpleRequirementSelection {
  readonly tagId: string
  readonly subject: AbilityRequirementSubject
  readonly percent?: number
}
const subjects: readonly string[] = ['owner', 'selected', 'affected', 'triggering']
export function createSimpleRequirement(
  tagId: string,
  subject: AbilityRequirementSubject,
  percent = 50,
): RequirementNode | null {
  if (!subjects.includes(subject)) throw new TypeError('Unknown Requirement target.')
  if (tagId === 'none') return null
  if (statusIds.has(tagId))
    return { kind: 'status-presence', subject, statusId: tagId, present: true }
  if (tagId === 'primed') return { kind: 'prime-presence', subject, present: true }
  if (!['hp-less-than', 'hp-more-than', 'mp-less-than', 'mp-more-than'].includes(tagId))
    throw new TypeError('Unknown simple Requirement tag.')
  if (
    !Number.isFinite(percent) ||
    percent < 0 ||
    percent > 100 ||
    Math.round(percent * 100) / 100 !== percent
  )
    throw new TypeError('Requirement percentage requires 0–100 with at most two decimal places.')
  return {
    kind: 'resource-state',
    subject,
    resource: tagId.startsWith('hp-') ? 'hp' : 'mp',
    comparison: tagId.endsWith('less-than') ? 'less-than' : 'more-than',
    basisPoints: Math.round(percent * 100),
  }
}
export function readSimpleRequirement(
  node: RequirementNode | null,
): SimpleRequirementSelection | null {
  if (node === null) return { tagId: 'none', subject: 'owner' }
  if (validateAbilityRequirements(node).length) return null
  if (node.kind === 'status-presence' && node.present && statusIds.has(node.statusId))
    return { tagId: node.statusId, subject: node.subject }
  if (node.kind === 'prime-presence' && node.present && node.abilityId === undefined)
    return { tagId: 'primed', subject: node.subject }
  if (
    node.kind === 'resource-state' &&
    (node.resource === 'hp' || node.resource === 'mp') &&
    (node.comparison === 'less-than' || node.comparison === 'more-than') &&
    node.basisPoints !== undefined
  )
    return {
      tagId: `${node.resource}-${node.comparison}`,
      subject: node.subject,
      percent: node.basisPoints / 100,
    }
  return null
}
export function isSimpleRequirement(node: RequirementNode | null): boolean {
  return readSimpleRequirement(node) !== null
}

/** One Target label maps to the genuine native role of this execution path. */
export function simpleRequirementSubjects(
  behavior: Pick<AbilityBehavior, 'activation' | 'mode' | 'automaticTrigger' | 'targeting'>,
): readonly AbilityRequirementSubject[] {
  if (behavior.activation === 'ongoing') return ['owner']
  if (behavior.mode === 'modifier') return ['owner', 'selected']
  if (behavior.activation === 'manual')
    return hasSimpleUnitSelection(behavior.targeting) ? ['owner', 'selected'] : ['owner']
  const target = SIMPLE_AUTOMATIC_TRIGGER_OPTIONS.find(
    ({ id }) => id === behavior.automaticTrigger,
  )?.targetSubject
  return target && target !== 'owner' ? ['owner', target] : ['owner']
}

type SimpleUnitCategory = 'self' | 'ally' | 'enemy'
/** Only causal roles produced by a native frame may bind a Simple Automatic command. */
export function simpleAutomaticTargetSubjects(
  behavior: Pick<AbilityBehavior, 'activation' | 'mode' | 'automaticTrigger' | 'targeting'>,
): readonly AbilityRequirementSubject[] {
  const target = behavior.targeting
  if (behavior.activation !== 'automatic' || behavior.mode !== 'action' || !target) return []
  if (!['single', 'line'].includes(target.shape?.kind)) return []
  if (target.kind === 'self') return ['owner']
  if (!['unit', 'ground-tile'].includes(target.kind)) return []
  if (target.categories !== undefined && !Array.isArray(target.categories)) return []
  const trigger = behavior.automaticTrigger
  const available: readonly AbilityRequirementSubject[] = !trigger
    ? ['owner']
    : trigger === 'turn-started' || trigger === 'enemy-turn-started' || trigger === 'enemy-turn-started' ||
      trigger === 'enemy-turn-ended'
      ? ['owner', 'triggering', 'affected']
      : ['owner', 'triggering', 'selected', 'affected']
  const actor = { id: 'owner', teamId: 'owner-team' }
  // Geometry 2 Ally admits its owner; geometry 3 uses the explicit native categories.
  const legacyCategories: readonly SimpleUnitCategory[] =
    target.teamPolicy === 'any'
      ? ['self', 'ally', 'enemy']
      : target.teamPolicy === 'ally'
        ? ['self', 'ally']
        : [target.teamPolicy]
  const spec = target.geometryVersion === 3 ? target : { ...target, categories: legacyCategories }
  return available.filter((subject) =>
    automaticTargetCategories(trigger, subject).some((category) => {
      if (category === 'self' && (target.minimumRange > 0 || target.shape.kind === 'line'))
        return false
      if (target.kind === 'ground-tile')
        return target.geometryVersion !== 3 || target.categories?.includes('ground') === true
      const unit =
        category === 'self'
          ? actor
          : { id: category, teamId: category === 'ally' ? actor.teamId : 'enemy-team' }
      return combatTargetUnitCategoryAllowed(spec, actor, unit)
    }),
  )
}
function automaticTargetCategories(
  trigger: SimpleAutomaticTriggerId | undefined,
  subject: AbilityRequirementSubject,
): readonly SimpleUnitCategory[] {
  if (subject === 'owner') return ['self']
  if (subject === 'selected') return ['self', 'ally', 'enemy']
  if (subject === 'triggering') {
    if (
      trigger === 'damage-taken' ||
      trigger === 'ally-damage-taken' ||
      trigger === 'enemy-turn-ended'
    )
      return ['enemy']
    return trigger === 'barrier-hit' ? ['self', 'ally', 'enemy'] : ['self']
  }
  switch (trigger) {
    case 'damage-dealt':
    case 'enemy-turn-started':
    case 'enemy-turn-ended':
      return ['enemy']
    case 'damage-taken':
    case 'turn-started':
    case 'barrier-hit':
    case 'rewound':
      return ['self']
    case 'ally-damage-taken':
      return ['ally']
    case 'healed':
      return ['self', 'ally']
    case 'displaced':
      return ['ally', 'enemy']
    default:
      return ['self', 'ally', 'enemy']
  }
}

/** Effect Target follows the packet's native recipient and the command's actual unit selection. */
export function simpleEffectRequirementSubjects(
  behavior: Pick<AbilityBehavior, 'activation' | 'targeting'>,
  payload: Pick<AbilityEffect['payload'], 'recipient'>,
): readonly AbilityRequirementSubject[] {
  if (payload.recipient === 'affected-tiles') return []
  if (behavior.activation === 'ongoing') return ['owner']
  if (payload.recipient === 'affected-units') return ['owner', 'affected']
  return hasSimpleUnitSelection(behavior.targeting) &&
    (payload.recipient === 'actor' || payload.recipient === 'primary-unit')
    ? ['owner', 'selected']
    : ['owner']
}

function hasSimpleUnitSelection(target: AbilityBehavior['targeting']): boolean {
  return (
    !!target &&
    ['self', 'unit'].includes(target.kind) &&
    target.shape?.kind === 'single' &&
    (target.categories === undefined ||
      (Array.isArray(target.categories) &&
        target.categories.some((category) => category !== 'ground')))
  )
}

/** Execution metadata is interpreted separately; stored Requirements remain a single leaf. */
export function automaticAbilityExecutionRequirements(
  behavior: AbilityBehavior,
): RequirementNode | null {
  if (behavior.requirementMode !== 'simple' || !behavior.automaticTrigger)
    return behavior.requirements
  const relation = (
    subject: AbilityRequirementSubject,
    value: 'same-unit' | 'ally' | 'enemy',
  ): RequirementNode => ({
    kind: 'subject-relation',
    subject,
    otherSubject: 'owner',
    relation: value,
  })
  const ownerSource = relation('triggering', 'same-unit')
  const ownerAffected = relation('affected', 'same-unit')
  const trigger = behavior.automaticTrigger
  const eventType = {
    'after-action': 'combat_action_used',
    'damage-dealt': 'damage_applied',
    'damage-taken': 'damage_applied',
    'ally-damage-taken': 'damage_applied',
    'enemy-turn-started': 'turn_started',
    'enemy-turn-ended': 'turn_ended',
    healed: 'healing_applied',
    'resource-changed': 'resource_changed',
    'turn-started': 'turn_started',
    'barrier-hit': 'barrier_absorbed',
    displaced: 'combatant_displaced',
    rewound: 'combatant_rewound',
  }[trigger]
  let bindings: RequirementNode[]
  switch (trigger) {
    case 'damage-dealt':
      bindings = [ownerSource, relation('affected', 'enemy')]
      break
    case 'damage-taken':
      bindings = [relation('triggering', 'enemy'), ownerAffected]
      break
    case 'ally-damage-taken':
      bindings = [relation('triggering', 'enemy'), relation('affected', 'ally')]
      break
    case 'enemy-turn-started':
    case 'enemy-turn-ended':
      bindings = [relation('triggering', 'enemy')]
      break
    case 'barrier-hit':
      bindings = [ownerAffected]
      break
    case 'healed':
      bindings = [
        ownerSource,
        { kind: 'any', children: [ownerAffected, relation('affected', 'ally')] },
      ]
      break
    default:
      bindings = [ownerSource]
  }
  return {
    kind: 'all',
    children: [
      { kind: 'event', eventType, phase: 'after' },
      ...bindings,
      ...(behavior.requirements ? [behavior.requirements] : []),
    ],
  }
}
