import { automaticAbilityExecutionRequirements } from './combat-simple-requirements'
import type { GridPosition } from './board'
import { canonicalAbilityTargetSpec } from './combat-targeting-shapes'
import type {
  CombatEncounterState,
  CombatTargetSelection,
  CombatResolutionContext,
  CombatContentCatalog,
  CombatResolutionTransition,
} from './actions'
import {
  prepareCombatAbilityCommand,
  type CombatAbilityCommandInput,
} from './combat-ability-command'
import { combatAbilitySubject } from './combat-behavior-runtime'
import { evaluateAutomaticRequirementTrigger } from './combat-requirements'
import {
  createCombatActionProvenance,
  consumeCombatTrigger,
  COMBAT_RESOLUTION_PIPELINE_VERSION,
  type CombatTriggerGuard,
} from './combat-kernel-types'
import type { AbilityBehavior } from './combat-definition'
import type { CapturedCombatAbilitySource } from './combat-behavior-capture'
import type {
  AbilityRequirementContext,
  AbilityRequirementSubjectState,
  AbilityResource,
} from './combat-requirements'

/** Declared capabilities; actual dispatch must also have its native mutation producer. */
export const AUTOMATIC_ABILITY_EVENT_PHASES = Object.freeze({
  combat_action_used: ['before', 'after'],
  combat_action_interrupted: ['after'],
  damage_applied: ['after'],
  healing_applied: ['after'],
  resource_changed: ['after'],
  ap_spent: ['after'],
  mp_spent: ['after'],
  hp_spent: ['after'],
  status_applied: ['after'],
  status_removed: ['after'],
  status_expired: ['after'],
  persistent_effect_applied: ['after'],
  barrier_changed: ['after'],
  barrier_absorbed: ['after'],
  combatant_displaced: ['after'],
  combatant_rewound: ['after'],
  movement_spent: ['after'],
  action_spent: ['after'],
  battle_started: ['after'],
  round_started: ['after'],
  turn_started: ['after'],
  turn_ended: ['after'],
} as const)
for (const phases of Object.values(AUTOMATIC_ABILITY_EVENT_PHASES)) Object.freeze(phases)
export type AutomaticAbilityEventType = keyof typeof AUTOMATIC_ABILITY_EVENT_PHASES
export function automaticAbilityEventSupported(type: string, phase: 'before' | 'after'): boolean {
  return (
    Object.hasOwn(AUTOMATIC_ABILITY_EVENT_PHASES, type) &&
    (
      AUTOMATIC_ABILITY_EVENT_PHASES[type as AutomaticAbilityEventType] as readonly string[]
    ).includes(phase)
  )
}
export interface CombatAbilityEventFrame {
  readonly id: string
  readonly mutationOrdinal: number
  readonly events: readonly {
    readonly type: AutomaticAbilityEventType
    readonly phase: 'before' | 'after'
  }[]
  readonly subjects: readonly {
    readonly combatantId: string
    readonly before?: AbilityRequirementSubjectState
    readonly after: AbilityRequirementSubjectState
  }[]
  readonly rootActionId?: string
  readonly actionFacts?: NonNullable<AbilityRequirementContext['event']>['action']
  readonly triggeringCombatantId?: string
  readonly selectedCombatantId?: string
  readonly selectedCombatantIds?: readonly string[]
  readonly affectedCombatantIds: readonly string[]
  readonly resourceMutations: readonly {
    readonly combatantId: string
    readonly resources: readonly AbilityResource[]
  }[]
  readonly placements: readonly {
    readonly combatantId: string
    readonly before?: GridPosition
    readonly after: GridPosition
  }[]
}
export type AutomaticAbilitySelectionResult =
  | { readonly selection: CombatTargetSelection }
  | {
      readonly suppression:
        | 'automatic-targeting-unsupported'
        | 'automatic-target-role-unavailable'
        | 'automatic-target-unit-unavailable'
    }

