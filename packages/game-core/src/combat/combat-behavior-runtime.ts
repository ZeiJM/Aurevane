import { readSkillCooldown } from './skill-cooldowns'
import { pruneCombatAbilityActionHistory } from './combat-ability-state'
import { hasCurrentPoison, hasCurrentBleed, currentBurnInstance } from './combat-dots'
import {
  prepareCombatAbilityCommand,
  commitCombatAbilityCommand,
  combatAbilityParticipant,
  combatAbilityParticipantIssues,
  combatAbilityCostIssues,
  type ManualCombatModifierSelection,
} from './combat-ability-command'
import {
  type CombatEncounterState,
  type CombatContentCatalog,
  type CombatResolutionContext,
  type CombatActionDefinition,
  type CombatActionEvaluation,
  type CombatResolutionTransition,
  type CombatTargetSelection,
} from './actions'
import {
  captureCombatAbilitySource,
  type CapturedCombatAbilitySource,
} from './combat-behavior-capture'
import type { AbilityBehavior } from './combat-definition'
import { nativeCombatTagPayload } from './combat-tag-registry'
import { canonicalCombatEffectRecipients } from './combat-targeting-shapes'
import {
  evaluateAbilityRequirements,
  evaluateAutomaticRequirementTrigger,
  type AbilityRequirementContext,
  type AbilityRequirementSubjectState,
  type RequirementNode,
} from './combat-requirements'
import { createCombatActionProvenance, createCombatTriggerGuard } from './combat-kernel-types'

interface CombatAbilityUsage {
  readonly key: string
  readonly rootActionId: string
  readonly pendingRootActionIds?: readonly string[]
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
  readonly nextCommandSequence?: number
  readonly conditionTruth?: readonly {
    readonly sourceInstanceId: string
    readonly behaviorId: string
    readonly holds: boolean
  }[]
}
export function combatAbilityCommandContext(
  state: CombatEncounterState,
  source: Pick<
    CapturedCombatAbilitySource,
    'ownerCombatantId' | 'abilityId' | 'contentVersion' | 'sourceKind'
  >,
): CombatResolutionContext {
  const triggerChainId = JSON.stringify([
    'ability',
    state.tactical.battle.battleId,
    state.tactical.battle.turnNumber,
    state.abilityRuntime?.nextCommandSequence ?? 1,
  ])
  return {
    provenance: createCombatActionProvenance({
      rulesetVersion: state.tactical.battle.rulesVersion,
      sourceKind: source.sourceKind,
      actionDefinitionId: source.abilityId,
      actionVersion: source.contentVersion,
      sourceCombatantId: source.ownerCombatantId,
      controllerCombatantId: source.ownerCombatantId,
      triggerChainId,
    }),
    triggerGuard: createCombatTriggerGuard({ triggerChainId }),
  }
}
export interface CombatAbilityActivationInput {
  readonly state: CombatEncounterState
  readonly actorId: string
  readonly source: CapturedCombatAbilitySource
  readonly behaviorId?: string
  readonly manualModifiers?: readonly ManualCombatModifierSelection[]
  readonly selection: CombatTargetSelection
  readonly content: CombatContentCatalog
  readonly context: CombatResolutionContext
  readonly trigger?: {
    readonly rootActionId?: string
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
  const target = behavior.targeting
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
    target: { ...target, geometryVersion: target.geometryVersion ?? 2 },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    ...(behavior.cooldown ? { cooldown: behavior.cooldown } : {}),
    ...(behavior.accuracy ? { accuracyRule: behavior.accuracy } : {}),
    effects: behavior.effects.map((effect) =>
      canonicalCombatEffectRecipients(nativeCombatTagPayload(effect.payload), target),
    ),
    effectTimingModes: behavior.effects.map((effect) => effect.timing),
    effectOrigins: behavior.effects.map((effect) => ({
      sourceInstanceId: source.sourceInstanceId,
      behaviorId: behavior.id,
      effectId: effect.id,
      family:
        source.sourceKind === 'resonance'
          ? 'resonance'
          : source.sourceKind === 'essence'
            ? 'essence'
            : 'skill',
      contentId: source.abilityId,
      contentVersion: source.contentVersion,
    })),
  }
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
    statusIds: [
      ...new Set([
        ...(state.statusState
          .find((row) => row.combatantId === id)
          ?.statuses.filter((row) => row.timingState !== 'pending')
          .map((row) => row.statusId) ?? []),
        ...(hasCurrentPoison(state, unit.id) ? ['poison'] : []),
        ...(hasCurrentBleed(state, unit.id) ? ['bleed'] : []),
        ...(currentBurnInstance(state, unit.id) ? ['burn'] : []),
      ]),
    ],
    primeAbilityIds: [],
  }
}

