import { prepareNativePv1fTurn } from './pv1f-turn-preparation'
import type { CombatNativeExecutionHooks } from './combat-native-mutations'
import {
  evaluateCombatAction,
  executeCombatAction,
  executeCommittedCombatActorEffects,
  type CombatActionDefinition,
  type CombatActionEvaluation,
  type CombatEncounterState,
  type CombatContentCatalog,
  type CombatResolutionContext,
  type CombatResolutionTransition,
  type CombatTargetSelection,
  type CombatResolutionEvent,
} from './actions'
import {
  captureCombatAbilitySource,
  type CapturedCombatAbilitySource,
} from './combat-behavior-capture'
import {
  combatAbilityCommandContext,
  combatAbilityBehavior,
  combatAbilitySubject,
  materializeCombatAbilityAction,
  reconcileCombatAbilitySources,
  type CombatAbilityActivationInput,
} from './combat-behavior-runtime'
import type { AbilityBehavior } from './combat-definition'
import {
  evaluateAbilityRequirements,
  type AbilityClassification,
  type AbilityAttackFamily,
  type AbilityRequirementSubjectState,
} from './combat-requirements'
import { combatTurnCycle, prepareCombatTurnTriggers } from './combat-turn-trigger-state'
import {
  consumeCombatTrigger,
  createCombatActionProvenance,
  COMBAT_RESOLUTION_PIPELINE_VERSION,
} from './combat-kernel-types'
import {
  applySkillCooldown,
  readSkillCooldown,
  type SkillCooldownDefinition,
} from './skill-cooldowns'
import { composeCombatModifiers } from './combat-modifier-composition'
import { issueCommittedCombatExecution, committedCombatAction } from './combat-committed-execution'
import { markPv1fTurnActivity } from './pv1f-turn-activity'
import { spendAction } from './battle-state'
import {
  createCombatAbilityEventSession,
  assertCombatAbilityEventSession,
  captureCombatAbilityMutation,
  automaticAbilityEventSupported,
  type AutomaticAbilityEventType,
  processCombatAbilityEvent,
  type CombatAbilityEventSession,
  type CombatAbilityEventFrame,
} from './combat-ability-events'

export interface ManualCombatModifierSelection {
  readonly sourceInstanceId: string
  readonly behaviorId: string
}
export interface CombatCommandDamageBonus {
  readonly sourceInstanceId: string
  readonly contentId: string
  readonly contentVersion: number
  readonly behaviorId: string
  readonly effectId: string
  readonly multiplierBasisPoints: number
}
export type CombatAbilityCommandRoot =
  | {
      readonly kind: 'canonical'
      readonly source: CapturedCombatAbilitySource
      readonly behaviorId?: string
    }
  | {
      readonly kind: 'native'
      readonly action: CombatActionDefinition
      readonly sourceInstanceId: string
      readonly costs: AbilityBehavior['costs']
      readonly classification: AbilityClassification
      readonly attackFamily?: AbilityAttackFamily
      readonly sourceDisciplineId?: string
    }
export interface CombatAbilityCommandInput {
  readonly state: CombatEncounterState
  readonly actorId: string
  readonly root: CombatAbilityCommandRoot
  readonly selection: CombatTargetSelection
  readonly content: CombatContentCatalog
  readonly context: CombatResolutionContext
  readonly trigger?: CombatAbilityActivationInput['trigger']
  readonly manualModifiers?: readonly ManualCombatModifierSelection[]
  /** Issued transient orchestration only; not persisted or supplied by intents. */
  readonly eventSession?: CombatAbilityEventSession
  readonly eventDepth?: number
}
export interface PreparedCombatAbilityParticipant {
  readonly sourceInstanceId: string
  readonly abilityId: string
  readonly contentVersion: number
  readonly behaviorId?: string
  readonly activation: 'manual' | 'automatic'
  readonly mode: 'action' | 'modifier'
  readonly costs: AbilityBehavior['costs']
  readonly cooldown: SkillCooldownDefinition | null
}
interface Participant extends PreparedCombatAbilityParticipant {
  readonly source?: CapturedCombatAbilitySource
  readonly behavior?: AbilityBehavior
  readonly triggerId?: string
  readonly depth?: number
}
export interface PreparedCombatAbilityCommand {
  readonly action: CombatActionDefinition
  readonly evaluation: CombatActionEvaluation
  readonly costs: AbilityBehavior['costs']
  readonly participants: readonly PreparedCombatAbilityParticipant[]
  readonly context: CombatResolutionContext
  readonly requirementSubjects: readonly {
    readonly combatantId: string
    readonly subject: AbilityRequirementSubjectState
  }[]
}
interface Prepared extends PreparedCombatAbilityCommand {
  readonly participants: readonly Participant[]
}

