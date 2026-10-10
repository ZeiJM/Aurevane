import {
  evaluateCombatAction,
  executeCombatAction,
  type CombatEncounterState,
  type CombatContentCatalog,
  type CombatResolutionContext,
  type CombatActionDefinition,
  type CombatActionEvaluation,
  type CombatResolutionTransition,
  type CombatTargetSelection,
  type CombatResolutionEvent,
} from './actions'
import {
  captureCombatAbilitySource,
  type CapturedCombatAbilitySource,
} from './combat-behavior-capture'
import type { AbilityBehavior } from './combat-definition'
import { nativeCombatTagPayload } from './combat-tag-registry'
import {
  evaluateAbilityRequirements,
  type AbilityRequirementContext,
  type AbilityRequirementSubjectState,
} from './combat-requirements'
import { combatTurnCycle, prepareCombatTurnTriggers } from './combat-turn-trigger-state'
import { createCombatActionProvenance, consumeCombatTrigger } from './combat-kernel-types'

interface CombatAbilityUsage {
  readonly key: string
  readonly rootActionId: string
  readonly commandId: string
  readonly ownerCycle: number
  readonly round: number
  readonly battleId: string
}
export interface CombatMaintainedAbilityContribution {
  readonly sourceInstanceId: string
  readonly ownerCombatantId: string
  readonly behaviorId: string
  readonly effectId: string
  readonly multiplierBasisPoints: number
}
export interface CombatAbilityRuntimeState {
  readonly schemaVersion: 1
  readonly activeSourceIds: readonly string[]
  readonly usage: readonly CombatAbilityUsage[]
  readonly maintained: readonly CombatMaintainedAbilityContribution[]
}
export interface CombatAbilityActivationInput {
  readonly state: CombatEncounterState
  readonly actorId: string
  readonly source: CapturedCombatAbilitySource
  readonly behaviorId?: string
  readonly selection: CombatTargetSelection
  readonly content: CombatContentCatalog
  readonly context: CombatResolutionContext
  readonly trigger?: {
    readonly id: string
    readonly type: string
    readonly phase: 'before' | 'after'
    readonly triggeringCombatantId?: string
    readonly depth: number
    readonly requirementsContext?: AbilityRequirementContext
  }
}

export function combatAbilityBehavior(
  source: CapturedCombatAbilitySource,
  behaviorId?: string,
): AbilityBehavior {
  const actions = source.definition.behaviors.filter(
    (behavior) => behavior.activation === 'manual' && behavior.mode === 'action',
  )
  const behavior = behaviorId
    ? source.definition.behaviors.find((row) => row.id === behaviorId)
    : actions.length === 1
      ? actions[0]
      : undefined
  if (!behaviorId && actions.length > 1) throw new TypeError('ambiguous-manual-behavior')
  if (!behavior || behavior.mode !== 'action' || behavior.activation === 'ongoing')
    throw new TypeError('ability-action-behavior-required')
  return behavior
}

export function materializeCombatAbilityAction(
  source: CapturedCombatAbilitySource,
  behavior: AbilityBehavior,
): CombatActionDefinition {
  if (!behavior.targeting) throw new TypeError('ability-action-targeting-required')
  const { maximumSelections: _count, ...target } = behavior.targeting
  void _count
  if (behavior.effects.some((effect) => ['summon', 'damage-bonus'].includes(effect.payload.type)))
    throw new TypeError('canonical-specialized-tag-routing-required')
  return {
    id: source.abilityId,
    version: source.contentVersion,
    sourceType: 'discipline-skill',
    tags: [
      ...source.tags.filter((tag) => !['attack', 'mystic', 'physical'].includes(tag)),
      ...(behavior.classification === 'attack' ? ['attack', behavior.attackFamily!] : []),
    ],
    target: { ...target, geometryVersion: 2 },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    ...(behavior.cooldown ? { cooldown: behavior.cooldown } : {}),
    ...(behavior.accuracy ? { accuracyRule: behavior.accuracy } : {}),
    effects: behavior.effects.map((effect) => nativeCombatTagPayload(effect.payload)),
    effectOrigins: behavior.effects.map(() => ({
      family: source.sourceKind === 'essence' ? 'essence' : 'skill',
      contentId: source.abilityId,
      contentVersion: source.contentVersion,
    })),
  }
}