/** Resolve causal identities only; native command admission checks current complete geometry. */
export function resolveAutomaticAbilitySelection(
  state: CombatEncounterState,
  source: CapturedCombatAbilitySource,
  behavior: AbilityBehavior,
  frame: CombatAbilityEventFrame,
): AutomaticAbilitySelectionResult {
  const target = behavior.targeting ? canonicalAbilityTargetSpec(behavior.targeting) : null
  if (
    !target ||
    behavior.activation !== 'automatic' ||
    behavior.mode !== 'action' ||
    !['self', 'unit', 'ground-tile', 'empty-tile'].includes(target.kind)
  )
    return { suppression: 'automatic-targeting-unsupported' }
  if (target.kind === 'self') return { selection: { kind: 'self' } }
  if (target.geometryVersion === 2 || target.geometryVersion === 3) {
    if (target.shape.kind === 'circle' || target.shape.kind === 'all')
      return behavior.automaticTarget
        ? { suppression: 'automatic-targeting-unsupported' }
        : { selection: { kind: 'activate' } }
  } else if (target.shape.kind !== 'single')
    return { suppression: 'automatic-targeting-unsupported' }
  const subject = behavior.automaticTarget?.subject
  const ids =
    subject === 'owner'
      ? [source.ownerCombatantId]
      : subject === 'triggering'
        ? frame.triggeringCombatantId
          ? [frame.triggeringCombatantId]
          : []
        : subject === 'selected'
          ? (frame.selectedCombatantIds ??
            (frame.selectedCombatantId ? [frame.selectedCombatantId] : []))
          : subject === 'affected'
            ? frame.affectedCombatantIds
            : []
  if (!ids.length || new Set(ids).size !== ids.length || ids.length > target.maximumSelections)
    return { suppression: 'automatic-target-role-unavailable' }
  if (
    ids.some(
      (id) => !state.tactical.battle.combatants.some((unit) => unit.id === id && unit.hp > 0),
    )
  )
    return { suppression: 'automatic-target-unit-unavailable' }
  if (target.shape.kind === 'line') {
    if (ids.length !== 1) return { suppression: 'automatic-target-role-unavailable' }
    const origin = state.tactical.placements.find(
      (row) => row.combatantId === source.ownerCombatantId,
    )?.position
    const position = state.tactical.placements.find((row) => row.combatantId === ids[0])?.position
    if (!origin || !position) return { suppression: 'automatic-target-unit-unavailable' }
    const dx = position.x - origin.x,
      dy = position.y - origin.y
    if ((!dx && !dy) || (dx && dy)) return { suppression: 'automatic-target-role-unavailable' }
    return {
      selection: {
        kind: 'direction',
        direction: dx ? (dx > 0 ? 'east' : 'west') : dy > 0 ? 'south' : 'north',
        ...(target.kind === 'ground-tile' || target.kind === 'empty-tile'
          ? { ground: true as const }
          : {}),
      },
    }
  }
  const selections = ids.map((id) =>
    target.kind === 'unit'
      ? { kind: 'unit' as const, combatantId: id }
      : {
          kind: 'tile' as const,
          position: {
            ...state.tactical.placements.find((row) => row.combatantId === id)!.position,
          },
        },
  )
  return {
    selection: selections.length === 1 ? selections[0]! : { kind: 'selections', selections },
  }
}

