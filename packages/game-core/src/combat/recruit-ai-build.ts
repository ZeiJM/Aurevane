import type { CombatActionEvaluation, CombatTargetSelection } from './actions'
import { readBattleAuthorityCombatBuildSnapshot } from './battle-authority-build-snapshot'
import { resolveEssenceForBuild } from './essence'
import { resolveMatureSkillVersion, type MatureSkillDefinition } from './mature-skills'
import {
  executePv1fAction,
  executePv1fMatureSkill,
  evaluatePv1fMatureSkill,
  readPv1fActionEconomy,
  type Pv1fTransition,
} from './pv1f-action-economy'
import {
  chooseRecruitAiDecision,
  type RecruitAiDecision,
  type RecruitAiProfile,
} from './recruit-ai'
import type { StatDrivenCombatEncounterState } from './stat-driven-combat'

interface BuildSkillCandidate {
  definition: MatureSkillDefinition
  target: CombatTargetSelection
  evaluation: CombatActionEvaluation
  utility: number
  stableKey: string
}

export function chooseBuildAwareRecruitAiDecision(input: {
  state: StatDrivenCombatEncounterState
  profile?: RecruitAiProfile
  tieBreakSeed: number
}): RecruitAiDecision {
  const baseline = chooseRecruitAiDecision(input)
  const actorId = input.state.tactical.battle.currentTurn?.combatantId
  if (!actorId) return baseline

  const skillCandidates = committedMatureSkills(input.state, actorId)
    .flatMap((definition) => buildSkillCandidates(input.state, definition))
    .sort((left, right) => {
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
      actionId: selected.definition.id,
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
): Pv1fTransition {
  const actorId = state.tactical.battle.currentTurn?.combatantId
  if (!actorId) throw new Error('Build-aware Recruit AI action requires an active turn.')
  const definition = committedMatureSkills(state, actorId).find(
    (candidate) => candidate.id === actionId,
  )
  if (definition) return executePv1fMatureSkill(state, definition, target, 'pve')
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
    candidates.push({
      definition,
      target,
      evaluation: evaluated.evaluation,
      utility: definition.ai.baseUtility + projectedEffectUtility(evaluated.evaluation),
      stableKey: `${definition.id}:${targetKey(target)}`,
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

function projectedEffectUtility(evaluation: CombatActionEvaluation): number {
  return evaluation.projectedEffects.reduce((utility, effect) => {
    if (typeof effect.before !== 'number' || typeof effect.after !== 'number') {
      return utility + (effect.effectType === 'apply-status' ? 8 : 0)
    }
    if (effect.effectType === 'damage')
      return utility + Math.max(0, effect.before - effect.after) * 2
    if (effect.effectType === 'healing')
      return utility + Math.max(0, effect.after - effect.before) * 2
    if (effect.effectType === 'resource-change') {
      return utility + Math.max(0, effect.after - effect.before)
    }
    return utility
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
