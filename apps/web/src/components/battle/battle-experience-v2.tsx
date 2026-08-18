'use client'

import { classifyFacingRelation } from '@aurevane/game-core/combat/board'
import type { BattleIntent } from '@aurevane/validation/combat/battle-session'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { BattleFinalTurnPreviewView } from '@/server/battle/battle-final-turn-service'
import type { BattlePreviewView } from '@/server/battle/battle-preview-service'
import type { RecruitTurnView } from '@/server/battle/battle-recruit-ai-service'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

import { BattleCompletionPanel } from './battle-completion-panel'
import { BattleLogPanel } from './battle-log-panel'
import styles from './battle-experience-v2.module.css'

const BASIC_ATTACK_ID = 'basic.attack.unarmed.basic'
const GUARD_ID = 'basic.guard'

type PlanningMode = 'inspect' | 'move' | 'attack' | 'guard' | 'end-turn'
type GridPosition = { x: number; y: number }
type Facing = 'north' | 'east' | 'south' | 'west'
type TacticalState = BattleSessionView['snapshot']['tactical']
type Combatant = TacticalState['battle']['combatants'][number]
type CombatPlacement = TacticalState['placements'][number]
type CombatStatus = BattleSessionView['snapshot']['statusState'][number]['statuses'][number]

interface BattleExperienceProps {
  initialBattle: BattleSessionView
}

interface ApiErrorBody {
  error?: {
    code?: string
    message?: string
    currentVersion?: number
  }
}

function positionKey(position: GridPosition): string {
  return `${position.x}:${position.y}`
}

function positionsEqual(left: GridPosition, right: GridPosition): boolean {
  return left.x === right.x && left.y === right.y
}

function facingGlyph(facing: Facing): string {
  if (facing === 'north') return '↑'
  if (facing === 'east') return '→'
  if (facing === 'south') return '↓'
  return '←'
}

function percentFromBasisPoints(value: number | null): string {
  if (value === null) return '—'
  return `${Math.round(value / 100)}%`
}

function percent(value: number, maximum: number): string {
  if (maximum <= 0) return '0%'
  return `${Math.max(0, Math.min(100, (value / maximum) * 100))}%`
}

function combatantLabel(combatantId: string): string {
  if (combatantId.startsWith('character:')) return 'Wayfarer'
  if (combatantId.startsWith('recruit:')) return 'Recruit'
  return combatantId
}

function activeFacingForBattle(battle: BattleSessionView): Facing {
  const turn = battle.snapshot.tactical.battle.currentTurn
  if (!turn) return 'east'
  if (turn.finalFacing) return turn.finalFacing
  return (
    battle.snapshot.tactical.placements.find(
      (placement) => placement.combatantId === turn.combatantId,
    )?.facing ?? 'east'
  )
}

function facingToward(from: GridPosition, to: GridPosition): Facing | null {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (dx === 0 && dy === 0) return null
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'east' : 'west'
  return dy >= 0 ? 'south' : 'north'
}

function facingFromPath(path: readonly GridPosition[]): Facing | null {
  if (path.length < 2) return null
  const previous = path[path.length - 2]
  const destination = path[path.length - 1]
  if (!previous || !destination) return null
  return facingToward(previous, destination)
}

function manhattanDistance(left: GridPosition, right: GridPosition): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y)
}

function statusLabel(status: CombatStatus): string {
  if (status.statusId === 'guarded') return 'Guarded · -20% damage'
  return status.statusId.replaceAll('.', ' ')
}