export interface CombatAbilityEventSession {
  guard: CombatTriggerGuard
  mutationOrdinal: number
  reservedAp?: { readonly combatantId: string; readonly amount: number }
  readonly dispatched: Set<string>
  readonly actionUsage: Map<string, Set<string>>
}
/** Keep unpaid walking costs unavailable throughout synchronous child command settlement. */
export function withCombatAbilityApReservation<Value>(
  session: CombatAbilityEventSession,
  reservation: CombatAbilityEventSession['reservedAp'],
  settle: () => Value,
): Value {
  const previous = session.reservedAp
  session.reservedAp = reservation ?? previous
  try {
    return settle()
  } finally {
    session.reservedAp = previous
  }
}
const sessions = new WeakSet<CombatAbilityEventSession>()
const frames = new WeakMap<CombatAbilityEventFrame, CombatAbilityEventSession>()
interface AutomaticImpulse {
  readonly source: CapturedCombatAbilitySource
  readonly behavior: AbilityBehavior
  readonly requirementsContext: AbilityRequirementContext
  readonly event?: CombatAbilityEventFrame['events'][number]
  readonly selectionFrame?: CombatAbilityEventFrame
}
const impulses = new WeakMap<CombatAbilityEventFrame, readonly AutomaticImpulse[]>()
function captureAutomaticImpulses(
  before: CombatEncounterState,
  after: CombatEncounterState,
  frame: CombatAbilityEventFrame,
  newlyActivatedSourceIds: readonly string[],
) {
  const truth = [...(after.abilityRuntime?.conditionTruth ?? [])]
  const candidates: AutomaticImpulse[] = []
  for (const source of after.capturedAbilitySources ?? []) {
    if (!after.abilityRuntime?.activeSourceIds.includes(source.sourceInstanceId)) continue
    for (const behavior of source.definition.behaviors) {
      if (behavior.activation !== 'automatic' || behavior.mode !== 'action') continue
      if (behavior.automaticTrigger === 'requirements-met') {
        // Readiness is retried after real mutations. Admission owns costs, cooldowns,
        // limits and geometry; an out-of-range attempt must not consume readiness.
        if (frame.events.length && !frame.events.some((event) => event.phase === 'after')) continue
        const subjects = frame.subjects
          .filter((row) => (row.after.resources?.hp ?? 0) > 0)
          .sort((a, b) =>
            a.combatantId < b.combatantId ? -1 : a.combatantId > b.combatantId ? 1 : 0,
          )
        for (const subject of subjects) {
          const selectionFrame = detached({
            ...frame,
            selectedCombatantId: subject.combatantId,
            selectedCombatantIds: [subject.combatantId],
            affectedCombatantIds: [subject.combatantId],
          })
          const requirementsContext = combatAbilityFrameRequirements(
            selectionFrame,
            source.ownerCombatantId,
          )
          if (
            evaluateAutomaticRequirementTrigger(behavior.requirements, requirementsContext, false)
              .holds
          )
            candidates.push(detached({ source, behavior, requirementsContext, selectionFrame }))
        }
        continue
      }
      const requirement = automaticAbilityExecutionRequirements(behavior)
      const context = combatAbilityFrameRequirements(frame, source.ownerCombatantId)
      const stateTruth = evaluateAutomaticRequirementTrigger(requirement, context, true).stateTruth
      const prior = truth.find(
        (row) => row.sourceInstanceId === source.sourceInstanceId && row.behaviorId === behavior.id,
      )
      const fresh =
        newlyActivatedSourceIds.includes(source.sourceInstanceId) &&
        !before.capturedAbilitySources?.some(
          (row) => row.sourceInstanceId === source.sourceInstanceId,
        )
      const entered = stateTruth && !(fresh ? false : (prior?.holds ?? stateTruth))
      const event = frame.events.find(
        (receipt) =>
          evaluateAutomaticRequirementTrigger(
            requirement,
            combatAbilityFrameRequirements(frame, source.ownerCombatantId, receipt),
            true,
          ).eventMatched,
      )
      const mutationMatched = evaluateAutomaticRequirementTrigger(
        requirement,
        context,
        true,
      ).eventMatched
      const row = {
        sourceInstanceId: source.sourceInstanceId,
        behaviorId: behavior.id,
        holds: stateTruth,
      }
      if (prior) truth[truth.indexOf(prior)] = row
      else truth.push(row)
      if (entered || event || mutationMatched)
        candidates.push(
          detached({
            source,
            behavior,
            requirementsContext: detached(
              event
                ? combatAbilityFrameRequirements(frame, source.ownerCombatantId, event)
                : context,
            ),
            ...(event ? { event } : {}),
          }),
        )
    }
  }
  impulses.set(
    frame,
    candidates.sort((a, b) =>
      a.source.sourceInstanceId < b.source.sourceInstanceId
        ? -1
        : a.source.sourceInstanceId > b.source.sourceInstanceId
          ? 1
          : a.behavior.id < b.behavior.id
            ? -1
            : a.behavior.id > b.behavior.id
              ? 1
              : 0,
    ),
  )
  return truth
}
export function createCombatAbilityEventSession(
  guard: CombatTriggerGuard,
  state?: CombatEncounterState,
): CombatAbilityEventSession {
  const session = {
    guard,
    mutationOrdinal: 0,
    dispatched: new Set<string>(),
    actionUsage: new Map(
      (state?.abilityRuntime?.usage ?? []).map((row) => [
        row.key,
        new Set([row.rootActionId, ...(row.pendingRootActionIds ?? [])]),
      ]),
    ),
  }
  sessions.add(session)
  return session
}
export function assertCombatAbilityEventSession(
  session: CombatAbilityEventSession,
  context: CombatResolutionContext,
): void {
  if (!sessions.has(session) || session.guard.triggerChainId !== context.provenance.triggerChainId)
    throw new TypeError('invalid-automatic-event-session')
}
function detached<Value>(value: Value): Value {
  const copy = JSON.parse(JSON.stringify(value)) as Value
  function freeze(item: unknown): void {
    if (item && typeof item === 'object') {
      Object.values(item).forEach(freeze)
      Object.freeze(item)
    }
  }
  freeze(copy)
  return copy
}
export function captureCombatAbilityEventFrame(
  before: CombatEncounterState,
  after: CombatEncounterState,
  identity: string,
  session: CombatAbilityEventSession,
  facts: Omit<CombatAbilityEventFrame, 'id' | 'mutationOrdinal' | 'subjects' | 'placements'>,
): CombatAbilityEventFrame {
  if (!sessions.has(session)) throw new TypeError('invalid-automatic-event-session')
  if (facts.events.some((event) => !automaticAbilityEventSupported(event.type, event.phase)))
    throw new TypeError('automatic-event-unsupported')
  const mutationOrdinal = ++session.mutationOrdinal
  const frame = detached({
    ...facts,
    id: JSON.stringify([session.guard.triggerChainId, identity, mutationOrdinal]),
    mutationOrdinal,
    subjects: after.tactical.battle.combatants.map((unit) => ({
      combatantId: unit.id,
      before: combatAbilitySubject(before, unit.id) ?? undefined,
      after: combatAbilitySubject(after, unit.id)!,
    })),
    placements: after.tactical.placements.map((row) => ({
      combatantId: row.combatantId,
      before: before.tactical.placements.find((old) => old.combatantId === row.combatantId)
        ?.position,
      after: row.position,
    })),
  })
  frames.set(frame, session)
  captureAutomaticImpulses(before, after, frame, [])
  return frame
}
/** Record truth at a real mutation; dispatch never edits this persisted memory. */
export function captureCombatAbilityMutation(
  before: CombatEncounterState,
  after: CombatEncounterState,
  identity: string,
  session: CombatAbilityEventSession,
  facts: Omit<CombatAbilityEventFrame, 'id' | 'mutationOrdinal' | 'subjects' | 'placements'>,
  options: { readonly newlyActivatedSourceIds?: readonly string[] } = {},
): { readonly state: CombatEncounterState; readonly frame: CombatAbilityEventFrame } {
  const frame = captureCombatAbilityEventFrame(before, after, identity, session, facts)
  const conditionTruth = captureAutomaticImpulses(
    before,
    after,
    frame,
    options.newlyActivatedSourceIds ?? [],
  )
  return {
    frame,
    state: after.abilityRuntime
      ? { ...after, abilityRuntime: { ...after.abilityRuntime, conditionTruth } }
      : after,
  }
}
export function combatAbilityFrameRequirements(
  frame: CombatAbilityEventFrame,
  ownerId: string,
  event?: CombatAbilityEventFrame['events'][number],
): AbilityRequirementContext {
  const ids = {
    owner: ownerId,
    triggering: frame.triggeringCombatantId,
    selected: frame.selectedCombatantId,
    affected: frame.affectedCombatantIds.length === 1 ? frame.affectedCombatantIds[0] : undefined,
  }
  const context: AbilityRequirementContext = {
    ...Object.fromEntries(
      Object.entries(ids).map(([role, id]) => {
        const subject = frame.subjects.find((row) => row.combatantId === id)
        const changed = frame.resourceMutations.find((row) => row.combatantId === id)
        return [
          role,
          subject
            ? {
                ...subject.after,
                ...(changed && subject.before
                  ? {
                      previousResources: Object.fromEntries(
                        changed.resources.map((resource) => [
                          resource,
                          subject.before!.resources?.[resource],
                        ]),
                      ),
                    }
                  : {}),
              }
            : null,
        ]
      }),
    ),
    resourceMutations: Object.fromEntries(
      Object.entries(ids).map(([role, id]) => [
        role,
        frame.resourceMutations.find((row) => row.combatantId === id)?.resources ?? [],
      ]),
    ),
    ...(event
      ? { event: { ...event, action: frame.actionFacts } }
      : frame.actionFacts
        ? { event: { type: '', phase: 'after', action: frame.actionFacts } }
        : {}),
  }
  return context
}

