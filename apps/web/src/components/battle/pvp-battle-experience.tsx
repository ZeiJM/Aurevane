'use client'

import type { CharacterPortraitRef } from '@aurevane/game-core/character/creation'
import type { BattleIntent } from '@aurevane/validation/combat/battle-session'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import { getStarterPortraitImageAssetId } from '@/media/character'
import type { BattlePreviewView } from '@/server/battle/battle-preview-service'
import type { PvpBattleMetadata, PvpBattleParticipantView } from '@/server/battle/pvp-lobby-service'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

import styles from './pvp-battle-experience.module.css'

const BASIC_ATTACK_ID = 'basic.attack.unarmed.basic'
const GUARD_ID = 'basic.guard'
const RECOVER_ID = 'basic.recover'
const ACTION_ECONOMY_KEY = 'pv1f.action-economy'
const ATTACK_COST = 30
const GUARD_COST = 30
const RECOVER_COST = 50
const MOVE_COST_PER_TERRAIN_POINT = 25

type Mode = 'none' | 'inspect' | 'move' | 'attack' | 'guard' | 'recover' | 'finish'
type GridPosition = { x: number; y: number }
type Facing = 'north' | 'east' | 'south' | 'west'
type Tactical = BattleSessionView['snapshot']['tactical']
type Combatant = Tactical['battle']['combatants'][number]
type Placement = Tactical['placements'][number]