export function combatAbilityUsageKey(
  state: CombatEncounterState,
  source: CapturedCombatAbilitySource,
  behavior: AbilityBehavior,
): string {
  return JSON.stringify([
    state.tactical.battle.battleId,
    source.sourceInstanceId,
    source.ownerCombatantId,
    source.abilityId,
    source.contentVersion,
    behavior.id,
  ])
}
export function combatAbilityParticipant(
  source: CapturedCombatAbilitySource,
  behavior: AbilityBehavior,
  triggerId?: string,
  depth?: number,
): Participant {
  if (behavior.activation === 'ongoing') throw new TypeError('ability-action-behavior-required')
  return {
    sourceInstanceId: source.sourceInstanceId,
    abilityId: source.abilityId,
    contentVersion: source.contentVersion,
    behaviorId: behavior.id,
    activation: behavior.activation,
    mode: behavior.mode,
    costs: behavior.costs,
    cooldown: behavior.cooldown,
    source,
    behavior,
    triggerId,
    depth,
  }
}
export function combatAbilityParticipantIssues(
  input: CombatAbilityCommandInput,
  participant: Participant,
): CombatActionEvaluation['issues'] {
  const issues: CombatActionEvaluation['issues'][number][] = []
  const actor = input.state.tactical.battle.combatants.find((row) => row.id === input.actorId)
  if (!actor || actor.hp <= 0)
    issues.push({
      code: 'source-owner-mismatch',
      message: 'Ability owner must be living and present.',
    })
  if (participant.cooldown && actor && readSkillCooldown(actor, participant.cooldown).active)
    issues.push({ code: 'cooldown-active', message: 'A participating cooldown is active.' })
  if (!participant.source || !participant.behavior) return issues
  const source = participant.source,
    behavior = participant.behavior
  if (source.ownerCombatantId !== input.actorId)
    issues.push({
      code: 'source-owner-mismatch',
      message: 'Captured source belongs to another owner.',
    })
  const stored = input.state.capturedAbilitySources?.find(
    (row) => row.sourceInstanceId === source.sourceInstanceId,
  )
  if (stored && JSON.stringify(stored) !== JSON.stringify(source))
    throw new TypeError('captured-source-cannot-change-in-place')
  if (
    input.state.abilityRuntime &&
    !input.state.abilityRuntime.activeSourceIds.includes(source.sourceInstanceId)
  )
    issues.push({ code: 'source-owner-mismatch', message: 'Captured source is inactive.' })
  const key = combatAbilityUsageKey(input.state, source, behavior),
    rootActionId = input.trigger?.rootActionId ?? input.context.provenance.triggerChainId
  const usage = input.state.abilityRuntime?.usage.find((row) => row.key === key)
  const commandId = participant.triggerId
    ? JSON.stringify([rootActionId, participant.triggerId])
    : rootActionId
  const instanceId = participant.triggerId ? JSON.stringify([key, participant.triggerId]) : key
  if (
    usage?.commandId === commandId ||
    input.context.triggerGuard.executedInstanceIds.includes(instanceId)
  )
    issues.push({
      code: 'duplicate-command',
      message: 'This captured activation already committed.',
    })
  if (
    participant.activation === 'automatic' &&
    !consumeCombatTrigger(input.context.triggerGuard, { instanceId, depth: participant.depth ?? 1 })
      .accepted
  )
    issues.push({
      code: 'activation-limit',
      message: 'Automatic activation exceeds the shared trigger guard.',
    })
  if (
    usage &&
    behavior.activationLimits?.some((scope) =>
      scope === 'once-per-battle'
        ? true
        : scope === 'once-per-round'
          ? usage.round === input.state.tactical.battle.round
          : scope === 'once-per-owner-turn'
            ? usage.ownerCycle === combatTurnCycle(input.state, input.actorId)
            : usage.rootActionId === rootActionId,
    )
  )
    issues.push({
      code: 'activation-limit',
      message: 'The captured activation limit has already been used.',
    })
  return issues
}
export function aggregateCombatAbilityCosts(
  participants: readonly PreparedCombatAbilityParticipant[],
): AbilityBehavior['costs'] {
  const totals = { ap: 0, mp: 0, hp: 0 }
  for (const participant of participants)
    for (const cost of participant.costs) {
      if (
        !Number.isSafeInteger(cost.amount) ||
        cost.amount < 0 ||
        !Object.hasOwn(totals, cost.resource)
      )
        throw new TypeError('invalid-command-cost')
      totals[cost.resource] += cost.amount
      if (!Number.isSafeInteger(totals[cost.resource]))
        throw new RangeError('command-cost-overflow')
    }
  return (['ap', 'mp', 'hp'] as const)
    .filter((resource) => totals[resource] > 0)
    .map((resource) => ({ resource, amount: totals[resource] }))
}
export function combatAbilityCostIssues(
  input: CombatAbilityCommandInput,
  costs: AbilityBehavior['costs'],
): CombatActionEvaluation['issues'] {
  const actor = input.state.tactical.battle.combatants.find((row) => row.id === input.actorId)
  return costs
    .filter(
      (cost) =>
        (cost.resource === 'ap'
          ? (actor?.temporaryResources.find((row) => row.key === 'pv1f.action-economy')?.current ??
            0)
          : cost.resource === 'hp'
            ? Math.max(0, (actor?.hp ?? 0) - 1)
            : (actor?.mp ?? 0)) < cost.amount,
    )
    .map((cost) => ({
      code:
        cost.resource === 'ap'
          ? 'insufficient-ap'
          : cost.resource === 'hp'
            ? 'insufficient-hp'
            : 'insufficient-mp',
      message: `Insufficient ${cost.resource.toUpperCase()} for atomic command payment.`,
    }))
}
export function prepareCombatAbilityCommand(
  input: CombatAbilityCommandInput,
): PreparedCombatAbilityCommand {
  let action: CombatActionDefinition, participant: Participant
  const root = input.root
  if (root.kind === 'canonical') {
    const source = captureCombatAbilitySource(root.source),
      behavior = combatAbilityBehavior(source, root.behaviorId)
    if (behavior.activation === 'automatic' && !input.trigger)
      throw new TypeError('automatic-event-required')
    if (behavior.activation === 'manual' && input.trigger)
      throw new TypeError('manual-trigger-authority-invalid')
    action = materializeCombatAbilityAction(source, behavior)
    participant = combatAbilityParticipant(
      source,
      behavior,
      input.trigger?.id,
      input.trigger?.depth,
    )
  } else {
    if (input.trigger) throw new TypeError('native-automatic-root-unsupported')
    action = root.action
    participant = {
      sourceInstanceId: root.sourceInstanceId,
      abilityId: action.id,
      contentVersion: action.version,
      activation: 'manual',
      mode: 'action',
      costs: root.costs,
      cooldown: action.cooldown ?? null,
    }
  }
  const context: CombatResolutionContext = {
    provenance: createCombatActionProvenance({
      ...input.context.provenance,
      sourceCombatantId: input.actorId,
      controllerCombatantId: input.actorId,
      ...(participant.source
        ? {
            sourceKind: participant.source.sourceKind,
            actionDefinitionId: participant.abilityId,
            actionVersion: participant.contentVersion,
          }
        : {}),
    }),
    triggerGuard: input.context.triggerGuard,
    ...(participant.activation === 'automatic'
      ? { executionAuthority: { activation: 'automatic', actorId: input.actorId } }
      : {}),
  }
  const { cooldown: _cooldown, ...prepaid } = action
  void _cooldown
  action = { ...prepaid, cost: { ...action.cost, mp: 0 } }
  const geometry = evaluateCombatAction(
    input.state,
    action,
    input.selection,
    input.content,
    context.executionAuthority,
  )
  const composed = composeCombatModifiers(input, action, geometry, participant)
  const participants = [participant, ...composed.participants]
  const costs = aggregateCombatAbilityCosts(participants)
  const evaluation = evaluateCombatAction(
    input.state,
    composed.action,
    input.selection,
    input.content,
    context.executionAuthority,
  )
  const issues = [
    ...evaluation.issues,
    ...participants.flatMap((row) => combatAbilityParticipantIssues(input, row)),
    ...combatAbilityCostIssues(input, costs),
  ]
  if (evaluation.actorId !== input.actorId)
    issues.push({
      code: 'source-owner-mismatch',
      message: 'Manual command requires the authoritative current owner.',
    })
  if (
    participant.behavior &&
    !evaluateAbilityRequirements(participant.behavior.requirements, {
      owner: combatAbilitySubject(input.state, input.actorId),
      selected: combatAbilitySubject(input.state, geometry.primaryCombatantId),
      ...(input.trigger?.requirementsContext ?? {}),
      ...(input.trigger
        ? {
            event: {
              ...input.trigger.requirementsContext?.event,
              type: input.trigger.type,
              phase: input.trigger.phase,
            },
          }
        : {}),
    })
  )
    issues.push({ code: 'requirement-not-met', message: 'Root Ability Requirements are not met.' })
  const sequence = input.state.abilityRuntime?.nextCommandSequence ?? 1
  if (
    !Number.isSafeInteger(sequence) ||
    sequence < 1 ||
    (participant.activation === 'manual' && sequence === Number.MAX_SAFE_INTEGER)
  )
    throw new RangeError('command-sequence-overflow')
  const expectedChain = JSON.stringify([
    'ability',
    input.state.tactical.battle.battleId,
    input.state.tactical.battle.turnNumber,
    sequence,
  ])
  if (
    participant.activation === 'manual' &&
    input.context.provenance.triggerChainId.startsWith('["ability",') &&
    input.context.provenance.triggerChainId !== expectedChain
  )
    issues.push({
      code: 'duplicate-command',
      message: 'stale-command: authoritative command sequence has advanced.',
    })
  // Forecast native settlement after the quoted atomic payment. Packet eligibility
  // above remains captured from activation; legality remains checked before payment.
  const forecast =
    issues.length === 0
      ? evaluateCombatAction(
          {
            ...input.state,
            tactical: {
              ...input.state.tactical,
              battle: {
                ...input.state.tactical.battle,
                combatants: input.state.tactical.battle.combatants.map((unit) => {
                  if (unit.id !== input.actorId) return unit
                  return {
                    ...unit,
                    hp: unit.hp - (costs.find((cost) => cost.resource === 'hp')?.amount ?? 0),
                    mp: unit.mp - (costs.find((cost) => cost.resource === 'mp')?.amount ?? 0),
                    temporaryResources: unit.temporaryResources.map((row) =>
                      row.key === 'pv1f.action-economy'
                        ? {
                            ...row,
                            current:
                              row.current -
                              (costs.find((cost) => cost.resource === 'ap')?.amount ?? 0),
                          }
                        : row,
                    ),
                  }
                }),
              },
            },
          },
          { ...composed.action, requirements: [] },
          input.selection,
          input.content,
          context.executionAuthority,
        )
      : evaluation
  return {
    action: composed.action,
    evaluation: { ...forecast, legal: issues.length === 0, issues },
    costs,
    participants,
    context,
    requirementSubjects: input.state.tactical.battle.combatants.map((unit) => ({
      combatantId: unit.id,
      subject: combatAbilitySubject(input.state, unit.id)!,
    })),
  }
}