/** Safe owner-relative quote; final compatibility/aggregate eligibility requires the selected action. */
export interface CombatManualModifierAvailability {
  readonly ownerCombatantId: string
  readonly sourceInstanceId: string
  readonly behaviorId: string
  readonly name: string
  readonly type: 'manual-modifier'
  readonly costs: AbilityBehavior['costs']
  readonly cooldown:
    (NonNullable<AbilityBehavior['cooldown']> & { readonly ticksRemaining: number }) | null
  readonly ownerEligible: boolean
  readonly blockedReasons: readonly string[]
  readonly requiresAction: true
}
function ownerRequirementTruth(
  node: RequirementNode | null,
  owner: AbilityRequirementSubjectState | null,
): boolean | null {
  if (!node) return true
  if (node.kind === 'all' || node.kind === 'any') {
    const values = node.children.map((child) => ownerRequirementTruth(child, owner))
    if (node.kind === 'all')
      return values.includes(false) ? false : values.includes(null) ? null : true
    return values.includes(true) ? true : values.includes(null) ? null : false
  }
  if (
    node.kind === 'action' ||
    node.kind === 'event' ||
    node.kind === 'resource-threshold-crossing' ||
    node.subject !== 'owner'
  )
    return null
  return evaluateAbilityRequirements(node, { owner })
}
export function combatManualModifierAvailability(
  state: CombatEncounterState,
  ownerCombatantId: string,
): readonly CombatManualModifierAvailability[] {
  const owner = state.tactical.battle.combatants.find((unit) => unit.id === ownerCombatantId)
  if (!owner) return []
  return (state.capturedAbilitySources ?? [])
    .filter(
      (source) =>
        source.ownerCombatantId === ownerCombatantId &&
        ['discipline-skill', 'essence', 'resonance'].includes(source.sourceKind) &&
        state.abilityRuntime?.activeSourceIds.includes(source.sourceInstanceId),
    )
    .flatMap((source) =>
      source.definition.behaviors
        .filter((behavior) => behavior.activation === 'manual' && behavior.mode === 'modifier')
        .map((behavior) => {
          const input = {
            state,
            actorId: ownerCombatantId,
            context: combatAbilityCommandContext(state, source),
          }
          const reasons = [
            ...combatAbilityParticipantIssues(
              input,
              combatAbilityParticipant(source, behavior),
            ).map((issue) => issue.code),
            ...combatAbilityCostIssues(input, behavior.costs).map((issue) => issue.code),
            ...(state.tactical.battle.lifecycle !== 'active' ? ['battle-ended'] : []),
            ...(state.tactical.battle.currentTurn?.combatantId !== ownerCombatantId
              ? ['turn-unavailable']
              : []),
            ...(ownerRequirementTruth(
              behavior.requirements,
              combatAbilitySubject(state, ownerCombatantId),
            ) === false
              ? ['requirement-not-met']
              : []),
          ]
          const blockedReasons = [...new Set(reasons)].sort()
          return {
            ownerCombatantId,
            sourceInstanceId: source.sourceInstanceId,
            behaviorId: behavior.id,
            name: behavior.id,
            type: 'manual-modifier' as const,
            costs: behavior.costs.map((cost) => ({ resource: cost.resource, amount: cost.amount })),
            cooldown: behavior.cooldown
              ? {
                  key: behavior.cooldown.key,
                  ownerTurns: behavior.cooldown.ownerTurns,
                  ticksRemaining: readSkillCooldown(owner, behavior.cooldown).ticksRemaining,
                }
              : null,
            ownerEligible: blockedReasons.length === 0,
            blockedReasons,
            requiresAction: true as const,
          }
        }),
    )
    .sort((a, b) =>
      a.sourceInstanceId < b.sourceInstanceId
        ? -1
        : a.sourceInstanceId > b.sourceInstanceId
          ? 1
          : a.behaviorId < b.behaviorId
            ? -1
            : a.behaviorId > b.behaviorId
              ? 1
              : 0,
    )
}

export function evaluateCombatAbility(input: CombatAbilityActivationInput): CombatActionEvaluation {
  return prepareCombatAbilityCommand({
    ...input,
    root: { kind: 'canonical', source: input.source, behaviorId: input.behaviorId },
  }).evaluation
}

export function activateCombatAbility(
  input: CombatAbilityActivationInput,
): CombatResolutionTransition {
  return commitCombatAbilityCommand({
    ...input,
    root: { kind: 'canonical', source: input.source, behaviorId: input.behaviorId },
  })
}

export function reconcileCombatAbilitySources(
  state: CombatEncounterState,
  sources: readonly CapturedCombatAbilitySource[],
): CombatEncounterState {
  state = pruneCombatAbilityActionHistory(state)
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
      ...(state.capturedAbilitySources ?? []).map(captureCombatAbilitySource),
      ...captured.filter(
        (source) =>
          !state.capturedAbilitySources?.some(
            (old) => old.sourceInstanceId === source.sourceInstanceId,
          ),
      ),
    ],
    abilityRuntime: {
      ...state.abilityRuntime,
      schemaVersion: 1,
      activeSourceIds: captured.map((row) => row.sourceInstanceId),
      usage: state.abilityRuntime?.usage ?? [],
      maintained,
      conditionTruth: [
        ...(state.abilityRuntime?.conditionTruth ?? []),
        ...captured.flatMap((source) =>
          source.definition.behaviors
            .filter(
              (behavior) =>
                behavior.activation === 'automatic' &&
                behavior.mode === 'action' &&
                !state.abilityRuntime?.conditionTruth?.some(
                  (row) =>
                    row.sourceInstanceId === source.sourceInstanceId &&
                    row.behaviorId === behavior.id,
                ),
            )
            .map((behavior) => ({
              sourceInstanceId: source.sourceInstanceId,
              behaviorId: behavior.id,
              holds: evaluateAutomaticRequirementTrigger(
                behavior.requirements,
                { owner: combatAbilitySubject(state, source.ownerCombatantId) },
                true,
              ).stateTruth,
            })),
        ),
      ],
      ...(state.abilityRuntime?.nextCommandSequence === undefined
        ? {}
        : { nextCommandSequence: state.abilityRuntime.nextCommandSequence }),
    },
  }
}

/** Strict restore validation happens at the owning encounter reader; this never dispatches. */
export function refreezeCapturedCombatAbilityState<State extends CombatEncounterState>(
  state: State,
): State {
  if (!state.capturedAbilitySources) return state
  return reconcileCombatAbilitySources(
    state,
    state.capturedAbilitySources.filter((source) =>
      state.abilityRuntime?.activeSourceIds.includes(source.sourceInstanceId),
    ),
  ) as State
}
