import {
  P2_3_COMBAT_CONTENT,
  P2_3_GUARD_ACTION,
  P2_3_UNARMED_ATTACK_PROFILE,
  createBasicAttackDefinition,
  evaluateCombatAction,
  type CombatActionDefinition,
  type CombatTargetSelection,
} from './actions'
import type { BattleFacing } from './battle-state'
import {
  evaluateCurrentMovementPath,
  type CombatPlacement,
  type CombatTile,
  type GridPosition,
  type TacticalBattleState,
} from './board'
import { forecastStatDrivenAttack, type StatDrivenCombatEncounterState } from './stat-driven-combat'

export const RECRUIT_AI_RULES_VERSION = 1 as const
export const RECRUIT_AI_PROFILE_VERSION = 1 as const

const BASIC_ATTACK = createBasicAttackDefinition(P2_3_UNARMED_ATTACK_PROFILE)
const ACTIONS: readonly CombatActionDefinition[] = [BASIC_ATTACK, P2_3_GUARD_ACTION]

export type RecruitAiIntent =
  | { kind: 'move'; path: readonly GridPosition[] }
  | { kind: 'action'; actionId: string; target: CombatTargetSelection }
  | { kind: 'face'; facing: BattleFacing }
  | { kind: 'end-turn' }

export type RecruitAiReasonTag =
  'legal-damage' | 'close-distance' | 'guard-survival' | 'face-threat' | 'safe-end-turn'

export interface RecruitAiProfile {
  id: 'recruit-weak-v1'
  version: typeof RECRUIT_AI_PROFILE_VERSION
  maxCandidates: number
  attackUtility: number
  movementUtility: number
  guardUtility: number
  facingUtility: number
  endTurnUtility: number
}

export interface RecruitAiKnowledge {
  rulesVersion: typeof RECRUIT_AI_RULES_VERSION
  battleId: string
  round: number
  turnNumber: number
  activeCombatantId: string
  movementRemaining: number
  actionReady: boolean
  finalFacing: BattleFacing | null
  combatants: readonly {
    id: string
    teamId: string
    hp: number
    maxHp: number
    mp: number
    maxMp: number
  }[]
  placements: readonly CombatPlacement[]
  tiles: readonly CombatTile[]
}

export interface RecruitAiDecision {
  intent: RecruitAiIntent
  reason: RecruitAiReasonTag
  utility: number
  candidateCount: number
  profileId: RecruitAiProfile['id']
  profileVersion: typeof RECRUIT_AI_PROFILE_VERSION
  rulesVersion: typeof RECRUIT_AI_RULES_VERSION
}

interface Candidate {
  intent: RecruitAiIntent
  reason: RecruitAiReasonTag
  utility: number
  stableKey: string
}

export const RECRUIT_WEAK_PROFILE: RecruitAiProfile = {
  id: 'recruit-weak-v1',
  version: RECRUIT_AI_PROFILE_VERSION,
  maxCandidates: 64,
  attackUtility: 100,
  movementUtility: 28,
  guardUtility: 16,
  facingUtility: 8,
  endTurnUtility: 0,
}

export function createRecruitAiKnowledge(
  state: StatDrivenCombatEncounterState,
): RecruitAiKnowledge {
  const battle = state.tactical.battle
  const turn = battle.currentTurn
  if (battle.lifecycle !== 'active' || turn === null) {
    throw new Error('Recruit AI knowledge requires an active battle turn.')
  }

  return {
    rulesVersion: RECRUIT_AI_RULES_VERSION,
    battleId: battle.battleId,
    round: battle.round,
    turnNumber: battle.turnNumber,
    activeCombatantId: turn.combatantId,
    movementRemaining: turn.movementRemaining,
    actionReady: turn.actionState === 'ready',
    finalFacing: turn.finalFacing,
    combatants: battle.combatants.map((combatant) => ({
      id: combatant.id,
      teamId: combatant.teamId,
      hp: combatant.hp,
      maxHp: combatant.maxHp,
      mp: combatant.mp,
      maxMp: combatant.maxMp,
    })),
    placements: state.tactical.placements.map((placement) => ({
      ...placement,
      position: { ...placement.position },
    })),
    tiles: state.tactical.tiles.map((tile) => ({ ...tile, position: { ...tile.position } })),
  }
}

