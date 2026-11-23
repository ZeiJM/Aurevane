import type { AbilityBehavior } from './combat-definition'
import type { AbilityRequirementSubject, RequirementNode } from './combat-requirements'
import { validateAbilityRequirements } from './combat-requirements'
import { FOUNDATION_DISCIPLINES } from '../character/foundation-disciplines'
import { ADVANCED_DISCIPLINES } from '../character/advanced-disciplines'
import { PHASE4_STATUSES, combatStatusDetails } from './status-content'

type ActionNode = Extract<RequirementNode, { kind: 'action' }>
type RelationNode = Extract<RequirementNode, { kind: 'subject-relation' }>
type CrossingNode = Extract<RequirementNode, { kind: 'resource-threshold-crossing' }>
export type ResourceChangeNode = Extract<RequirementNode, { kind: 'resource-change' }>

/** Authoring modules lower to the existing interpreter; these IDs are never runtime events. */
export const COMBAT_TRIGGER_MODULES = [
  { id: 'trigger.attack-hit', label: 'Damage Dealt', eventType: 'damage_applied', phase: 'after' },
  {
    id: 'trigger.damage-received',
    label: 'Damage Taken',
    eventType: 'damage_applied',
    phase: 'after',
  },
  {
    id: 'trigger.ally-damage-received',
    label: 'Ally Damaged',
    eventType: 'damage_applied',
    phase: 'after',
  },
  {
    id: 'trigger.after-action',
    label: 'After Your Action',
    eventType: 'combat_action_used',
    phase: 'after',
  },
  {
    id: 'trigger.before-attack',
    label: 'Before Your Attack',
    eventType: 'combat_action_used',
    phase: 'before',
  },
  {
    id: 'trigger.heal-applied',
    label: 'Heal Resolved',
    eventType: 'healing_applied',
    phase: 'after',
  },
  {
    id: 'trigger.barrier-absorbed',
    label: 'Barrier Absorbed',
    eventType: 'barrier_absorbed',
    phase: 'after',
  },
  {
    id: 'trigger.turn-start',
    label: 'Your Turn Starts',
    eventType: 'turn_started',
    phase: 'after',
  },
  {
    id: 'trigger.enemy-turn-end',
    label: 'Enemy Turn Ends',
    eventType: 'turn_ended',
    phase: 'after',
  },
  {
    id: 'trigger.hp-threshold-crossed-on-damage',
    label: 'HP Falls to Threshold',
    eventType: 'damage_applied',
    phase: 'after',
  },
  {
    id: 'trigger.mp-threshold-crossed-by-drain',
    label: 'MP Drain Crosses Threshold',
    eventType: 'resource_changed',
    phase: 'after',
  },
  {
    id: 'trigger.mp-restored',
    label: 'MP Restored',
    eventType: 'resource_changed',
    phase: 'after',
  },
  {
    id: 'trigger.displacement-applied',
    label: 'Enemy Displaced',
    eventType: 'combatant_displaced',
    phase: 'after',
  },
  {
    id: 'trigger.rewind-completed',
    label: 'Your Rewind Completes',
    eventType: 'combatant_rewound',
    phase: 'after',
  },
] as const
export type CombatTriggerModuleId = (typeof COMBAT_TRIGGER_MODULES)[number]['id']