type ApiErrorBody = {
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

function meterPercent(value: number, maximum: number): number {
  if (maximum <= 0) return 0
  return Math.max(0, Math.min(100, (value / maximum) * 100))
}

function readEconomy(combatant: Combatant | null): number {
  if (!combatant) return 0
  return (
    combatant.temporaryResources.find((resource) => resource.key === ACTION_ECONOMY_KEY)?.current ??
    0
  )
}

function terrainTraversalCost(
  tactical: Tactical,
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
  tactical: Tactical,
  activePlacement: Placement | null,
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
      if (Math.abs(neighborTile.elevation - currentTile.elevation) > profile.maxElevationStep) {
        continue
      }

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

function teamLabel(teamIndex: number, teamCount: number): string {
  if (teamCount === 3) return `Faction ${String.fromCharCode(65 + teamIndex)}`
  return teamIndex === 0 ? 'Vanguard' : 'Challengers'
}

function participantName(
  participantByCombatant: ReadonlyMap<string, PvpBattleParticipantView>,
  combatantId: string | null | undefined,
): string {
  if (!combatantId) return '—'
  return participantByCombatant.get(combatantId)?.characterName ?? combatantId
}

function participantTeam(
  participantByCombatant: ReadonlyMap<string, PvpBattleParticipantView>,
  combatantId: string,
): number | null {
  return participantByCombatant.get(combatantId)?.teamIndex ?? null
}

function livingTeamIndexes(
  battle: BattleSessionView,
  participantByCombatant: ReadonlyMap<string, PvpBattleParticipantView>,
): Set<number> {
  const result = new Set<number>()
  for (const combatant of battle.snapshot.tactical.battle.combatants) {
    if (combatant.hp <= 0) continue
    const team = participantTeam(participantByCombatant, combatant.id)
    if (team !== null) result.add(team)
  }
  return result
}

export function PvpBattleExperience({
  initialBattle,
  metadata,
}: {
  initialBattle: BattleSessionView
  metadata: PvpBattleMetadata
}) {
  const router = useRouter()
  const [battle, setBattle] = useState(initialBattle)
  const [mode, setMode] = useState<Mode>('none')
  const [path, setPath] = useState<GridPosition[]>([])
  const [pendingIntent, setPendingIntent] = useState<BattleIntent | null>(null)
  const [preview, setPreview] = useState<BattlePreviewView | null>(null)
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [notice, setNotice] = useState('Arena linked. Waiting for the authoritative turn state.')
  const [previewPending, setPreviewPending] = useState(false)
  const [commitPending, setCommitPending] = useState(false)
  const [copyNotice, setCopyNotice] = useState(false)
  const [victoryOpen, setVictoryOpen] = useState(false)
  const previewSequence = useRef(0)
  const commitLock = useRef(false)

  const tactical = battle.snapshot.tactical
  const battleState = tactical.battle
  const participantByCombatant = useMemo(
    () =>
      new Map(metadata.participants.map((participant) => [participant.combatantId, participant])),
    [metadata.participants],
  )
  const localParticipant = useMemo(
    () =>
      metadata.participants.find(
        (participant) => participant.characterId === metadata.localCharacterId,
      ) ?? null,
    [metadata.localCharacterId, metadata.participants],
  )
  const localCombatantId = localParticipant?.combatantId ?? null
  const localCombatant = localCombatantId
    ? (battleState.combatants.find((combatant) => combatant.id === localCombatantId) ?? null)
    : null
  const localPlacement = localCombatantId
    ? (tactical.placements.find((placement) => placement.combatantId === localCombatantId) ?? null)
    : null
  const localTeamIndex = localParticipant?.teamIndex ?? -1
  const localTurn = Boolean(
    localCombatantId && battleState.currentTurn?.combatantId === localCombatantId,
  )
  const actionEconomy = localTurn ? readEconomy(localCombatant) : 0
  const planningDisabled = !localTurn || battleState.lifecycle !== 'active' || commitPending
  const activeName = participantName(participantByCombatant, battleState.currentTurn?.combatantId)
  const teamCount = metadata.mode === '1v1v1' ? 3 : 2

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
  const reachablePaths = useMemo(
    () =>
      localTurn
        ? buildReachablePaths(tactical, localPlacement, actionEconomy)
        : new Map<string, GridPosition[]>(),
    [actionEconomy, localPlacement, localTurn, tactical],
  )

  const attackRange = useMemo(() => {
    const result = new Set<string>()
    if (!localPlacement) return result
    for (const position of [
      { x: localPlacement.position.x + 1, y: localPlacement.position.y },
      { x: localPlacement.position.x - 1, y: localPlacement.position.y },
      { x: localPlacement.position.x, y: localPlacement.position.y + 1 },
      { x: localPlacement.position.x, y: localPlacement.position.y - 1 },
    ]) {
      if (
        position.x >= 0 &&
        position.x < tactical.width &&
        position.y >= 0 &&
        position.y < tactical.height
      ) {
        result.add(positionKey(position))
      }
    }
    return result
  }, [localPlacement, tactical.height, tactical.width])

  const clearPlanning = useCallback((nextMode: Mode = 'none') => {
    previewSequence.current += 1
    setMode(nextMode)
    setPath([])
    setPendingIntent(null)
    setPreview(null)
    setSelectedUnitId(null)
    setPreviewPending(false)
  }, [])

  const applyRemoteBattle = useCallback(
    (next: BattleSessionView) => {
      setBattle((current) => {
        if (next.battleVersion === current.battleVersion) return current
        const wasLocal =
          current.snapshot.tactical.battle.currentTurn?.combatantId === localCombatantId
        const isLocal = next.snapshot.tactical.battle.currentTurn?.combatantId === localCombatantId
        if (!wasLocal && isLocal) setNotice('Your turn. Choose an action.')
        else if (wasLocal && !isLocal) {
          clearPlanning()
          setNotice(
            `Turn committed. Waiting for ${participantName(
              participantByCombatant,
              next.snapshot.tactical.battle.currentTurn?.combatantId,
            )}.`,
          )
        }
        return next
      })
    },
    [clearPlanning, localCombatantId, participantByCombatant],
  )

  useEffect(() => {
    if (battleState.lifecycle !== 'active') return
    let cancelled = false
    const timer = window.setInterval(async () => {
      if (commitLock.current) return
      try {
        const response = await fetch(`/api/battles/${battle.battleSessionId}`, {
          cache: 'no-store',
        })
        const body = (await response.json()) as { battle?: BattleSessionView } & ApiErrorBody
        if (!response.ok || !body.battle || cancelled) return
        if (body.battle.battleVersion !== battle.battleVersion) applyRemoteBattle(body.battle)
      } catch {
        // The next poll repairs transient connectivity without disturbing local planning.
      }
    }, 700)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [applyRemoteBattle, battle.battleSessionId, battle.battleVersion, battleState.lifecycle])

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
        const body = (await response.json()) as {
          battlePreview?: BattlePreviewView
        } & ApiErrorBody
        if (sequence !== previewSequence.current) return
        if (!response.ok || !body.battlePreview) {
          setPreview(null)
          setNotice(body.error?.message ?? 'That command is not available right now.')
          return
        }
        setPreview(body.battlePreview)
        const result = body.battlePreview.preview
        if (!result.legal) {
          setNotice(result.issues[0]?.message ?? 'That command is not legal right now.')
        } else if (result.kind === 'move') {
          setNotice(
            `Movement ready · ${result.actionEconomyCost} AP · ${result.actionEconomyAfter} AP remains.`,
          )
        } else if (result.kind === 'action' && result.actionId === BASIC_ATTACK_ID) {
          setNotice(`Basic Attack ready · ${result.actionEconomyCost} AP.`)
        } else if (result.kind === 'action' && result.actionId === GUARD_ID) {
          setNotice('Guard ready · 30 AP · incoming damage reduced for 2 turns.')
        } else if (result.kind === 'action' && result.actionId === RECOVER_ID) {
          setNotice('Recover ready · 50 AP · restores 10% maximum HP.')
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
    [battle.battleSessionId, battle.battleVersion],
  )

  const commitValue = useCallback(
    async (intent: BattleIntent) => {
      if (commitLock.current || commitPending || !localTurn) return
      commitLock.current = true
      setCommitPending(true)
      try {
        const response = await fetch(`/api/battles/${battle.battleSessionId}/commit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedBattleVersion: battle.battleVersion, intent }),
        })
        const body = (await response.json()) as { battle?: BattleSessionView } & ApiErrorBody
        if (!response.ok || !body.battle) {
          if (response.status === 409 || body.error?.code === 'STALE_VERSION') {
            const refresh = await fetch(`/api/battles/${battle.battleSessionId}`, {
              cache: 'no-store',
            })
            const refreshBody = (await refresh.json()) as { battle?: BattleSessionView }
            if (refresh.ok && refreshBody.battle) applyRemoteBattle(refreshBody.battle)
          }
          setNotice(body.error?.message ?? 'That action could not be committed.')
          return
        }

        setBattle(body.battle)
        const nextLocalCombatant = localCombatantId
          ? (body.battle.snapshot.tactical.battle.combatants.find(
              (combatant) => combatant.id === localCombatantId,
            ) ?? null)
          : null
        const nextLocalTurn =
          body.battle.snapshot.tactical.battle.currentTurn?.combatantId === localCombatantId
        const remaining = nextLocalTurn ? readEconomy(nextLocalCombatant) : 0

        if (
          intent.kind === 'action' &&
          intent.actionId === BASIC_ATTACK_ID &&
          body.battle.snapshot.tactical.battle.lifecycle === 'active' &&
          nextLocalTurn &&
          remaining >= ATTACK_COST
        ) {
          clearPlanning('attack')
          setNotice(
            `Basic Attack committed. ${remaining} AP remains — choose another target or another action.`,
          )
        } else {
          clearPlanning()
          if (nextLocalTurn) setNotice(`Action committed. ${remaining} AP remains.`)
          else {
            setNotice(
              `Turn handed to ${participantName(
                participantByCombatant,
                body.battle.snapshot.tactical.battle.currentTurn?.combatantId,
              )}.`,
            )
          }
        }
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'That action could not be committed.')
      } finally {
        setCommitPending(false)
        commitLock.current = false
      }
    },
    [
      applyRemoteBattle,
      battle.battleSessionId,
      battle.battleVersion,
      clearPlanning,
      commitPending,
      localCombatantId,
      localTurn,
      participantByCombatant,
    ],
  )

  const commitSelected = useCallback(() => {
    if (!pendingIntent || !preview?.preview.legal || previewPending) return
    void commitValue(pendingIntent)
  }, [commitValue, pendingIntent, preview, previewPending])

  const chooseMode = useCallback(
    (nextMode: Mode) => {
      if (planningDisabled && nextMode !== 'inspect') return
      clearPlanning(nextMode)
      if (nextMode === 'guard') {
        void requestPreview({ kind: 'action', actionId: GUARD_ID, target: { kind: 'self' } })
      } else if (nextMode === 'recover') {
        void requestPreview({ kind: 'action', actionId: RECOVER_ID, target: { kind: 'self' } })
      } else if (nextMode === 'move') {
        setNotice('Move mode · green tiles are reachable with your remaining AP.')
      } else if (nextMode === 'attack') {
        setNotice('Basic Attack · only the four adjacent tiles are in range.')
      } else if (nextMode === 'finish') {
        setNotice('Choose final facing with the buttons, WASD, or arrow keys to end the turn.')
      } else if (nextMode === 'inspect') {
        setNotice('Inspect mode · choose any combatant on the board.')
      }
    },
    [clearPlanning, planningDisabled, requestPreview],
  )

  const handleTile = useCallback(
    (position: GridPosition) => {
      const key = positionKey(position)
      const placement = placementByTile.get(key)
      if (mode === 'inspect') {
        setSelectedUnitId(placement?.combatantId ?? null)
        return
      }
      if (planningDisabled) return

      if (mode === 'move') {
        const nextPath = reachablePaths.get(key)
        if (!nextPath || nextPath.length < 2) {
          if (localPlacement && positionsEqual(position, localPlacement.position)) {
            clearPlanning('move')
            setNotice('Move preview returned to your current tile.')
          } else {
            setNotice('That tile is not reachable with the AP you have left.')
          }
          return
        }
        setPath(nextPath)
        void requestPreview({ kind: 'move', path: nextPath })
        return
      }

      if (mode === 'attack') {
        if (!placement || !localParticipant) {
          setNotice('Choose an adjacent enemy combatant.')
          return
        }
        const target = participantByCombatant.get(placement.combatantId)
        const targetCombatant = battleState.combatants.find(
          (combatant) => combatant.id === placement.combatantId,
        )
        if (
          !attackRange.has(key) ||
          !target ||
          target.teamIndex === localParticipant.teamIndex ||
          !targetCombatant ||
          targetCombatant.hp <= 0
        ) {
          setNotice('That unit is not a legal Basic Attack target.')
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
    [
      attackRange,
      battleState.combatants,
      clearPlanning,
      localParticipant,
      localPlacement,
      mode,
      participantByCombatant,
      placementByTile,
      planningDisabled,
      reachablePaths,
      requestPreview,
    ],
  )

  const moveByKeyboard = useCallback(
    (delta: GridPosition) => {
      if (mode !== 'move' || planningDisabled || !localPlacement) return
      const origin = localPlacement.position
      const tip = path.at(-1) ?? origin
      const next = { x: tip.x + delta.x, y: tip.y + delta.y }

      if (path.length > 1) {
        const previous = path[path.length - 2]
        if (previous && positionsEqual(previous, next)) {
          const shorter = path.slice(0, -1)
          if (shorter.length <= 1) {
            setPath([])
            setPendingIntent(null)
            setPreview(null)
            previewSequence.current += 1
            setNotice('Move preview returned to your current tile.')
          } else {
            setPath(shorter)
            void requestPreview({ kind: 'move', path: shorter })
          }
          return
        }
      }

      const nextPath = reachablePaths.get(positionKey(next))
      if (!nextPath || nextPath.length < 2) {
        setNotice('That direction is not reachable with the AP you have left.')
        return
      }
      setPath(nextPath)
      void requestPreview({ kind: 'move', path: nextPath })
    },
    [localPlacement, mode, path, planningDisabled, reachablePaths, requestPreview],
  )

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTextEntryTarget(event.target)) return
      const lower = event.key.toLowerCase()
      const direction: { delta: GridPosition; facing: Facing } | null =
        lower === 'w' || event.key === 'ArrowUp'
          ? { delta: { x: 0, y: -1 }, facing: 'north' }
          : lower === 'd' || event.key === 'ArrowRight'
            ? { delta: { x: 1, y: 0 }, facing: 'east' }
            : lower === 's' || event.key === 'ArrowDown'
              ? { delta: { x: 0, y: 1 }, facing: 'south' }
              : lower === 'a' || event.key === 'ArrowLeft'
                ? { delta: { x: -1, y: 0 }, facing: 'west' }
                : null

      if (direction && mode === 'finish' && !planningDisabled) {
        event.preventDefault()
        void commitValue({ kind: 'face', facing: direction.facing })
        return
      }
      if (direction && mode === 'move' && !planningDisabled) {
        event.preventDefault()
        moveByKeyboard(direction.delta)
        return
      }
      if (event.key === 'Enter' && pendingIntent && preview?.preview.legal) {
        event.preventDefault()
        commitSelected()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        clearPlanning()
        setNotice('Selection cleared.')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    clearPlanning,
    commitSelected,
    commitValue,
    mode,
    moveByKeyboard,
    pendingIntent,
    planningDisabled,
    preview,
  ])

  const boardStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${tactical.width}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${tactical.height}, minmax(0, 1fr))`,
    aspectRatio: `${tactical.width} / ${tactical.height}`,
  }

  const selectedParticipant = selectedUnitId
    ? (participantByCombatant.get(selectedUnitId) ?? null)
    : null
  const selectedCombatant = selectedUnitId
    ? (battleState.combatants.find((combatant) => combatant.id === selectedUnitId) ?? null)
    : null
  const selectedPlacement = selectedUnitId
    ? (tactical.placements.find((placement) => placement.combatantId === selectedUnitId) ?? null)
    : null
  const proposedCost =
    preview?.preview.kind === 'move' || preview?.preview.kind === 'action'
      ? preview.preview.actionEconomyCost
      : 0
  const livingTeams = livingTeamIndexes(battle, participantByCombatant)
  const objectiveComplete = battleState.lifecycle === 'completed'

  async function copyBattleKey() {
    try {
      await navigator.clipboard.writeText(metadata.battleKey)
      setCopyNotice(true)
      window.setTimeout(() => setCopyNotice(false), 1500)
    } catch {
      setNotice('Battle Key copy is unavailable in this browser.')
    }
  }

  function resultLabel(): string {
    if (livingTeams.size !== 1) return 'Battle Complete'
    return livingTeams.has(localTeamIndex) ? 'Victory' : 'Defeat'
  }

  return (
    <main className={styles.shell} data-pvp-battle="true">
      <header className={styles.header}>
        <div className={styles.objective}>
          <span>Battle Hall · Player vs Player · {metadata.mode.toUpperCase()}</span>
          <strong>Defeat every opposing combatant</strong>
        </div>

        <div className={styles.economy} data-active={localTurn || undefined}>
          {localTurn ? (
            <>
              <div className={styles.economyCopy}>
                <span>Action Economy</span>
                <strong>{actionEconomy} AP</strong>
                {proposedCost > 0 ? <small>− {proposedCost} proposed</small> : <small>Your turn</small>}
              </div>
              <div
                className={styles.economyTrack}
                role="progressbar"
                aria-label="Action Economy remaining"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={actionEconomy}
              >
                <span style={{ width: `${actionEconomy}%` }} />
                {proposedCost > 0 ? (
                  <i
                    style={{
                      left: `${Math.max(0, actionEconomy - proposedCost)}%`,
                      width: `${Math.min(actionEconomy, proposedCost)}%`,
                    }}
                  />
                ) : null}
              </div>
            </>
          ) : (
            <div className={styles.waitingTurn}>
              <span>Turn control</span>
              <strong>
                {battleState.lifecycle === 'active' ? `${activeName} acting…` : 'Battle complete'}
              </strong>
            </div>
          )}
          <button
            type="button"
            className={styles.victoryButton}
            onClick={() => setVictoryOpen(true)}
          >
            <span>Victory Conditions</span>
            <strong>{objectiveComplete ? '1/1' : '0/1'}</strong>
          </button>
        </div>

        <button type="button" className={styles.logButton} aria-expanded="false">
          Round {battleState.round}
          <small>Combat Log</small>
        </button>
      </header>

      <section className={styles.roster} aria-label="PvP battle roster">
        {Array.from({ length: teamCount }, (_, teamIndex) => {
          const members = metadata.participants.filter(
            (participant) => participant.teamIndex === teamIndex,
          )
          return (
            <div
              className={styles.teamRoster}
              key={teamIndex}
              data-local={teamIndex === localTeamIndex || undefined}
            >
              <div className={styles.teamHeading}>
                <span>Team {teamIndex + 1}</span>
                <strong>{teamLabel(teamIndex, teamCount)}</strong>
              </div>
              <div className={styles.teamMembers}>
                {members.map((participant) => {
                  const combatant = battleState.combatants.find(
                    (candidate) => candidate.id === participant.combatantId,
                  )
                  const active = battleState.currentTurn?.combatantId === participant.combatantId
                  return (
                    <article
                      key={participant.combatantId}
                      className={styles.rosterCard}
                      data-active={active || undefined}
                      data-defeated={combatant?.hp === 0 || undefined}
                    >
                      <CharacterPortraitImage
                        imageUrl={participant.profileImageUrl}
                        fallbackAssetId={getStarterPortraitImageAssetId(
                          participant.portraitRef as CharacterPortraitRef,
                        )}
                        className={styles.rosterPortrait}
                        sizes="56px"
                        alt=""
                      />
                      <div className={styles.rosterIdentity}>
                        <strong>{participant.characterName}</strong>
                        <small>
                          Lv {participant.characterLevel}
                          {participant.characterId === metadata.localCharacterId ? ' · You' : ''}
                        </small>
                        <div className={styles.miniMeters}>
                          <span>
                            <i
                              style={{
                                width: `${meterPercent(combatant?.hp ?? 0, combatant?.maxHp ?? 1)}%`,
                              }}
                            />
                          </span>
                          <span>
                            <i
                              style={{
                                width: `${meterPercent(combatant?.mp ?? 0, combatant?.maxMp ?? 1)}%`,
                              }}
                            />
                          </span>
                        </div>
                      </div>
                      {active ? <b>ACTIVE</b> : null}
                    </article>
                  )
                })}
              </div>
            </div>
          )
        })}
      </section>

      <section className={styles.content}>
        <div className={styles.notice} data-local-turn={localTurn || undefined}>
          <strong>
            {localTurn
              ? 'Your turn'
              : battleState.lifecycle === 'active'
                ? `Waiting for ${activeName}`
                : resultLabel()}
          </strong>
          <span>{notice}</span>
        </div>

        <section id="battlefield" className={styles.battlefield} aria-label="PvP tactical battlefield">
          <div className={styles.boardViewport}>
            <div className={styles.board} style={boardStyle}>
              {tactical.tiles.map((tile) => {
                const key = positionKey(tile.position)
                const placement = placementByTile.get(key)
                const participant = placement
                  ? participantByCombatant.get(placement.combatantId)
                  : null
                const combatant = placement
                  ? battleState.combatants.find(
                      (candidate) => candidate.id === placement.combatantId,
                    )
                  : null
                const pathIndex = path.findIndex((point) => positionsEqual(point, tile.position))
                const reachable = mode === 'move' && reachablePaths.has(key) && pathIndex < 0
                const inAttackRange = mode === 'attack' && attackRange.has(key)
                const legalEnemy = Boolean(
                  inAttackRange &&
                    participant &&
                    participant.teamIndex !== localTeamIndex &&
                    combatant &&
                    combatant.hp > 0,
                )
                const selfTarget =
                  (mode === 'guard' || mode === 'recover') &&
                  placement?.combatantId === localCombatantId
                const targetRelation = selfTarget
                  ? 'friendly'
                  : inAttackRange
                    ? legalEnemy
                      ? 'enemy'
                      : 'illegal'
                    : undefined
                const selected = selectedUnitId === placement?.combatantId
                const terrain = tile.terrainId === 'rough-ground' ? 'rough' : 'open'

                return (
                  <button
                    type="button"
                    key={key}
                    className={styles.tile}
                    data-terrain={terrain}
                    data-elevation={tile.elevation > 0 || undefined}
                    data-reachable={reachable || undefined}
                    data-path={pathIndex >= 0 || undefined}
                    data-target={targetRelation}
                    data-selected={selected || undefined}
                    onClick={() => handleTile(tile.position)}
                    aria-label={`Tile ${tile.position.x + 1}, ${tile.position.y + 1}; ${terrain} ground; elevation ${tile.elevation}${participant ? `; occupied by ${participant.characterName}` : ''}`}
                  >
                    <span className={styles.tileMeta}>
                      {tile.position.x + 1},{tile.position.y + 1}
                    </span>
                    {tile.elevation > 0 ? <span className={styles.elevation}>▲</span> : null}
                    {pathIndex >= 0 ? <span className={styles.pathNumber}>{pathIndex}</span> : null}
                    {participant && placement ? (
                      <span
                        className={styles.unit}
                        data-team={participant.teamIndex}
                        data-active={
                          battleState.currentTurn?.combatantId === participant.combatantId ||
                          undefined
                        }
                        data-defeated={combatant?.hp === 0 || undefined}
                      >
                        <CharacterPortraitImage
                          imageUrl={participant.profileImageUrl}
                          fallbackAssetId={getStarterPortraitImageAssetId(
                            participant.portraitRef as CharacterPortraitRef,
                          )}
                          className={styles.unitPortrait}
                          sizes="64px"
                          alt=""
                        />
                        <i>{facingGlyph(placement.facing)}</i>
                        <strong>{participant.characterName}</strong>
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
          <div className={styles.legend}>
            <span>
              <b>Green</b> friendly / reachable
            </span>
            <span>
              <b>Orange</b> legal enemy target
            </span>
            <span>
              <b>Red</b> unavailable inside effective range
            </span>
          </div>
        </section>

        <section className={styles.commandDeck} aria-label="Command Deck">
          <div className={styles.context}>
            {mode === 'inspect' && selectedParticipant && selectedCombatant && selectedPlacement ? (
              <>
                <strong>{selectedParticipant.characterName}</strong>
                <span>
                  Team {selectedParticipant.teamIndex + 1} · HP {selectedCombatant.hp}/
                  {selectedCombatant.maxHp} · MP {selectedCombatant.mp}/{selectedCombatant.maxMp} ·
                  Facing {selectedPlacement.facing} {facingGlyph(selectedPlacement.facing)}
                </span>
              </>
            ) : (
              <>
                <strong>
                  {mode === 'none'
                    ? 'Choose an action'
                    : mode === 'finish'
                      ? 'Choose final facing'
                      : mode.replace('-', ' ')}
                </strong>
                <span>{notice}</span>
              </>
            )}
          </div>
          <div className={styles.commands}>
            <button
              type="button"
              data-active={mode === 'inspect' || undefined}
              onClick={() => chooseMode('inspect')}
            >
              <span>00</span>
              <strong>Inspect</strong>
              <small>Free</small>
            </button>
            <button
              type="button"
              data-active={mode === 'move' || undefined}
              disabled={planningDisabled || actionEconomy < MOVE_COST_PER_TERRAIN_POINT}
              onClick={() => chooseMode('move')}
            >
              <span>01</span>
              <strong>Move</strong>
              <small>25+ AP</small>
            </button>
            <button
              type="button"
              data-active={mode === 'attack' || undefined}
              disabled={planningDisabled || actionEconomy < ATTACK_COST}
              onClick={() => chooseMode('attack')}
            >
              <span>02</span>
              <strong>Basic Attack</strong>
              <small>30 AP</small>
            </button>
            <button
              type="button"
              data-active={mode === 'guard' || undefined}
              disabled={planningDisabled || actionEconomy < GUARD_COST}
              onClick={() => chooseMode('guard')}
            >
              <span>03</span>
              <strong>Guard</strong>
              <small>30 AP</small>
            </button>
            <button
              type="button"
              data-active={mode === 'recover' || undefined}
              disabled={
                planningDisabled ||
                actionEconomy < RECOVER_COST ||
                !localCombatant ||
                localCombatant.hp >= localCombatant.maxHp
              }
              onClick={() => chooseMode('recover')}
            >
              <span>04</span>
              <strong>Recover</strong>
              <small>50 AP</small>
            </button>
            <button
              type="button"
              data-active={mode === 'finish' || undefined}
              disabled={planningDisabled}
              onClick={() => chooseMode('finish')}
            >
              <span>05</span>
              <strong>Finish Turn</strong>
              <small>Face + end</small>
            </button>
          </div>

          <div className={styles.facingRow} data-open={mode === 'finish' || undefined}>
            <span>Final facing · WASD / arrows</span>
            {(['north', 'west', 'east', 'south'] as const).map((facing) => (
              <button
                type="button"
                key={facing}
                disabled={mode !== 'finish' || planningDisabled}
                onClick={() => void commitValue({ kind: 'face', facing })}
                aria-label={`Face ${facing}`}
              >
                {facingGlyph(facing)}
              </button>
            ))}
          </div>
        </section>
      </section>

      <footer className={styles.footer}>
        <button type="button" className={styles.chatButton} aria-expanded="false">
          Chat
        </button>
        <button type="button" className={styles.battleKey} onClick={() => void copyBattleKey()}>
          <small>{copyNotice ? 'Copied!' : 'Battle Key · click to copy'}</small>
          <strong>{metadata.battleKey}</strong>
        </button>
        <div className={styles.footerActions}>
          <button
            type="button"
            onClick={() => {
              clearPlanning()
              setNotice('Selection cleared.')
            }}
            disabled={commitPending}
          >
            Cancel Action
          </button>
          <button
            type="button"
            className={styles.confirm}
            onClick={commitSelected}
            disabled={commitPending || previewPending || !pendingIntent || !preview?.preview.legal}
          >
            {commitPending ? 'Committing…' : 'Confirm Action'}
          </button>
        </div>
      </footer>

      {victoryOpen ? (
        <div className={styles.modalBackdrop} onPointerDown={() => setVictoryOpen(false)}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pvp-victory-title"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <span>Victory Conditions · {objectiveComplete ? '1/1' : '0/1'}</span>
            <h2 id="pvp-victory-title">Defeat every opposing combatant.</h2>
            <p>
              Your team wins when it is the only team with at least one combatant still able to
              fight.
            </p>
            <button type="button" onClick={() => setVictoryOpen(false)}>
              Return to battle
            </button>
          </section>
        </div>
      ) : null}

      {battleState.lifecycle === 'completed' ? (
        <div className={styles.resultBackdrop}>
          <section
            className={styles.result}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pvp-result-title"
          >
            <span>Battle Hall · PvP Result</span>
            <h2 id="pvp-result-title">{resultLabel()}</h2>
            <p>
              Battle complete in Round {battleState.round}. The Battle Key remains valid for
              read-only spectation of the completed result.
            </p>
            <button type="button" onClick={() => router.push('/game/battle')}>
              Return to Battle Hall
            </button>
          </section>
        </div>
      ) : null}
    </main>
  )
}
