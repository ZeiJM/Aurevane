import type { GridPosition } from './board'
import type {
  CombatEncounterState,
  CombatTargetSelection,
  CombatResolutionContext,
  CombatContentCatalog,
  CombatResolutionTransition,
} from './actions'
import type { CombatAbilityCommandInput } from './combat-ability-command'
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
  readonly actionFacts?: NonNullable<AbilityRequirementContext['event']>['action']
  readonly triggeringCombatantId?: string
  readonly selectedCombatantId?: string
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
  const target = behavior.targeting
  if (
    !target ||
    behavior.activation !== 'automatic' ||
    behavior.mode !== 'action' ||
    target.shape.kind !== 'single' ||
    target.maximumSelections !== 1 ||
    !['self', 'unit'].includes(target.kind)
  )
    return { suppression: 'automatic-targeting-unsupported' }
  if (target.kind === 'self') return { selection: { kind: 'self' } }
  const subject = behavior.automaticTarget?.subject
  const id =
    subject === 'owner'
      ? source.ownerCombatantId
      : subject === 'triggering'
        ? frame.triggeringCombatantId
        : subject === 'selected'
          ? frame.selectedCombatantId
          : subject === 'affected' && frame.affectedCombatantIds.length === 1
            ? frame.affectedCombatantIds[0]
            : undefined
  if (!id) return { suppression: 'automatic-target-role-unavailable' }
  if (!state.tactical.battle.combatants.some((unit) => unit.id === id && unit.hp > 0))
    return { suppression: 'automatic-target-unit-unavailable' }
  return { selection: { kind: 'unit', combatantId: id } }
}

export interface CombatAbilityEventSession {
  guard: CombatTriggerGuard
  mutationOrdinal: number
  readonly dispatched: Set<string>
}
const sessions = new WeakSet<CombatAbilityEventSession>()
const frames = new WeakMap<CombatAbilityEventFrame, CombatAbilityEventSession>()
interface AutomaticImpulse {
  readonly source: CapturedCombatAbilitySource
  readonly behavior: AbilityBehavior
  readonly requirementsContext: AbilityRequirementContext
  readonly event?: CombatAbilityEventFrame['events'][number]
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
      const context = combatAbilityFrameRequirements(frame, source.ownerCombatantId)
      const stateTruth = evaluateAutomaticRequirementTrigger(
        behavior.requirements,
        context,
        true,
      ).stateTruth
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
            behavior.requirements,
            combatAbilityFrameRequirements(frame, source.ownerCombatantId, receipt),
            true,
          ).eventMatched,
      )
      const mutationMatched = evaluateAutomaticRequirementTrigger(
        behavior.requirements,
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
): CombatAbilityEventSession {
  const session = { guard, mutationOrdinal: 0, dispatched: new Set<string>() }
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
): CombatResolutionTransition {
  assertCombatAbilityEventSession(session, context)
  if (frames.get(frame) !== session) throw new TypeError('invalid-automatic-event-frame')
  let next = state
  const events: CombatResolutionTransition['events'][number][] = []
  const candidates = impulses.get(frame) ?? []
  for (const { source, behavior, requirementsContext, event: matching } of candidates) {
    if (
      next.tactical.battle.lifecycle !== 'active' ||
      !next.abilityRuntime?.activeSourceIds.includes(source.sourceInstanceId) ||
      !next.tactical.battle.combatants.some(
        (unit) => unit.id === source.ownerCombatantId && unit.hp > 0,
      )
    )
      continue
    const key = JSON.stringify([frame.id, source.sourceInstanceId, behavior.id])
    if (session.dispatched.has(key)) continue
    session.dispatched.add(key)
    const usageKey = JSON.stringify([
      state.tactical.battle.battleId,
      source.sourceInstanceId,
      source.ownerCombatantId,
      source.abilityId,
      source.contentVersion,
      behavior.id,
    ])
    if (
      !consumeCombatTrigger(session.guard, {
        instanceId: JSON.stringify([usageKey, frame.id]),
        depth: depth + 1,
      }).accepted
    )
      continue
    const selection = resolveAutomaticAbilitySelection(next, source, behavior, frame)
    if ('suppression' in selection) continue
    const child = executeAutomatic({
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
        id: frame.id,
        type: matching?.type ?? '',
        phase: matching?.phase ?? 'after',
        depth: depth + 1,
        triggeringCombatantId: frame.triggeringCombatantId,
        requirementsContext,
      },
      eventSession: session,
      eventDepth: depth + 1,
    })
    next = child.state
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