function usageKey(
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

export function combatAbilitySubject(
  state: CombatEncounterState,
  id: string | null | undefined,
): AbilityRequirementSubjectState | null {
  const unit = state.tactical.battle.combatants.find((row) => row.id === id)
  if (!unit) return null
  const ap = unit.temporaryResources.find((row) => row.key === 'pv1f.action-economy')
  return {
    resources: { hp: unit.hp, mp: unit.mp, ap: ap?.current ?? 0 },
    maximumResources: { hp: unit.maxHp, mp: unit.maxMp, ap: ap?.maximum ?? 100 },
    statusIds:
      state.statusState
        .find((row) => row.combatantId === id)
        ?.statuses.filter((row) => row.timingState !== 'pending')
        .map((row) => row.statusId) ?? [],
    primeAbilityIds: [],
  }
}

export function evaluateCombatAbility(input: CombatAbilityActivationInput): CombatActionEvaluation {
  const source = captureCombatAbilitySource(input.source)
  const behavior = combatAbilityBehavior(source, input.behaviorId)
  const action = materializeCombatAbilityAction(source, behavior)
  if (behavior.activation === 'automatic' && !input.trigger)
    throw new TypeError('automatic-event-required')
  const authority =
    behavior.activation === 'automatic'
      ? { activation: 'automatic' as const, actorId: input.actorId }
      : undefined
  const evaluation = evaluateCombatAction(
    input.state,
    action,
    input.selection,
    input.content,
    authority,
  )
  const issues = [...evaluation.issues]
  if (source.ownerCombatantId !== input.actorId || evaluation.actorId !== input.actorId)
    issues.push({
      code: 'source-owner-mismatch',
      message: 'Captured source belongs to a different acting combatant.',
    })
  const stored = input.state.capturedAbilitySources?.find(
    (row) => row.sourceInstanceId === source.sourceInstanceId,
  )
  if (stored && JSON.stringify(stored) !== JSON.stringify(source))
    throw new TypeError('captured-source-cannot-change-in-place')
  const context: AbilityRequirementContext = {
    owner: combatAbilitySubject(input.state, input.actorId),
    selected: combatAbilitySubject(input.state, evaluation.primaryCombatantId),
    triggering: combatAbilitySubject(input.state, input.trigger?.triggeringCombatantId),
    ...(input.trigger?.requirementsContext ?? {}),
    ...(input.trigger ? { event: { type: input.trigger.type, phase: input.trigger.phase } } : {}),
  }
  if (!evaluateAbilityRequirements(behavior.requirements, context))
    issues.push({ code: 'requirement-not-met', message: 'Ability Requirements are not met.' })
  const key = usageKey(input.state, source, behavior)
  const usage = input.state.abilityRuntime?.usage.find((row) => row.key === key)
  const rootActionId = input.context.provenance.triggerChainId
  const commandId = input.trigger ? JSON.stringify([rootActionId, input.trigger.id]) : rootActionId
  const instanceId = input.trigger ? JSON.stringify([key, input.trigger.id]) : key
  if (
    usage?.commandId === commandId ||
    input.context.triggerGuard.executedInstanceIds.includes(instanceId)
  )
    issues.push({
      code: 'duplicate-command',
      message: 'This captured activation already committed.',
    })
  if (
    input.trigger &&
    !consumeCombatTrigger(input.context.triggerGuard, { instanceId, depth: input.trigger.depth })
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
  const unit = input.state.tactical.battle.combatants.find((row) => row.id === input.actorId)
  for (const cost of behavior.costs) {
    const available =
      cost.resource === 'ap'
        ? (unit?.temporaryResources.find((row) => row.key === 'pv1f.action-economy')?.current ?? 0)
        : cost.resource === 'hp'
          ? Math.max(0, (unit?.hp ?? 0) - 1)
          : (unit?.mp ?? 0)
    if (available < cost.amount)
      issues.push({
        code:
          cost.resource === 'ap'
            ? 'insufficient-ap'
            : cost.resource === 'hp'
              ? 'insufficient-hp'
              : 'insufficient-mp',
        message: `Insufficient ${cost.resource.toUpperCase()} for atomic Ability payment.`,
      })
  }
  return { ...evaluation, legal: issues.length === 0, issues }
}

export function activateCombatAbility(
  input: CombatAbilityActivationInput,
): CombatResolutionTransition {
  const evaluation = evaluateCombatAbility(input)
  if (!evaluation.legal)
    throw new Error(`${evaluation.issues[0]?.code}: ${evaluation.issues[0]?.message}`)
  const source = captureCombatAbilitySource(input.source)
  const behavior = combatAbilityBehavior(source, input.behaviorId)
  const action = materializeCombatAbilityAction(source, behavior)
  const key = usageKey(input.state, source, behavior)
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
          for (const cost of behavior.costs) {
            if (cost.amount === 0) continue
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
          return next
        }),
      },
    },
  }
  const tracking = paid.abilityRuntime ?? {
    schemaVersion: 1,
    activeSourceIds: [source.sourceInstanceId],
    usage: [],
    maintained: [],
  }
  const instanceId = input.trigger ? JSON.stringify([key, input.trigger.id]) : key
  paid = {
    ...paid,
    capturedAbilitySources: paid.capturedAbilitySources?.some(
      (row) => row.sourceInstanceId === source.sourceInstanceId,
    )
      ? paid.capturedAbilitySources
      : [...(paid.capturedAbilitySources ?? []), source],
    abilityRuntime: {
      ...tracking,
      usage: [
        ...tracking.usage.filter((row) => row.key !== key),
        {
          key,
          rootActionId: input.context.provenance.triggerChainId,
          commandId: input.trigger
            ? JSON.stringify([input.context.provenance.triggerChainId, input.trigger.id])
            : input.context.provenance.triggerChainId,
          ownerCycle: combatTurnCycle(paid, input.actorId),
          round: paid.tactical.battle.round,
          battleId: paid.tactical.battle.battleId,
        },
      ],
    },
  }
  const triggerGuard = input.trigger
    ? consumeCombatTrigger(input.context.triggerGuard, { instanceId, depth: input.trigger.depth })
        .guard
    : {
        ...input.context.triggerGuard,
        executedInstanceIds: [...input.context.triggerGuard.executedInstanceIds, key],
      }
  const context: CombatResolutionContext = {
    provenance: createCombatActionProvenance({
      rulesetVersion: input.state.tactical.battle.rulesVersion,
      sourceKind: source.sourceKind,
      actionDefinitionId: source.abilityId,
      actionVersion: source.contentVersion,
      sourceCombatantId: input.actorId,
      controllerCombatantId: input.actorId,
      triggerChainId: input.context.provenance.triggerChainId,
    }),
    triggerGuard,
    ...(behavior.activation === 'automatic'
      ? { executionAuthority: { activation: 'automatic', actorId: input.actorId } }
      : {}),
  }
  const out = executeCombatAction(paid, action, input.selection, input.content, context)
  return { ...out, events: [...paymentEvents, ...out.events] }
}

