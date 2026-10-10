import {
  prepareCombatAbilityCommand,
  commitCombatAbilityCommand,
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
import {
  evaluateAbilityRequirements,
  type AbilityRequirementContext,
  type AbilityRequirementSubjectState,
} from './combat-requirements'
import { createCombatActionProvenance, createCombatTriggerGuard } from './combat-kernel-types'

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
  readonly nextCommandSequence?: number
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
    effectTimingModes: behavior.effects.map((effect) => effect.timing),
    effectOrigins: behavior.effects.map((effect) => ({
      sourceInstanceId: source.sourceInstanceId,
      behaviorId: behavior.id,
      effectId: effect.id,
      family: source.sourceKind === 'essence' ? 'essence' : 'skill',
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
    statusIds:
      state.statusState
        .find((row) => row.combatantId === id)
        ?.statuses.filter((row) => row.timingState !== 'pending')
        .map((row) => row.statusId) ?? [],
    primeAbilityIds: [],
  }
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
      ...state.abilityRuntime,
      schemaVersion: 1,
      activeSourceIds: captured.map((row) => row.sourceInstanceId),
      usage: state.abilityRuntime?.usage ?? [],
      maintained,
      ...(state.abilityRuntime?.nextCommandSequence === undefined
        ? {}
        : { nextCommandSequence: state.abilityRuntime.nextCommandSequence }),
    },
  }
}
