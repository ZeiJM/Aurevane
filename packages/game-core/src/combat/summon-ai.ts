import { combatReversalKnowledgeState } from './combat-reversal'
import { enumerateCombatTargetSelections } from './combat-targeting-shapes'
import { buildCombatAiPluralSelection } from './combat-ai-plural-selection'
import type { GridPosition } from './board'
import type { CombatTargetSelection } from './actions'
import { normalizeCombatEffectState, type CombatSummonInstance } from './combat-effect-state'
import {
  evaluatePv1fSummonAbility,
  PV1F_SUMMON_ABILITY_USED_TURN_KEY,
  executePv1fMovement,
  preparePv1fTurnEconomy,
  readPv1fActionEconomy,
} from './pv1f-action-economy'
import { PV1F_MINIMUM_MOVEMENT_AP_COST } from './pv1f-skills'
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
  input = {
    ...input,
    state: preparePv1fTurnEconomy(
      combatReversalKnowledgeState(
        input.state,
        input.state.tactical.battle.currentTurn?.combatantId,
      ),
    ),
  }
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

  const profile = getRecruitAiProfile(
    summon.profile.neverMoves === undefined ? summon.profile.aiProfile : 'high',
  )
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
      intent: {
        kind: 'action' as const,
        actionId: candidate.actionId,
        target: copyTarget(candidate.target),
      } as SummonAiDecision['intent'],
      reason: candidate.reason,
      utility: candidate.utility,
      stableKey: candidate.stableKey,
    }))
    .concat(buildMovementCandidates(input.state, summon, profile.maxCandidates))
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
    intent: selected.intent,
    reason: selected.reason,
    utility: selected.utility,
    candidateCount: baseline.candidateCount + abilityCandidates.length,
    profileId: baseline.profileId,
    profileVersion: baseline.profileVersion,
    rulesVersion: baseline.rulesVersion,
  }
}

/** Bounded legal lookahead: price the walk and evaluate the actual post-walk state. */
function buildMovementCandidates(
  state: StatDrivenCombatEncounterState,
  summon: CombatSummonInstance,
  maximumPositions: number,
): {
  intent: SummonAiDecision['intent']
  reason: RecruitAiReasonTag
  utility: number
  stableKey: string
}[] {
  if (summon.profile.neverMoves) return []
  const actor = state.tactical.battle.combatants.find((row) => row.id === summon.combatantId)
  if (
    actor?.temporaryResources.some(
      (row) =>
        row.key === PV1F_SUMMON_ABILITY_USED_TURN_KEY &&
        row.current === state.tactical.battle.turnNumber,
    )
  )
    return []
  const origin = state.tactical.placements.find(
    (row) => row.combatantId === summon.combatantId,
  )?.position
  if (!origin) return []
  const minimumAbilityAp = Math.min(...summon.profile.abilities.map((ability) => ability.apCost))
  const economyBefore = readPv1fActionEconomy(state, summon.combatantId)?.current ?? 0
  const remainingMovement = state.tactical.battle.currentTurn?.movementRemaining ?? 0
  if (!remainingMovement || economyBefore < minimumAbilityAp + PV1F_MINIMUM_MOVEMENT_AP_COST)
    return []
  const candidates: {
    intent: SummonAiDecision['intent']
    reason: RecruitAiReasonTag
    utility: number
    stableKey: string
  }[] = []
  const queue: GridPosition[][] = [[origin]]
  const visited = new Set([`${origin.x},${origin.y}`])
  for (let cursor = 0; cursor < queue.length && cursor < maximumPositions; cursor += 1) {
    const path = queue[cursor]!
    const enteredTiles = path.length
    if (
      enteredTiles > remainingMovement ||
      enteredTiles * PV1F_MINIMUM_MOVEMENT_AP_COST + minimumAbilityAp > economyBefore
    )
      continue
    const from = path[path.length - 1]!
    for (const destination of [
      { x: from.x, y: from.y - 1 },
      { x: from.x + 1, y: from.y },
      { x: from.x, y: from.y + 1 },
      { x: from.x - 1, y: from.y },
    ]) {
      if (visited.size >= maximumPositions) break
      if (
        destination.x < 0 ||
        destination.y < 0 ||
        destination.x >= state.tactical.width ||
        destination.y >= state.tactical.height
      )
        continue
      const key = `${destination.x},${destination.y}`
      if (visited.has(key)) continue
      const nextPath = [...path, destination]
      let moved: StatDrivenCombatEncounterState
      try {
        moved = executePv1fMovement(state, nextPath).state
      } catch {
        continue
      }
      if (moved.tactical.battle.currentTurn?.combatantId !== summon.combatantId) continue
      visited.add(key)
      const economyAfter = readPv1fActionEconomy(moved, summon.combatantId)?.current ?? 0
      if (economyAfter < minimumAbilityAp) continue
      queue.push(nextPath)
      const cost = economyBefore - economyAfter
      const available = summon.profile.abilities.flatMap((ability) =>
        buildAbilityCandidates(moved, summon, ability),
      )
      const bestUtility = Math.max(0, ...available.map((candidate) => candidate.utility))
      if (bestUtility > 0)
        candidates.push({
          intent: { kind: 'move', path: nextPath },
          reason: 'close-distance',
          utility: bestUtility - 2 - cost / 5,
          stableKey: `summon-move:${key}`,
        })
    }
  }
  return candidates
}

