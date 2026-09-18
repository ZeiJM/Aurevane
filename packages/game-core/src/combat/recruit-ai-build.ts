import { terrainOverlayAiUtility, terrainOverlayAt } from './terrain-overlays'
import { combatStatusDetails } from './status-content'
import type {
  CombatActionEvaluation,
  CombatEffectDefinition,
  CombatTargetSelection,
} from './actions'
import { readBattleAuthorityCombatBuildSnapshot } from './battle-authority-build-snapshot'
import { resolveEssenceForBuild } from './essence'
import {
  resolveMatureSkillForContext,
  resolveMatureSkillVersion,
  type MatureSkillDefinition,
} from './mature-skills'
import { copiedSkillCommandId } from './combat-skill-copy'
import {
  committedResonanceForecast,
  executePv1fAction,
  executePv1fCopiedSkill,
  executePv1fMatureSkill,
  evaluatePv1fCopiedSkill,
  evaluatePv1fMatureSkill,
  readPv1fActionEconomy,
  type Pv1fMatureSkillCopyContext,
  type Pv1fTransition,
} from './pv1f-action-economy'
import {
  chooseRecruitAiDecision,
  RECRUIT_EASY_PROFILE,
  RECRUIT_STANDARD_PROFILE,
  type RecruitAiDecision,
  type RecruitAiProfile,
} from './recruit-ai'
import type { StatDrivenCombatEncounterState } from './stat-driven-combat'

interface BuildSkillCandidate {
  actionId: string
  definition: MatureSkillDefinition
  target: CombatTargetSelection
  evaluation: CombatActionEvaluation
  utility: number
  stableKey: string
}

export interface BuildAwareRecruitAiSkillOptions {
  committedSkills?: readonly MatureSkillDefinition[]
  copiedSkills?: readonly MatureSkillDefinition[]
  copyContextsBySource?: Readonly<Record<string, Pv1fMatureSkillCopyContext>>
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
  const copied = input.skillOptions?.copiedSkills ?? []
  const skillCandidates = [
    ...committed.flatMap((definition) =>
      buildSkillCandidates(
        input.state,
        definition,
        input.profile ?? RECRUIT_STANDARD_PROFILE,
        false,
        input.skillOptions?.copyContextsBySource,
      ),
    ),
    ...copied.flatMap((definition) =>
      buildSkillCandidates(
        input.state,
        definition,
        input.profile ?? RECRUIT_STANDARD_PROFILE,
        true,
        input.skillOptions?.copyContextsBySource,
      ),
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
    },
    reason: selected.definition.tags.includes('heal') ? 'recover-survival' : 'legal-damage',
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
): Pv1fTransition {
  const actorId = state.tactical.battle.currentTurn?.combatantId
  if (!actorId) throw new Error('Build-aware Recruit AI action requires an active turn.')
  const copied = (skillOptions.copiedSkills ?? []).find(
    (candidate) => copiedSkillCommandId(candidate.id, candidate.contentVersion) === actionId,
  )
  if (copied) {
    const copyContext =
      copied.effects.some((effect) => effect.type === 'copy') && target.kind === 'unit'
        ? skillOptions.copyContextsBySource?.[target.combatantId]
        : undefined
    return executePv1fCopiedSkill(state, copied, target, 'pve', copyContext)
  }

  const definition = (skillOptions.committedSkills ?? committedMatureSkills(state, actorId)).find(
    (candidate) => candidate.id === actionId,
  )
  if (definition) {
    const copyContext =
      definition.effects.some((effect) => effect.type === 'copy') && target.kind === 'unit'
        ? skillOptions.copyContextsBySource?.[target.combatantId]
        : undefined
    return executePv1fMatureSkill(
      state,
      definition,
      target,
      'pve',
      copyContext ? { copyContext } : {},
    )
  }
  return executePv1fAction(state, actionId, target)
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
  copied: boolean,
  copyContextsBySource?: Readonly<Record<string, Pv1fMatureSkillCopyContext>>,
): BuildSkillCandidate[] {
  if (!definition.enabled || !definition.ai.enabled) return []
  const candidates: BuildSkillCandidate[] = []
  for (const target of targetSelections(state, definition)) {
    let evaluated
    try {
      const copyContext =
        definition.effects.some((effect) => effect.type === 'copy') && target.kind === 'unit'
          ? copyContextsBySource?.[target.combatantId]
          : undefined
      evaluated = copied
        ? evaluatePv1fCopiedSkill(state, definition, target, 'pve', copyContext)
        : evaluatePv1fMatureSkill(
            state,
            definition,
            target,
            'pve',
            copyContext ? { copyContext } : {},
          )
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
      target.kind === 'tile' &&
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
    const resonanceUtility = resonance?.forecast.willActivate
      ? resonance.definition.trigger.aiPayoffUtilityBonus
      : resonance?.forecast.willArm
        ? resonance.definition.trigger.aiSetupUtilityBonus
        : 0
    const originalCost = resolveMatureSkillForContext(definition, 'pve').apCost
    const copiedApDiscountUtility = copied ? Math.max(0, originalCost - evaluated.cost) : 0
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
        projectedCombatEffectUtility(evaluated.evaluation, state, definition.effects) +
        terrainOverlayAiUtility(state, evaluated.evaluation) +
        resonanceUtility +
        copiedApDiscountUtility,
      stableKey: `${evaluated.action.id}:${targetKey(target)}`,
    })
  }
  return candidates
}

function targetSelections(
  state: StatDrivenCombatEncounterState,
  definition: MatureSkillDefinition,
): readonly CombatTargetSelection[] {
  if (definition.target.kind === 'self') return [{ kind: 'self' }]
  if (definition.target.kind === 'unit') {
    return [...state.tactical.battle.combatants]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((combatant) => ({ kind: 'unit' as const, combatantId: combatant.id }))
  }
  return [...state.tactical.tiles]
    .sort((left, right) => left.position.y - right.position.y || left.position.x - right.position.x)
    .map((tile) => ({ kind: 'tile' as const, position: { ...tile.position } }))
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
    if (typeof effect.before !== 'number' || typeof effect.after !== 'number') {
      if (effect.before === effect.after) return utility
      if (effect.effectType === 'copy-statuses') {
        if (!copyMode) return utility
        // Clone projections already passed authoritative legality/eligibility. Reuse the
        // ordinary status utility magnitude and score only the actual projected recipient.
        return utility + (copyMode === 'amplify' ? 8 * sign : -8 * sign)
      }
      if (effect.effectType === 'remove-status')
        return utility + (effect.before === 'none' ? 0 : 8 * sign)
      if (effect.effectType === 'apply-status' && typeof effect.after === 'string') {
        const kind = combatStatusDetails(effect.after.split(':')[0]!).kind
        // Coupled tradeoffs are deliberately neutral here; their authored utility is
        // not inflated as if the drawback were another beneficial status.
        return utility + (kind === 'Buff' ? 8 * sign : kind === 'Debuff' ? -8 * sign : 0)
      }
      return utility
    }
    const change = effect.after - effect.before
    return utility + change * sign * (effect.effectType === 'resource-change' ? 1 : 2)
  }, 0)
}

function targetKey(target: CombatTargetSelection): string {
  if (target.kind === 'self') return 'self'
  if (target.kind === 'unit') return `unit:${target.combatantId}`
  return `tile:${target.position.x},${target.position.y}`
}

function copyTarget(target: CombatTargetSelection): CombatTargetSelection {
  if (target.kind === 'tile') return { kind: 'tile', position: { ...target.position } }
  return { ...target }
}
