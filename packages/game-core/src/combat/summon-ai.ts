import type { CombatTargetSelection } from './actions'
import { normalizeCombatEffectState, type CombatSummonInstance } from './combat-effect-state'
import {
  evaluatePv1fSummonAbility,
  readPv1fActionEconomy,
} from './pv1f-action-economy'
import {
  chooseRecruitAiDecision,
  getRecruitAiProfile,
  type RecruitAiDecision,
  type RecruitAiReasonTag,
} from './recruit-ai'
import { projectedCombatEffectUtility } from './recruit-ai-build'
import type { StatDrivenCombatEncounterState } from './stat-driven-combat'
import type { SummonAbilityDefinition } from './summon-content'

export type SummonAiDecision = RecruitAiDecision

interface SummonAbilityCandidate {
  readonly actionId: string
  readonly target: CombatTargetSelection
  readonly reason: RecruitAiReasonTag
  readonly utility: number
  readonly stableKey: string
}

export function chooseSummonAiDecision(input: {
  state: StatDrivenCombatEncounterState
  summon: CombatSummonInstance
  tieBreakSeed: number
}): SummonAiDecision {
  if (!Number.isSafeInteger(input.tieBreakSeed)) {
    throw new RangeError('Summon AI tieBreakSeed must be a safe integer.')
  }

  const summon =
    normalizeCombatEffectState(input.state.effectState).summons?.find(
      (candidate) => candidate.combatantId === input.summon.combatantId,
    ) ?? null
  if (!summon) throw new Error('Summon AI requires an active summon instance.')
  if (input.state.tactical.battle.currentTurn?.combatantId !== summon.combatantId) {
    throw new Error('Summon AI can decide only during that summon’s turn.')
  }

  const profile = getRecruitAiProfile(summon.profile.aiProfile)
  const baseline = chooseRecruitAiDecision({
    state: input.state,
    profile,
    tieBreakSeed: input.tieBreakSeed,
    capabilities: {
      basicAttack: false,
      guard: false,
      recover: false,
    },
  })

  const abilityCandidates = summon.profile.abilities
    .flatMap((ability) => buildAbilityCandidates(input.state, summon, ability))
    .map((candidate) => ({
      ...candidate,
      tieBreak: deterministicTieBreak(input.tieBreakSeed, candidate.stableKey),
    }))
    .sort((left, right) => {
      if (left.utility !== right.utility) return right.utility - left.utility
      if (left.tieBreak !== right.tieBreak) return right.tieBreak - left.tieBreak
      return left.stableKey.localeCompare(right.stableKey)
    })

  const selected = abilityCandidates[0]
  if (!selected || selected.utility <= baseline.utility) {
    return {
      ...baseline,
      candidateCount: baseline.candidateCount + abilityCandidates.length,
    }
  }

  return {
    intent: {
      kind: 'action',
      actionId: selected.actionId,
      target: copyTarget(selected.target),
    },
    reason: selected.reason,
    utility: selected.utility,
    candidateCount: baseline.candidateCount + abilityCandidates.length,
    profileId: baseline.profileId,
    profileVersion: baseline.profileVersion,
    rulesVersion: baseline.rulesVersion,
  }
}

function buildAbilityCandidates(
  state: StatDrivenCombatEncounterState,
  summon: CombatSummonInstance,
  ability: SummonAbilityDefinition,
): SummonAbilityCandidate[] {
  const candidates: SummonAbilityCandidate[] = []

  for (const target of targetSelections(state, ability)) {
    let evaluated
    try {
      evaluated = evaluatePv1fSummonAbility(state, summon, ability.id, target)
    } catch {
      continue
    }

    const economy = readPv1fActionEconomy(evaluated.prepared, summon.combatantId)
    if (!evaluated.evaluation.legal || !economy || economy.current < evaluated.cost) continue

    const changed =
      evaluated.evaluation.projectedEffects.some((effect) => effect.before !== effect.after) ||
      evaluated.evaluation.projectedTerrain.some((effect) => effect.before !== effect.after)
    if (!changed) continue

    candidates.push({
      actionId: ability.id,
      target,
      reason: ability.tags.includes('heal') ? 'recover-survival' : 'legal-damage',
      utility:
        ability.ai.baseUtility +
        projectedCombatEffectUtility(evaluated.evaluation, state, ability.effects),
      stableKey: `action:${ability.id}:${targetKey(target)}`,
    })
  }

  return candidates
}

function targetSelections(
  state: StatDrivenCombatEncounterState,
  ability: SummonAbilityDefinition,
): readonly CombatTargetSelection[] {
  if (ability.target.kind === 'self') return [{ kind: 'self' }]
  if (ability.target.kind === 'unit') {
    return [...state.tactical.battle.combatants]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((combatant) => ({ kind: 'unit' as const, combatantId: combatant.id }))
  }
  return [...state.tactical.tiles]
    .sort((left, right) => left.position.y - right.position.y || left.position.x - right.position.x)
    .map((tile) => ({ kind: 'tile' as const, position: { ...tile.position } }))
}

function deterministicTieBreak(seed: number, stableKey: string): number {
  let hash = (seed >>> 0) ^ 0x811c9dc5
  for (let index = 0; index < stableKey.length; index += 1) {
    hash ^= stableKey.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
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