export function reconcileCombatAbilitySources(
  state: CombatEncounterState,
  sources: readonly CapturedCombatAbilitySource[],
): CombatEncounterState {
  const captured = sources.map(captureCombatAbilitySource)
  if (new Set(captured.map((source) => source.sourceInstanceId)).size !== captured.length)
    throw new TypeError('duplicate-captured-source')
  for (const source of captured) {
    const previous = state.capturedAbilitySources?.find(
      (row) => row.sourceInstanceId === source.sourceInstanceId,
    )
    if (previous && JSON.stringify(previous) !== JSON.stringify(source))
      throw new TypeError('captured-source-cannot-change-in-place')
  }
  const maintained: CombatMaintainedAbilityContribution[] = []
  for (const source of captured) {
    const owner = state.tactical.battle.combatants.find((row) => row.id === source.ownerCombatantId)
    if (!owner || owner.hp <= 0 || state.tactical.battle.lifecycle !== 'active') continue
    for (const behavior of source.definition.behaviors) {
      if (
        behavior.activation !== 'ongoing' ||
        !evaluateAbilityRequirements(behavior.requirements, {
          owner: combatAbilitySubject(state, source.ownerCombatantId),
        })
      )
        continue
      for (const effect of behavior.effects) {
        if (effect.payload.type !== 'damage-bonus') throw new TypeError('unsupported-ongoing-tag')
        maintained.push({
          sourceInstanceId: source.sourceInstanceId,
          ownerCombatantId: source.ownerCombatantId,
          behaviorId: behavior.id,
          effectId: effect.id,
          multiplierBasisPoints: effect.payload.multiplierBasisPoints,
        })
      }
    }
  }
  return {
    ...state,
    capturedAbilitySources: [
      ...(state.capturedAbilitySources ?? []),
      ...captured.filter(
        (source) =>
          !state.capturedAbilitySources?.some(
            (old) => old.sourceInstanceId === source.sourceInstanceId,
          ),
      ),
    ],
    abilityRuntime: {
      schemaVersion: 1,
      activeSourceIds: captured.map((row) => row.sourceInstanceId),
      usage: state.abilityRuntime?.usage ?? [],
      maintained,
    },
  }
}