export const COMBAT_REQUIREMENT_DISCIPLINE_OPTIONS = Object.freeze(
  [...FOUNDATION_DISCIPLINES, ...ADVANCED_DISCIPLINES].map(({ id, name }) => ({ id, label: name })),
)
/** These core statuses precede the Phase4 metadata catalogue and retain their native IDs. */
export const COMBAT_REQUIREMENT_STATUS_OPTIONS = Object.freeze(
  [
    ...new Set([
      ...PHASE4_STATUSES.map((row) => row.id),
      'guarded',
      'exposed',
      'covert',
      'revealed',
      'lowered-guard',
    ]),
  ].map((id) => ({ id, label: combatStatusDetails(id).name })),
)
/** Registered intrinsic action facts used by shared trigger filters, independent of any Skill ID. */
export const COMBAT_REQUIREMENT_ACTION_TAG_OPTIONS = Object.freeze(
  [
    'attack',
    'physical',
    'mystic',
    'area',
    'awareness',
    'bleed',
    'burn',
    'cleanse',
    'control',
    'defense',
    'drain',
    'expose',
    'facing',
    'finisher',
    'guard',
    'heal',
    'line',
    'mark',
    'melee',
    'movement',
    'opportunist',
    'payoff',
    'poison',
    'precision',
    'pressure',
    'ranged',
    'reach',
    'recovery',
    'setup',
    'support',
    'survival',
    'tempo',
    'tradeoff',
    'utility',
  ].map((id) => ({ id, label: id.charAt(0).toUpperCase() + id.slice(1) })),
)
/** Finite native event/phase pairs supported by these modules; no dispatcher runtime import. */
export const COMBAT_REQUIREMENT_EVENT_OPTIONS = Object.freeze([
  ...new Map(
    COMBAT_TRIGGER_MODULES.map(({ eventType, phase }) => [
      `${eventType}:${phase}`,
      { id: `${eventType}:${phase}`, label: `${eventType} (${phase})`, eventType, phase },
    ]),
  ).values(),
])
export const COMBAT_REQUIREMENT_STATUS_SETS = [
  {
    id: 'removable-debuffs',
    label: 'Removable Debuffs',
    statusIds: [
      'burn',
      'bleed',
      'poison',
      'slow',
      'root',
      'exposed',
      'mark',
      'challenged',
      'suppress',
    ],
  },
] as const

export interface CombatTriggerModuleParameters {
  readonly actionQualifiers: readonly ActionNode[]
  readonly causalRelations: readonly RelationNode[]
  readonly crossing?: CrossingNode
  readonly resourceChange?: ResourceChangeNode
}
export interface CombatTriggerModuleSelection {
  readonly id: CombatTriggerModuleId
  readonly parameters: CombatTriggerModuleParameters
}
export type CombatRequirementModuleLayout =
  | {
      readonly kind: 'group'
      readonly operator: 'all'
      readonly children: readonly CombatRequirementModuleLayout[]
    }
  | { readonly kind: 'trigger'; readonly index: number }
  | { readonly kind: 'condition'; readonly index: number }
  | { readonly kind: 'none' }
export interface CombatRequirementModules {
  readonly trigger: CombatTriggerModuleSelection | null
  readonly conditions: readonly RequirementNode[]
  readonly layout: CombatRequirementModuleLayout
  /** Native behavior admission can already bind historical trigger ownership. */
  readonly binding?: CombatRequirementBehaviorBinding
}
export type CombatRequirementBehaviorBinding = Pick<
  AbilityBehavior,
  'activation' | 'mode' | 'targeting' | 'automaticTarget'
>
const knownDisciplines = new Set(COMBAT_REQUIREMENT_DISCIPLINE_OPTIONS.map(({ id }) => id))
const knownStatuses = new Set(COMBAT_REQUIREMENT_STATUS_OPTIONS.map(({ id }) => id))
const knownActionTags = new Set(COMBAT_REQUIREMENT_ACTION_TAG_OPTIONS.map(({ id }) => id))
const relation = (
  subject: AbilityRequirementSubject,
  otherSubject: AbilityRequirementSubject,
  value: RelationNode['relation'],
): RelationNode => ({ kind: 'subject-relation', subject, otherSubject, relation: value })
const ownerAction = () => relation('triggering', 'owner', 'same-unit')
const ownerAffected = () => relation('affected', 'owner', 'same-unit')
const enemyAction = () => relation('triggering', 'owner', 'enemy')
const enemyAffected = () => relation('affected', 'owner', 'enemy')