/** Only an injected command executor may settle children; this module owns no damage path. */
export function processCombatAbilityEvent(
  state: CombatEncounterState,
  frame: CombatAbilityEventFrame,
  content: CombatContentCatalog,
  context: CombatResolutionContext,
  session: CombatAbilityEventSession,
  depth: number,
  executeAutomatic: (input: CombatAbilityCommandInput) => CombatResolutionTransition,
  options: {
    readonly readinessOnly?: boolean
  } = {},
): CombatResolutionTransition {
  assertCombatAbilityEventSession(session, context)
  if (frames.get(frame) !== session) throw new TypeError('invalid-automatic-event-frame')
  let next = state
  const events: CombatResolutionTransition['events'][number][] = []
  const candidates = impulses.get(frame) ?? []
  for (const {
    source,
    behavior,
    requirementsContext,
    event: matching,
    selectionFrame,
  } of candidates) {
    if (options.readinessOnly && behavior.automaticTrigger !== 'requirements-met') continue
    if (
      next.tactical.battle.lifecycle !== 'active' ||
      !next.abilityRuntime?.activeSourceIds.includes(source.sourceInstanceId) ||
      !next.tactical.battle.combatants.some(
        (unit) => unit.id === source.ownerCombatantId && unit.hp > 0,
      )
    )
      continue
    const readiness = behavior.automaticTrigger === 'requirements-met'
    const key = JSON.stringify([
      readiness ? 'readiness' : frame.id,
      source.sourceInstanceId,
      behavior.id,
    ])
    if (session.dispatched.has(key)) continue
    if (!readiness) session.dispatched.add(key)
    const usageKey = JSON.stringify([
      state.tactical.battle.battleId,
      source.sourceInstanceId,
      source.ownerCombatantId,
      source.abilityId,
      source.contentVersion,
      behavior.id,
    ])
    const selection = resolveAutomaticAbilitySelection(
      next,
      source,
      behavior,
      selectionFrame ?? frame,
    )
    if ('suppression' in selection) continue
    const childInput: CombatAbilityCommandInput = {
      state: next,
      actorId: source.ownerCombatantId,
      root: { kind: 'canonical', source, behaviorId: behavior.id },
      selection: selection.selection,
      content,
      context: {
        provenance: createCombatActionProvenance({
          ...context.provenance,
          sourceKind: source.sourceKind,
          sourceCombatantId: source.ownerCombatantId,
          controllerCombatantId: source.ownerCombatantId,
          actionDefinitionId: source.abilityId,
          actionVersion: source.contentVersion,
        }),
        triggerGuard: session.guard,
      },
      trigger: {
        rootActionId: frame.rootActionId,
        id: frame.id,
        type: matching?.type ?? '',
        phase: matching?.phase ?? 'after',
        depth: depth + 1,
        triggeringCombatantId: frame.triggeringCombatantId,
        requirementsContext: readiness
          ? {
              ...requirementsContext,
              owner: combatAbilitySubject(next, source.ownerCombatantId),
              selected: combatAbilitySubject(next, selectionFrame?.selectedCombatantId),
              affected: combatAbilitySubject(next, selectionFrame?.selectedCombatantId),
            }
          : requirementsContext,
      },
      eventSession: session,
      eventDepth: depth + 1,
    }
    // Unavailable targets must not exhaust the shared trigger-chain budget.
    if (readiness) {
      const quote = prepareCombatAbilityCommand(childInput)
      if (!quote.evaluation.legal) continue
      if (
        behavior.requirements &&
        'subject' in behavior.requirements &&
        behavior.requirements.subject === 'selected' &&
        !quote.evaluation.affectedCombatantIds.includes(selectionFrame!.selectedCombatantId!)
      )
        continue
    }
    if (
      !consumeCombatTrigger(session.guard, {
        instanceId: JSON.stringify([usageKey, frame.id, selectionFrame?.selectedCombatantId]),
        depth: depth + 1,
      }).accepted
    )
      continue
    // Hold the reentrancy guard through native child mutations, even without an authored limit.
    if (readiness) session.dispatched.add(key)
    const child = executeAutomatic(childInput)
    next = child.state
    if (readiness && !child.events.some((event) => event.event === 'combat_action_used'))
      session.dispatched.delete(key)
    events.push(...child.events)
    if (child.resolution) {
      session.guard = child.resolution.triggerGuard
      assertCombatAbilityEventSession(session, context)
    }
  }
  return {
    state: next,
    events,
    resolution: {
      pipelineVersion: COMBAT_RESOLUTION_PIPELINE_VERSION,
      provenance: context.provenance,
      triggerGuard: session.guard,
    },
  }
}