export function commitCombatAbilityCommand(
  input: CombatAbilityCommandInput,
): CombatResolutionTransition {
  const prepared = prepareCombatAbilityCommand(input) as Prepared
  if (!prepared.evaluation.legal)
    throw new Error(
      `${prepared.evaluation.issues[0]?.code}: ${prepared.evaluation.issues[0]?.message}`,
    )
  const paymentEvents: CombatResolutionEvent[] = []
  let paid = prepareCombatTurnTriggers(input.state)
  paid = {
    ...paid,
    tactical: {
      ...paid.tactical,
      battle: {
        ...paid.tactical.battle,
        combatants: paid.tactical.battle.combatants.map((unit) => {
          if (unit.id !== input.actorId) return unit
          let next = { ...unit }
          for (const cost of prepared.costs) {
            if (cost.resource === 'ap') {
              next = {
                ...next,
                temporaryResources: next.temporaryResources.map((row) =>
                  row.key === 'pv1f.action-economy'
                    ? { ...row, current: row.current - cost.amount }
                    : row,
                ),
              }
              paymentEvents.push({
                event: 'ap_spent',
                combatantId: unit.id,
                amount: cost.amount,
                remaining: next.temporaryResources.find((row) => row.key === 'pv1f.action-economy')!
                  .current,
              })
            } else {
              next = { ...next, [cost.resource]: next[cost.resource] - cost.amount }
              paymentEvents.push({
                event: cost.resource === 'hp' ? 'hp_spent' : 'mp_spent',
                combatantId: unit.id,
                amount: cost.amount,
                remaining: next[cost.resource],
              })
            }
          }
          const cooldowns = new Map<string, Participant>()
          for (const participant of prepared.participants)
            if (
              participant.cooldown &&
              (cooldowns.get(participant.cooldown.key)?.cooldown?.ownerTurns ?? 0) <
                participant.cooldown.ownerTurns
            )
              cooldowns.set(participant.cooldown.key, participant)
          for (const participant of cooldowns.values()) {
            const transition = applySkillCooldown(next, participant.cooldown!, {
              actionId: participant.abilityId,
              definitionVersion: participant.contentVersion,
            })
            next = transition.combatant
            paymentEvents.push(...transition.events)
          }
          return next
        }),
      },
    },
  }
  let guard = prepared.context.triggerGuard
  const tracking = paid.abilityRuntime ?? {
    schemaVersion: 1 as const,
    activeSourceIds: prepared.participants.flatMap((row) =>
      row.source ? [row.sourceInstanceId] : [],
    ),
    usage: [],
    maintained: [],
  }
  let usage = [...tracking.usage]
  const captures = [...(paid.capturedAbilitySources ?? [])]
  for (const participant of prepared.participants) {
    if (!participant.source || !participant.behavior) continue
    const source = participant.source,
      key = combatAbilityUsageKey(paid, source, participant.behavior)
    const instanceId = participant.triggerId ? JSON.stringify([key, participant.triggerId]) : key
    guard =
      participant.activation === 'automatic'
        ? consumeCombatTrigger(guard, { instanceId, depth: participant.depth ?? 1 }).guard
        : { ...guard, executedInstanceIds: [...guard.executedInstanceIds, instanceId] }
    if (!captures.some((row) => row.sourceInstanceId === source.sourceInstanceId))
      captures.push(source)
    usage = [
      ...usage.filter((row) => row.key !== key),
      {
        key,
        rootActionId: input.trigger?.rootActionId ?? prepared.context.provenance.triggerChainId,
        commandId: participant.triggerId
          ? JSON.stringify([prepared.context.provenance.triggerChainId, participant.triggerId])
          : prepared.context.provenance.triggerChainId,
        ownerCycle: combatTurnCycle(paid, input.actorId),
        round: paid.tactical.battle.round,
        battleId: paid.tactical.battle.battleId,
      },
    ]
  }
  paid = {
    ...paid,
    capturedAbilitySources: captures,
    abilityRuntime: {
      ...tracking,
      usage,
      nextCommandSequence:
        prepared.participants[0]!.activation === 'automatic'
          ? tracking.nextCommandSequence
          : (tracking.nextCommandSequence ?? 1) + 1,
    },
  }
  const manual = prepared.participants[0]!.activation === 'manual'
  if (manual) paid = markPv1fTurnActivity(paid, input.actorId)
  if (prepared.action.cost.spendsAction) {
    const spent = spendAction(paid.tactical.battle)
    paid = { ...paid, tactical: { ...paid.tactical, battle: spent.state } }
    paymentEvents.push(...spent.events)
  }
  const context = { ...prepared.context, triggerGuard: guard }
  const session = input.eventSession ?? createCombatAbilityEventSession(guard)
  assertCombatAbilityEventSession(session, context)
  session.guard = guard
  const depth = input.eventDepth ?? input.trigger?.depth ?? 0
  const commandIdentity = input.trigger?.id ?? context.provenance.triggerChainId
  const actionFacts = {
    classification:
      input.root.kind === 'canonical'
        ? prepared.participants[0]!.behavior!.classification
        : input.root.classification,
    attackFamily:
      input.root.kind === 'canonical'
        ? prepared.participants[0]!.behavior!.attackFamily
        : input.root.attackFamily,
    sourceDisciplineId:
      input.root.kind === 'canonical'
        ? input.root.source.sourceDisciplineId
        : input.root.sourceDisciplineId,
    tags: prepared.action.tags,
  }
  const facts = {
    rootActionId: input.trigger?.rootActionId ?? context.provenance.triggerChainId,
    actionFacts,
    triggeringCombatantId: input.actorId,
    selectedCombatantId: prepared.evaluation.primaryCombatantId ?? undefined,
    affectedCombatantIds: prepared.evaluation.affectedCombatantIds,
  }
  const outcomeQueue: CombatAbilityEventFrame[] = []
  const paymentMutation = captureCombatAbilityMutation(
    input.state,
    paid,
    commandIdentity,
    session,
    {
      ...facts,
      affectedCombatantIds: [input.actorId],
      events: paymentEvents.flatMap((event) =>
        ['ap_spent', 'mp_spent', 'hp_spent', 'action_spent'].includes(event.event)
          ? [
              {
                type: event.event as 'ap_spent' | 'mp_spent' | 'hp_spent' | 'action_spent',
                phase: 'after' as const,
              },
            ]
          : [],
      ),
      resourceMutations: prepared.costs.length
        ? [{ combatantId: input.actorId, resources: prepared.costs.map((cost) => cost.resource) }]
        : [],
    },
  )
  paid = paymentMutation.state
  outcomeQueue.push(paymentMutation.frame)
  const committedExecution = issueCommittedCombatExecution(
    paid,
    input.actorId,
    prepared.action,
    input.selection,
    context,
    manual,
  )
  const attempt: CombatResolutionEvent = {
    event: 'combat_action_used',
    actionId: prepared.action.id,
    actorId: input.actorId,
  }
  const beforeMutation = captureCombatAbilityMutation(paid, paid, commandIdentity, session, {
    ...facts,
    events: [{ type: 'combat_action_used', phase: 'before' }],
    resourceMutations: [],
  })
  paid = beforeMutation.state
  const beforeFrame = beforeMutation.frame
  const executeAutomatic = (child: CombatAbilityCommandInput): CombatResolutionTransition => {
    const quote = prepareCombatAbilityCommand(child)
    if (!quote.evaluation.legal)
      return {
        state: child.state,
        events: [],
        resolution: {
          pipelineVersion: COMBAT_RESOLUTION_PIPELINE_VERSION,
          provenance: child.context.provenance,
          triggerGuard: session.guard,
        },
      }
    return commitCombatAbilityCommand(child)
  }
  const before = processCombatAbilityEvent(
    paid,
    beforeFrame,
    input.content,
    context,
    session,
    depth,
    executeAutomatic,
  )
  let live = before.state
  const drainOutcomes = (
    native: CombatResolutionTransition,
    nativeGuard: typeof guard,
  ): CombatResolutionTransition => {
    session.guard = nativeGuard
    let state = native.state
    const events = [...native.events]
    for (const frame of outcomeQueue) {
      const children = processCombatAbilityEvent(
        state,
        frame,
        input.content,
        context,
        session,
        depth,
        executeAutomatic,
      )
      state = children.state
      events.push(...children.events)
    }
    const finishedMutation = captureCombatAbilityMutation(state, state, commandIdentity, session, {
      ...facts,
      events: [{ type: 'combat_action_used', phase: 'after' }],
      resourceMutations: [],
    })
    state = finishedMutation.state
    const finishedChildren = processCombatAbilityEvent(
      state,
      finishedMutation.frame,
      input.content,
      context,
      session,
      depth,
      executeAutomatic,
    )
    state = finishedChildren.state
    events.push(...finishedChildren.events)
    return {
      state,
      events,
      resolution: {
        pipelineVersion: COMBAT_RESOLUTION_PIPELINE_VERSION,
        provenance: context.provenance,
        triggerGuard: session.guard,
      },
    }
  }
  const nativeHooks: CombatNativeExecutionHooks = {
    commandFacts: (actionId) =>
      actionId === prepared.action.id
        ? {
            rootActionId: facts.rootActionId,
            actionFacts,
            selectedCombatantId: facts.selectedCombatantId,
          }
        : undefined,
    prepareIncoming: (state) => prepareNativePv1fTurn(state, true),
    getGuard: () => session.guard,
    setGuard: (value) => {
      session.guard = value
    },
    observeMutation: (before, transition, nativeFacts) => {
      const after = reconcileCombatAbilitySources(
        transition.state,
        (transition.state.capturedAbilitySources ?? []).filter((source) =>
          transition.state.abilityRuntime?.activeSourceIds.includes(source.sourceInstanceId),
        ),
      )
      const resources = after.tactical.battle.combatants.flatMap((unit) => {
        const old = combatAbilitySubject(before, unit.id),
          next = combatAbilitySubject(after, unit.id)
        const changed = (['ap', 'mp', 'hp'] as const).filter(
          (resource) => old && old.resources?.[resource] !== next?.resources?.[resource],
        )
        return changed.length ? [{ combatantId: unit.id, resources: changed }] : []
      })
      const mutation = captureCombatAbilityMutation(before, after, commandIdentity, session, {
        ...facts,
        ...nativeFacts,
        actionFacts:
          nativeFacts.actionFacts ??
          (!nativeFacts.prepaid && nativeFacts.actionId === prepared.action.id
            ? facts.actionFacts
            : undefined),
        selectedCombatantId:
          nativeFacts.selectedCombatantId ??
          (!nativeFacts.prepaid && nativeFacts.actionId === prepared.action.id
            ? facts.selectedCombatantId
            : undefined),
        events: transition.events.flatMap((event) =>
          automaticAbilityEventSupported(event.event, 'after') &&
          !(event.event === 'damage_applied' && event.amount === 0)
            ? [{ type: event.event as AutomaticAbilityEventType, phase: 'after' as const }]
            : [],
        ),
        resourceMutations: resources,
      })
      outcomeQueue.push(mutation.frame)
      return mutation.state
    },
  }
  const actor = live.tactical.battle.combatants.find((unit) => unit.id === input.actorId)
  const interruption =
    !actor || actor.hp <= 0
      ? ('actor-unavailable' as const)
      : live.tactical.battle.lifecycle !== 'active'
        ? ('battle-ended' as const)
        : manual &&
            (live.tactical.battle.turnNumber !== input.state.tactical.battle.turnNumber ||
              live.tactical.battle.currentTurn?.combatantId !== input.actorId)
          ? ('turn-changed' as const)
          : !evaluateCombatAction(
                live,
                committedCombatAction(prepared.action),
                input.selection,
                input.content,
                context.executionAuthority,
              ).legal
            ? ('selection-invalid' as const)
            : null
  const interruptedReceipt: CombatResolutionEvent | null = interruption
    ? {
        event: 'combat_action_interrupted',
        actionId: prepared.action.id,
        actorId: input.actorId,
        reason: interruption,
      }
    : null
  if (interruption) {
    const interruptedMutation = captureCombatAbilityMutation(live, live, commandIdentity, session, {
      ...facts,
      events: [{ type: 'combat_action_interrupted', phase: 'after' }],
      resourceMutations: [],
    })
    live = interruptedMutation.state
    outcomeQueue.push(interruptedMutation.frame)
  }
  const canSettleActor = interruption === 'selection-invalid'
  const out = interruption
    ? canSettleActor
      ? executeCommittedCombatActorEffects(live, prepared.action, input.selection, input.content, {
          ...context,
          triggerGuard: session.guard,
          committedExecution,
          nativeHooks,
          resolveCommittedAbilityOutcomes: (native, nativeGuard) =>
            drainOutcomes(
              { ...native, events: [interruptedReceipt!, ...native.events] },
              nativeGuard,
            ),
        })
      : drainOutcomes({ state: live, events: [interruptedReceipt!] }, session.guard)
    : executeCombatAction(live, prepared.action, input.selection, input.content, {
        ...context,
        triggerGuard: session.guard,
        committedExecution,
        nativeHooks,
        resolveCommittedAbilityOutcomes: drainOutcomes,
      })
  return {
    ...out,
    events: [
      ...paymentEvents.map((event) => ({
        ...event,
        abilityParticipants: prepared.participants.map((row) => ({
          sourceInstanceId: row.sourceInstanceId,
          abilityId: row.abilityId,
          contentVersion: row.contentVersion,
          ...(row.behaviorId ? { behaviorId: row.behaviorId } : {}),
          costs: row.costs.map((cost) => ({ ...cost })),
        })),
      })),
      attempt,
      ...before.events,
      ...out.events,
    ],
  }
}