export function createCombatTriggerModuleSelection(
  id: CombatTriggerModuleId,
): CombatTriggerModuleSelection {
  let actionQualifiers: ActionNode[] = [],
    causalRelations: RelationNode[] = []
  let crossing: CrossingNode | undefined, resourceChange: ResourceChangeNode | undefined
  switch (id) {
    case 'trigger.attack-hit':
      actionQualifiers = [{ kind: 'action', classification: 'attack' }]
      causalRelations = [ownerAction()]
      break
    case 'trigger.damage-received':
      causalRelations = [ownerAffected(), enemyAction()]
      break
    case 'trigger.ally-damage-received':
      causalRelations = [enemyAction(), relation('affected', 'owner', 'ally')]
      break
    case 'trigger.after-action':
      actionQualifiers = [{ kind: 'action', classification: 'attack' }]
      causalRelations = [ownerAction()]
      break
    case 'trigger.before-attack':
      actionQualifiers = [{ kind: 'action', classification: 'attack' }]
      break
    case 'trigger.heal-applied':
      actionQualifiers = [{ kind: 'action', classification: 'recovery' }]
      causalRelations = [ownerAction()]
      break
    case 'trigger.barrier-absorbed':
      actionQualifiers = [{ kind: 'action', classification: 'attack' }]
      causalRelations = [ownerAffected(), enemyAction()]
      break
    case 'trigger.turn-start':
      causalRelations = [ownerAction()]
      break
    case 'trigger.enemy-turn-end':
      causalRelations = [enemyAction()]
      break
    case 'trigger.hp-threshold-crossed-on-damage':
      causalRelations = [ownerAffected()]
      crossing = {
        kind: 'resource-threshold-crossing',
        subject: 'owner',
        resource: 'hp',
        direction: 'below',
        thresholdBasisPoints: 3500,
      }
      break
    case 'trigger.mp-threshold-crossed-by-drain':
      actionQualifiers = [{ kind: 'action', classification: 'attack', requiredTags: ['drain'] }]
      causalRelations = [ownerAction(), enemyAffected()]
      crossing = {
        kind: 'resource-threshold-crossing',
        subject: 'affected',
        resource: 'mp',
        direction: 'below',
        thresholdBasisPoints: 2500,
      }
      break
    case 'trigger.mp-restored':
      actionQualifiers = [{ kind: 'action', classification: 'recovery' }]
      causalRelations = [ownerAction(), ownerAffected()]
      resourceChange = {
        kind: 'resource-change',
        subject: 'affected',
        resource: 'mp',
        direction: 'gained',
        minimumAmount: 1,
      }
      break
    case 'trigger.displacement-applied':
      actionQualifiers = [{ kind: 'action', classification: 'attack' }]
      causalRelations = [ownerAction(), enemyAffected()]
      break
    case 'trigger.rewind-completed':
      causalRelations = [ownerAction(), ownerAffected()]
      break
  }
  return {
    id,
    parameters: {
      actionQualifiers,
      causalRelations,
      ...(crossing ? { crossing } : {}),
      ...(resourceChange ? { resourceChange } : {}),
    },
  }
}

function primitiveNodes(selection: CombatTriggerModuleSelection): RequirementNode[] {
  const module = COMBAT_TRIGGER_MODULES.find(({ id }) => id === selection.id)
  if (!module) throw new TypeError('Unknown registered trigger module.')
  const p = selection.parameters
  return [
    { kind: 'event', eventType: module.eventType, phase: module.phase },
    ...p.actionQualifiers,
    ...p.causalRelations,
    ...(p.crossing ? [p.crossing] : []),
    ...(p.resourceChange ? [p.resourceChange] : []),
  ]
}
function registeredAction(node: ActionNode): boolean {
  return (
    (!node.sourceDisciplineId || knownDisciplines.has(node.sourceDisciplineId)) &&
    (!node.requiredTags || node.requiredTags.every((id) => knownActionTags.has(id)))
  )
}
function registeredCondition(node: RequirementNode): boolean {
  if (node.kind === 'all' || node.kind === 'any') return node.children.every(registeredCondition)
  if (node.kind === 'status-presence') return knownStatuses.has(node.statusId)
  return node.kind === 'resource-state' || node.kind === 'prime-presence'
}
function equivalentRelation(
  node: RelationNode,
  subject: AbilityRequirementSubject,
  other: AbilityRequirementSubject,
  value: RelationNode['relation'],
): boolean {
  return (
    node.relation === value &&
    ((node.subject === subject && node.otherSubject === other) ||
      (node.subject === other && node.otherSubject === subject))
  )
}
function satisfiesModule(
  selection: CombatTriggerModuleSelection,
  behavior?: CombatRequirementBehaviorBinding,
): boolean {
  const p = selection.parameters
  if (p.actionQualifiers.some((node) => !registeredAction(node))) return false
  const hasRelation = (
    subject: AbilityRequirementSubject,
    other: AbilityRequirementSubject,
    value: RelationNode['relation'],
  ) => p.causalRelations.some((node) => equivalentRelation(node, subject, other, value))
  const selfBoundTrigger =
    behavior?.automaticTarget?.subject === 'triggering' &&
    !!behavior.targeting &&
    behavior.targeting.categories?.length === 1 &&
    behavior.targeting.categories[0] === 'self'
  const owner = hasRelation('triggering', 'owner', 'same-unit') || selfBoundTrigger
  const affectedOwner = hasRelation('affected', 'owner', 'same-unit')
  const enemy = hasRelation('triggering', 'owner', 'enemy')
  const attack = p.actionQualifiers.some((node) => node.classification === 'attack')
  const tags = p.actionQualifiers.flatMap((node) => node.requiredTags ?? [])
  if (
    p.crossing &&
    !['trigger.hp-threshold-crossed-on-damage', 'trigger.mp-threshold-crossed-by-drain'].includes(
      selection.id,
    )
  )
    return false
  if (p.resourceChange && selection.id !== 'trigger.mp-restored') return false
  switch (selection.id) {
    case 'trigger.attack-hit':
      return owner && attack
    case 'trigger.damage-received':
      return affectedOwner && enemy
    case 'trigger.ally-damage-received':
      return enemy && hasRelation('affected', 'owner', 'ally')
    case 'trigger.after-action':
      return owner && p.actionQualifiers.length > 0
    case 'trigger.before-attack':
      return attack && behavior?.mode === 'modifier'
    case 'trigger.heal-applied':
      return owner
    case 'trigger.barrier-absorbed':
      return affectedOwner && enemy
    case 'trigger.turn-start':
      return owner
    case 'trigger.enemy-turn-end':
      return enemy
    case 'trigger.hp-threshold-crossed-on-damage':
      return (
        affectedOwner &&
        p.crossing?.subject === 'owner' &&
        p.crossing.resource === 'hp' &&
        p.crossing.direction === 'below'
      )
    case 'trigger.mp-threshold-crossed-by-drain':
      return (
        owner &&
        hasRelation('affected', 'owner', 'enemy') &&
        attack &&
        tags.includes('drain') &&
        p.crossing?.subject === 'affected' &&
        p.crossing.resource === 'mp' &&
        p.crossing.direction === 'below'
      )
    case 'trigger.mp-restored':
      return (
        owner &&
        affectedOwner &&
        p.resourceChange?.subject === 'affected' &&
        p.resourceChange.resource === 'mp' &&
        p.resourceChange.direction === 'gained' &&
        p.resourceChange.minimumAmount >= 1
      )
    case 'trigger.displacement-applied':
      return owner && hasRelation('affected', 'owner', 'enemy')
    case 'trigger.rewind-completed':
      return owner && (affectedOwner || selfBoundTrigger)
  }
}