function modeInstruction(
  mode: PlanningMode,
  actionReady: boolean,
  movementRemaining: number,
  provisionalFacing: Facing,
): string {
  if (mode === 'move') {
    return `MOVE · Green tiles are reachable now. Click any green tile and AUREVANE will build the path. You have ${movementRemaining} Movement left, and moving does NOT spend your Action.`
  }
  if (mode === 'attack') {
    return actionReady
      ? 'BASIC ATTACK · Green target = legal range; red target = blocked or out of range. Review the forecast, then Confirm. Attacking spends your Action.'
      : 'BASIC ATTACK · Your Action is already spent this turn.'
  }
  if (mode === 'guard') {
    return actionReady
      ? 'GUARD · Guard spends your Action and reduces incoming damage by 20% until your next turn. Confirm to commit it.'
      : 'GUARD · Your Action is already spent this turn.'
  }
  if (mode === 'end-turn') {
    return `FACING → END TURN · Choose the direction you want to protect, then Confirm. You will end the turn facing ${provisionalFacing} ${facingGlyph(provisionalFacing)}.`
  }
  return 'INSPECT · Click a unit or tile. Terrain cost, elevation, HP, MP, statuses, initiative and facing are explained in the Inspector.'
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

function terrainTraversalCost(
  tactical: TacticalState,
  terrainId: string,
  movementProfileId: string,
): number | null {
  const profile = tactical.movementProfiles.find((candidate) => candidate.id === movementProfileId)
  const override = profile?.terrainCostOverrides.find(
    (candidate) => candidate.terrainId === terrainId,
  )
  if (override) return override.traversalCost
  return tactical.terrains.find((candidate) => candidate.id === terrainId)?.traversalCost ?? null
}

function buildReachablePaths(
  tactical: TacticalState,
  activePlacement: CombatPlacement | null,
): Map<string, GridPosition[]> {
  const turn = tactical.battle.currentTurn
  if (!turn || !activePlacement || turn.combatantId !== activePlacement.combatantId)
    return new Map()

  const profile = tactical.movementProfiles.find(
    (candidate) => candidate.id === activePlacement.movementProfileId,
  )
  if (!profile) return new Map()

  const tiles = new Map(tactical.tiles.map((tile) => [positionKey(tile.position), tile] as const))
  const occupied = new Map(
    tactical.placements.map(
      (placement) => [positionKey(placement.position), placement.combatantId] as const,
    ),
  )
  const result = new Map<string, GridPosition[]>()
  const bestCost = new Map<string, number>()
  const frontier: Array<{ position: GridPosition; cost: number; path: GridPosition[] }> = [
    { position: { ...activePlacement.position }, cost: 0, path: [{ ...activePlacement.position }] },
  ]

  bestCost.set(positionKey(activePlacement.position), 0)
  result.set(positionKey(activePlacement.position), [{ ...activePlacement.position }])

  while (frontier.length > 0) {
    frontier.sort((left, right) => left.cost - right.cost)
    const current = frontier.shift()
    if (!current) break

    const neighbors: GridPosition[] = [
      { x: current.position.x + 1, y: current.position.y },
      { x: current.position.x - 1, y: current.position.y },
      { x: current.position.x, y: current.position.y + 1 },
      { x: current.position.x, y: current.position.y - 1 },
    ]

    for (const neighbor of neighbors) {
      if (
        neighbor.x < 0 ||
        neighbor.x >= tactical.width ||
        neighbor.y < 0 ||
        neighbor.y >= tactical.height
      )
        continue

      const neighborKey = positionKey(neighbor)
      const neighborTile = tiles.get(neighborKey)
      const currentTile = tiles.get(positionKey(current.position))
      if (!neighborTile || !currentTile) continue

      const occupant = occupied.get(neighborKey)
      if (occupant && occupant !== activePlacement.combatantId) continue
      if (Math.abs(neighborTile.elevation - currentTile.elevation) > profile.maxElevationStep)
        continue

      const traversalCost = terrainTraversalCost(
        tactical,
        neighborTile.terrainId,
        activePlacement.movementProfileId,
      )
      if (traversalCost === null) continue

      const nextCost = current.cost + traversalCost
      if (nextCost > turn.movementRemaining) continue

      const known = bestCost.get(neighborKey)
      if (known !== undefined && known <= nextCost) continue

      const nextPath = [...current.path, { ...neighbor }]
      bestCost.set(neighborKey, nextCost)
      result.set(neighborKey, nextPath)
      frontier.push({ position: neighbor, cost: nextCost, path: nextPath })
    }
  }

  return result
}

function getStatuses(
  battle: BattleSessionView,
  combatantId: string | null,
): readonly CombatStatus[] {
  if (!combatantId) return []
  return battle.snapshot.statusState.find((row) => row.combatantId === combatantId)?.statuses ?? []
}

function describeRecruitTurn(
  before: BattleSessionView,
  after: BattleSessionView,
  decisions: RecruitTurnView['decisions'],
): string {
  const recruitProfile = before.snapshot.statBridge.combatants.find(
    (profile) => profile.provenance.kind === 'scenario',
  )
  const playerProfile = before.snapshot.statBridge.combatants.find(
    (profile) => profile.provenance.kind === 'character-derived',
  )
  const recruitId = recruitProfile?.combatantId
  const playerId = playerProfile?.combatantId
  if (!recruitId) return 'Recruit turn resolved.'

  const beforeRecruit = before.snapshot.tactical.placements.find(
    (placement) => placement.combatantId === recruitId,
  )
  const afterRecruit = after.snapshot.tactical.placements.find(
    (placement) => placement.combatantId === recruitId,
  )
  const beforePlayer = before.snapshot.tactical.battle.combatants.find(
    (combatant) => combatant.id === playerId,
  )
  const afterPlayer = after.snapshot.tactical.battle.combatants.find(
    (combatant) => combatant.id === playerId,
  )
  const parts: string[] = []

  if (
    beforeRecruit &&
    afterRecruit &&
    !positionsEqual(beforeRecruit.position, afterRecruit.position)
  ) {
    parts.push(
      `moved ${beforeRecruit.position.x + 1},${beforeRecruit.position.y + 1} → ${afterRecruit.position.x + 1},${afterRecruit.position.y + 1}`,
    )
  }

  const attemptedAttack = decisions.some((decision) => decision.reason === 'legal-damage')
  if (beforePlayer && afterPlayer && beforePlayer.hp > afterPlayer.hp) {
    parts.push(`hit Wayfarer for ${beforePlayer.hp - afterPlayer.hp} damage`)
  } else if (attemptedAttack) {
    parts.push('attacked but dealt no damage')
  }

  const guarded = getStatuses(after, recruitId).some((status) => status.statusId === 'guarded')
  if (guarded) parts.push('Guarded (-20% incoming damage)')

  if (afterRecruit)
    parts.push(`finished facing ${afterRecruit.facing} ${facingGlyph(afterRecruit.facing)}`)

  return parts.length > 0
    ? `Recruit turn: ${parts.join(' → ')}.`
    : 'Recruit turn resolved with no visible state change.'
}

function combatantCard(
  combatant: Combatant | null,
  placement: CombatPlacement | null,
  statuses: readonly CombatStatus[],
  active: boolean,
  onSelect: () => void,
) {
  if (!combatant || !placement) return null
  const label = combatantLabel(combatant.id)
  const sigil = label === 'Wayfarer' ? 'W' : 'R'
  return (
    <button
      type="button"
      className={`${styles.combatantCard} ${active ? styles.combatantCardActive : ''}`}
      onClick={onSelect}
      aria-label={`Inspect ${label}`}
    >
      <span className={styles.combatantSigil}>{sigil}</span>
      <span className={styles.combatantMain}>
        <span className={styles.combatantHeading}>
          <strong>{label}</strong>
          <small>{active ? 'ACTIVE TURN' : `${combatant.initiative} INIT`}</small>
        </span>
        <span className={styles.meterRow}>
          <b>HP</b>
          <span className={`${styles.meter} ${styles.hpMeter}`}>
            <span style={{ width: percent(combatant.hp, combatant.maxHp) }} />
          </span>
          <b>
            {combatant.hp}/{combatant.maxHp}
          </b>
        </span>
        <span className={styles.meterRow}>
          <b>MP</b>
          <span className={`${styles.meter} ${styles.mpMeter}`}>
            <span style={{ width: percent(combatant.mp, combatant.maxMp) }} />
          </span>
          <b>
            {combatant.mp}/{combatant.maxMp}
          </b>
        </span>
        <span className={styles.statuses}>
          {statuses.length > 0 ? (
            statuses.map((status) => (
              <span
                className={styles.statusTag}
                key={`${status.statusId}:${status.sourceCombatantId}`}
              >
                {statusLabel(status)}
              </span>
            ))
          ) : (
            <span className={styles.statusEmpty}>No active status</span>
          )}
        </span>
      </span>
      <span className={styles.facingBadge}>
        <strong>{facingGlyph(placement.facing)}</strong>
        <small>{placement.facing}</small>
      </span>
    </button>
  )
}

export function BattleExperienceV2({ initialBattle }: BattleExperienceProps) {
  const [battle, setBattle] = useState(initialBattle)
  const [mode, setMode] = useState<PlanningMode>('inspect')
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(
    initialBattle.snapshot.statBridge.combatants.find(
      (profile) => profile.provenance.kind === 'character-derived',
    )?.combatantId ?? null,
  )
  const [selectedPosition, setSelectedPosition] = useState<GridPosition | null>(null)
  const [path, setPath] = useState<GridPosition[]>([])
  const [pendingIntent, setPendingIntent] = useState<BattleIntent | null>(null)
  const [preview, setPreview] = useState<BattlePreviewView | null>(null)
  const [finalTurnPreview, setFinalTurnPreview] = useState<BattleFinalTurnPreviewView | null>(null)
  const [provisionalFacing, setProvisionalFacing] = useState<Facing>(
    activeFacingForBattle(initialBattle),
  )
  const [previewPending, setPreviewPending] = useState(false)
  const [commitPending, setCommitPending] = useState(false)
  const [recruitPending, setRecruitPending] = useState(false)
  const [recruitFailed, setRecruitFailed] = useState(false)
  const [notice, setNotice] = useState(
    'Battle ready. Use Move, then an Action, choose Facing, and End Turn.',
  )
  const previewSequence = useRef(0)
  const recruitAttemptedVersion = useRef<number | null>(null)
  const commitLock = useRef(false)
  const recruitLock = useRef(false)

  const snapshot = battle.snapshot
  const tactical = snapshot.tactical
  const battleState = tactical.battle
  const currentTurn = battleState.currentTurn
  const activeProfile = currentTurn
    ? (snapshot.statBridge.combatants.find(
        (profile) => profile.combatantId === currentTurn.combatantId,
      ) ?? null)
    : null
  const playerTurn = activeProfile?.provenance.kind === 'character-derived'
  const activePlacement = currentTurn
    ? (tactical.placements.find((placement) => placement.combatantId === currentTurn.combatantId) ??
      null)
    : null

  const playerProfile = snapshot.statBridge.combatants.find(
    (profile) => profile.provenance.kind === 'character-derived',
  )
  const recruitProfile = snapshot.statBridge.combatants.find(
    (profile) => profile.provenance.kind === 'scenario',
  )
  const playerId = playerProfile?.combatantId ?? null
  const recruitId = recruitProfile?.combatantId ?? null
  const playerCombatant = playerId
    ? (battleState.combatants.find((combatant) => combatant.id === playerId) ?? null)
    : null
  const recruitCombatant = recruitId
    ? (battleState.combatants.find((combatant) => combatant.id === recruitId) ?? null)
    : null
  const playerPlacement = playerId
    ? (tactical.placements.find((placement) => placement.combatantId === playerId) ?? null)
    : null
  const recruitPlacement = recruitId
    ? (tactical.placements.find((placement) => placement.combatantId === recruitId) ?? null)
    : null
  const playerStatuses = getStatuses(battle, playerId)
  const recruitStatuses = getStatuses(battle, recruitId)

  const selectedCombatant = selectedUnitId
    ? (battleState.combatants.find((combatant) => combatant.id === selectedUnitId) ?? null)
    : null
  const selectedPlacement = selectedUnitId
    ? (tactical.placements.find((placement) => placement.combatantId === selectedUnitId) ?? null)
    : null
  const selectedProfile = selectedUnitId
    ? (snapshot.statBridge.combatants.find((profile) => profile.combatantId === selectedUnitId) ??
      null)
    : null
  const selectedStatuses = getStatuses(battle, selectedUnitId)

  const placementByTile = useMemo(
    () =>
      new Map(
        tactical.placements.map(
          (placement) => [positionKey(placement.position), placement] as const,
        ),
      ),
    [tactical.placements],
  )
  const tileByKey = useMemo(
    () => new Map(tactical.tiles.map((tile) => [positionKey(tile.position), tile] as const)),
    [tactical.tiles],
  )
  const pathTiles = useMemo(() => new Set(path.map(positionKey)), [path])
  const previewAffectedTiles = useMemo(() => {
    if (preview?.preview.kind !== 'action') return new Set<string>()
    return new Set(preview.preview.affectedTiles.map(positionKey))
  }, [preview])
  const reachablePaths = useMemo(
    () =>
      playerTurn
        ? buildReachablePaths(tactical, activePlacement)
        : new Map<string, GridPosition[]>(),
    [activePlacement, playerTurn, tactical],
  )

  const selectedTile = selectedPosition
    ? (tileByKey.get(positionKey(selectedPosition)) ?? null)
    : null
  const selectedTileReachable = selectedTile
    ? reachablePaths.has(positionKey(selectedTile.position))
    : false
  const actionReady = currentTurn?.actionState === 'ready'
  const previewLegal = preview?.preview.legal ?? false
  const finalTurnLegal = finalTurnPreview?.legal ?? false
  const planningDisabled =
    !playerTurn || battleState.lifecycle !== 'active' || commitPending || recruitPending
  const commandLegal = mode === 'end-turn' ? finalTurnLegal : previewLegal
  const hasPendingCommand = mode === 'end-turn' ? Boolean(finalTurnPreview) : Boolean(pendingIntent)

  const attackFacingRelation = useMemo(() => {
    if (!playerPlacement || !recruitPlacement) return null
    return classifyFacingRelation(
      recruitPlacement.position,
      recruitPlacement.facing,
      playerPlacement.position,
    )
  }, [playerPlacement, recruitPlacement])
  const attackGeometryLegal =
    Boolean(playerPlacement && recruitPlacement) &&
    manhattanDistance(playerPlacement!.position, recruitPlacement!.position) === 1 &&
    Math.abs(
      (tileByKey.get(positionKey(playerPlacement!.position))?.elevation ?? 0) -
        (tileByKey.get(positionKey(recruitPlacement!.position))?.elevation ?? 0),
    ) <= 1

  const resetPlanning = useCallback(() => {
    previewSequence.current += 1
    setMode('inspect')
    setPath([])
    setPendingIntent(null)
    setPreview(null)
    setFinalTurnPreview(null)
    setPreviewPending(false)
  }, [])

  const refreshBattle = useCallback(
    async (message = 'Authoritative battle state refreshed.') => {
      const response = await fetch(`/api/battles/${battle.battleSessionId}`, {
        method: 'GET',
        cache: 'no-store',
      })
      const body = (await response.json()) as { battle?: BattleSessionView } & ApiErrorBody
      if (!response.ok || !body.battle) {
        throw new Error(body.error?.message ?? 'The battle state could not be refreshed.')
      }
      setBattle(body.battle)
      setProvisionalFacing(activeFacingForBattle(body.battle))
      resetPlanning()
      setNotice(message)
      return body.battle
    },
    [battle.battleSessionId, resetPlanning],
  )

  const handleApiFailure = useCallback(
    async (response: Response, body: ApiErrorBody, fallback: string) => {
      if (response.status === 409 && body.error?.code === 'STALE_VERSION') {
        try {
          await refreshBattle(
            `Battle changed to state v${body.error.currentVersion ?? 'newer'}. Your unfinished preview was cleared and the authoritative state was reloaded.`,
          )
        } catch (refreshError) {
          setNotice(
            refreshError instanceof Error
              ? refreshError.message
              : 'The battle changed and could not be refreshed.',
          )
        }
        return
      }
      setNotice(body.error?.message ?? fallback)
    },
    [refreshBattle],
  )

  const runRecruitTurn = useCallback(async () => {
    if (
      recruitLock.current ||
      recruitPending ||
      playerTurn ||
      battleState.lifecycle !== 'active' ||
      !currentTurn ||
      recruitAttemptedVersion.current === battle.battleVersion
    )
      return

    recruitLock.current = true
    recruitAttemptedVersion.current = battle.battleVersion
    setRecruitPending(true)
    setRecruitFailed(false)
    resetPlanning()
    setNotice(
      'Recruit turn resolving… movement, Action and facing are being committed server-side.',
    )
    const before = battle

    try {
      const response = await fetch(`/api/battles/${battle.battleSessionId}/recruit-turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedBattleVersion: battle.battleVersion }),
      })
      const body = (await response.json()) as { battle?: RecruitTurnView } & ApiErrorBody
      if (!response.ok || !body.battle) {
        await handleApiFailure(response, body, 'The Recruit turn could not be resolved.')
        setRecruitFailed(true)
        return
      }

      const nextBattle: BattleSessionView = {
        battleSessionId: body.battle.battleSessionId,
        battleVersion: body.battle.battleVersion,
        snapshot: body.battle.snapshot,
        replayed: false,
        invalidation: body.battle.invalidation,
      }
      setBattle(nextBattle)
      setProvisionalFacing(activeFacingForBattle(nextBattle))
      setSelectedUnitId(
        nextBattle.snapshot.statBridge.combatants.find(
          (profile) => profile.provenance.kind === 'scenario',
        )?.combatantId ?? null,
      )
      setNotice(describeRecruitTurn(before, nextBattle, body.battle.decisions))
    } catch (error) {
      setRecruitFailed(true)
      setNotice(error instanceof Error ? error.message : 'The Recruit turn could not be resolved.')
    } finally {
      setRecruitPending(false)
      recruitLock.current = false
    }
  }, [
    battle,
    battleState.lifecycle,
    currentTurn,
    handleApiFailure,
    playerTurn,
    recruitPending,
    resetPlanning,
  ])

  const requestPreview = useCallback(
    async (intent: BattleIntent) => {
      const sequence = ++previewSequence.current
      setPreviewPending(true)
      setPendingIntent(intent)
      setFinalTurnPreview(null)

      try {
        const response = await fetch(`/api/battles/${battle.battleSessionId}/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedBattleVersion: battle.battleVersion, intent }),
        })
        const body = (await response.json()) as { battlePreview?: BattlePreviewView } & ApiErrorBody
        if (sequence !== previewSequence.current) return
        if (!response.ok || !body.battlePreview) {
          setPreview(null)
          await handleApiFailure(response, body, 'That command could not be previewed.')
          return
        }
        setPreview(body.battlePreview)
        const issue = body.battlePreview.preview.issues[0]
        if (!body.battlePreview.preview.legal) {
          setNotice(issue?.message ?? 'That command is not legal in the current state.')
          return
        }
        if (body.battlePreview.preview.kind === 'move') {
          setNotice(
            `Move preview: costs ${body.battlePreview.preview.cost} Movement and leaves ${body.battlePreview.preview.movementRemainingAfter}. Your Action stays available.`,
          )
        } else if (
          body.battlePreview.preview.kind === 'action' &&
          body.battlePreview.preview.actionId === BASIC_ATTACK_ID
        ) {
          setNotice(
            `Attack preview ready: ${percentFromBasisPoints(body.battlePreview.preview.hitChanceBasisPoints)} hit chance, ${body.battlePreview.preview.mitigatedBaseDamage ?? '—'} base damage after defense.`,
          )
        } else if (
          body.battlePreview.preview.kind === 'action' &&
          body.battlePreview.preview.actionId === GUARD_ID
        ) {
          setNotice(
            'Guard preview ready: incoming damage will be reduced by 20% until your next turn.',
          )
        } else {
          setNotice('Preview ready. Confirm to commit this command.')
        }
      } catch (error) {
        if (sequence !== previewSequence.current) return
        setPreview(null)
        setNotice(error instanceof Error ? error.message : 'That command could not be previewed.')
      } finally {
        if (sequence === previewSequence.current) setPreviewPending(false)
      }
    },
    [battle.battleSessionId, battle.battleVersion, handleApiFailure],
  )

  const requestFinalTurnPreview = useCallback(
    async (facing: Facing) => {
      const sequence = ++previewSequence.current
      setPreviewPending(true)
      setPendingIntent(null)
      setPreview(null)
      setFinalTurnPreview(null)

      try {
        const response = await fetch(`/api/battles/${battle.battleSessionId}/final-turn/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedBattleVersion: battle.battleVersion, facing }),
        })
        const body = (await response.json()) as {
          finalTurnPreview?: BattleFinalTurnPreviewView
        } & ApiErrorBody
        if (sequence !== previewSequence.current) return
        if (!response.ok || !body.finalTurnPreview) {
          await handleApiFailure(response, body, 'That final turn could not be previewed.')
          return
        }
        setFinalTurnPreview(body.finalTurnPreview)
        setNotice(
          body.finalTurnPreview.legal
            ? `Ready to end the turn facing ${facing} ${facingGlyph(facing)}. Confirm when you are finished moving and acting.`
            : (body.finalTurnPreview.issues[0]?.message ?? 'That final turn is not legal.'),
        )
      } catch (error) {
        if (sequence !== previewSequence.current) return
        setNotice(
          error instanceof Error ? error.message : 'That final turn could not be previewed.',
        )
      } finally {
        if (sequence === previewSequence.current) setPreviewPending(false)
      }
    },
    [battle.battleSessionId, battle.battleVersion, handleApiFailure],
  )

  const commitIntent = useCallback(async () => {
    if (commitLock.current || commitPending || !pendingIntent || !preview?.preview.legal) return
    commitLock.current = true
    setCommitPending(true)
    const committedIntent = pendingIntent
    const before = battle

    try {
      const response = await fetch(`/api/battles/${battle.battleSessionId}/intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          expectedBattleVersion: battle.battleVersion,
          intent: committedIntent,
        }),
      })
      const body = (await response.json()) as { battle?: BattleSessionView } & ApiErrorBody
      if (!response.ok || !body.battle) {
        await handleApiFailure(response, body, 'That command could not be committed.')
        return
      }

      let nextFacing = activeFacingForBattle(body.battle)
      if (committedIntent.kind === 'move') {
        nextFacing = facingFromPath(committedIntent.path) ?? nextFacing
      } else if (
        committedIntent.kind === 'action' &&
        committedIntent.actionId === BASIC_ATTACK_ID &&
        committedIntent.target.kind === 'unit' &&
        activePlacement
      ) {
        const targetPlacement = tactical.placements.find(
          (placement) => placement.combatantId === committedIntent.target.combatantId,
        )
        if (targetPlacement) {
          nextFacing =
            facingToward(activePlacement.position, targetPlacement.position) ?? nextFacing
        }
      }

      setBattle(body.battle)
      setProvisionalFacing(nextFacing)
      resetPlanning()

      if (committedIntent.kind === 'move') {
        const turn = body.battle.snapshot.tactical.battle.currentTurn
        const destination = committedIntent.path.at(-1)
        setNotice(
          `Moved${destination ? ` to ${destination.x + 1},${destination.y + 1}` : ''}. ${turn?.movementRemaining ?? 0}/${turn?.movementMaximum ?? 0} Movement remains. Action is still ${turn?.actionState === 'ready' ? 'READY' : 'SPENT'}.`,
        )
      } else if (
        committedIntent.kind === 'action' &&
        committedIntent.actionId === BASIC_ATTACK_ID &&
        committedIntent.target.kind === 'unit'
      ) {
        const targetBefore = before.snapshot.tactical.battle.combatants.find(
          (combatant) => combatant.id === committedIntent.target.combatantId,
        )
        const targetAfter = body.battle.snapshot.tactical.battle.combatants.find(
          (combatant) => combatant.id === committedIntent.target.combatantId,
        )
        const damage =
          targetBefore && targetAfter ? Math.max(0, targetBefore.hp - targetAfter.hp) : 0
        setNotice(
          damage > 0 && targetAfter
            ? `Basic Attack hit for ${damage} damage. ${combatantLabel(targetAfter.id)} now has ${targetAfter.hp}/${targetAfter.maxHp} HP.`
            : `Basic Attack resolved with no HP loss. ${targetAfter ? `${combatantLabel(targetAfter.id)} remains at ${targetAfter.hp}/${targetAfter.maxHp} HP.` : ''}`,
        )
      } else if (committedIntent.kind === 'action' && committedIntent.actionId === GUARD_ID) {
        setNotice(
          'Guard committed. You are Guarded: incoming damage is reduced by 20% until your next turn. Your Action is SPENT; remaining Movement can still be used.',
        )
      } else {
        setNotice(`Command committed at state v${body.battle.battleVersion}.`)
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'That command could not be committed.')
    } finally {
      setCommitPending(false)
      commitLock.current = false
    }
  }, [
    activePlacement,
    battle,
    commitPending,
    handleApiFailure,
    pendingIntent,
    preview,
    resetPlanning,
    tactical.placements,
  ])

  const commitFinalTurn = useCallback(async () => {
    if (commitLock.current || commitPending || !finalTurnPreview?.legal) return
    commitLock.current = true
    setCommitPending(true)

    try {
      const response = await fetch(`/api/battles/${battle.battleSessionId}/final-turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          expectedBattleVersion: battle.battleVersion,
          facing: provisionalFacing,
        }),
      })
      const body = (await response.json()) as { battle?: BattleSessionView } & ApiErrorBody
      if (!response.ok || !body.battle) {
        await handleApiFailure(response, body, 'The turn could not be ended.')
        return
      }
      setBattle(body.battle)
      setProvisionalFacing(activeFacingForBattle(body.battle))
      resetPlanning()
      setNotice(
        `Turn ended facing ${provisionalFacing} ${facingGlyph(provisionalFacing)}. Recruit turn begins.`,
      )
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The turn could not be ended.')
    } finally {
      setCommitPending(false)
      commitLock.current = false
    }
  }, [
    battle.battleSessionId,
    battle.battleVersion,
    commitPending,
    finalTurnPreview,
    handleApiFailure,
    provisionalFacing,
    resetPlanning,
  ])

  useEffect(() => {
    if (
      !playerTurn &&
      currentTurn &&
      battleState.lifecycle === 'active' &&
      !recruitPending &&
      !recruitFailed &&
      recruitAttemptedVersion.current !== battle.battleVersion
    ) {
      void runRecruitTurn()
    }
  }, [
    battle.battleVersion,
    battleState.lifecycle,
    currentTurn,
    playerTurn,
    recruitFailed,
    recruitPending,
    runRecruitTurn,
  ])

  useEffect(() => {
    function handleReconnect() {
      recruitAttemptedVersion.current = null
      setRecruitFailed(false)
      void refreshBattle('Connection restored. Authoritative battle state reloaded.').catch(
        (error) => {
          setNotice(error instanceof Error ? error.message : 'The battle could not be refreshed.')
        },
      )
    }

    window.addEventListener('online', handleReconnect)
    return () => window.removeEventListener('online', handleReconnect)
  }, [refreshBattle])

  const chooseMode = useCallback(
    (nextMode: PlanningMode) => {
      resetPlanning()
      setMode(nextMode)

      if (nextMode === 'guard') {
        void requestPreview({ kind: 'action', actionId: GUARD_ID, target: { kind: 'self' } })
        return
      }
      if (nextMode === 'end-turn') {
        void requestFinalTurnPreview(provisionalFacing)
        return
      }
      if (nextMode === 'move') {
        setNotice(
          `Move mode: ${currentTurn?.movementRemaining ?? 0} Movement available. Green tiles are reachable. Moving does NOT spend your Action.`,
        )
        return
      }
      if (nextMode === 'attack') {
        setNotice(
          'Basic Attack: select the Recruit. Green means legal range; red means blocked or out of range.',
        )
        return
      }
      setNotice(
        'Inspect mode: select a unit or tile for terrain, elevation, vitals and facing details.',
      )
    },
    [
      currentTurn?.movementRemaining,
      provisionalFacing,
      requestFinalTurnPreview,
      requestPreview,
      resetPlanning,
    ],
  )

  function handleTileClick(position: GridPosition) {
    const key = positionKey(position)
    const placement = placementByTile.get(key)
    setSelectedPosition(position)
    setSelectedUnitId(placement?.combatantId ?? null)

    if (!playerTurn || commitPending || recruitPending) return

    if (mode === 'move') {
      const nextPath = reachablePaths.get(key)
      if (!nextPath) {
        setNotice(
          'That tile is not reachable with your remaining Movement. Red-tinted tiles are currently unavailable.',
        )
        return
      }
      if (nextPath.length < 2) {
        setNotice('You are already standing on that tile.')
        return
      }
      setPath(nextPath)
      void requestPreview({ kind: 'move', path: nextPath })
      return
    }

    if (mode === 'attack' && placement) {
      if (placement.combatantId === currentTurn?.combatantId) {
        setNotice('Basic Attack must target an enemy.')
        return
      }
      if (activePlacement) {
        setProvisionalFacing(
          facingToward(activePlacement.position, placement.position) ?? provisionalFacing,
        )
      }
      void requestPreview({
        kind: 'action',
        actionId: BASIC_ATTACK_ID,
        target: { kind: 'unit', combatantId: placement.combatantId },
      })
    }
  }

  const previewFacing = useCallback(
    (facing: Facing) => {
      if (!playerTurn || commitPending || recruitPending) return
      setProvisionalFacing(facing)
      setMode('end-turn')
      void requestFinalTurnPreview(facing)
    },
    [commitPending, playerTurn, recruitPending, requestFinalTurnPreview],
  )

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTextEntryTarget(event.target)) return

      if (event.key === 'Escape') {
        event.preventDefault()
        resetPlanning()
        setNotice('Planning cleared. Nothing was committed.')
        return
      }

      if (!playerTurn || battleState.lifecycle !== 'active' || commitPending || recruitPending)
        return

      if (event.key === '1') {
        event.preventDefault()
        chooseMode('inspect')
      } else if (event.key === '2') {
        event.preventDefault()
        chooseMode('move')
      } else if (event.key === '3') {
        event.preventDefault()
        if (actionReady) chooseMode('attack')
      } else if (event.key === '4') {
        event.preventDefault()
        if (actionReady) chooseMode('guard')
      } else if (event.key === '5' || event.code === 'Space') {
        event.preventDefault()
        chooseMode('end-turn')
      } else if (event.key === 'Enter') {
        if (mode === 'end-turn' && finalTurnPreview?.legal) {
          event.preventDefault()
          void commitFinalTurn()
        } else if (preview?.preview.legal && pendingIntent) {
          event.preventDefault()
          void commitIntent()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    actionReady,
    battleState.lifecycle,
    chooseMode,
    commitFinalTurn,
    commitIntent,
    commitPending,
    finalTurnPreview,
    mode,
    pendingIntent,
    playerTurn,
    preview,
    recruitPending,
    resetPlanning,
  ])

  const selectedTerrainCost =
    selectedTile && activePlacement
      ? terrainTraversalCost(tactical, selectedTile.terrainId, activePlacement.movementProfileId)
      : null
  const selectedMovementProfile = activePlacement
    ? tactical.movementProfiles.find((profile) => profile.id === activePlacement.movementProfileId)
    : null

  return (
    <main className={styles.shell} aria-busy={recruitPending}>
      <a className="skip-link" href="#battlefield">
        Skip to battlefield
      </a>

      <header className={styles.objectiveBar}>
        <div className={styles.objectiveCopy}>
          <span className={styles.kicker}>Tactical Hall · Controlled Exercise</span>
          <strong>Defeat the opposing Recruit</strong>
        </div>
        <div className={styles.roundReadout} aria-label="Battle round and activation">
          <span>Round {battleState.round}</span>
          <span>Activation {battleState.turnNumber}</span>
          <span>State v{battle.battleVersion}</span>
        </div>
      </header>

      <div className={styles.content}>
        <section className={styles.combatHud} aria-label="Combatant status and turn flow">
          {combatantCard(
            playerCombatant,
            playerPlacement,
            playerStatuses,
            currentTurn?.combatantId === playerId,
            () => setSelectedUnitId(playerId),
          )}

          <div className={styles.turnFlow} aria-label="Turn flow">
            <div
              className={`${styles.flowStep} ${playerTurn && (currentTurn?.movementRemaining ?? 0) > 0 ? styles.flowReady : ''} ${mode === 'move' ? styles.flowActive : ''}`}
            >
              <span>1 · Move</span>
              <strong>
                {currentTurn?.movementRemaining ?? 0}/{currentTurn?.movementMaximum ?? 0}
              </strong>
              <small>Does not spend Action</small>
            </div>
            <div
              className={`${styles.flowStep} ${playerTurn && actionReady ? styles.flowReady : ''} ${mode === 'attack' || mode === 'guard' ? styles.flowActive : ''}`}
            >
              <span>2 · Action</span>
              <strong>{actionReady ? 'READY' : 'SPENT'}</strong>
              <small>Attack or Guard</small>
            </div>
            <div className={`${styles.flowStep} ${mode === 'end-turn' ? styles.flowActive : ''}`}>
              <span>3 · Facing</span>
              <strong>
                {facingGlyph(provisionalFacing)} {provisionalFacing}
              </strong>
              <small>Choose your final direction</small>
            </div>
            <div className={`${styles.flowStep} ${mode === 'end-turn' ? styles.flowReady : ''}`}>
              <span>4 · End Turn</span>
              <strong>{playerTurn ? 'AVAILABLE' : 'WAIT'}</strong>
              <small>Facing commits with it</small>
            </div>
          </div>

          {combatantCard(
            recruitCombatant,
            recruitPlacement,
            recruitStatuses,
            currentTurn?.combatantId === recruitId,
            () => setSelectedUnitId(recruitId),
          )}
        </section>

        <section className={styles.feedbackBanner} aria-live="polite">
          <strong>{recruitPending ? 'Enemy turn' : 'Last result'}</strong>
          <p>{notice}</p>
          <div className={styles.feedbackActions}>
            <BattleLogPanel
              battleSessionId={battle.battleSessionId}
              battleVersion={battle.battleVersion}
            />
            {recruitFailed ? (
              <button
                type="button"
                className={styles.textButton}
                onClick={() => {
                  recruitAttemptedVersion.current = null
                  setRecruitFailed(false)
                  void runRecruitTurn()
                }}
              >
                Retry Recruit turn
              </button>
            ) : null}
            <button
              type="button"
              className={styles.textButton}
              onClick={() => {
                recruitAttemptedVersion.current = null
                setRecruitFailed(false)
                void refreshBattle()
              }}
              disabled={commitPending || recruitPending}
            >
              Refresh state
            </button>
          </div>
        </section>

        <div className={styles.stage}>
          <section
            id="battlefield"
            className={styles.battlefield}
            aria-label="Tactical battlefield"
          >
            <div className={styles.boardViewport}>
              <div
                className={styles.board}
                style={{
                  gridTemplateColumns: `repeat(${tactical.width}, minmax(3.6rem, 1fr))`,
                  gridTemplateRows: `repeat(${tactical.height}, minmax(3.6rem, 1fr))`,
                  minWidth: `${Math.max(30, tactical.width * 5.2)}rem`,
                  aspectRatio: `${tactical.width} / ${tactical.height}`,
                }}
              >
                {tactical.tiles.map((tile) => {
                  const key = positionKey(tile.position)
                  const placement = placementByTile.get(key)
                  const combatant = placement
                    ? battleState.combatants.find(
                        (candidate) => candidate.id === placement.combatantId,
                      )
                    : null
                  const selected = selectedPosition
                    ? positionsEqual(tile.position, selectedPosition)
                    : false
                  const active = placement?.combatantId === currentTurn?.combatantId
                  const inPath = pathTiles.has(key)
                  const affected = previewAffectedTiles.has(key)
                  const moveReachable = mode === 'move' && reachablePaths.has(key)
                  const moveUnavailable =
                    mode === 'move' &&
                    !moveReachable &&
                    placement?.combatantId !== currentTurn?.combatantId
                  const attackTarget = mode === 'attack' && placement?.combatantId === recruitId
                  const attackTargetLegal =
                    attackTarget && attackGeometryLegal && Boolean(actionReady)
                  const attackTargetIllegal = attackTarget && !attackTargetLegal
                  const legalDestination =
                    preview?.preview.kind === 'move' &&
                    positionsEqual(preview.preview.destination, tile.position) &&
                    preview.preview.legal
                  const illegalDestination =
                    preview?.preview.kind === 'move' &&
                    positionsEqual(preview.preview.destination, tile.position) &&
                    !preview.preview.legal
                  const tileClass = [
                    styles.tile,
                    tile.terrainId === 'rough-ground' ? styles.tileRough : '',
                    tile.elevation > 0 ? styles.tileRaised : '',
                    moveReachable || attackTargetLegal ? styles.tileReachable : '',
                    moveUnavailable || attackTargetIllegal ? styles.tileUnavailable : '',
                    selected ? styles.tileSelected : '',
                    inPath ? styles.tilePath : '',
                    affected ? styles.tileAffected : '',
                    attackTarget ? styles.tileTarget : '',
                    legalDestination ? styles.tileLegal : '',
                    illegalDestination ? styles.tileIllegal : '',
                  ]
                    .filter(Boolean)
                    .join(' ')

                  return (
                    <button
                      key={key}
                      type="button"
                      className={tileClass}
                      onClick={() => handleTileClick(tile.position)}
                      aria-label={`Tile ${tile.position.x + 1}, ${tile.position.y + 1}; ${tile.terrainId}; elevation ${tile.elevation}${placement ? `; occupied by ${combatantLabel(placement.combatantId)}` : ''}`}
                    >
                      <span className={styles.tileMeta}>
                        {tile.position.x + 1}.{tile.position.y + 1}
                        {tile.terrainId === 'rough-ground' ? (
                          <span className={styles.terrainBadge}>R2</span>
                        ) : null}
                        {tile.elevation > 0 ? (
                          <span className={styles.terrainBadge}>E{tile.elevation}</span>
                        ) : null}
                      </span>
                      {placement ? (
                        <span
                          className={`${styles.unit} ${placement.combatantId === playerId ? styles.unitPlayer : styles.unitOpponent} ${active ? styles.unitActive : ''}`}
                        >
                          <span
                            className={styles.unitFacing}
                            aria-label={`Facing ${placement.facing}`}
                          >
                            {facingGlyph(placement.facing)}
                          </span>
                          <strong>{combatantLabel(placement.combatantId)}</strong>
                          <small>
                            {combatant?.hp ?? 0}/{combatant?.maxHp ?? 0} HP
                          </small>
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className={styles.legend} aria-label="Battlefield legend">
              <span>
                <b>Green</b> reachable / legal
              </span>
              <span>
                <b>Red</b> unavailable / out of range
              </span>
              <span>
                <b>R2</b> rough ground costs 2 Movement
              </span>
              <span>
                <b>E1</b> raised tile
              </span>
              <span>
                <b>↑</b> unit facing
              </span>
            </div>
          </section>

          <aside className={styles.inspector} aria-label="Context inspector">
            <div className={styles.inspectorHeading}>
              <span>Inspector</span>
              <strong>
                {selectedCombatant ? combatantLabel(selectedCombatant.id) : 'Terrain'}
              </strong>
            </div>
            {selectedCombatant && selectedPlacement ? (
              <div className={styles.inspectorBody}>
                <p className={styles.inspectorCallout}>
                  Facing is already meaningful: a Basic Attack deals 100% damage from the front,
                  110% from the side, and 125% from the rear. The arrow on each unit shows its
                  current facing.
                </p>
                <dl className={styles.detailList}>
                  <div>
                    <dt>HP</dt>
                    <dd>
                      {selectedCombatant.hp}/{selectedCombatant.maxHp}
                    </dd>
                  </div>
                  <div>
                    <dt>MP</dt>
                    <dd>
                      {selectedCombatant.mp}/{selectedCombatant.maxMp}
                    </dd>
                  </div>
                  <div>
                    <dt>Facing</dt>
                    <dd>
                      {facingGlyph(selectedPlacement.facing)} {selectedPlacement.facing}
                    </dd>
                  </div>
                  <div>
                    <dt>Initiative</dt>
                    <dd>{selectedCombatant.initiative}</dd>
                  </div>
                  <div>
                    <dt>Movement / turn</dt>
                    <dd>{selectedCombatant.baseMovementBudget}</dd>
                  </div>
                  <div>
                    <dt>Jump</dt>
                    <dd>{selectedProfile?.jump ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Armor</dt>
                    <dd>{selectedProfile?.armor ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Evasion</dt>
                    <dd>
                      {selectedProfile ? percentFromBasisPoints(selectedProfile.evasion) : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      {selectedStatuses.length > 0
                        ? selectedStatuses.map(statusLabel).join(', ')
                        : 'None'}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : selectedTile ? (
              <div className={styles.inspectorBody}>
                <p className={styles.inspectorCallout}>
                  {selectedTile.terrainId === 'rough-ground'
                    ? 'Rough ground costs 2 Movement when entered. It can make a shorter-looking route more expensive.'
                    : 'Open ground costs 1 Movement when entered.'}{' '}
                  {selectedTile.elevation > 0
                    ? `This tile is elevation ${selectedTile.elevation}. Your active movement profile can change height by up to ${selectedMovementProfile?.maxElevationStep ?? 0} per step.`
                    : 'This tile is at ground elevation.'}
                </p>
                <dl className={styles.detailList}>
                  <div>
                    <dt>Position</dt>
                    <dd>
                      {selectedTile.position.x + 1}, {selectedTile.position.y + 1}
                    </dd>
                  </div>
                  <div>
                    <dt>Terrain</dt>
                    <dd>
                      {selectedTile.terrainId === 'rough-ground' ? 'Rough ground' : 'Open ground'}
                    </dd>
                  </div>
                  <div>
                    <dt>Entry cost</dt>
                    <dd>
                      {selectedTerrainCost === null ? 'Blocked' : `${selectedTerrainCost} Movement`}
                    </dd>
                  </div>
                  <div>
                    <dt>Elevation</dt>
                    <dd>{selectedTile.elevation}</dd>
                  </div>
                  <div>
                    <dt>Reachable now</dt>
                    <dd>
                      {playerTurn ? (selectedTileReachable ? 'YES' : 'NO') : 'Wait for your turn'}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : (
              <div className={styles.inspectorBody}>
                <p className={styles.inspectorCallout}>
                  Click a unit for HP, MP, statuses and facing, or click a tile for terrain cost,
                  elevation and current reachability.
                </p>
              </div>
            )}
          </aside>
        </div>

        <section className={styles.commandDeck} aria-label="Command Deck">
          <p
            className={styles.modeInstruction}
            data-testid="combat-mode-instruction"
            aria-live="polite"
          >
            {modeInstruction(
              mode,
              Boolean(actionReady),
              currentTurn?.movementRemaining ?? 0,
              provisionalFacing,
            )}
          </p>

          <div className={styles.commandBody}>
            <div className={styles.commandActions}>
              <button
                type="button"
                className={mode === 'inspect' ? styles.commandActive : ''}
                onClick={() => chooseMode('inspect')}
              >
                <span>01</span>
                <strong>Inspect</strong>
                <small>Terrain &amp; unit info</small>
              </button>
              <button
                type="button"
                className={mode === 'move' ? styles.commandActive : ''}
                onClick={() => chooseMode('move')}
                disabled={planningDisabled || (currentTurn?.movementRemaining ?? 0) <= 0}
              >
                <span>02</span>
                <strong>Move</strong>
                <small>Green tiles · Action stays READY</small>
              </button>
              <button
                type="button"
                className={mode === 'attack' ? styles.commandActive : ''}
                onClick={() => chooseMode('attack')}
                disabled={planningDisabled || !actionReady}
              >
                <span>03</span>
                <strong>Basic Attack</strong>
                <small>Spend Action on one enemy</small>
              </button>
              <button
                type="button"
                className={mode === 'guard' ? styles.commandActive : ''}
                onClick={() => chooseMode('guard')}
                disabled={planningDisabled || !actionReady}
              >
                <span>04</span>
                <strong>Guard</strong>
                <small>-20% incoming · spends Action</small>
              </button>
              <button
                type="button"
                className={mode === 'end-turn' ? styles.commandActive : ''}
                onClick={() => chooseMode('end-turn')}
                disabled={planningDisabled}
              >
                <span>05</span>
                <strong>Facing / End Turn</strong>
                <small>Choose direction, then Confirm</small>
              </button>
            </div>

            <div className={styles.facingPad} aria-label="Final facing controls">
              <button
                type="button"
                className={styles.faceNorth}
                onClick={() => previewFacing('north')}
                disabled={planningDisabled}
                aria-label="Face north"
                aria-pressed={provisionalFacing === 'north'}
              >
                ↑ N
              </button>
              <button
                type="button"
                className={styles.faceWest}
                onClick={() => previewFacing('west')}
                disabled={planningDisabled}
                aria-label="Face west"
                aria-pressed={provisionalFacing === 'west'}
              >
                ← W
              </button>
              <span className={styles.faceCenter}>Final facing</span>
              <button
                type="button"
                className={styles.faceEast}
                onClick={() => previewFacing('east')}
                disabled={planningDisabled}
                aria-label="Face east"
                aria-pressed={provisionalFacing === 'east'}
              >
                → E
              </button>
              <button
                type="button"
                className={styles.faceSouth}
                onClick={() => previewFacing('south')}
                disabled={planningDisabled}
                aria-label="Face south"
                aria-pressed={provisionalFacing === 'south'}
              >
                ↓ S
              </button>
            </div>

            <div className={styles.forecast} aria-live="polite">
              <div>
                <span>Preview</span>
                <strong>
                  {previewPending
                    ? 'Checking…'
                    : mode === 'end-turn' && finalTurnPreview
                      ? finalTurnPreview.legal
                        ? 'READY'
                        : 'BLOCKED'
                      : preview
                        ? preview.preview.legal
                          ? 'LEGAL'
                          : 'BLOCKED'
                        : '—'}
                </strong>
              </div>
              {preview?.preview.kind === 'move' ? (
                <>
                  <div>
                    <span>Move cost</span>
                    <strong>{preview.preview.cost}</strong>
                  </div>
                  <div>
                    <span>Movement after</span>
                    <strong>{preview.preview.movementRemainingAfter}</strong>
                  </div>
                  <div>
                    <span>Action after</span>
                    <strong>{actionReady ? 'READY' : 'SPENT'}</strong>
                  </div>
                </>
              ) : null}
              {preview?.preview.kind === 'action' &&
              preview.preview.actionId === BASIC_ATTACK_ID ? (
                <>
                  <div>
                    <span>Hit chance</span>
                    <strong>{percentFromBasisPoints(preview.preview.hitChanceBasisPoints)}</strong>
                  </div>
                  <div>
                    <span>Damage</span>
                    <strong>{preview.preview.mitigatedBaseDamage ?? '—'}</strong>
                  </div>
                  <div>
                    <span>Facing angle</span>
                    <strong>
                      {attackFacingRelation ?? '—'} ·{' '}
                      {attackFacingRelation === 'rear'
                        ? '125%'
                        : attackFacingRelation === 'side'
                          ? '110%'
                          : '100%'}
                    </strong>
                  </div>
                </>
              ) : null}
              {preview?.preview.kind === 'action' && preview.preview.actionId === GUARD_ID ? (
                <>
                  <div>
                    <span>Effect</span>
                    <strong>GUARDED</strong>
                  </div>
                  <div>
                    <span>Incoming damage</span>
                    <strong>-20%</strong>
                  </div>
                </>
              ) : null}
              {mode === 'end-turn' && finalTurnPreview ? (
                <div>
                  <span>End facing</span>
                  <strong>
                    {facingGlyph(finalTurnPreview.facing)} {finalTurnPreview.facing}
                  </strong>
                </div>
              ) : null}
              <p>
                {mode === 'end-turn'
                  ? (finalTurnPreview?.issues[0]?.message ?? 'Facing and End Turn commit together.')
                  : (preview?.preview.issues[0]?.message ??
                    'Nothing happens until you Confirm. Green previews are legal; red previews explain why they are blocked.')}
              </p>
            </div>
          </div>

          <div className={styles.commitRow}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={() => {
                resetPlanning()
                setNotice('Planning cleared. Nothing was committed.')
              }}
              disabled={commitPending || recruitPending}
            >
              Cancel <kbd>Esc</kbd>
            </button>
            <button
              type="button"
              className={styles.confirmButton}
              onClick={() => {
                if (mode === 'end-turn') void commitFinalTurn()
                else void commitIntent()
              }}
              disabled={
                !hasPendingCommand ||
                !commandLegal ||
                previewPending ||
                commitPending ||
                recruitPending
              }
            >
              {commitPending ? 'Committing…' : 'Confirm command'} <kbd>Enter</kbd>
            </button>
          </div>
        </section>

        {battleState.lifecycle === 'completed' ? <BattleCompletionPanel battle={battle} /> : null}

        <footer className={styles.footer}>
          <span>
            <strong>Authority:</strong> previews are informational; movement, attacks, Guard, facing
            and enemy turns commit on the server.
          </span>
          <span>State v{battle.battleVersion}</span>
        </footer>
      </div>
    </main>
  )
}
