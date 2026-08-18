'use client'

import type { BattleIntent } from '@aurevane/validation/combat/battle-session'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import { AurevaneImage } from '@/components/media/aurevane-image'
import type { ImageAssetId } from '@/media/registry'
import type { BattlePreviewView } from '@/server/battle/battle-preview-service'
import type { RecruitTurnView } from '@/server/battle/battle-recruit-ai-service'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

import { BattleCompletionPanel } from './battle-completion-panel'
import { BattleLogPanel } from './battle-log-panel'
import styles from './battle-experience-v2.module.css'

const BASIC_ATTACK_ID = 'basic.attack.unarmed.basic'
const GUARD_ID = 'basic.guard'
const RECOVER_ID = 'basic.recover'
const ACTION_ECONOMY_KEY = 'pv1f.action-economy'
const ATTACK_COST = 30
const GUARD_COST = 30
const RECOVER_COST = 50
const MOVE_COST_PER_TERRAIN_POINT = 10

type PlanningMode = 'inspect' | 'move' | 'attack' | 'guard' | 'recover' | 'finish'
type GridPosition = { x: number; y: number }
type Facing = 'north' | 'east' | 'south' | 'west'
type TacticalState = BattleSessionView['snapshot']['tactical']
type Combatant = TacticalState['battle']['combatants'][number]
type CombatPlacement = TacticalState['placements'][number]
type CombatStatus = BattleSessionView['snapshot']['statusState'][number]['statuses'][number]
type CombatProfile = BattleSessionView['snapshot']['statBridge']['combatants'][number]

type OverlayState =
  | { kind: 'log' }
  | { kind: 'chat' }
  | { kind: 'abort' }
  | { kind: 'status'; combatantId: string; statusId: string | null }
  | { kind: 'facing'; combatantId: string }
  | null

interface BattleExperienceProps {
  initialBattle: BattleSessionView
  playerName: string
  playerPortraitAssetId: ImageAssetId
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

function meterPercent(value: number, maximum: number): number {
  if (maximum <= 0) return 0
  return Math.max(0, Math.min(100, (value / maximum) * 100))
}

function combatantName(combatantId: string, playerName: string): string {
  if (combatantId.startsWith('character:')) return playerName
  if (combatantId.startsWith('recruit:')) return 'Recruit'
  return combatantId
}

function manhattanDistance(left: GridPosition, right: GridPosition): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y)
}

function readEconomy(combatant: Combatant | null): number {
  if (!combatant) return 0
  return (
    combatant.temporaryResources.find((resource) => resource.key === ACTION_ECONOMY_KEY)?.current ??
    0
  )
}

function getStatuses(
  battle: BattleSessionView,
  combatantId: string | null,
): readonly CombatStatus[] {
  if (!combatantId) return []
  return battle.snapshot.statusState.find((row) => row.combatantId === combatantId)?.statuses ?? []
}