export function compileCombatTriggerModule(
  selection: CombatTriggerModuleSelection,
  behavior?: CombatRequirementBehaviorBinding,
): RequirementNode {
  const node: RequirementNode = { kind: 'all', children: primitiveNodes(selection) }
  // Recognized historical trees can bind ownership through targeting; retain that in their projection.
  if (validateAbilityRequirements(node).length || !satisfiesModule(selection, behavior))
    throw new TypeError('Trigger parameters must use registered, valid values.')
  return structuredClone(node)
}

function isTriggerPrimitive(node: RequirementNode): boolean {
  return [
    'event',
    'action',
    'subject-relation',
    'resource-threshold-crossing',
    'resource-change',
  ].includes(node.kind)
}
function flatAll(node: RequirementNode | null): RequirementNode[] {
  return node?.kind === 'all' ? node.children.flatMap(flatAll) : node ? [node] : []
}
const equalNode = (a: RequirementNode, b: RequirementNode) => {
  const entries = Object.entries(a)
  const other = b as unknown as Record<string, unknown>
  return (
    entries.length === Object.keys(b).length &&
    entries.every(([key, value]) => JSON.stringify(value) === JSON.stringify(other[key]))
  )
}

/** Null means preserve the exact raw tree; never project only a recognized subset. */
export function recognizeCombatRequirementModules(
  node: RequirementNode | null,
  behavior?: CombatRequirementBehaviorBinding,
): CombatRequirementModules | null {
  if (validateAbilityRequirements(node).length) return null
  const leaves = flatAll(node)
  const anchors = leaves.filter(isTriggerPrimitive)
  const conditions = leaves.filter((value) => !isTriggerPrimitive(value))
  if (conditions.some((value) => !registeredCondition(value))) return null
  const events = anchors.filter(
    (value): value is Extract<RequirementNode, { kind: 'event' }> => value.kind === 'event',
  )
  let trigger: CombatTriggerModuleSelection | null = null
  let compiledAnchors: RequirementNode[] = []
  if (anchors.length) {
    if (events.length !== 1) return null
    const actionQualifiers = anchors.filter((value): value is ActionNode => value.kind === 'action')
    const causalRelations = anchors.filter(
      (value): value is RelationNode => value.kind === 'subject-relation',
    )
    const crossings = anchors.filter(
      (value): value is CrossingNode => value.kind === 'resource-threshold-crossing',
    )
    const changes = anchors.filter(
      (value): value is ResourceChangeNode => value.kind === 'resource-change',
    )
    if (crossings.length > 1 || changes.length > 1) return null
    const parameters: CombatTriggerModuleParameters = {
      actionQualifiers,
      causalRelations,
      ...(crossings[0] ? { crossing: crossings[0] } : {}),
      ...(changes[0] ? { resourceChange: changes[0] } : {}),
    }
    // Specific crossing modules must win over a more general native damage receipt.
    const candidates = [...COMBAT_TRIGGER_MODULES].sort(
      (a, b) => Number(b.id.includes('threshold')) - Number(a.id.includes('threshold')),
    )
    const match = candidates.find(
      (module) =>
        module.eventType === events[0]!.eventType &&
        module.phase === events[0]!.phase &&
        satisfiesModule({ id: module.id, parameters }, behavior),
    )
    if (!match) return null
    trigger = { id: match.id, parameters: structuredClone(parameters) }
    compiledAnchors = primitiveNodes(trigger)
    if (compiledAnchors.length !== anchors.length) return null
  }
  const unusedAnchors = new Set(compiledAnchors.map((_, index) => index))
  let conditionIndex = 0
  function layout(value: RequirementNode | null): CombatRequirementModuleLayout {
    if (!value) return { kind: 'none' }
    if (value.kind === 'all')
      return { kind: 'group', operator: 'all', children: value.children.map(layout) }
    if (!isTriggerPrimitive(value)) return { kind: 'condition', index: conditionIndex++ }
    const index = [...unusedAnchors].find((index) => equalNode(compiledAnchors[index]!, value))
    if (index === undefined) throw new TypeError('Unaccounted trigger primitive.')
    unusedAnchors.delete(index)
    return { kind: 'trigger', index }
  }
  return {
    trigger,
    conditions: structuredClone(conditions),
    layout: layout(node),
    ...(behavior
      ? {
          binding: {
            activation: behavior.activation,
            mode: behavior.mode,
            targeting: structuredClone(behavior.targeting),
            ...(behavior.automaticTarget
              ? { automaticTarget: structuredClone(behavior.automaticTarget) }
              : {}),
          },
        }
      : {}),
  }
}