function buildAbilityCandidates(
  state: StatDrivenCombatEncounterState,
  summon: CombatSummonInstance,
  ability: SummonAbilityDefinition,
): SummonAbilityCandidate[] {
  if ((readPv1fActionEconomy(state, summon.combatantId)?.current ?? 0) < ability.apCost) return []
  const actor = state.tactical.battle.combatants.find((row) => row.id === summon.combatantId)
  if (
    actor?.temporaryResources.some(
      (row) =>
        row.key === PV1F_SUMMON_ABILITY_USED_TURN_KEY &&
        row.current === state.tactical.battle.turnNumber,
    )
  )
    return []
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

    if (ability.effects.some((effect) => effect.type === 'reversal')) {
      candidates.push({
        actionId: ability.id,
        target,
        reason: 'guard-survival',
        utility: ability.ai.baseUtility + 28,
        stableKey: `action:${ability.id}:${targetKey(target)}`,
      })
      continue
    }
    const changed =
      evaluated.evaluation.projectedEffects.some((effect) => effect.before !== effect.after) ||
      evaluated.evaluation.projectedTerrain.some((effect) => effect.before !== effect.after)
    if (!changed) continue
    const effectUtility = projectedCombatEffectUtility(evaluated.evaluation, state, ability.effects)
    if (
      effectUtility < 0 ||
      (effectUtility === 0 &&
        !evaluated.evaluation.projectedTerrain.some((effect) => effect.before !== effect.after))
    )
      continue

    candidates.push({
      actionId: ability.id,
      target,
      reason: ability.tags.includes('heal') ? 'recover-survival' : 'legal-damage',
      utility: ability.ai.baseUtility + effectUtility,
      stableKey: `action:${ability.id}:${targetKey(target)}`,
    })
  }

  const plural = buildCombatAiPluralSelection(ability.target, candidates)
  if (plural) {
    const evaluated = evaluatePv1fSummonAbility(state, summon, ability.id, plural)
    const economy = readPv1fActionEconomy(evaluated.prepared, summon.combatantId)
    if (
      evaluated.evaluation.legal &&
      economy &&
      economy.current >= evaluated.cost &&
      projectedCombatEffectUtility(evaluated.evaluation, state, ability.effects) > 0
    )
      candidates.push({
        actionId: ability.id,
        target: plural,
        reason: ability.tags.includes('heal') ? 'recover-survival' : 'legal-damage',
        utility:
          ability.ai.baseUtility +
          projectedCombatEffectUtility(evaluated.evaluation, state, ability.effects),
        stableKey: `action:${ability.id}:${targetKey(plural)}`,
      })
  }

  return candidates
}

function targetSelections(
  state: StatDrivenCombatEncounterState,
  ability: SummonAbilityDefinition,
): readonly CombatTargetSelection[] {
  return enumerateCombatTargetSelections(
    state,
    state.tactical.battle.currentTurn!.combatantId,
    ability.target,
  )
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