/** Internal native boundary driver. Each invocation owns its queue; nested commands retain theirs. */
export function createCombatNativeAbilityRuntime(
  state: CombatEncounterState,
  content: CombatContentCatalog,
) {
  const source = state.capturedAbilitySources?.find(
    (source) =>
      state.abilityRuntime?.activeSourceIds.includes(source.sourceInstanceId) &&
      source.definition.behaviors.some(
        (behavior) =>
          (behavior.activation === 'automatic' && behavior.mode === 'action') ||
          (behavior.activation === 'ongoing' && behavior.mode === 'modifier'),
      ),
  )
  if (!source) return undefined
  const context = combatAbilityCommandContext(state, source)
  const session = createCombatAbilityEventSession(context.triggerGuard)
  const queue: CombatAbilityEventFrame[] = []
  const identity = JSON.stringify([
    'native-boundary',
    state.tactical.battle.battleId,
    state.tactical.battle.turnNumber,
  ])
  const hooks: CombatNativeExecutionHooks = {
    getGuard: () => session.guard,
    setGuard: (guard) => {
      session.guard = guard
    },
    prepareIncoming: (state) => prepareNativePv1fTurn(state, true),
    observeMutation: (before, transition, facts) => {
      const after = reconcileCombatAbilitySources(
        transition.state,
        (transition.state.capturedAbilitySources ?? []).filter((source) =>
          transition.state.abilityRuntime?.activeSourceIds.includes(source.sourceInstanceId),
        ),
      )
      const mutation = captureCombatAbilityMutation(before, after, identity, session, {
        ...facts,
        events: transition.events.flatMap((event) =>
          automaticAbilityEventSupported(event.event, 'after') &&
          !(event.event === 'damage_applied' && event.amount === 0)
            ? [{ type: event.event as AutomaticAbilityEventType, phase: 'after' as const }]
            : [],
        ),
        resourceMutations: after.tactical.battle.combatants.flatMap((unit) => {
          const old = combatAbilitySubject(before, unit.id),
            next = combatAbilitySubject(after, unit.id)
          const resources = (['ap', 'mp', 'hp'] as const).filter(
            (resource) => old && old.resources?.[resource] !== next?.resources?.[resource],
          )
          return resources.length ? [{ combatantId: unit.id, resources }] : []
        }),
      })
      queue.push(mutation.frame)
      return mutation.state
    },
    settleOutcomes: (transition) => {
      let state = transition.state
      const events = [...transition.events]
      while (queue.length) {
        const out = processCombatAbilityEvent(
          state,
          queue.shift()!,
          content,
          context,
          session,
          0,
          (child) => {
            if (prepareCombatAbilityCommand(child).evaluation.legal)
              return commitCombatAbilityCommand(child)
            return {
              state: child.state,
              events: [],
              resolution: {
                pipelineVersion: COMBAT_RESOLUTION_PIPELINE_VERSION,
                provenance: child.context.provenance,
                triggerGuard: session.guard,
              },
            }
          },
        )
        state = out.state
        events.push(...out.events)
      }
      return { state, events }
    },
  }
  return hooks
}