/** Preserve exact grouping on a roundtrip; changed arity rebuilds the equivalent top-level All. */
export function compileCombatRequirementModules(
  value: CombatRequirementModules,
): RequirementNode | null {
  const anchors = value.trigger
    ? flatAll(compileCombatTriggerModule(value.trigger, value.binding))
    : []
  if (
    value.conditions.some(
      (node) => validateAbilityRequirements(node).length || !registeredCondition(node),
    )
  )
    throw new TypeError('Condition modules must use registered, valid values.')
  const usedAnchors = new Set<number>(),
    usedConditions = new Set<number>()
  let complete = true
  function render(layout: CombatRequirementModuleLayout): RequirementNode | null {
    if (layout.kind === 'none') return null
    if (layout.kind === 'group')
      return {
        kind: 'all',
        children: layout.children.flatMap((child) => {
          const node = render(child)
          return node ? [node] : []
        }),
      }
    const list = layout.kind === 'trigger' ? anchors : value.conditions
    const used = layout.kind === 'trigger' ? usedAnchors : usedConditions
    if (!list[layout.index] || used.has(layout.index)) {
      complete = false
      return null
    }
    used.add(layout.index)
    return list[layout.index]!
  }
  const rendered = render(value.layout)
  if (
    complete &&
    usedAnchors.size === anchors.length &&
    usedConditions.size === value.conditions.length
  )
    return structuredClone(rendered)
  const nodes = [...anchors, ...value.conditions]
  return nodes.length ? { kind: 'all', children: structuredClone(nodes) } : null
}

export function setCombatRequirementTriggerModule(
  node: RequirementNode | null,
  trigger: CombatTriggerModuleSelection | null,
  behavior?: CombatRequirementBehaviorBinding,
): RequirementNode | null {
  const projection = recognizeCombatRequirementModules(node, behavior)
  if (!projection)
    throw new TypeError('Preserve unsupported raw requirements until explicitly replaced.')
  return compileCombatRequirementModules({ ...projection, trigger })
}
