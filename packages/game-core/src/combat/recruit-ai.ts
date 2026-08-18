import type { BattleFacing } from './battle-state'
import {
  PV1F_COMBAT_CONTENT,
  PV1F_GUARD_ACTION_ID,
  PV1F_RECOVER_ACTION_ID,
  evaluatePv1fAction,
  evaluatePv1fMovement,
  preparePv1fTurnEconomy,
  readPv1fActionEconomy,
} from './pv1f-action-economy'
import { forecastStatDrivenAttack, type StatDrivenCombatEncounterState } from './stat-driven-combat'
import type { CombatTargetSelection } from './actions'
import type { CombatPlacement, CombatTile, GridPosition } from './board'

export const RECRUIT_AI_RULES_VERSION = 2 as const
export const RECRUIT_AI_PROFILE_VERSION = 2 as const

export type RecruitAiDifficulty = 'easy' | 'standard' | 'high'

export type RecruitAiIntent =
  | { kind: 'move'; path: readonly GridPosition[] }
  | { kind: 'action'; actionId: string; target: CombatTargetSelection }
  | { kind: 'face'; facing: BattleFacing }
  | { kind: 'end-turn' }

export type RecruitAiReasonTag =
  | 'legal-damage'
  | 'close-distance'
  | 'guard-survival'
  | 'recover-survival'
  | 'face-threat'
  | 'safe-end-turn'

export interface RecruitAiProfile {
  id: 'recruit-easy-v2' | 'recruit-standard-v2' | 'recruit-high-v2'
  version: typeof RECRUIT_AI_PROFILE_VERSION
  difficulty: RecruitAiDifficulty
  maxCandidates: number
  attackUtility: number
  movementUtility: number
  guardUtility: number
  recoverUtility: number
  facingUtility: number
}

export interface RecruitAiKnowledge {
  rulesVersion: typeof RECRUIT_AI_RULES_VERSION
  battleId: string
  round: number
  turnNumber: number
  activeCombatantId: string
  actionEconomyRemaining: number
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

export const RECRUIT_EASY_PROFILE: RecruitAiProfile = {
  id: 'recruit-easy-v2',
  version: RECRUIT_AI_PROFILE_VERSION,
  difficulty: 'easy',
  maxCandidates: 48,
  attackUtility: 70,
  movementUtility: 34,
  guardUtility: 34,
  recoverUtility: 48,
  facingUtility: 8,
}

export const RECRUIT_STANDARD_PROFILE: RecruitAiProfile = {
  id: 'recruit-standard-v2',
  version: RECRUIT_AI_PROFILE_VERSION,
  difficulty: 'standard',
  maxCandidates: 72,
  attackUtility: 100,
  movementUtility: 30,
  guardUtility: 24,
  recoverUtility: 52,
  facingUtility: 8,
}

export const RECRUIT_HIGH_PROFILE: RecruitAiProfile = {
  id: 'recruit-high-v2',
  version: RECRUIT_AI_PROFILE_VERSION,
  difficulty: 'high',
  maxCandidates: 96,
  attackUtility: 116,
  movementUtility: 36,
  guardUtility: 26,
  recoverUtility: 58,
  facingUtility: 10,
}

export const RECRUIT_WEAK_PROFILE = RECRUIT_EASY_PROFILE

export function getRecruitAiProfile(difficulty: RecruitAiDifficulty): RecruitAiProfile {
  if (difficulty === 'easy') return RECRUIT_EASY_PROFILE
  if (difficulty === 'high') return RECRUIT_HIGH_PROFILE
  return RECRUIT_STANDARD_PROFILE
}

export function createRecruitAiKnowledge(
  state: StatDrivenCombatEncounterState,
): RecruitAiKnowledge {
  const prepared = preparePv1fTurnEconomy(state)
  const battle = prepared.tactical.battle
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
    actionEconomyRemaining: readPv1fActionEconomy(prepared, turn.combatantId)?.current ?? 0,
    finalFacing: turn.finalFacing,
    combatants: battle.combatants.map((combatant) => ({
      id: combatant.id,
      teamId: combatant.teamId,
      hp: combatant.hp,
      maxHp: combatant.maxHp,
      mp: combatant.mp,
      maxMp: combatant.maxMp,
    })),
    placements: prepared.tactical.placements.map((placement) => ({
      ...placement,
      position: { ...placement.position },
    })),
    tiles: prepared.tactical.tiles.map((tile) => ({ ...tile, position: { ...tile.position } })),
  }
}