export function chooseRecruitAiDecision(input: {
  state: StatDrivenCombatEncounterState
  profile?: RecruitAiProfile
  tieBreakSeed: number
}): RecruitAiDecision {
  const profile = input.profile ?? RECRUIT_WEAK_PROFILE
  assertRecruitAiProfile(profile)
  if (!Number.isSafeInteger(input.tieBreakSeed)) {
    throw new RangeError('Recruit AI tieBreakSeed must be a safe integer.')
  }

  const knowledge = createRecruitAiKnowledge(input.state)
  const candidates = buildCandidates(input.state, knowledge, profile)
  if (candidates.length === 0) {
    throw new Error('Recruit AI could not find a legal bounded turn decision.')
  }

  const ranked = candidates
    .map((candidate) => ({
      ...candidate,
      tieBreak: deterministicTieBreak(input.tieBreakSeed, candidate.stableKey),
    }))
    .sort((left, right) => {
      if (left.utility !== right.utility) return right.utility - left.utility
      if (left.tieBreak !== right.tieBreak) return right.tieBreak - left.tieBreak
      return left.stableKey.localeCompare(right.stableKey)
    })

  const selected = ranked[0]
  if (!selected) throw new Error('Recruit AI candidate ranking unexpectedly produced no decision.')

  return {
    intent: copyIntent(selected.intent),
    reason: selected.reason,
    utility: selected.utility,
    candidateCount: candidates.length,
    profileId: profile.id,
    profileVersion: profile.version,
    rulesVersion: RECRUIT_AI_RULES_VERSION,
  }
}

function buildCandidates(
  state: StatDrivenCombatEncounterState,
  knowledge: RecruitAiKnowledge,
  profile: RecruitAiProfile,
): Candidate[] {
  const candidates: Candidate[] = []
  const actor = knowledge.combatants.find(
    (combatant) => combatant.id === knowledge.activeCombatantId,
  )
  const actorPlacement = knowledge.placements.find(
    (placement) => placement.combatantId === knowledge.activeCombatantId,
  )
  if (!actor || !actorPlacement)
    throw new Error('Recruit AI active combatant is missing committed state.')

  const enemies = knowledge.combatants
    .filter((combatant) => combatant.teamId !== actor.teamId && combatant.hp > 0)
    .sort((left, right) => left.id.localeCompare(right.id))

  if (knowledge.actionReady) {
    for (const enemy of enemies) {
      pushCandidate(candidates, profile, createAttackCandidate(state, enemy.id, profile))
    }

    const guardEvaluation = evaluateCombatAction(
      state,
      P2_3_GUARD_ACTION,
      { kind: 'self' },
      P2_3_COMBAT_CONTENT,
    )
    if (guardEvaluation.legal) {
      const hpRatio = actor.maxHp > 0 ? actor.hp / actor.maxHp : 0
      pushCandidate(candidates, profile, {
        intent: { kind: 'action', actionId: P2_3_GUARD_ACTION.id, target: { kind: 'self' } },
        reason: 'guard-survival',
        utility: profile.guardUtility + Math.round((1 - hpRatio) * 12),
        stableKey: `action:${P2_3_GUARD_ACTION.id}:self`,
      })
    }
  }

  if (knowledge.movementRemaining > 0 && enemies.length > 0) {
    const nearestBefore = nearestEnemyDistance(
      knowledge,
      actorPlacement.position,
      enemies.map((enemy) => enemy.id),
    )
    for (const destination of orthogonalNeighbors(actorPlacement.position)) {
      const path = [actorPlacement.position, destination]
      const movement = evaluateCurrentMovementPath(state.tactical, path)
      if (!movement.legal || movement.cost <= 0) continue
      const nearestAfter = nearestEnemyDistance(
        knowledge,
        destination,
        enemies.map((enemy) => enemy.id),
      )
      const improvement = nearestBefore - nearestAfter
      if (improvement <= 0) continue
      pushCandidate(candidates, profile, {
        intent: { kind: 'move', path: movement.path },
        reason: 'close-distance',
        utility: profile.movementUtility + improvement * 6 - movement.cost,
        stableKey: `move:${destination.x},${destination.y}`,
      })
    }
  }

  const nearestEnemy = nearestEnemyPlacement(
    knowledge,
    actorPlacement.position,
    enemies.map((enemy) => enemy.id),
  )
  if (nearestEnemy) {
    const preferredFacing = facingToward(actorPlacement.position, nearestEnemy.position)
    if (knowledge.finalFacing !== preferredFacing) {
      pushCandidate(candidates, profile, {
        intent: { kind: 'face', facing: preferredFacing },
        reason: 'face-threat',
        utility: profile.facingUtility,
        stableKey: `face:${preferredFacing}`,
      })
    }
  }

  if (knowledge.finalFacing !== null) {
    pushCandidate(candidates, profile, {
      intent: { kind: 'end-turn' },
      reason: 'safe-end-turn',
      utility: profile.endTurnUtility,
      stableKey: 'end-turn',
    })
  }

  return candidates
}

