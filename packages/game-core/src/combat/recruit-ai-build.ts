import { prepareCombatAbilityCommand, commitCombatAbilityCommand } from './combat-ability-command'
import { combatAbilityCommandContext } from './combat-behavior-runtime'
import type { CapturedCombatAbilitySource } from './combat-behavior-capture'
import { outgoingSuppressionBasisPoints } from './combat-suppress'
import { enumerateCombatTargetSelections } from './combat-targeting-shapes'
import { terrainOverlayAiUtility, terrainOverlayAt } from './terrain-overlays'
import { combatStatusDetails } from './status-content'
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
  actionId: string
  definition?: MatureSkillDefinition
  behaviorId?: string
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
    ...canonicalSkillCandidates(input.state, sources, input.profile ?? RECRUIT_STANDARD_PROFILE),
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
    intent: {
      kind: 'action',
      actionId: selected.actionId,
      target: copyTarget(selected.target),
      ...(selected.behaviorId ? { behaviorId: selected.behaviorId } : {}),
    },
    reason:
      selected.recovery || selected.definition?.tags.includes('heal')
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
  commandOptions: { readonly behaviorId?: string } = {},
): Pv1fTransition {
  const actorId = state.tactical.battle.currentTurn?.combatantId
  if (!actorId) throw new Error('Build-aware Recruit AI action requires an active turn.')
  const source = activeCanonicalSources(state, actorId, skillOptions).find(
    (row) => row.abilityId === actionId,
  )
  if (source) {
    const prepared = preparePv1fTurnEconomy(state)
    const transition = commitCombatAbilityCommand({
      state: prepared,
      actorId,
      root: { kind: 'canonical', source, behaviorId: commandOptions.behaviorId },
      selection: target,
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

  const definition = (skillOptions.committedSkills ?? committedMatureSkills(state, actorId)).find(
    (candidate) => candidate.id === actionId,
  )
  if (definition) {
    return executePv1fMatureSkill(state, definition, target, 'pve', commandOptions)
  }
  return executePv1fAction(state, actionId, target)
}

function activeCanonicalSources(
  state: StatDrivenCombatEncounterState,
  actorId: string,
  options?: BuildAwareRecruitAiSkillOptions,
): readonly CapturedCombatAbilitySource[] {
  return (options?.canonicalSources ?? state.capturedAbilitySources ?? []).filter(
    (source) =>
      source.ownerCombatantId === actorId &&
      ['discipline-skill', 'essence', 'resonance'].includes(source.sourceKind) &&
      state.abilityRuntime?.activeSourceIds.includes(source.sourceInstanceId),
  )
}
function canonicalSkillCandidates(
  state: StatDrivenCombatEncounterState,
  sources: readonly CapturedCombatAbilitySource[],
  profile: RecruitAiProfile,
): BuildSkillCandidate[] {
  const prepared = preparePv1fTurnEconomy(state)
  const actorId = prepared.tactical.battle.currentTurn!.combatantId
  return sources.flatMap((source) =>
    source.definition.behaviors.flatMap((behavior) => {
      if (behavior.activation !== 'manual' || behavior.mode !== 'action' || !behavior.targeting)
        return []
      return enumerateCombatTargetSelections(prepared, actorId, behavior.targeting).flatMap(
        (target) => {
          try {
            const command = prepareCombatAbilityCommand({
              state: prepared,
              actorId,
              root: { kind: 'canonical', source, behaviorId: behavior.id },
              selection: target,
              content: PV1F_COMBAT_CONTENT,
              context: combatAbilityCommandContext(prepared, source),
            })
            if (!command.evaluation.legal) return []
            const utility =
              projectedCombatEffectUtility(command.evaluation, prepared, command.action.effects) +
              terrainOverlayAiUtility(prepared, command.evaluation)
            if (utility <= 0) return []
            return [
              {
                actionId: source.abilityId,
                behaviorId: behavior.id,
                recovery: behavior.classification === 'recovery',
                target,
                evaluation: command.evaluation,
                utility:
                  (behavior.classification === 'recovery'
                    ? profile.recoverUtility
                    : behavior.classification === 'utility'
                      ? profile.guardUtility
                      : profile.attackUtility) + utility,
                stableKey: JSON.stringify([
                  source.sourceInstanceId,
                  behavior.id,
                  targetKey(target),
                ]),
              },
            ]
          } catch {
            return []
          }
        },
      )
    }),
  )
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