export function chooseRecruitAiDecision(input: {
  state: StatDrivenCombatEncounterState
  profile?: RecruitAiProfile
  tieBreakSeed: number
}): RecruitAiDecision {
  const profile = input.profile ?? RECRUIT_STANDARD_PROFILE
  assertRecruitAiProfile(profile)
  if (!Number.isSafeInteger(input.tieBreakSeed)) {
    throw new RangeError('Recruit AI tieBreakSeed must be a safe integer.')
  }

  const knowledge = createRecruitAiKnowledge(input.state)
  const candidates = buildCandidates(input.state, knowledge, profile)
  if (candidates.length === 0) {
    throw new Error('Recruit AI could not find a legal bounded turn decision.')
  }

  const selected = candidates
    .map((candidate) => ({
      ...candidate,
      tieBreak: deterministicTieBreak(input.tieBreakSeed, candidate.stableKey),
    }))
    .sort((left, right) => {
      if (left.utility !== right.utility) return right.utility - left.utility
      if (left.tieBreak !== right.tieBreak) return right.tieBreak - left.tieBreak
      return left.stableKey.localeCompare(right.stableKey)
    })[0]

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
  if (!actor || !actorPlacement) {
    throw new Error('Recruit AI active combatant is missing committed state.')
  }

  const enemies = knowledge.combatants
    .filter((combatant) => combatant.teamId !== actor.teamId && combatant.hp > 0)
    .sort((left, right) => left.id.localeCompare(right.id))

  for (const enemy of enemies) {
    pushCandidate(candidates, profile, createAttackCandidate(state, enemy.id, profile))
  }

  const hpRatio = actor.maxHp > 0 ? actor.hp / actor.maxHp : 0
  if (hpRatio < 0.72) {
    pushCandidate(
      candidates,
      profile,
      createSelfActionCandidate(
        state,
        PV1F_GUARD_ACTION_ID,
        'guard-survival',
        profile.guardUtility + Math.round((1 - hpRatio) * 24),
      ),
    )
  }
  if (hpRatio < 0.62) {
    pushCandidate(
      candidates,
      profile,
      createSelfActionCandidate(
        state,
        PV1F_RECOVER_ACTION_ID,
        'recover-survival',
        profile.recoverUtility + Math.round((1 - hpRatio) * 32),
      ),
    )
  }

  if (enemies.length > 0) {
    const nearestBefore = nearestEnemyDistance(
      knowledge,
      actorPlacement.position,
      enemies.map((enemy) => enemy.id),
    )
    for (const destination of orthogonalNeighbors(actorPlacement.position)) {
      const preview = evaluatePv1fMovement(state, [actorPlacement.position, destination])
      if (!preview.movement.legal || preview.economyCost <= 0) continue
      if (preview.economyCost > knowledge.actionEconomyRemaining) continue
      const nearestAfter = nearestEnemyDistance(
        knowledge,
        destination,
        enemies.map((enemy) => enemy.id),
      )
      const improvement = nearestBefore - nearestAfter
      if (improvement <= 0) continue
      pushCandidate(candidates, profile, {
        intent: { kind: 'move', path: preview.movement.path },
        reason: 'close-distance',
        utility: profile.movementUtility + improvement * 7 - preview.economyCost / 5,
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
    pushCandidate(candidates, profile, {
      intent: { kind: 'face', facing: preferredFacing },
      reason: 'face-threat',
      utility:
        knowledge.actionEconomyRemaining === 0 ? profile.facingUtility + 20 : profile.facingUtility,
      stableKey: `face:${preferredFacing}`,
    })
  } else {
    pushCandidate(candidates, profile, {
      intent: { kind: 'end-turn' },
      reason: 'safe-end-turn',
      utility: 0,
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
  let evaluation
  try {
    evaluation = evaluatePv1fAction(state, 'basic.attack.unarmed.basic', target)
  } catch {
    return null
  }
  if (!evaluation.evaluation.legal) return null
  const economy = readPv1fActionEconomy(evaluation.prepared)
  if (!economy || economy.current < evaluation.cost) return null

  const forecast = forecastStatDrivenAttack(
    evaluation.prepared,
    evaluation.action,
    target,
    PV1F_COMBAT_CONTENT,
  )
  if (!forecast.evaluation.legal) return null

  const targetCombatant = state.tactical.battle.combatants.find(
    (combatant) => combatant.id === targetCombatantId,
  )
  const damage = forecast.mitigatedBaseDamage ?? 0
  const lethalBonus = targetCombatant && damage >= targetCombatant.hp ? 16 : 0
  const hitChanceBonus = Math.round((forecast.hitChanceBasisPoints ?? 0) / 1_000)

  return {
    intent: { kind: 'action', actionId: evaluation.action.id, target },
    reason: 'legal-damage',
    utility: profile.attackUtility + damage + lethalBonus + hitChanceBonus,
    stableKey: `action:${evaluation.action.id}:unit:${targetCombatantId}`,
  }
}

function createSelfActionCandidate(
  state: StatDrivenCombatEncounterState,
  actionId: string,
  reason: 'guard-survival' | 'recover-survival',
  utility: number,
): Candidate | null {
  try {
    const evaluated = evaluatePv1fAction(state, actionId, { kind: 'self' })
    const economy = readPv1fActionEconomy(evaluated.prepared)
    if (!evaluated.evaluation.legal || !economy || economy.current < evaluated.cost) return null
    return {
      intent: { kind: 'action', actionId: evaluated.action.id, target: { kind: 'self' } },
      reason,
      utility,
      stableKey: `action:${evaluated.action.id}:self`,
    }
  } catch {
    return null
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
  if (intent.kind === 'move') {
    return { kind: 'move', path: intent.path.map((position) => ({ ...position })) }
  }
  if (intent.kind === 'action') return { ...intent, target: copyTarget(intent.target) }
  return { ...intent }
}

function copyTarget(target: CombatTargetSelection): CombatTargetSelection {
  if (target.kind === 'tile') return { kind: 'tile', position: { ...target.position } }
  return { ...target }
}

function assertRecruitAiProfile(profile: RecruitAiProfile): void {
  const supportedIds = new Set(['recruit-easy-v2', 'recruit-standard-v2', 'recruit-high-v2'])
  if (!supportedIds.has(profile.id) || profile.version !== RECRUIT_AI_PROFILE_VERSION) {
    throw new Error('Unsupported Recruit AI profile.')
  }
  if (
    !Number.isSafeInteger(profile.maxCandidates) ||
    profile.maxCandidates < 1 ||
    profile.maxCandidates > 256
  ) {
    throw new RangeError('Recruit AI maxCandidates must be a safe integer between 1 and 256.')
  }
}

export function recruitAiActionCatalog(): readonly string[] {
  return ['basic.attack.unarmed.basic', PV1F_GUARD_ACTION_ID, PV1F_RECOVER_ACTION_ID]
}

export function recruitAiKnowledgeFromTacticalStateForTest(
  tactical: StatDrivenCombatEncounterState['tactical'],
): Pick<RecruitAiKnowledge, 'placements' | 'tiles'> {
  return {
    placements: tactical.placements.map((placement) => ({
      ...placement,
      position: { ...placement.position },
    })),
    tiles: tactical.tiles.map((tile) => ({ ...tile, position: { ...tile.position } })),
  }
}
