import type { GridPosition } from './board'
import { evaluatePreparedCombatWalking } from './combat-walking'
import { resolveCombatTargeting } from './actions'
import { prepareCombatAbilityCommand, commitCombatAbilityCommand } from './combat-ability-command'
import {
  combatAbilityCommandContext,
  combatAbilityBehavior,
  primeCombatControlledAbility,
  cancelCombatControlledAbility,
} from './combat-behavior-runtime'
import { isControlledCombatAbility, combatControlledPrime } from './combat-controlled'
import { applyAbilityTimingDefaults } from './combat-definition'
import type { CapturedCombatAbilitySource } from './combat-behavior-capture'
import { outgoingSuppressionBasisPoints } from './combat-suppress'
import {
  canonicalAbilityTargetSpec,
  enumerateCombatTargetSelections,
} from './combat-targeting-shapes'
import { buildCombatAiPluralSelection } from './combat-ai-plural-selection'
import { terrainOverlayAiUtility, terrainOverlayAt } from './terrain-overlays'
import { combatStatusDetails } from './status-content'
import { hasGameplayTag } from './gameplay-tags'
import { isMaterializedCombatEffect } from './summon-content'
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
  readPv1fActionEconomy,
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
  recovery?: boolean
  target: CombatTargetSelection
  evaluation: CombatActionEvaluation
  utility: number
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
  const skillCandidates = [
    ...canonicalSkillCandidates(
      input.state,
      sources,
      input.profile ?? RECRUIT_STANDARD_PROFILE,
      baseline,
    ),
    ...committed
      .filter((definition) => !sources.some((source) => source.abilityId === definition.id))
      .flatMap((definition) =>
        buildSkillCandidates(input.state, definition, input.profile ?? RECRUIT_STANDARD_PROFILE),
      ),
  ].sort((left, right) => {
    if (left.utility !== right.utility) return right.utility - left.utility
    return left.stableKey.localeCompare(right.stableKey)
  })
  const selected = skillCandidates[0]
  if (!selected || selected.utility <= baseline.utility) {
    return {
      ...baseline,
      candidateCount: baseline.candidateCount + skillCandidates.length,
    }
  }

  return {
    intent: selected.controlledOperation
      ? { kind: 'ability-prime', actionId: selected.actionId, behaviorId: selected.behaviorId! }
      : {
          kind: 'action',
          actionId: selected.actionId,
          target: copyTarget(selected.target),
          ...(selected.behaviorId ? { behaviorId: selected.behaviorId } : {}),
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
function canonicalSkillCandidates(
  state: StatDrivenCombatEncounterState,
  sources: readonly CapturedCombatAbilitySource[],
  profile: RecruitAiProfile,
  baseline: RecruitAiDecision,
): BuildSkillCandidate[] {
  const initial = preparePv1fTurnEconomy(state)
  const actorId = initial.tactical.battle.currentTurn!.combatantId
  return sources.flatMap((source) =>
    source.definition.behaviors.flatMap((authored) => {
      const behavior = applyAbilityTimingDefaults(authored, initial.effectTimingPolicy)
      if (behavior.activation !== 'manual' || behavior.mode !== 'action' || !behavior.targeting)
        return []
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
          })
          prepared = reattachStatDrivenCombatBridge(primed.state, initial.statBridge)
          controlledOperation = 'prime'
        } catch {
          return []
        }
      }
      const move = behavior.effects.find((effect) => effect.payload.type === 'move')
      const targeting = canonicalAbilityTargetSpec(behavior.targeting)
      const selections = enumerateCombatTargetSelections(prepared, actorId, targeting)
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
          try {
            // Only prune unconditional Move geometry. Conditional eligibility still uses S0.
            if (
              movementPath &&
              move?.requirements == null &&
              resolveCombatTargeting(spatialState, actorId, targeting, target, PV1F_COMBAT_CONTENT)
                .issues.length
            )
              return []
            const command = prepareCombatAbilityCommand({
              state: prepared,
              actorId,
              root: { kind: 'canonical', source, behaviorId: behavior.id },
              selection: target,
              movementPath,
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
                actionId: canonicalSourceActionId(source),
                behaviorId: behavior.id,
                movementPath,
                recovery: behavior.classification === 'recovery',
                target,
                evaluation: command.evaluation,
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
): BuildSkillCandidate[] {
  if (!definition.enabled || !definition.ai.enabled) return []
  const candidates: BuildSkillCandidate[] = []
  for (const target of targetSelections(state, definition)) {
    let evaluated
    try {
      evaluated = evaluatePv1fMatureSkill(state, definition, target, 'pve')
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
    const resonanceMechanics = resonance ? normalizedResonanceMechanics(resonance.definition) : null
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
    candidates.push({
      actionId: evaluated.action.id,
      definition,
      target,
      evaluation: evaluated.evaluation,
      utility:
        // Authored base utilities use the easy-profile scale. Match the ordinary
        // action difficulty adjustment so higher difficulties do not suppress Skills.
        definition.ai.baseUtility +
        (profile.attackUtility - RECRUIT_EASY_PROFILE.attackUtility) +
        projectedCombatEffectUtility(
          evaluated.evaluation,
          state,
          definition.effects.filter(isMaterializedCombatEffect),
        ) +
        terrainOverlayAiUtility(state, evaluated.evaluation) +
        resonanceUtility,
      stableKey: `${evaluated.action.id}:${targetKey(target)}`,
    })
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
