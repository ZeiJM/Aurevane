import { moveCurrentCombatant, type GridPosition } from './board'
import { airborneMovementTactical } from './combat-airborne'
import { capturedBasicSkillSource } from './combat-basic-actions'
import { evaluatePreparedCombatWalking } from './combat-walking'
import { resolveCombatTargeting } from './actions'
import { prepareCombatAbilityCommand, commitCombatAbilityCommand } from './combat-ability-command'
import type { ManualCombatModifierSelection } from './combat-ability-command'
import {
  combatAbilityCommandContext,
  combatAbilityBehavior,
  primeCombatControlledAbility,
  cancelCombatControlledAbility,
  combatManualModifierAvailability,
} from './combat-behavior-runtime'
import { isControlledCombatAbility, combatControlledPrime } from './combat-controlled'
import { applyAbilityTimingDefaults, type AbilityBehavior } from './combat-definition'
import { combatEffectTimingMode } from './combat-effect-timing'
import type { CapturedCombatAbilitySource } from './combat-behavior-capture'
import { outgoingSuppressionBasisPoints } from './combat-suppress'
import {
  canonicalAbilityTargetSpec,
  canonicalAbilitySupportsFireGroundIntent,
  enumerateCombatTargetSelections,
} from './combat-targeting-shapes'
import { buildCombatAiPluralSelection } from './combat-ai-plural-selection'
import { terrainOverlayAiUtility, terrainOverlayAt } from './terrain-overlays'
import { combatStatusDetails } from './status-content'
import { hasGameplayTag } from './gameplay-tags'
import { isMaterializedCombatEffect } from './summon-content'
import { readSkillCooldown } from './skill-cooldowns'
import type {
  CombatActionEvaluation,
  CombatEffectDefinition,
  CombatTargetSelection,
} from './actions'
import { readBattleAuthorityCombatBuildSnapshot } from './battle-authority-build-snapshot'
import { resolveEssenceForBuild } from './essence'
import { resolveMatureSkillVersion, type MatureSkillDefinition } from './mature-skills'
import {
  committedResonanceForecast,
  executePv1fAction,
  executePv1fMatureSkill,
  evaluatePv1fMatureSkill,
  evaluatePv1fAction,
  readPv1fActionEconomy,
  evaluatePv1fMovement,
  spendPv1fActionEconomy,
  preparePv1fTurnEconomy,
  PV1F_COMBAT_CONTENT,
  PV1F_BASIC_ATTACK_ID,
  type Pv1fTransition,
} from './pv1f-action-economy'
import {
  chooseRecruitAiDecision,
  RECRUIT_EASY_PROFILE,
  RECRUIT_STANDARD_PROFILE,
  type RecruitAiDecision,
  type RecruitAiProfile,
} from './recruit-ai'
import { normalizedResonanceMechanics } from './resonance-v2'
import {
  reattachStatDrivenCombatBridge,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'

interface BuildSkillCandidate {
  controlledOperation?: 'prime'
  actionId: string
  definition?: MatureSkillDefinition
  behaviorId?: string
  movementPath?: readonly GridPosition[]
  manualModifiers?: readonly ManualCombatModifierSelection[]
  recovery?: boolean
  target: CombatTargetSelection
  evaluation: CombatActionEvaluation
  utility: number
  apCost?: number
  effectUtility?: number
  stableKey: string
}

export interface BuildAwareRecruitAiSkillOptions {
  committedSkills?: readonly MatureSkillDefinition[]
  canonicalSources?: readonly CapturedCombatAbilitySource[]
}

export function chooseBuildAwareRecruitAiDecision(input: {
  state: StatDrivenCombatEncounterState
  profile?: RecruitAiProfile
  tieBreakSeed: number
  skillOptions?: BuildAwareRecruitAiSkillOptions
}): RecruitAiDecision {
  const baseline = chooseRecruitAiDecision(input)
  const actorId = input.state.tactical.battle.currentTurn?.combatantId
  if (!actorId) return baseline

  const committed =
    input.skillOptions?.committedSkills ?? committedMatureSkills(input.state, actorId)
  const sources = activeCanonicalSources(input.state, actorId, input.skillOptions)
  const modifierBundles = manualModifierBundles(
    input.state,
    actorId,
    (input.profile ?? RECRUIT_STANDARD_PROFILE).maxCandidates,
  )
  const skillCandidates = [
    ...canonicalSkillCandidates(
      input.state,
      sources,
      input.profile ?? RECRUIT_STANDARD_PROFILE,
      baseline,
      modifierBundles,
    ),
    ...committed
      .filter((definition) => !sources.some((source) => source.abilityId === definition.id))
      .flatMap((definition) =>
        buildSkillCandidates(
          input.state,
          definition,
          input.profile ?? RECRUIT_STANDARD_PROFILE,
          modifierBundles,
        ),
      ),
    ...(!sources.some((source) => canonicalSourceActionId(source) === PV1F_BASIC_ATTACK_ID)
      ? nativeBasicModifierCandidates(
          input.state,
          input.profile ?? RECRUIT_STANDARD_PROFILE,
          modifierBundles,
        )
      : []),
  ].sort((left, right) => {
    if (left.utility !== right.utility) return right.utility - left.utility
    const attachments = (left.manualModifiers?.length ?? 0) - (right.manualModifiers?.length ?? 0)
    if (attachments) return attachments
    return left.stableKey.localeCompare(right.stableKey)
  })
  const selected = skillCandidates[0]
  const immediate: RecruitAiDecision =
    !selected || selected.utility <= baseline.utility
      ? { ...baseline, candidateCount: baseline.candidateCount + skillCandidates.length }
      : {
          intent: selected.controlledOperation
            ? {
                kind: 'ability-prime',
                actionId: selected.actionId,
                behaviorId: selected.behaviorId!,
                ...(selected.manualModifiers?.length
                  ? { manualModifiers: selected.manualModifiers.map((row) => ({ ...row })) }
                  : {}),
              }
            : {
                kind: 'action',
                actionId: selected.actionId,
                target: copyTarget(selected.target),
                ...(selected.behaviorId ? { behaviorId: selected.behaviorId } : {}),
                ...(selected.manualModifiers?.length
                  ? { manualModifiers: selected.manualModifiers.map((row) => ({ ...row })) }
                  : {}),
                ...(selected.movementPath
                  ? { movementPath: selected.movementPath.map((position) => ({ ...position })) }
                  : {}),
              },
          reason: selected.controlledOperation
            ? 'prepare-controlled'
            : selected.recovery || selected.definition?.tags.includes('heal')
              ? 'recover-survival'
              : 'legal-damage',
          utility: selected.utility,
          candidateCount: baseline.candidateCount + skillCandidates.length,
          profileId: baseline.profileId,
          profileVersion: baseline.profileVersion,
          rulesVersion: baseline.rulesVersion,
        }
  const reposition = rangedReposition(
    input.state,
    sources,
    input.profile ?? RECRUIT_STANDARD_PROFILE,
    skillCandidates,
    baseline,
    immediate,
  )
  return reposition ?? immediate
}

/** A movement opportunity, never a promised attack or a simulation of future random rolls. */
function rangedAction(behavior: AbilityBehavior): boolean {
  return (
    behavior.activation === 'manual' &&
    behavior.mode === 'action' &&
    behavior.classification === 'attack' &&
    (behavior.targeting?.minimumRange ?? 0) >= 2 &&
    !behavior.effects.some((effect) => effect.payload.type === 'move')
  )
}
function repeatableBasicAttack(state: StatDrivenCombatEncounterState, actorId: string): boolean {
  const source = capturedBasicSkillSource(state, actorId, 'unarmed.basic')
  if (!source) return true // Historical native Basic has only its ordinary AP payment.
  const behavior =
    source.definition.behaviors[0] &&
    applyAbilityTimingDefaults(source.definition.behaviors[0], state.effectTimingPolicy)
  return (
    !!behavior &&
    source.definition.behaviors.length === 1 &&
    !behavior.cooldown &&
    !behavior.requirements &&
    !behavior.activationLimits?.length &&
    behavior.costs.every((cost) => cost.resource === 'ap') &&
    behavior.effects.length === 1 &&
    !behavior.effects[0]!.requirements &&
    (behavior.effects[0]!.timing ?? combatEffectTimingMode(state.effectTimingPolicy, 'damage')) ===
      'instant' &&
    ['damage', 'pierce'].includes(behavior.effects[0]!.payload.type)
  )
}
function rangedReposition(
  state: StatDrivenCombatEncounterState,
  sources: readonly CapturedCombatAbilitySource[],
  profile: RecruitAiProfile,
  immediateCandidates: readonly BuildSkillCandidate[],
  baseline: RecruitAiDecision,
  immediate: RecruitAiDecision,
): RecruitAiDecision | null {
  if (!sources.some((source) => source.definition.behaviors.some(rangedAction))) return null
  // Historical native Skill choice/ranking is preserved by this canonical-only extension.
  if (immediateCandidates[0]?.definition && immediate.utility > baseline.utility) return null
  const prepared = preparePv1fTurnEconomy(state)
  const actorId = prepared.tactical.battle.currentTurn!.combatantId
  const origin = prepared.tactical.placements.find((row) => row.combatantId === actorId)!.position
  const actor = prepared.tactical.battle.combatants.find((row) => row.id === actorId)!
  const ready = sources.flatMap((source) =>
    source.definition.behaviors.filter(
      (behavior) =>
        rangedAction(behavior) &&
        (!behavior.cooldown || !readSkillCooldown(actor, behavior.cooldown).active),
    ),
  )
  const minimumAp = Math.min(
    ...ready.map((behavior) =>
      behavior.costs
        .filter((cost) => cost.resource === 'ap')
        .reduce((sum, cost) => sum + cost.amount, 0),
    ),
  )
  const availableAp = readPv1fActionEconomy(prepared)?.current ?? 0
  if (availableAp <= minimumAp) return null
  const visibleEnemies = prepared.tactical.battle.combatants.filter(
    (unit) =>
      unit.teamId !== actor.teamId &&
      unit.hp > 0 &&
      !hasGameplayTag(prepared, unit.id, 'Invisible', PV1F_COMBAT_CONTENT),
  )
  const hasRangeGap = visibleEnemies.some((unit) => {
    const position = prepared.tactical.placements.find(
      (row) => row.combatantId === unit.id,
    )?.position
    if (!position) return false
    const distance = Math.abs(origin.x - position.x) + Math.abs(origin.y - position.y)
    return ready.some(
      (behavior) =>
        distance < behavior.targeting!.minimumRange || distance > behavior.targeting!.maximumRange,
    )
  })
  if (!hasRangeGap) return null
  let currentValuePerAp = 0
  let basicTurnBenchmark: number | undefined
  for (const candidate of immediateCandidates) {
    if (candidate.apCost !== undefined && candidate.effectUtility !== undefined)
      currentValuePerAp = Math.max(
        currentValuePerAp,
        candidate.apCost === 0
          ? candidate.effectUtility > 0
            ? Infinity
            : 0
          : candidate.effectUtility / candidate.apCost,
      )
  }
  if (baseline.intent.kind === 'action') {
    try {
      const plain = evaluatePv1fAction(
        prepared,
        baseline.intent.actionId,
        baseline.intent.target,
        baseline.intent,
      )
      if (plain.evaluation.legal && plain.cost >= 0)
        currentValuePerAp = Math.max(
          currentValuePerAp,
          plain.cost === 0
            ? projectedCombatEffectUtility(plain.evaluation, plain.prepared, plain.action.effects) >
              0
              ? Infinity
              : 0
            : projectedCombatEffectUtility(plain.evaluation, plain.prepared, plain.action.effects) /
                plain.cost,
        )
      if (
        baseline.intent.actionId === PV1F_BASIC_ATTACK_ID &&
        plain.evaluation.legal &&
        plain.cost > 0 &&
        repeatableBasicAttack(prepared, actorId)
      )
        basicTurnBenchmark =
          Math.floor(availableAp / plain.cost) *
          projectedCombatEffectUtility(plain.evaluation, plain.prepared, plain.action.effects)
    } catch {
      /* Canonical candidates above carry their exact shared quotes. */
    }
  }
  // A single foe rarely repays extra walking; keep that probe deliberately small.
  const budget = {
    remaining: Math.min(
      Math.floor(profile.maxCandidates / 3),
      visibleEnemies.length === 1 ? 4 : Infinity,
    ),
  }
  let best: { intent: RecruitAiDecision['intent']; utility: number; key: string } | undefined
  let candidates = 0
  for (const destination of [
    { x: origin.x, y: origin.y - 1 },
    { x: origin.x + 1, y: origin.y },
    { x: origin.x, y: origin.y + 1 },
    { x: origin.x - 1, y: origin.y },
  ]) {
    if (budget.remaining <= 0) break
    // Entry effects can interrupt walking. This narrow projection does not invent their outcomes.
    if (
      prepared.groundAreas?.some((area) =>
        area.tiles.some((tile) => tile.x === destination.x && tile.y === destination.y),
      )
    )
      continue
    const path = [origin, destination]
    try {
      const move = capturedBasicSkillSource(prepared, actorId, 'basic.move')
      let cost: number, intent: RecruitAiDecision['intent']
      if (
        move?.basic?.execution.kind === 'basic-move' &&
        move.basic.execution.costBasis === 'flat'
      ) {
        const walking =
          move.definition.behaviors[0] &&
          applyAbilityTimingDefaults(move.definition.behaviors[0], prepared.effectTimingPolicy)
        // Rich flat Move can pay other resources, change effects or start clocks.
        // This optional opportunity projects only unconditional AP-paid walking.
        if (
          move.definition.behaviors.length !== 1 ||
          !walking ||
          walking.classification !== 'utility' ||
          walking.targeting?.kind !== 'self' ||
          walking.costs.some((cost) => cost.resource !== 'ap') ||
          walking.cooldown ||
          walking.requirements ||
          walking.activationLimits?.length ||
          walking.effects.length !== 1 ||
          walking.effects[0]!.requirements ||
          walking.effects[0]!.timing !== 'instant' ||
          walking.effects[0]!.payload.type !== 'move'
        )
          continue
        const quote = evaluatePv1fAction(
          prepared,
          'basic.move',
          { kind: 'self' },
          { movementPath: path },
        )
        if (
          !quote.evaluation.legal ||
          evaluatePreparedCombatWalking(prepared, path, PV1F_COMBAT_CONTENT).poisonForecast
            .triggeredTicks > 0
        )
          continue
        cost = quote.cost
        intent = {
          kind: 'action',
          actionId: 'basic.move',
          target: { kind: 'self' },
          movementPath: path,
        }
      } else {
        const quote = evaluatePv1fMovement(prepared, path)
        if (!quote.movement.legal || quote.poisonForecast.triggeredTicks > 0) continue
        cost = quote.economyCost
        intent = { kind: 'move', path: quote.movement.path }
      }
      if (cost <= 0 || cost + minimumAp > availableAp) continue
      const moved = moveCurrentCombatant(
        airborneMovementTactical(prepared, PV1F_COMBAT_CONTENT),
        path,
        'entered-tiles',
        prepared.statBalancePolicyVersion,
        prepared.airborneJumpPolicyVersion,
      )
      const projected = spendPv1fActionEconomy(
        {
          ...prepared,
          tactical: {
            ...prepared.tactical,
            ...moved.state,
            movementProfiles: prepared.tactical.movementProfiles,
          },
        },
        cost,
      )
      const followups = canonicalSkillCandidates(
        projected,
        sources,
        profile,
        baseline,
        manualModifierBundles(projected, actorId, profile.maxCandidates),
        budget,
      )
      for (const next of followups) {
        if (
          next.apCost === undefined ||
          next.effectUtility === undefined ||
          next.effectUtility <= 0
        )
          continue
        if (next.effectUtility / (cost + next.apCost) <= currentValuePerAp) continue
        // A small per-AP improvement can still lose a whole Basic turn and invite
        // the ordinary close-distance planner to walk straight back after the shot.
        // This conservative single-foe benchmark reuses the current pure Basic quote;
        // it neither queues repeated attacks nor predicts their future effects/RNG.
        if (
          visibleEnemies.length === 1 &&
          basicTurnBenchmark !== undefined &&
          next.effectUtility <= basicTurnBenchmark
        )
          continue
        const utility = next.utility - cost / 5
        if (utility <= immediate.utility) continue
        candidates++
        const key = JSON.stringify([destination, next.stableKey])
        if (!best || utility > best.utility || (utility === best.utility && key < best.key))
          best = { intent, utility, key }
      }
    } catch {
      /* Illegal or unaffordable paths are ordinary unavailable opportunities. */
    }
  }
  return best
    ? {
        ...immediate,
        intent: best.intent,
        reason: 'ranged-spacing',
        utility: best.utility,
        candidateCount: immediate.candidateCount + candidates,
      }
    : null
}

export function executeBuildAwareRecruitAiAction(
  state: StatDrivenCombatEncounterState,
  actionId: string,
  target: CombatTargetSelection,
  skillOptions: BuildAwareRecruitAiSkillOptions = {},
  commandOptions: {
    readonly behaviorId?: string
    readonly controlledOperation?: 'prime' | 'cancel'
    readonly movementPath?: readonly GridPosition[]
    readonly manualModifiers?: readonly ManualCombatModifierSelection[]
  } = {},
): Pv1fTransition {
  const actorId = state.tactical.battle.currentTurn?.combatantId
  if (!actorId) throw new Error('Build-aware Recruit AI action requires an active turn.')
  const source = activeCanonicalSources(state, actorId, skillOptions).find(
    (row) => canonicalSourceActionId(row) === actionId,
  )
  if (source) {
    if (commandOptions.controlledOperation) {
      const behavior = combatAbilityBehavior(
        source,
        commandOptions.behaviorId,
        state.effectTimingPolicy,
      )
      const transition = (
        commandOptions.controlledOperation === 'prime'
          ? primeCombatControlledAbility
          : cancelCombatControlledAbility
      )({
        state,
        actorId,
        sourceInstanceId: source.sourceInstanceId,
        behaviorId: behavior.id,
        ...(commandOptions.controlledOperation === 'prime'
          ? { manualModifiers: commandOptions.manualModifiers }
          : {}),
      })
      return {
        ...transition,
        state: reattachStatDrivenCombatBridge(
          transition.state,
          (transition.state as StatDrivenCombatEncounterState).statBridge ?? state.statBridge,
        ),
      }
    }
    const prepared = preparePv1fTurnEconomy(state)
    const transition = commitCombatAbilityCommand({
      state: prepared,
      actorId,
      root: { kind: 'canonical', source, behaviorId: commandOptions.behaviorId },
      selection: target,
      movementPath: commandOptions.movementPath,
      manualModifiers: commandOptions.manualModifiers,
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(prepared, source),
    })
    return {
      ...transition,
      state: reattachStatDrivenCombatBridge(
        transition.state,
        (transition.state as StatDrivenCombatEncounterState).statBridge ?? prepared.statBridge,
      ),
    }
  }

  if (commandOptions.controlledOperation) throw new TypeError('controlled-source-unavailable')
  const definition = (skillOptions.committedSkills ?? committedMatureSkills(state, actorId)).find(
    (candidate) => candidate.id === actionId,
  )
  if (definition) {
    return executePv1fMatureSkill(state, definition, target, 'pve', commandOptions)
  }
  return executePv1fAction(state, actionId, target, commandOptions)
}

function activeCanonicalSources(
  state: StatDrivenCombatEncounterState,
  actorId: string,
  options?: BuildAwareRecruitAiSkillOptions,
): readonly CapturedCombatAbilitySource[] {
  return (options?.canonicalSources ?? state.capturedAbilitySources ?? []).filter(
    (source) =>
      source.ownerCombatantId === actorId &&
      ['discipline-skill', 'essence', 'resonance', 'basic'].includes(source.sourceKind) &&
      !(
        source.basic?.execution.kind === 'basic-move' &&
        source.basic.execution.costBasis === 'per-terrain-point'
      ) &&
      state.abilityRuntime?.activeSourceIds.includes(source.sourceInstanceId),
  )
}
/** Bounded planning only: omission, singles, then stable breadth-first combinations.
 * Every selected bundle is re-quoted atomically; no explicit command is truncated. */
function manualModifierBundles(
  state: StatDrivenCombatEncounterState,
  owner: string,
  maximum: number,
): readonly (readonly ManualCombatModifierSelection[])[] {
  const references = combatManualModifierAvailability(state, owner)
    .filter((row) => row.ownerEligible)
    .map(({ sourceInstanceId, behaviorId }) => ({ sourceInstanceId, behaviorId }))
  const bundles: ManualCombatModifierSelection[][] = [[]]
  for (let cursor = 0; cursor < bundles.length && bundles.length < maximum; cursor++) {
    const bundle = bundles[cursor]!
    if (bundle.length >= 15) continue
    const last = bundle.at(-1)
    const start = last
      ? references.findIndex(
          (row) =>
            row.sourceInstanceId === last.sourceInstanceId && row.behaviorId === last.behaviorId,
        ) + 1
      : 0
    for (let index = start; index < references.length && bundles.length < maximum; index++)
      bundles.push([...bundle, references[index]!])
  }
  return bundles
}

/** Historical encounters can have native Basics alongside canonical modifiers. */
function nativeBasicModifierCandidates(
  state: StatDrivenCombatEncounterState,
  profile: RecruitAiProfile,
  bundles: readonly (readonly ManualCombatModifierSelection[])[],
): BuildSkillCandidate[] {
  if (bundles.length <= 1) return []
  return state.tactical.battle.combatants.flatMap((unit) => {
    const target = { kind: 'unit' as const, combatantId: unit.id }
    let plain
    try {
      plain = evaluatePv1fAction(state, PV1F_BASIC_ATTACK_ID, target)
      if (!plain.evaluation.legal) return []
    } catch {
      return []
    }
    const plainUtility = projectedCombatEffectUtility(plain.evaluation, state, plain.action.effects)
    return bundles
      .filter((bundle) => bundle.length)
      .flatMap((manualModifiers) => {
        try {
          const quote = evaluatePv1fAction(state, PV1F_BASIC_ATTACK_ID, target, { manualModifiers })
          if (!quote.evaluation.legal) return []
          const utility = projectedCombatEffectUtility(
            quote.evaluation,
            state,
            quote.action.effects,
          )
          if (utility <= plainUtility) return []
          return [
            {
              actionId: PV1F_BASIC_ATTACK_ID,
              target,
              manualModifiers,
              evaluation: quote.evaluation,
              apCost: quote.cost,
              effectUtility: utility,
              utility: profile.attackUtility + utility,
              stableKey: JSON.stringify([PV1F_BASIC_ATTACK_ID, targetKey(target), manualModifiers]),
            },
          ]
        } catch {
          return []
        }
      })
  })
}
function canonicalSkillCandidates(
  state: StatDrivenCombatEncounterState,
  sources: readonly CapturedCombatAbilitySource[],
  profile: RecruitAiProfile,
  baseline: RecruitAiDecision,
  modifierBundles: readonly (readonly ManualCombatModifierSelection[])[],
  rangedBudget?: { remaining: number },
): BuildSkillCandidate[] {
  const initial = preparePv1fTurnEconomy(state)
  const actorId = initial.tactical.battle.currentTurn!.combatantId
  return sources.flatMap((source) =>
    source.definition.behaviors.flatMap((authored) => {
      const behavior = applyAbilityTimingDefaults(authored, initial.effectTimingPolicy)
      if (behavior.activation !== 'manual' || behavior.mode !== 'action' || !behavior.targeting)
        return []
      if (rangedBudget && (rangedBudget.remaining <= 0 || !rangedAction(behavior))) return []
      const targeting = canonicalAbilityTargetSpec(behavior.targeting)
      const existingPrime = combatControlledPrime(initial, source, behavior)
      const bundles = existingPrime
        ? [
            (existingPrime.manualModifiers ?? []).map(({ sourceInstanceId, behaviorId }) => ({
              sourceInstanceId,
              behaviorId,
            })),
          ]
        : modifierBundles
      return bundles.flatMap((manualModifiers) => {
        if (rangedBudget && rangedBudget.remaining <= 0) return []
        let prepared = initial
        let controlledOperation: 'prime' | undefined
        if (
          isControlledCombatAbility(behavior) &&
          !combatControlledPrime(initial, source, behavior)
        ) {
          try {
            const primed = primeCombatControlledAbility({
              state: initial,
              actorId,
              sourceInstanceId: source.sourceInstanceId,
              behaviorId: behavior.id,
              manualModifiers,
            })
            prepared = reattachStatDrivenCombatBridge(primed.state, initial.statBridge)
            controlledOperation = 'prime'
          } catch {
            return []
          }
        }
        const move = behavior.effects.find((effect) => effect.payload.type === 'move')
        // Current Fire areas distinguish Enemy from Ground intent. A captured
        // persistent Ground group must keep its area when the AI activates it.
        const groundFire =
          behavior.groundArea !== undefined &&
          canonicalAbilitySupportsFireGroundIntent(behavior, prepared.elementalDamagePolicyVersion)
        const selections = enumerateCombatTargetSelections(prepared, actorId, targeting).map(
          (selection) =>
            groundFire && (selection.kind === 'activate' || selection.kind === 'direction')
              ? { ...selection, ground: true as const }
              : selection,
        )
        const paths =
          move?.payload.type === 'move'
            ? walkingPaths(
                prepared,
                move.payload.maximumTiles,
                profile.maxCandidates,
                move.requirements != null,
              )
            : [undefined]
        return paths.flatMap((movementPath) => {
          const destination = movementPath?.at(-1)
          const spatialState = destination
            ? {
                ...prepared,
                tactical: {
                  ...prepared.tactical,
                  placements: prepared.tactical.placements.map((row) =>
                    row.combatantId === actorId ? { ...row, position: destination } : row,
                  ),
                },
              }
            : prepared
          const evaluate = (target: CombatTargetSelection): BuildSkillCandidate[] => {
            if (rangedBudget) {
              if (rangedBudget.remaining <= 0) return []
              rangedBudget.remaining--
            }
            try {
              // Only prune unconditional Move geometry. Conditional eligibility still uses S0.
              if (
                movementPath &&
                move?.requirements == null &&
                resolveCombatTargeting(
                  spatialState,
                  actorId,
                  targeting,
                  target,
                  PV1F_COMBAT_CONTENT,
                ).issues.length
              )
                return []
              const command = prepareCombatAbilityCommand({
                state: prepared,
                actorId,
                root: { kind: 'canonical', source, behaviorId: behavior.id },
                selection: target,
                movementPath,
                manualModifiers,
                content: PV1F_COMBAT_CONTENT,
                context: combatAbilityCommandContext(prepared, source),
              })
              if (!command.evaluation.legal) return []
              const utility =
                projectedCombatEffectUtility(command.evaluation, prepared, command.action.effects) +
                terrainOverlayAiUtility(prepared, command.evaluation) +
                rewindPositionUtility(command.evaluation, prepared)
              const preparingReturn =
                controlledOperation === 'prime' &&
                baseline.reason === 'close-distance' &&
                (baseline.intent.kind === 'move' ||
                  (baseline.intent.kind === 'action' && !!baseline.intent.movementPath?.length)) &&
                command.evaluation.projectedEvents.some(
                  (event) =>
                    event.event === 'combatant_rewound' &&
                    event.combatantId === actorId &&
                    (visibleEnemyDistance(prepared, actorId, event.from) ?? 0) > 1,
                )
              if (utility <= 0 && !preparingReturn) return []
              return [
                {
                  controlledOperation,
                  manualModifiers,
                  actionId: canonicalSourceActionId(source),
                  behaviorId: behavior.id,
                  movementPath,
                  recovery: behavior.classification === 'recovery',
                  target,
                  evaluation: command.evaluation,
                  apCost: command.costs
                    .filter((cost) => cost.resource === 'ap')
                    .reduce((sum, cost) => sum + cost.amount, 0),
                  effectUtility: utility,
                  utility:
                    preparingReturn && utility <= 0
                      ? baseline.utility + 1
                      : (behavior.classification === 'recovery'
                          ? profile.recoverUtility
                          : behavior.classification === 'utility'
                            ? profile.guardUtility
                            : profile.attackUtility) + utility,
                  stableKey: JSON.stringify([
                    source.sourceInstanceId,
                    behavior.id,
                    targetKey(target),
                    movementPath,
                    ...(manualModifiers.length ? [manualModifiers] : []),
                  ]),
                },
              ]
            } catch {
              return []
            }
          }
          const candidates = selections.flatMap(evaluate)
          const plural = buildCombatAiPluralSelection(targeting, candidates)
          return plural ? [...candidates, ...evaluate(plural)] : candidates
        })
      })
    }),
  )
}

function visibleEnemyDistance(
  state: StatDrivenCombatEncounterState,
  actorId: string,
  position: GridPosition,
): number | undefined {
  const teamId = state.tactical.battle.combatants.find((unit) => unit.id === actorId)?.teamId
  let nearest: number | undefined
  for (const unit of state.tactical.battle.combatants) {
    if (
      unit.hp <= 0 ||
      unit.teamId === teamId ||
      hasGameplayTag(state, unit.id, 'Invisible', PV1F_COMBAT_CONTENT)
    )
      continue
    const placement = state.tactical.placements.find((row) => row.combatantId === unit.id)
    if (!placement) continue
    const distance =
      Math.abs(position.x - placement.position.x) + Math.abs(position.y - placement.position.y)
    nearest = nearest === undefined ? distance : Math.min(nearest, distance)
  }
  return nearest
}

/** Score only a real legal projected return; preserve anchors when returning gains nothing. */
function rewindPositionUtility(
  evaluation: CombatActionEvaluation,
  state: StatDrivenCombatEncounterState,
): number {
  const actor = state.tactical.battle.combatants.find((unit) => unit.id === evaluation.actorId)
  if (!actor) return 0
  const hpRatio = actor.maxHp > 0 ? actor.hp / actor.maxHp : 0
  let utility = 0
  for (const event of evaluation.projectedEvents) {
    if (event.event !== 'combatant_rewound' || event.combatantId !== actor.id) continue
    const before = visibleEnemyDistance(state, actor.id, event.from)
    const after = visibleEnemyDistance(state, actor.id, event.to)
    if (before === undefined || after === undefined) continue
    const improvement = hpRatio < 0.62 ? after - before : before - after
    if (improvement <= 0) continue
    utility +=
      Math.min(improvement, 4) * (hpRatio < 0.62 ? 16 + Math.round((1 - hpRatio) * 24) : 16)
  }
  return utility
}

function canonicalSourceActionId(source: CapturedCombatAbilitySource): string {
  return source.basic?.id === 'unarmed.basic' ? PV1F_BASIC_ATTACK_ID : source.abilityId
}

/** One shortest legal route per destination, bounded by authored Move, live Movement and AI profile. */
function walkingPaths(
  state: StatDrivenCombatEncounterState,
  maximumTiles: number,
  limit: number,
  conditional: boolean,
): (readonly GridPosition[])[] {
  const actorId = state.tactical.battle.currentTurn!.combatantId
  const origin = state.tactical.placements.find((row) => row.combatantId === actorId)!.position
  const paths: (readonly GridPosition[])[] = []
  const queue = [[origin]],
    seen = new Set([`${origin.x},${origin.y}`])
  for (let index = 0; index < queue.length && paths.length < limit; index++) {
    const path = queue[index]!
    if (path.length - 1 >= maximumTiles) continue
    const end = path.at(-1)!
    for (const position of [
      { x: end.x, y: end.y - 1 },
      { x: end.x + 1, y: end.y },
      { x: end.x, y: end.y + 1 },
      { x: end.x - 1, y: end.y },
    ]) {
      const key = `${position.x},${position.y}`
      if (
        position.x < 0 ||
        position.y < 0 ||
        position.x >= state.tactical.width ||
        position.y >= state.tactical.height ||
        seen.has(key)
      )
        continue
      const next = [...path, position]
      const legal = evaluatePreparedCombatWalking(state, next, PV1F_COMBAT_CONTENT, {
        maximumTiles,
        ignorePoisonForecast: true,
      }).movement.legal
      // An ineligible conditional Move may legitimately leave a rooted actor in place.
      if (!legal && !(conditional && path.length === 1)) continue
      paths.push(next)
      if (legal) {
        seen.add(key)
        queue.push(next)
      }
      if (paths.length >= limit) break
    }
  }
  return paths
}

export function committedMatureSkills(
  state: StatDrivenCombatEncounterState,
  combatantId: string,
): readonly MatureSkillDefinition[] {
  const snapshot = readBattleAuthorityCombatBuildSnapshot(state, combatantId)
  if (!snapshot) return []

  const definitions: MatureSkillDefinition[] = []
  const seen = new Set<string>()
  for (const reference of snapshot.disciplineSkills) {
    const definition = resolveMatureSkillVersion(reference.skillId, reference.contentVersion)
    if (
      !definition ||
      definition.sourceDisciplineId !== reference.sourceDisciplineId ||
      seen.has(definition.id)
    ) {
      continue
    }
    definitions.push(definition)
    seen.add(definition.id)
  }

  const essenceReference = snapshot.extensions.essence
  if (essenceReference) {
    const essence = resolveEssenceForBuild(
      snapshot.primary.disciplineId,
      snapshot.secondary?.disciplineId ?? null,
      essenceReference.contentVersion,
    )
    if (
      essence &&
      essence.essenceId === essenceReference.essenceId &&
      essence.skill.id === essenceReference.skillId &&
      essence.skill.contentVersion === essenceReference.skillContentVersion &&
      !seen.has(essence.skill.id)
    ) {
      definitions.push(essence.skill)
    }
  }

  return definitions.sort((left, right) => left.id.localeCompare(right.id))
}

function buildSkillCandidates(
  state: StatDrivenCombatEncounterState,
  definition: MatureSkillDefinition,
  profile: RecruitAiProfile,
  modifierBundles: readonly (readonly ManualCombatModifierSelection[])[],
): BuildSkillCandidate[] {
  if (!definition.enabled || !definition.ai.enabled) return []
  const candidates: BuildSkillCandidate[] = []
  for (const manualModifiers of modifierBundles) {
    for (const target of targetSelections(state, definition)) {
      let evaluated
      try {
        evaluated = evaluatePv1fMatureSkill(state, definition, target, 'pve', { manualModifiers })
      } catch {
        continue
      }
      const economy = readPv1fActionEconomy(
        evaluated.prepared,
        evaluated.prepared.tactical.battle.currentTurn?.combatantId ?? null,
      )
      if (!evaluated.evaluation.legal || !economy || economy.current < evaluated.cost) continue
      // A repeated discrete ground effect can be empty. Do not burn AP for no resulting change.
      if (
        (target.kind === 'tile' || target.kind === 'direction' || target.kind === 'activate') &&
        !evaluated.evaluation.projectedEffects.some((effect) => effect.before !== effect.after) &&
        !evaluated.evaluation.projectedTerrain.some(
          (effect) =>
            effect.before !== effect.after ||
            terrainOverlayAt(state, effect.position)?.remainingRoundBoundaries !==
              effect.remainingRoundBoundaries,
        )
      )
        continue
      const resonance = committedResonanceForecast(evaluated.prepared, definition, target)
      const resonanceMechanics = resonance
        ? normalizedResonanceMechanics(resonance.definition)
        : null
      const resonanceUtility = resonance?.forecast.willActivate
        ? (resonanceMechanics?.aiTriggerUtilityBonus ?? 0)
        : resonance?.forecast.willArm
          ? (resonanceMechanics?.aiSetupUtilityBonus ?? 0)
          : 0
      if (
        outgoingSuppressionBasisPoints(state, evaluated.evaluation.actorId!) === 10000 &&
        !evaluated.evaluation.projectedEffects.some((effect) => effect.before !== effect.after) &&
        !evaluated.evaluation.projectedTerrain.some((effect) => effect.before !== effect.after) &&
        resonanceUtility === 0
      )
        continue
      const effectUtility = projectedCombatEffectUtility(
        evaluated.evaluation,
        state,
        evaluated.action.effects.filter(isMaterializedCombatEffect),
      )
      candidates.push({
        actionId: evaluated.action.id,
        manualModifiers,
        definition,
        target,
        evaluation: evaluated.evaluation,
        apCost: evaluated.cost,
        effectUtility,
        utility:
          // Authored base utilities use the easy-profile scale. Match the ordinary
          // action difficulty adjustment so higher difficulties do not suppress Skills.
          definition.ai.baseUtility +
          (profile.attackUtility - RECRUIT_EASY_PROFILE.attackUtility) +
          effectUtility +
          terrainOverlayAiUtility(state, evaluated.evaluation) +
          resonanceUtility,
        stableKey: `${evaluated.action.id}:${targetKey(target)}${manualModifiers.length ? `:${JSON.stringify(manualModifiers)}` : ''}`,
      })
    }
  }
  return candidates
}

function targetSelections(
  state: StatDrivenCombatEncounterState,
  definition: MatureSkillDefinition,
): readonly CombatTargetSelection[] {
  return enumerateCombatTargetSelections(
    state,
    state.tactical.battle.currentTurn!.combatantId,
    definition.target,
  )
}

export function projectedCombatEffectUtility(
  evaluation: CombatActionEvaluation,
  state: StatDrivenCombatEncounterState,
  effects: readonly CombatEffectDefinition[],
): number {
  const copyMode = effects.find((effect) => effect.type === 'copy-statuses')?.mode
  const actorTeam = state.tactical.battle.combatants.find(
    (unit) => unit.id === evaluation.actorId,
  )?.teamId
  return evaluation.projectedEffects.reduce((utility, effect) => {
    const ally =
      state.tactical.battle.combatants.find((unit) => unit.id === effect.combatantId)?.teamId ===
      actorTeam
    const sign = ally ? 1 : -1
    const resistance = evaluation.targetStatusResistances?.find(
      (row) => row.targetCombatantId === effect.combatantId,
    )
    const debuffProbability =
      effect.effectOrdinal !== undefined &&
      resistance?.eligibleEffectOrdinals.includes(effect.effectOrdinal)
        ? (10000 - resistance.resistanceChanceBasisPoints) / 10000
        : 1
    if (typeof effect.before !== 'number' || typeof effect.after !== 'number') {
      if (effect.before === effect.after) return utility
      if (
        effect.effectType === 'summon' &&
        (effect.after === 'active' || effect.after === 'pending')
      )
        return (
          utility +
          (8 * sign) /
            (1 +
              Math.max(
                0,
                (effect.activationRound ?? state.tactical.battle.round) -
                  state.tactical.battle.round,
              ))
        )
      if (effect.statusId === 'suppress')
        return (
          utility - 8 * sign * ((effect.potencyBasisPoints ?? 2500) / 10000) * debuffProbability
        )
      if (effect.effectType === 'copy-statuses') {
        if (!copyMode) return utility
        // Clone projections already passed authoritative legality/eligibility. Reuse the
        // ordinary status utility magnitude and score only the actual projected recipient.
        return utility + (copyMode === 'amplify' ? 8 * sign : -8 * sign * debuffProbability)
      }
      if (
        state.statBalancePolicyVersion === 1 &&
        ['poison', 'burn', 'bleed'].includes(effect.effectType)
      )
        return utility - 8 * sign * debuffProbability
      if (effect.effectType === 'remove-status')
        return utility + (effect.before === 'none' ? 0 : 8 * sign)
      if (effect.effectType === 'apply-status' && typeof effect.after === 'string') {
        const kind = combatStatusDetails(effect.after.split(':')[0]!).kind
        // Coupled tradeoffs are deliberately neutral here; their authored utility is
        // not inflated as if the drawback were another beneficial status.
        return (
          utility +
          (kind === 'Buff' ? 8 * sign : kind === 'Debuff' ? -8 * sign * debuffProbability : 0)
        )
      }
      return utility
    }
    const change = effect.after - effect.before
    return (
      utility +
      change * sign * (effect.effectType === 'resource-change' ? 1 : 2) * debuffProbability
    )
  }, 0)
}

function targetKey(target: CombatTargetSelection): string {
  if (target.kind === 'selections') return JSON.stringify(target.selections)
  if (target.kind === 'self') return 'self'
  if (target.kind === 'activate') return 'activate'
  if (target.kind === 'direction') return `direction:${target.direction}`
  if (target.kind === 'unit') return `unit:${target.combatantId}`
  return `tile:${target.position.x},${target.position.y}`
}

function copyTarget(target: CombatTargetSelection): CombatTargetSelection {
  if (target.kind === 'tile') return { kind: 'tile', position: { ...target.position } }
  return { ...target }
}