function statusPresentation(statusId: string): {
  label: string
  summary: string
  beneficial: boolean
} {
  if (statusId === 'guarded') {
    return {
      label: 'Guarded',
      summary: 'Incoming damage is reduced by 15%.',
      beneficial: true,
    }
  }
  if (statusId.startsWith('buff.')) {
    return {
      label: statusId.slice('buff.'.length).replaceAll('.', ' '),
      summary: 'A beneficial combat effect is active.',
      beneficial: true,
    }
  }
  return {
    label: statusId.replaceAll('.', ' '),
    summary: 'A harmful combat effect is active.',
    beneficial: false,
  }
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
  actionEconomy: number,
): Map<string, GridPosition[]> {
  const turn = tactical.battle.currentTurn
  if (!turn || !activePlacement || turn.combatantId !== activePlacement.combatantId) {
    return new Map()
  }

  const profile = tactical.movementProfiles.find(
    (candidate) => candidate.id === activePlacement.movementProfileId,
  )
  if (!profile) return new Map()

  const maximumTerrainCost = Math.min(
    turn.movementRemaining,
    Math.floor(actionEconomy / MOVE_COST_PER_TERRAIN_POINT),
  )
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

    for (const neighbor of [
      { x: current.position.x + 1, y: current.position.y },
      { x: current.position.x - 1, y: current.position.y },
      { x: current.position.x, y: current.position.y + 1 },
      { x: current.position.x, y: current.position.y - 1 },
    ]) {
      if (
        neighbor.x < 0 ||
        neighbor.x >= tactical.width ||
        neighbor.y < 0 ||
        neighbor.y >= tactical.height
      ) {
        continue
      }

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
      if (nextCost > maximumTerrainCost) continue
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

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

function describeRecruitTurn(
  before: BattleSessionView,
  after: BattleSessionView,
  decisions: RecruitTurnView['decisions'],
  playerName: string,
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

  const beforeRecruitPlacement = before.snapshot.tactical.placements.find(
    (placement) => placement.combatantId === recruitId,
  )
  const afterRecruitPlacement = after.snapshot.tactical.placements.find(
    (placement) => placement.combatantId === recruitId,
  )
  const beforeRecruit = before.snapshot.tactical.battle.combatants.find(
    (combatant) => combatant.id === recruitId,
  )
  const afterRecruit = after.snapshot.tactical.battle.combatants.find(
    (combatant) => combatant.id === recruitId,
  )
  const beforePlayer = before.snapshot.tactical.battle.combatants.find(
    (combatant) => combatant.id === playerId,
  )
  const afterPlayer = after.snapshot.tactical.battle.combatants.find(
    (combatant) => combatant.id === playerId,
  )
  const parts: string[] = []

  if (
    beforeRecruitPlacement &&
    afterRecruitPlacement &&
    !positionsEqual(beforeRecruitPlacement.position, afterRecruitPlacement.position)
  ) {
    parts.push(
      `moved ${beforeRecruitPlacement.position.x + 1},${beforeRecruitPlacement.position.y + 1} → ${afterRecruitPlacement.position.x + 1},${afterRecruitPlacement.position.y + 1}`,
    )
  }
  if (beforePlayer && afterPlayer && beforePlayer.hp > afterPlayer.hp) {
    parts.push(`hit ${playerName} for ${beforePlayer.hp - afterPlayer.hp}`)
  } else if (decisions.some((decision) => decision.reason === 'legal-damage')) {
    parts.push('attacked but dealt no damage')
  }
  if (beforeRecruit && afterRecruit && afterRecruit.hp > beforeRecruit.hp) {
    parts.push(`recovered ${afterRecruit.hp - beforeRecruit.hp} HP`)
  }
  if (getStatuses(after, recruitId).some((status) => status.statusId === 'guarded')) {
    parts.push('Guarded (-15% damage)')
  }
  if (afterRecruitPlacement) {
    parts.push(
      `finished facing ${afterRecruitPlacement.facing} ${facingGlyph(afterRecruitPlacement.facing)}`,
    )
  }

  return parts.length > 0 ? `Recruit: ${parts.join(' → ')}.` : 'Recruit turn resolved.'
}

export function BattleExperienceV2({
  initialBattle,
  playerName,
  playerPortraitAssetId,
}: BattleExperienceProps) {
  const router = useRouter()
  const [battle, setBattle] = useState(initialBattle)
  const [mode, setMode] = useState<PlanningMode>('move')
  const [selectedPosition, setSelectedPosition] = useState<GridPosition | null>(null)
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [path, setPath] = useState<GridPosition[]>([])
  const [pendingIntent, setPendingIntent] = useState<BattleIntent | null>(null)
  const [preview, setPreview] = useState<BattlePreviewView | null>(null)
  const [previewPending, setPreviewPending] = useState(false)
  const [commitPending, setCommitPending] = useState(false)
  const [recruitPending, setRecruitPending] = useState(false)
  const [recruitFailed, setRecruitFailed] = useState(false)
  const [notice, setNotice] = useState('Your turn. Move, act, then choose final facing to finish.')
  const [overlay, setOverlay] = useState<OverlayState>(null)
  const [abortPending, setAbortPending] = useState(false)
  const previewSequence = useRef(0)
  const recruitAttemptedVersion = useRef<number | null>(null)
  const commitLock = useRef(false)
  const recruitLock = useRef(false)

  const snapshot = battle.snapshot
  const tactical = snapshot.tactical
  const battleState = tactical.battle
  const currentTurn = battleState.currentTurn
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
  const playerTurn = Boolean(playerId && currentTurn?.combatantId === playerId)
  const activeCombatant = currentTurn
    ? (battleState.combatants.find((combatant) => combatant.id === currentTurn.combatantId) ?? null)
    : null
  const actionEconomy = readEconomy(activeCombatant)
  const playerEconomy = playerTurn ? actionEconomy : 0
  const planningDisabled =
    !playerTurn || battleState.lifecycle !== 'active' || commitPending || recruitPending

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
  const previewAffectedTiles = useMemo(() => {
    if (preview?.preview.kind !== 'action') return new Set<string>()
    return new Set(preview.preview.affectedTiles.map(positionKey))
  }, [preview])
  const reachablePaths = useMemo(
    () =>
      playerTurn
        ? buildReachablePaths(tactical, playerPlacement, playerEconomy)
        : new Map<string, GridPosition[]>(),
    [playerEconomy, playerPlacement, playerTurn, tactical],
  )

  const selectedTile = selectedPosition
    ? (tileByKey.get(positionKey(selectedPosition)) ?? null)
    : null
  const selectedPlacement = selectedUnitId
    ? (tactical.placements.find((placement) => placement.combatantId === selectedUnitId) ?? null)
    : null
  const selectedCombatant = selectedUnitId
    ? (battleState.combatants.find((combatant) => combatant.id === selectedUnitId) ?? null)
    : null
  const selectedProfile = selectedUnitId
    ? (snapshot.statBridge.combatants.find((profile) => profile.combatantId === selectedUnitId) ??
      null)
    : null

  const attackGeometryLegal =
    Boolean(playerPlacement && recruitPlacement) &&
    manhattanDistance(playerPlacement!.position, recruitPlacement!.position) === 1 &&
    Math.abs(
      (tileByKey.get(positionKey(playerPlacement!.position))?.elevation ?? 0) -
        (tileByKey.get(positionKey(recruitPlacement!.position))?.elevation ?? 0),
    ) <= 1

  const clearPlanning = useCallback((nextMode: PlanningMode = 'move') => {
    previewSequence.current += 1
    setMode(nextMode)
    setPath([])
    setPendingIntent(null)
    setPreview(null)
    setPreviewPending(false)
    setSelectedPosition(null)
  }, [])

  const refreshBattle = useCallback(
    async (message = 'Battle state reloaded.') => {
      const response = await fetch(`/api/battles/${battle.battleSessionId}`, {
        method: 'GET',
        cache: 'no-store',
      })
      const body = (await response.json()) as { battle?: BattleSessionView } & ApiErrorBody
      if (!response.ok || !body.battle) {
        throw new Error(body.error?.message ?? 'The battle state could not be reloaded.')
      }
      setBattle(body.battle)
      clearPlanning('move')
      setNotice(message)
      return body.battle
    },
    [battle.battleSessionId, clearPlanning],
  )

  const handleApiFailure = useCallback(
    async (response: Response, body: ApiErrorBody, fallback: string) => {
      if (response.status === 401) {
        window.location.assign('/')
        return
      }
      if (response.status === 409 && body.error?.code === 'STALE_VERSION') {
        try {
          await refreshBattle(
            'The battle changed elsewhere. Your unfinished selection was cleared.',
          )
        } catch (refreshError) {
          setNotice(
            refreshError instanceof Error
              ? refreshError.message
              : 'The battle changed and could not be reloaded.',
          )
        }
        return
      }
      setNotice(body.error?.message ?? fallback)
    },
    [refreshBattle],
  )

  const requestPreview = useCallback(
    async (intent: BattleIntent) => {
      const sequence = ++previewSequence.current
      setPreviewPending(true)
      setPendingIntent(intent)
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
          await handleApiFailure(response, body, 'That command could not be checked.')
          return
        }
        setPreview(body.battlePreview)
        const result = body.battlePreview.preview
        if (!result.legal) {
          setNotice(result.issues[0]?.message ?? 'That command is not legal right now.')
        } else if (result.kind === 'move') {
          setNotice(
            `Path ready: ${result.actionEconomyCost}% Action Economy. ${result.actionEconomyAfter}% will remain.`,
          )
        } else if (result.kind === 'action' && result.actionId === BASIC_ATTACK_ID) {
          setNotice(
            `Attack ready: ${percentFromBasisPoints(result.hitChanceBasisPoints)} hit chance · ${result.mitigatedBaseDamage ?? '—'} projected damage before final facing effects.`,
          )
        } else if (result.kind === 'action' && result.actionId === GUARD_ID) {
          setNotice('Guard ready: costs 30% and reduces incoming damage by 15% for 2 turns.')
        } else if (result.kind === 'action' && result.actionId === RECOVER_ID) {
          setNotice('Recover ready: costs 50% and restores 10% of maximum HP immediately.')
        }
      } catch (error) {
        if (sequence === previewSequence.current) {
          setPreview(null)
          setNotice(error instanceof Error ? error.message : 'That command could not be checked.')
        }
      } finally {
        if (sequence === previewSequence.current) setPreviewPending(false)
      }
    },
    [battle.battleSessionId, battle.battleVersion, handleApiFailure],
  )

  const chooseMode = useCallback(
    (nextMode: PlanningMode) => {
      if (planningDisabled && nextMode !== 'inspect') return
      clearPlanning(nextMode)
      setOverlay(null)
      if (nextMode === 'guard') {
        void requestPreview({ kind: 'action', actionId: GUARD_ID, target: { kind: 'self' } })
      } else if (nextMode === 'recover') {
        void requestPreview({ kind: 'action', actionId: RECOVER_ID, target: { kind: 'self' } })
      } else if (nextMode === 'finish') {
        setNotice('Choose final facing. The direction you choose immediately ends the turn.')
      } else if (nextMode === 'inspect') {
        setNotice(
          'Inspect mode: special terrain is highlighted. Click a tile or combatant for details.',
        )
      } else if (nextMode === 'move') {
        setNotice('Move mode: green tiles are reachable with your remaining Action Economy.')
      } else {
        setNotice('Basic Attack: choose a highlighted enemy, then confirm the action.')
      }
    },
    [clearPlanning, planningDisabled, requestPreview],
  )

  const handleTileClick = useCallback(
    (position: GridPosition) => {
      const placement = placementByTile.get(positionKey(position))
      setSelectedPosition(position)
      if (mode === 'inspect') {
        setSelectedUnitId(placement?.combatantId ?? null)
        setOverlay(null)
        return
      }
      if (planningDisabled) return
      if (mode === 'move') {
        const nextPath = reachablePaths.get(positionKey(position))
        if (!nextPath || nextPath.length < 2) {
          setNotice('That tile is not reachable with the Action Economy you have left.')
          return
        }
        setPath(nextPath)
        void requestPreview({ kind: 'move', path: nextPath })
        return
      }
      if (mode === 'attack') {
        if (!placement || placement.combatantId !== recruitId) {
          setNotice('Choose the enemy combatant as your Basic Attack target.')
          return
        }
        setSelectedUnitId(placement.combatantId)
        void requestPreview({
          kind: 'action',
          actionId: BASIC_ATTACK_ID,
          target: { kind: 'unit', combatantId: placement.combatantId },
        })
      }
    },
    [mode, placementByTile, planningDisabled, reachablePaths, recruitId, requestPreview],
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
        await handleApiFailure(response, body, 'That action could not be committed.')
        return
      }

      setBattle(body.battle)
      clearPlanning('move')
      const actorAfter = playerId
        ? (body.battle.snapshot.tactical.battle.combatants.find(
            (combatant) => combatant.id === playerId,
          ) ?? null)
        : null
      const remainingEconomy = readEconomy(actorAfter)

      if (committedIntent.kind === 'move') {
        setNotice(`Movement committed. ${remainingEconomy}% Action Economy remains.`)
      } else if (
        committedIntent.kind === 'action' &&
        committedIntent.actionId === BASIC_ATTACK_ID
      ) {
        const targetId =
          committedIntent.target.kind === 'unit' ? committedIntent.target.combatantId : null
        const targetBefore = before.snapshot.tactical.battle.combatants.find(
          (combatant) => combatant.id === targetId,
        )
        const targetAfter = body.battle.snapshot.tactical.battle.combatants.find(
          (combatant) => combatant.id === targetId,
        )
        const damage =
          targetBefore && targetAfter ? Math.max(0, targetBefore.hp - targetAfter.hp) : 0
        setNotice(
          damage > 0
            ? `Basic Attack dealt ${damage} damage. ${remainingEconomy}% Action Economy remains.`
            : `Basic Attack resolved without damage. ${remainingEconomy}% Action Economy remains.`,
        )
      } else if (committedIntent.kind === 'action' && committedIntent.actionId === GUARD_ID) {
        setNotice(
          `Guarded for 2 turns at -15% incoming damage. ${remainingEconomy}% Action Economy remains.`,
        )
      } else if (committedIntent.kind === 'action' && committedIntent.actionId === RECOVER_ID) {
        const beforePlayer = playerId
          ? before.snapshot.tactical.battle.combatants.find(
              (combatant) => combatant.id === playerId,
            )
          : null
        const healed = beforePlayer && actorAfter ? Math.max(0, actorAfter.hp - beforePlayer.hp) : 0
        setNotice(`Recovered ${healed} HP. ${remainingEconomy}% Action Economy remains.`)
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'That action could not be committed.')
    } finally {
      setCommitPending(false)
      commitLock.current = false
    }
  }, [battle, clearPlanning, commitPending, handleApiFailure, pendingIntent, playerId, preview])

  const commitFinalFacing = useCallback(
    async (facing: Facing) => {
      if (commitLock.current || commitPending || planningDisabled) return
      commitLock.current = true
      setCommitPending(true)
      setOverlay(null)
      try {
        const response = await fetch(`/api/battles/${battle.battleSessionId}/final-turn`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idempotencyKey: crypto.randomUUID(),
            expectedBattleVersion: battle.battleVersion,
            facing,
          }),
        })
        const body = (await response.json()) as { battle?: BattleSessionView } & ApiErrorBody
        if (!response.ok || !body.battle) {
          await handleApiFailure(response, body, 'The turn could not be finished.')
          return
        }
        setBattle(body.battle)
        clearPlanning('move')
        setNotice(`Finished facing ${facing} ${facingGlyph(facing)}. Recruit turn begins.`)
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'The turn could not be finished.')
      } finally {
        setCommitPending(false)
        commitLock.current = false
      }
    },
    [
      battle.battleSessionId,
      battle.battleVersion,
      clearPlanning,
      commitPending,
      handleApiFailure,
      planningDisabled,
    ],
  )

  const runRecruitTurn = useCallback(async () => {
    if (
      recruitLock.current ||
      recruitPending ||
      playerTurn ||
      battleState.lifecycle !== 'active' ||
      !currentTurn ||
      recruitAttemptedVersion.current === battle.battleVersion
    ) {
      return
    }

    recruitLock.current = true
    recruitAttemptedVersion.current = battle.battleVersion
    setRecruitPending(true)
    setRecruitFailed(false)
    setOverlay(null)
    clearPlanning('move')
    setNotice('Recruit is acting…')
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
      setNotice(describeRecruitTurn(before, nextBattle, body.battle.decisions, playerName))
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
    clearPlanning,
    currentTurn,
    handleApiFailure,
    playerName,
    playerTurn,
    recruitPending,
  ])

  useEffect(() => {
    if (
      playerTurn ||
      battleState.lifecycle !== 'active' ||
      !currentTurn ||
      recruitPending ||
      recruitFailed
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      void runRecruitTurn()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [
    battleState.lifecycle,
    currentTurn,
    playerTurn,
    recruitFailed,
    recruitPending,
    runRecruitTurn,
  ])

  async function abortExercise() {
    if (abortPending) return
    setAbortPending(true)
    try {
      const currentResponse = await fetch(`/api/battles/${battle.battleSessionId}`, {
        method: 'GET',
        cache: 'no-store',
      })
      const currentBody = (await currentResponse.json()) as {
        battle?: BattleSessionView
      } & ApiErrorBody
      if (!currentResponse.ok || !currentBody.battle) {
        throw new Error(currentBody.error?.message ?? 'The exercise state could not be checked.')
      }
      const response = await fetch(`/api/battles/${battle.battleSessionId}/abort`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          expectedBattleVersion: currentBody.battle.battleVersion,
        }),
      })
      const body = (await response.json()) as { battle?: BattleSessionView } & ApiErrorBody
      if (!response.ok || !body.battle) {
        throw new Error(body.error?.message ?? 'The exercise could not be aborted.')
      }
      router.replace('/game/battle')
      router.refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The exercise could not be aborted.')
      setOverlay(null)
    } finally {
      setAbortPending(false)
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTextEntryTarget(event.target)) return
      if (event.key === 'Escape') {
        event.preventDefault()
        setOverlay(null)
        clearPlanning('move')
        setNotice('Selection cleared. Move mode restored.')
      } else if (event.key === '0') {
        event.preventDefault()
        chooseMode('inspect')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [chooseMode, clearPlanning])

  const boardStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${tactical.width}, minmax(0, 1fr))`,
    aspectRatio: `${tactical.width} / ${tactical.height}`,
    maxWidth: `min(100%, calc((100dvh - 17rem) * ${tactical.width / tactical.height}))`,
  }

  const selectedTerrainCost =
    selectedTile && playerPlacement
      ? terrainTraversalCost(tactical, selectedTile.terrainId, playerPlacement.movementProfileId)
      : null
  const selectedTileReachable = selectedTile
    ? reachablePaths.has(positionKey(selectedTile.position))
    : false

  function contextualContent() {
    if (mode === 'inspect') {
      if (selectedCombatant && selectedPlacement && selectedProfile) {
        return (
          <>
            <strong>{combatantName(selectedCombatant.id, playerName)}</strong>
            <span>
              Initiative {selectedCombatant.initiative} · Movement{' '}
              {selectedCombatant.baseMovementBudget} · Jump {selectedProfile.jump} · Armor{' '}
              {selectedProfile.armor} · Evasion {percentFromBasisPoints(selectedProfile.evasion)} ·
              Facing {selectedPlacement.facing} {facingGlyph(selectedPlacement.facing)}
            </span>
          </>
        )
      }
      if (selectedTile) {
        const terrainName =
          selectedTile.terrainId === 'rough-ground' ? 'Rough ground' : 'Open ground'
        return (
          <>
            <strong>
              {terrainName} · Tile {selectedTile.position.x + 1},{selectedTile.position.y + 1}
            </strong>
            <span>
              Entry costs{' '}
              {selectedTerrainCost === null
                ? 'blocked'
                : `${selectedTerrainCost * MOVE_COST_PER_TERRAIN_POINT}% Action Economy`}{' '}
              · Elevation {selectedTile.elevation} ·{' '}
              {playerTurn
                ? selectedTileReachable
                  ? 'reachable now'
                  : 'not reachable now'
                : 'wait for your turn'}
              .
            </span>
          </>
        )
      }
      return (
        <>
          <strong>Inspect</strong>
          <span>
            Special terrain is highlighted. Click a tile or combatant to read its tactical details
            here.
          </span>
        </>
      )
    }

    if (mode === 'move') {
      if (preview?.preview.kind === 'move') {
        return (
          <>
            <strong>{preview.preview.legal ? 'Movement path ready' : 'Movement blocked'}</strong>
            <span>
              Cost {preview.preview.actionEconomyCost}% · leaves{' '}
              {preview.preview.actionEconomyAfter}% Action Economy · terrain weight{' '}
              {preview.preview.terrainCost}.
            </span>
          </>
        )
      }
      return (
        <>
          <strong>Move · 10% per normal tile</strong>
          <span>
            Green tiles are reachable. Rough ground costs 20%. Click a destination to draw the
            numbered path.
          </span>
        </>
      )
    }

    if (mode === 'attack') {
      if (preview?.preview.kind === 'action') {
        return (
          <>
            <strong>{preview.preview.legal ? 'Basic Attack ready' : 'Basic Attack blocked'}</strong>
            <span>
              30% cost · {percentFromBasisPoints(preview.preview.hitChanceBasisPoints)} hit chance ·{' '}
              {preview.preview.mitigatedBaseDamage ?? '—'} projected damage after Armor.
              Front/side/rear facing still matters.
            </span>
          </>
        )
      }
      return (
        <>
          <strong>Basic Attack · 30%</strong>
          <span>
            Choose the enemy. Damage scales from Level, Might, and Finesse, then Armor and facing
            modify the result.
          </span>
        </>
      )
    }

    if (mode === 'guard') {
      return (
        <>
          <strong>Guard · 30%</strong>
          <span>Reduce incoming damage by 15% for 2 turns. Confirm to commit.</span>
        </>
      )
    }
    if (mode === 'recover') {
      return (
        <>
          <strong>Recover · 50%</strong>
          <span>Restore 10% of maximum HP immediately. Cannot exceed maximum HP.</span>
        </>
      )
    }
    return (
      <>
        <strong>Finish Turn · choose facing</strong>
        <span>
          Your N/E/S/W choice is the final input: it commits the direction and immediately ends the
          turn.
        </span>
      </>
    )
  }

  return (
    <main className={styles.shell} aria-busy={recruitPending}>
      <a className="skip-link" href="#battlefield">
        Skip to battlefield
      </a>

      <header className={styles.battleHeader}>
        <div className={styles.objective}>
          <span>Tactical Hall · Controlled Exercise</span>
          <strong>Defeat the opposing Recruit</strong>
        </div>

        <div className={styles.headerEconomy} data-active={playerTurn || undefined}>
          {playerTurn ? (
            <>
              <div>
                <span>Action Economy</span>
                <strong>{playerEconomy}%</strong>
              </div>
              <div
                className={styles.headerEconomyTrack}
                role="progressbar"
                aria-label="Action Economy remaining"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={playerEconomy}
              >
                <span style={{ width: `${playerEconomy}%` }} />
              </div>
            </>
          ) : (
            <strong>{recruitPending ? 'Recruit acting…' : 'Waiting for opponent'}</strong>
          )}
        </div>

        <button
          type="button"
          className={styles.roundButton}
          aria-expanded={overlay?.kind === 'log'}
          onClick={() =>
            setOverlay((current) => (current?.kind === 'log' ? null : { kind: 'log' }))
          }
        >
          Round {battleState.round}
          <small>Combat Log</small>
        </button>
      </header>

      <BattleLogPanel
        battleSessionId={battle.battleSessionId}
        battleVersion={battle.battleVersion}
        open={overlay?.kind === 'log'}
        onClose={() => setOverlay(null)}
      />

      <div className={styles.content}>
        <section className={styles.stage}>
          <CombatantRail
            side="player"
            name={playerName}
            combatant={playerCombatant}
            placement={playerPlacement}
            profile={playerProfile ?? null}
            statuses={getStatuses(battle, playerId)}
            portraitAssetId={playerPortraitAssetId}
            active={currentTurn?.combatantId === playerId}
            overlay={overlay}
            setOverlay={setOverlay}
          />

          <section
            id="battlefield"
            className={styles.battlefield}
            aria-label="Tactical battlefield"
          >
            <div className={styles.boardViewport}>
              <div className={styles.board} style={boardStyle}>
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
                  const pathIndex = path.findIndex((point) => positionsEqual(point, tile.position))
                  const affected = previewAffectedTiles.has(key)
                  const moveReachable = mode === 'move' && reachablePaths.has(key)
                  const moveUnavailable =
                    mode === 'move' && !moveReachable && placement?.combatantId !== playerId
                  const attackTarget = mode === 'attack' && placement?.combatantId === recruitId
                  const attackLegal =
                    attackTarget && attackGeometryLegal && playerEconomy >= ATTACK_COST
                  const inspectSpecial =
                    mode === 'inspect' && (tile.terrainId !== 'open-ground' || tile.elevation > 0)
                  const previewDestination =
                    preview?.preview.kind === 'move' &&
                    positionsEqual(preview.preview.destination, tile.position)

                  const tileClass = [
                    styles.tile,
                    tile.terrainId === 'rough-ground' ? styles.tileRough : '',
                    tile.elevation > 0 ? styles.tileRaised : '',
                    inspectSpecial ? styles.tileInspectSpecial : '',
                    moveReachable || attackLegal ? styles.tileReachable : '',
                    moveUnavailable || (attackTarget && !attackLegal) ? styles.tileUnavailable : '',
                    selected ? styles.tileSelected : '',
                    pathIndex > 0 ? styles.tilePath : '',
                    affected ? styles.tileAffected : '',
                    previewDestination && preview?.preview.legal ? styles.tileLegal : '',
                    previewDestination && !preview?.preview.legal ? styles.tileIllegal : '',
                  ]
                    .filter(Boolean)
                    .join(' ')

                  return (
                    <button
                      key={key}
                      type="button"
                      className={tileClass}
                      onClick={() => handleTileClick(tile.position)}
                      aria-label={`Tile ${tile.position.x + 1}, ${tile.position.y + 1}; ${tile.terrainId}; elevation ${tile.elevation}${placement ? `; occupied by ${combatantName(placement.combatantId, playerName)}` : ''}`}
                    >
                      <span className={styles.tileMeta}>
                        {tile.position.x + 1}.{tile.position.y + 1}
                        {tile.terrainId === 'rough-ground' ? <b>R20</b> : null}
                        {tile.elevation > 0 ? <b>▲{tile.elevation}</b> : null}
                      </span>
                      {pathIndex > 0 ? (
                        <span className={styles.pathMarker}>{pathIndex}</span>
                      ) : null}
                      {placement ? (
                        <span
                          className={`${styles.unit} ${placement.combatantId === playerId ? styles.unitPlayer : styles.unitOpponent} ${active ? styles.unitActive : ''}`}
                        >
                          <span className={styles.unitFacing}>{facingGlyph(placement.facing)}</span>
                          <strong>{combatantName(placement.combatantId, playerName)}</strong>
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className={styles.legend}>
              <span>
                <b>Green</b> legal/reachable
              </span>
              <span>
                <b>Red</b> unavailable
              </span>
              <span>
                <b>R20</b> rough = 20% move
              </span>
              <span>
                <b>▲</b> elevation
              </span>
            </div>
          </section>

          <CombatantRail
            side="enemy"
            name="Recruit"
            combatant={recruitCombatant}
            placement={recruitPlacement}
            profile={recruitProfile ?? null}
            statuses={getStatuses(battle, recruitId)}
            portraitAssetId={null}
            active={currentTurn?.combatantId === recruitId}
            overlay={overlay}
            setOverlay={setOverlay}
          />
        </section>

        <section className={styles.commandDeck} aria-label="Command Deck">
          <div
            className={styles.contextStrip}
            data-testid="combat-mode-instruction"
            aria-live="polite"
          >
            <div>{contextualContent()}</div>
            <small>{notice}</small>
          </div>

          <div className={styles.commandRow}>
            <div className={styles.actionButtons}>
              <CommandButton
                number="00"
                label="Inspect"
                cost="Free"
                active={mode === 'inspect'}
                disabled={false}
                onClick={() => chooseMode('inspect')}
              />
              <CommandButton
                number="01"
                label="Move"
                cost="10% / tile"
                active={mode === 'move'}
                disabled={planningDisabled || playerEconomy < 10}
                onClick={() => chooseMode('move')}
              />
              <CommandButton
                number="02"
                label="Basic Attack"
                cost="30%"
                active={mode === 'attack'}
                disabled={planningDisabled || playerEconomy < ATTACK_COST}
                onClick={() => chooseMode('attack')}
              />
              <CommandButton
                number="03"
                label="Guard"
                cost="30%"
                active={mode === 'guard'}
                disabled={planningDisabled || playerEconomy < GUARD_COST}
                onClick={() => chooseMode('guard')}
              />
              <CommandButton
                number="04"
                label="Recover"
                cost="50%"
                active={mode === 'recover'}
                disabled={
                  planningDisabled ||
                  playerEconomy < RECOVER_COST ||
                  !playerCombatant ||
                  playerCombatant.hp >= playerCombatant.maxHp
                }
                onClick={() => chooseMode('recover')}
              />
              <CommandButton
                number="05"
                label="Finish Turn"
                cost="Face + end"
                active={mode === 'finish'}
                disabled={planningDisabled}
                onClick={() => chooseMode('finish')}
              />
            </div>

            <div
              className={styles.facingPad}
              data-enabled={(mode === 'finish' && !planningDisabled) || undefined}
            >
              <span>Final facing</span>
              <button
                type="button"
                aria-label="Face north"
                disabled={mode !== 'finish' || planningDisabled}
                onClick={() => void commitFinalFacing('north')}
              >
                ↑<small>N</small>
              </button>
              <button
                type="button"
                aria-label="Face west"
                disabled={mode !== 'finish' || planningDisabled}
                onClick={() => void commitFinalFacing('west')}
              >
                ←<small>W</small>
              </button>
              <i>◆</i>
              <button
                type="button"
                aria-label="Face east"
                disabled={mode !== 'finish' || planningDisabled}
                onClick={() => void commitFinalFacing('east')}
              >
                →<small>E</small>
              </button>
              <button
                type="button"
                aria-label="Face south"
                disabled={mode !== 'finish' || planningDisabled}
                onClick={() => void commitFinalFacing('south')}
              >
                ↓<small>S</small>
              </button>
            </div>
          </div>
        </section>

        {battleState.lifecycle === 'completed' ? <BattleCompletionPanel battle={battle} /> : null}
        {recruitFailed ? (
          <button
            type="button"
            className={styles.retryRecruit}
            onClick={() => {
              recruitAttemptedVersion.current = null
              setRecruitFailed(false)
              void runRecruitTurn()
            }}
          >
            Retry Recruit turn
          </button>
        ) : null}
      </div>

      <footer className={styles.battleFooter}>
        <div className={styles.chatControl}>
          <button
            type="button"
            aria-expanded={overlay?.kind === 'chat'}
            onClick={() =>
              setOverlay((current) => (current?.kind === 'chat' ? null : { kind: 'chat' }))
            }
          >
            Chat <span>Solo</span>
          </button>
          {overlay?.kind === 'chat' ? (
            <div className={styles.chatPanel}>
              <strong>Battle Chat</strong>
              <p>
                This Recruit exercise is solo, so chat is unavailable. Multiplayer battles will use
                this same collapsible space when participant messaging is implemented.
              </p>
              <button type="button" onClick={() => setOverlay(null)}>
                Close
              </button>
            </div>
          ) : null}
        </div>

        <div className={styles.footerActions}>
          <button
            type="button"
            onClick={() => {
              setOverlay(null)
              clearPlanning('move')
              setNotice('Selection cleared. Move mode restored.')
            }}
            disabled={commitPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.confirm}
            onClick={() => void commitIntent()}
            disabled={commitPending || previewPending || !pendingIntent || !preview?.preview.legal}
          >
            {commitPending ? 'Committing…' : 'Confirm action'}
          </button>
          <button
            type="button"
            className={styles.abort}
            onClick={() => setOverlay({ kind: 'abort' })}
            disabled={abortPending || battleState.lifecycle !== 'active'}
          >
            Abort
          </button>
        </div>
      </footer>

      {overlay?.kind === 'abort' ? (
        <div className={styles.modalBackdrop}>
          <section
            className={styles.abortModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="abort-title"
          >
            <span>Practice exercise</span>
            <h2 id="abort-title">Abort this battle?</h2>
            <p>
              The exercise ends immediately as abandoned. Practice grants no normal progression
              rewards.
            </p>
            <div>
              <button type="button" onClick={() => setOverlay(null)} disabled={abortPending}>
                Stay in battle
              </button>
              <button
                type="button"
                className={styles.abort}
                onClick={() => void abortExercise()}
                disabled={abortPending}
              >
                {abortPending ? 'Aborting…' : 'Confirm Abort'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}

function CommandButton({
  number,
  label,
  cost,
  active,
  disabled,
  onClick,
}: {
  number: string
  label: string
  cost: string
  active: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={active ? styles.commandActive : ''}
      disabled={disabled}
      onClick={onClick}
    >
      <span>{number}</span>
      <strong>{label}</strong>
      <small>{cost}</small>
    </button>
  )
}

function CombatantRail({
  side,
  name,
  combatant,
  placement,
  profile,
  statuses,
  portraitAssetId,
  active,
  overlay,
  setOverlay,
}: {
  side: 'player' | 'enemy'
  name: string
  combatant: Combatant | null
  placement: CombatPlacement | null
  profile: CombatProfile | null
  statuses: readonly CombatStatus[]
  portraitAssetId: ImageAssetId | null
  active: boolean
  overlay: OverlayState
  setOverlay: (overlay: OverlayState) => void
}) {
  if (!combatant || !placement) return <aside className={styles.combatantRail} />
  const statusOverlay =
    overlay?.kind === 'status' && overlay.combatantId === combatant.id ? overlay : null
  const facingOpen = overlay?.kind === 'facing' && overlay.combatantId === combatant.id
  const focusedStatus = statusOverlay?.statusId
    ? (statuses.find((status) => status.statusId === statusOverlay.statusId) ?? null)
    : null

  return (
    <aside
      className={`${styles.combatantRail} ${side === 'enemy' ? styles.enemyRail : styles.playerRail}`}
      aria-label={`${name} combat status`}
    >
      <article className={styles.combatantCard} data-active={active || undefined}>
        <div className={styles.cardHeading}>
          <div>
            <span>{side === 'enemy' ? 'Opponent' : 'Character'}</span>
            <strong>{name}</strong>
          </div>
          {active ? <b>Active</b> : null}
        </div>

        <button
          type="button"
          className={styles.portraitButton}
          onClick={() =>
            setOverlay(
              statusOverlay ? null : { kind: 'status', combatantId: combatant.id, statusId: null },
            )
          }
          aria-label={`Show ${name} status effects`}
        >
          {portraitAssetId ? (
            <AurevaneImage assetId={portraitAssetId} sizes="12rem" />
          ) : (
            <span className={styles.enemyPortrait}>R</span>
          )}
          <div className={styles.portraitMeters}>
            <span aria-label={`${name} HP ${combatant.hp} of ${combatant.maxHp}`}>
              <i style={{ width: `${meterPercent(combatant.hp, combatant.maxHp)}%` }} />
            </span>
            <span aria-label={`${name} MP ${combatant.mp} of ${combatant.maxMp}`}>
              <i style={{ width: `${meterPercent(combatant.mp, combatant.maxMp)}%` }} />
            </span>
          </div>
        </button>

        <div className={styles.statusIcons} aria-label={`${name} buffs and debuffs`}>
          {statuses.length === 0 ? (
            <span className={styles.noStatus}>No effects</span>
          ) : (
            statuses.map((status) => {
              const display = statusPresentation(status.statusId)
              return (
                <button
                  key={`${status.statusId}:${status.sourceCombatantId}`}
                  type="button"
                  className={display.beneficial ? styles.buffIcon : styles.debuffIcon}
                  aria-label={`${display.label}, ${status.remainingOwnerTurnStarts} turns remaining`}
                  onClick={() =>
                    setOverlay({
                      kind: 'status',
                      combatantId: combatant.id,
                      statusId: status.statusId,
                    })
                  }
                >
                  {display.beneficial ? '+' : '!'}
                </button>
              )
            })
          )}
        </div>

        <dl className={styles.combatStats}>
          <div>
            <dt>Initiative</dt>
            <dd>{combatant.initiative}</dd>
          </div>
          <div>
            <dt>Movement</dt>
            <dd>{combatant.baseMovementBudget}</dd>
          </div>
          <div>
            <dt>Jump</dt>
            <dd>{profile?.jump ?? '—'}</dd>
          </div>
          <div>
            <dt>Armor</dt>
            <dd>{profile?.armor ?? '—'}</dd>
          </div>
          <div>
            <dt>Evasion</dt>
            <dd>{profile ? percentFromBasisPoints(profile.evasion) : '—'}</dd>
          </div>
        </dl>

        <button
          type="button"
          className={styles.facingControl}
          aria-expanded={facingOpen}
          onClick={() =>
            setOverlay(facingOpen ? null : { kind: 'facing', combatantId: combatant.id })
          }
        >
          <span>{facingGlyph(placement.facing)}</span>
          <strong>{placement.facing}</strong>
        </button>

        {statusOverlay ? (
          <div className={styles.contextPopover}>
            <button
              type="button"
              className={styles.popoverClose}
              onClick={() => setOverlay(null)}
              aria-label="Close status details"
            >
              ×
            </button>
            {focusedStatus ? (
              <StatusDetails status={focusedStatus} />
            ) : (
              <>
                <strong>{name} · active effects</strong>
                {statuses.length === 0 ? (
                  <p>No buffs or debuffs are active.</p>
                ) : (
                  <ul>
                    {statuses.map((status) => (
                      <li key={status.statusId}>
                        <StatusDetails status={status} />
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        ) : null}

        {facingOpen ? (
          <div className={styles.contextPopover}>
            <button
              type="button"
              className={styles.popoverClose}
              onClick={() => setOverlay(null)}
              aria-label="Close facing details"
            >
              ×
            </button>
            <strong>
              Facing {placement.facing} {facingGlyph(placement.facing)}
            </strong>
            <p>
              This is the direction {name} is currently protecting. Attacks from the side and rear
              are more favorable to the attacker.
            </p>
          </div>
        ) : null}
      </article>
    </aside>
  )
}

function StatusDetails({ status }: { status: CombatStatus }) {
  const display = statusPresentation(status.statusId)
  return (
    <div className={styles.statusDetail}>
      <strong>{display.label}</strong>
      <span className={display.beneficial ? styles.positiveText : styles.negativeText}>
        {display.beneficial ? 'Buff' : 'Debuff'}
      </span>
      <p>{display.summary}</p>
      <small>
        {status.remainingOwnerTurnStarts} turn{status.remainingOwnerTurnStarts === 1 ? '' : 's'}{' '}
        remaining
      </small>
    </div>
  )
}