function createAttackCandidate(
  state: StatDrivenCombatEncounterState,
  targetCombatantId: string,
  profile: RecruitAiProfile,
): Candidate | null {
  const target: CombatTargetSelection = { kind: 'unit', combatantId: targetCombatantId }
  const forecast = forecastStatDrivenAttack(state, BASIC_ATTACK, target, P2_3_COMBAT_CONTENT)
  if (!forecast.evaluation.legal) return null

  const targetCombatant = state.tactical.battle.combatants.find(
    (combatant) => combatant.id === targetCombatantId,
  )
  const damage = forecast.mitigatedBaseDamage ?? 0
  const lethalBonus = targetCombatant && damage >= targetCombatant.hp ? 14 : 0
  const hitChanceBonus = Math.round((forecast.hitChanceBasisPoints ?? 0) / 1_000)

  return {
    intent: { kind: 'action', actionId: BASIC_ATTACK.id, target },
    reason: 'legal-damage',
    utility: profile.attackUtility + damage + lethalBonus + hitChanceBonus,
    stableKey: `action:${BASIC_ATTACK.id}:unit:${targetCombatantId}`,
  }
}

function pushCandidate(
  candidates: Candidate[],
  profile: RecruitAiProfile,
  candidate: Candidate | null,
): void {
  if (!candidate || candidates.length >= profile.maxCandidates) return
  candidates.push(candidate)
}

function nearestEnemyDistance(
  knowledge: RecruitAiKnowledge,
  from: GridPosition,
  enemyIds: readonly string[],
): number {
  const placement = nearestEnemyPlacement(knowledge, from, enemyIds)
  return placement ? manhattanDistance(from, placement.position) : Number.MAX_SAFE_INTEGER
}

function nearestEnemyPlacement(
  knowledge: RecruitAiKnowledge,
  from: GridPosition,
  enemyIds: readonly string[],
): CombatPlacement | null {
  const enemySet = new Set(enemyIds)
  return (
    [...knowledge.placements]
      .filter((placement) => enemySet.has(placement.combatantId))
      .sort((left, right) => {
        const distanceDelta =
          manhattanDistance(from, left.position) - manhattanDistance(from, right.position)
        return distanceDelta || left.combatantId.localeCompare(right.combatantId)
      })[0] ?? null
  )
}

function orthogonalNeighbors(position: GridPosition): GridPosition[] {
  return [
    { x: position.x, y: position.y - 1 },
    { x: position.x + 1, y: position.y },
    { x: position.x, y: position.y + 1 },
    { x: position.x - 1, y: position.y },
  ]
}

function facingToward(from: GridPosition, to: GridPosition): BattleFacing {
  const deltaX = to.x - from.x
  const deltaY = to.y - from.y
  if (Math.abs(deltaX) >= Math.abs(deltaY)) return deltaX >= 0 ? 'east' : 'west'
  return deltaY >= 0 ? 'south' : 'north'
}

function manhattanDistance(left: GridPosition, right: GridPosition): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y)
}

function deterministicTieBreak(seed: number, stableKey: string): number {
  let hash = (seed >>> 0) ^ 0x811c9dc5
  for (let index = 0; index < stableKey.length; index += 1) {
    hash ^= stableKey.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

function copyIntent(intent: RecruitAiIntent): RecruitAiIntent {
  if (intent.kind === 'move')
    return { kind: 'move', path: intent.path.map((position) => ({ ...position })) }
  if (intent.kind === 'action') return { ...intent, target: copyTarget(intent.target) }
  return { ...intent }
}

function copyTarget(target: CombatTargetSelection): CombatTargetSelection {
  if (target.kind === 'tile') return { kind: 'tile', position: { ...target.position } }
  return { ...target }
}

function assertRecruitAiProfile(profile: RecruitAiProfile): void {
  if (profile.id !== 'recruit-weak-v1' || profile.version !== RECRUIT_AI_PROFILE_VERSION) {
    throw new Error('Unsupported Recruit AI profile.')
  }
  if (
    !Number.isSafeInteger(profile.maxCandidates) ||
    profile.maxCandidates < 1 ||
    profile.maxCandidates > 256
  ) {
    throw new RangeError('Recruit AI maxCandidates must be a safe integer between 1 and 256.')
  }
  for (const [field, value] of Object.entries({
    attackUtility: profile.attackUtility,
    movementUtility: profile.movementUtility,
    guardUtility: profile.guardUtility,
    facingUtility: profile.facingUtility,
    endTurnUtility: profile.endTurnUtility,
  })) {
    if (!Number.isSafeInteger(value))
      throw new RangeError(`Recruit AI ${field} must be a safe integer.`)
  }
}

export function recruitAiActionCatalog(): readonly CombatActionDefinition[] {
  return ACTIONS
}

export function recruitAiKnowledgeFromTacticalStateForTest(
  tactical: TacticalBattleState,
): Pick<RecruitAiKnowledge, 'placements' | 'tiles'> {
  return {
    placements: tactical.placements.map((placement) => ({
      ...placement,
      position: { ...placement.position },
    })),
    tiles: tactical.tiles.map((tile) => ({ ...tile, position: { ...tile.position } })),
  }
}
