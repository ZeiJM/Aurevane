'use client'

import type { BattleIntent } from '@aurevane/validation/combat/battle-session'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { BattleFinalTurnPreviewView } from '@/server/battle/battle-final-turn-service'
import type { BattlePreviewView } from '@/server/battle/battle-preview-service'
import type { RecruitTurnView } from '@/server/battle/battle-recruit-ai-service'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

import { BattleCompletionPanel } from './battle-completion-panel'
import { BattleLogPanel } from './battle-log-panel'
import styles from './battle-experience.module.css'

const BASIC_ATTACK_ID = 'basic.attack.unarmed.basic'
const GUARD_ID = 'basic.guard'

type PlanningMode = 'inspect' | 'move' | 'attack' | 'guard' | 'face' | 'end-turn'
type GridPosition = { x: number; y: number }
type Facing = 'north' | 'east' | 'south' | 'west'

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

function modeInstruction(
  mode: PlanningMode,
  actionReady: boolean,
  provisionalFacing: Facing,
): string {
  if (mode === 'move')
    return 'POSITION · Choose adjacent tiles. Moving normally does not spend your Action.'
  if (mode === 'attack') {
    return actionReady
      ? 'ACT · Choose an enemy in range, review the forecast, then Confirm.'
      : 'ACT · Your Action is already spent this turn.'
  }
  if (mode === 'guard') {
    return actionReady
      ? 'ACT · Guard spends your Action to take a defensive stance.'
      : 'ACT · Your Action is already spent this turn.'
  }
  if (mode === 'face')
    return `FACING · ${provisionalFacing}. You can still move or act before ending the turn.`
  if (mode === 'end-turn') {
    return `END TURN · Final facing ${provisionalFacing}. Adjust facing if needed, then Confirm.`
  }
  return 'INSPECT · Select a unit or tile. Nothing is committed while inspecting.'
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

export function BattleExperience({ initialBattle }: BattleExperienceProps) {
  const [battle, setBattle] = useState(initialBattle)
  const [mode, setMode] = useState<PlanningMode>('inspect')
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(
    initialBattle.snapshot.tactical.battle.currentTurn?.combatantId ?? null,
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
  const [notice, setNotice] = useState<string>('Authoritative state loaded.')
  const previewSequence = useRef(0)
  const recruitAttemptedVersion = useRef<number | null>(null)

  const snapshot = battle.snapshot
  const tactical = snapshot.tactical
  const battleState = tactical.battle
  const currentTurn = battleState.currentTurn
  const activeCombatant = currentTurn
    ? (battleState.combatants.find((combatant) => combatant.id === currentTurn.combatantId) ?? null)
    : null
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
  const selectedStatuses = selectedUnitId
    ? (snapshot.statusState.find((row) => row.combatantId === selectedUnitId)?.statuses ?? [])
    : []

  const placementByTile = useMemo(() => {
    return new Map(
      tactical.placements.map((placement) => [positionKey(placement.position), placement] as const),
    )
  }, [tactical.placements])

  const previewAffectedTiles = useMemo(() => {
    if (preview?.preview.kind !== 'action') return new Set<string>()
    return new Set(preview.preview.affectedTiles.map(positionKey))
  }, [preview])

  const pathTiles = useMemo(() => new Set(path.map(positionKey)), [path])

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
      setSelectedUnitId(body.battle.snapshot.tactical.battle.currentTurn?.combatantId ?? null)
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
            `Battle state changed to version ${body.error.currentVersion ?? 'newer'}. Planning was cleared and authoritative state was reloaded.`,
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
    if (recruitPending || playerTurn || battleState.lifecycle !== 'active' || !currentTurn) return
    if (recruitAttemptedVersion.current === battle.battleVersion) return

    recruitAttemptedVersion.current = battle.battleVersion
    setRecruitPending(true)
    resetPlanning()
    setNotice('Recruit is choosing from committed battle state…')

    try {
      const response = await fetch(`/api/battles/${battle.battleSessionId}/recruit-turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedBattleVersion: battle.battleVersion }),
      })
      const body = (await response.json()) as { battle?: RecruitTurnView } & ApiErrorBody
      if (!response.ok || !body.battle) {
        await handleApiFailure(response, body, 'The Recruit turn could not be resolved.')
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
      setSelectedUnitId(nextBattle.snapshot.tactical.battle.currentTurn?.combatantId ?? null)
      resetPlanning()
      const decisionSummary = body.battle.decisions
        .map((decision) => `${decision.reason} (${decision.utility})`)
        .join(' → ')
      setNotice(
        decisionSummary.length > 0
          ? `Recruit turn resolved server-side: ${decisionSummary}.`
          : 'Recruit turn resolved server-side.',
      )
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The Recruit turn could not be resolved.')
    } finally {
      setRecruitPending(false)
    }
  }, [
    battle.battleSessionId,
    battle.battleVersion,
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
          body: JSON.stringify({
            expectedBattleVersion: battle.battleVersion,
            intent,
          }),
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
        setNotice(
          body.battlePreview.preview.legal
            ? 'Preview ready. Confirm to commit this command.'
            : (issue?.message ?? 'That command is not legal in the current state.'),
        )
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
            ? `Preview ready. Confirm to commit this command. End Turn will face ${facing}.`
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
    if (commitPending || !pendingIntent || !preview?.preview.legal) return
    setCommitPending(true)
    const committedIntent = pendingIntent
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
        const targetCombatantId = committedIntent.target.combatantId
        const targetPlacement = tactical.placements.find(
          (placement) => placement.combatantId === targetCombatantId,
        )
        if (targetPlacement) {
          nextFacing =
            facingToward(activePlacement.position, targetPlacement.position) ?? nextFacing
        }
      } else if (committedIntent.kind === 'face') {
        nextFacing = committedIntent.facing
      }

      setBattle(body.battle)
      setProvisionalFacing(nextFacing)
      setSelectedUnitId(body.battle.snapshot.tactical.battle.currentTurn?.combatantId ?? null)
      resetPlanning()
      setNotice(`Command committed. Authoritative battle version ${body.battle.battleVersion}.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'That command could not be committed.')
    } finally {
      setCommitPending(false)
    }
  }, [
    activePlacement,
    battle.battleSessionId,
    battle.battleVersion,
    commitPending,
    handleApiFailure,
    pendingIntent,
    preview,
    resetPlanning,
    tactical.placements,
  ])

  const commitFinalTurn = useCallback(async () => {
    if (commitPending || !finalTurnPreview?.legal) return
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
      setSelectedUnitId(body.battle.snapshot.tactical.battle.currentTurn?.combatantId ?? null)
      resetPlanning()
      setNotice(
        `Turn ended facing ${provisionalFacing}. Authoritative battle version ${body.battle.battleVersion}.`,
      )
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The turn could not be ended.')
    } finally {
      setCommitPending(false)
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
      recruitAttemptedVersion.current !== battle.battleVersion
    ) {
      void runRecruitTurn()
    }
  }, [
    battle.battleVersion,
    battleState.lifecycle,
    currentTurn,
    playerTurn,
    recruitPending,
    runRecruitTurn,
  ])

  useEffect(() => {
    function handleReconnect() {
      recruitAttemptedVersion.current = null
      void refreshBattle('Connection restored. Authoritative battle state reloaded.').catch(
        (error) => {
          setNotice(error instanceof Error ? error.message : 'The battle could not be refreshed.')
        },
      )
    }

    window.addEventListener('online', handleReconnect)
    return () => window.removeEventListener('online', handleReconnect)
  }, [refreshBattle])

  function chooseMode(nextMode: PlanningMode) {
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
    if (nextMode === 'move' && activePlacement) {
      setPath([{ ...activePlacement.position }])
      setNotice(
        'Move mode: choose adjacent tiles to build a path. Movement does not normally spend your Action.',
      )
      return
    }
    if (nextMode === 'attack') {
      setNotice('Basic Attack: choose an enemy unit on the battlefield, then review the forecast.')
      return
    }
    if (nextMode === 'face') {
      setNotice(
        `Facing: ${provisionalFacing}. This is provisional until you commit a facing command or End Turn.`,
      )
      return
    }
    setNotice('Inspect mode: select a unit or tile without committing anything.')
  }

  function handleTileClick(position: GridPosition) {
    const placement = placementByTile.get(positionKey(position))
    setSelectedPosition(position)
    if (placement) setSelectedUnitId(placement.combatantId)

    if (!playerTurn || commitPending) return

    if (mode === 'move' && activePlacement) {
      let nextPath: GridPosition[]
      if (positionsEqual(position, activePlacement.position)) {
        nextPath = [{ ...activePlacement.position }]
      } else {
        const basePath = path.length > 0 ? path : [{ ...activePlacement.position }]
        nextPath = [...basePath, { ...position }]
      }
      setPath(nextPath)
      if (nextPath.length >= 2) void requestPreview({ kind: 'move', path: nextPath })
      return
    }

    if (mode === 'attack' && placement) {
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

  function previewFacing(facing: Facing) {
    if (!playerTurn || commitPending) return
    setProvisionalFacing(facing)
    if (mode === 'end-turn') {
      void requestFinalTurnPreview(facing)
      return
    }
    setMode('face')
    void requestPreview({ kind: 'face', facing })
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTextEntryTarget(event.target)) return

      if (event.key === 'Escape') {
        event.preventDefault()
        resetPlanning()
        setNotice('Planning cleared. No command was committed.')
        return
      }

      if (!playerTurn || battleState.lifecycle !== 'active' || commitPending || recruitPending)
        return

      if (event.key === '1') {
        event.preventDefault()
        chooseMode('inspect')
        return
      }
      if (event.key === '2') {
        event.preventDefault()
        chooseMode('move')
        return
      }
      if (event.key === '3') {
        event.preventDefault()
        if (currentTurn?.actionState === 'ready') chooseMode('attack')
        else setNotice('Basic Attack unavailable: your Action is already spent this turn.')
        return
      }
      if (event.key === '4') {
        event.preventDefault()
        if (currentTurn?.actionState === 'ready') chooseMode('guard')
        else setNotice('Guard unavailable: your Action is already spent this turn.')
        return
      }
      if (event.key === '5' || event.code === 'Space') {
        event.preventDefault()
        chooseMode('end-turn')
        return
      }

      if (mode === 'face' || mode === 'end-turn') {
        const facingByKey: Partial<Record<string, Facing>> = {
          w: 'north',
          W: 'north',
          a: 'west',
          A: 'west',
          s: 'south',
          S: 'south',
          d: 'east',
          D: 'east',
          ArrowUp: 'north',
          ArrowLeft: 'west',
          ArrowDown: 'south',
          ArrowRight: 'east',
        }
        const facing = facingByKey[event.key]
        if (facing) {
          event.preventDefault()
          previewFacing(facing)
          return
        }
      }

      if (event.key === 'Enter') {
        if (mode === 'end-turn' && finalTurnPreview?.legal) {
          event.preventDefault()
          void commitFinalTurn()
          return
        }
        if (preview?.preview.legal && pendingIntent) {
          event.preventDefault()
          void commitIntent()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    battleState.lifecycle,
    chooseMode,
    commitFinalTurn,
    commitIntent,
    commitPending,
    currentTurn?.actionState,
    finalTurnPreview,
    mode,
    pendingIntent,
    playerTurn,
    preview,
    previewFacing,
    recruitPending,
    resetPlanning,
  ])

  const selectedTile = selectedPosition
    ? (tactical.tiles.find((tile) => positionsEqual(tile.position, selectedPosition)) ?? null)
    : null
  const previewLegal = preview?.preview.legal ?? false
  const finalTurnLegal = finalTurnPreview?.legal ?? false
  const planningDisabled =
    !playerTurn || battleState.lifecycle !== 'active' || commitPending || recruitPending
  const actionReady = currentTurn?.actionState === 'ready'
  const commandLegal = mode === 'end-turn' ? finalTurnLegal : previewLegal
  const hasPendingCommand = mode === 'end-turn' ? Boolean(finalTurnPreview) : Boolean(pendingIntent)

  return (
    <main className={styles.shell}>
      <a className="skip-link" href="#battlefield">
        Skip to battlefield
      </a>

      <header className={styles.objectiveBar}>
        <div>
          <span className={styles.kicker}>Tactical Hall · Controlled Exercise</span>
          <strong>Objective: defeat the opposing recruit</strong>
        </div>
        <div className={styles.roundReadout} aria-label="Battle round and version">
          <span>Round {battleState.round}</span>
          <span>Turn {battleState.turnNumber}</span>
          <span>v{battle.battleVersion}</span>
        </div>
      </header>

      <nav className={styles.initiative} aria-label="Initiative order">
        {battleState.initiativeOrder.map((combatantId, index) => {
          const combatant = battleState.combatants.find((candidate) => candidate.id === combatantId)
          const active = currentTurn?.combatantId === combatantId
          return (
            <button
              key={combatantId}
              type="button"
              className={`${styles.initiativeItem} ${active ? styles.initiativeItemActive : ''}`}
              onClick={() => setSelectedUnitId(combatantId)}
            >
              <span>{index + 1}</span>
              <strong>{combatantLabel(combatantId)}</strong>
              <small>{combatant?.initiative ?? 0} INIT</small>
            </button>
          )
        })}
      </nav>

      <section id="battlefield" className={styles.battlefield} aria-label="Tactical battlefield">
        <div className={styles.fieldFrame}>
          <div
            className={styles.board}
            style={{
              gridTemplateColumns: `repeat(${tactical.width}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${tactical.height}, minmax(0, 1fr))`,
            }}
          >
            {tactical.tiles.map((tile) => {
              const key = positionKey(tile.position)
              const placement = placementByTile.get(key)
              const combatant = placement
                ? battleState.combatants.find((candidate) => candidate.id === placement.combatantId)
                : null
              const selected = selectedPosition
                ? positionsEqual(tile.position, selectedPosition)
                : false
              const active = placement?.combatantId === currentTurn?.combatantId
              const inPath = pathTiles.has(key)
              const affected = previewAffectedTiles.has(key)
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
                selected ? styles.tileSelected : '',
                inPath ? styles.tilePath : '',
                affected ? styles.tileAffected : '',
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
                    {tile.position.x + 1}.{tile.position.y + 1} · E{tile.elevation}
                  </span>
                  {placement ? (
                    <span
                      className={`${styles.unit} ${placement.combatantId.startsWith('character:') ? styles.unitPlayer : styles.unitOpponent} ${active ? styles.unitActive : ''}`}
                    >
                      <strong>{combatantLabel(placement.combatantId)}</strong>
                      <span className={styles.facing} aria-label={`Facing ${placement.facing}`}>
                        {facingGlyph(placement.facing)}
                      </span>
                      <small>
                        {combatant?.hp ?? 0}/{combatant?.maxHp ?? 0} HP
                      </small>
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
          <div className={styles.legend} aria-label="Battlefield legend">
            <span>
              <b>◆</b> Wayfarer
            </span>
            <span>
              <b>◇</b> Recruit
            </span>
            <span>
              <b>▧</b> Rough ground costs 2
            </span>
            <span>
              <b>↑</b> Facing matters
            </span>
          </div>
        </div>
      </section>

      <aside className={styles.inspector} aria-label="Context inspector">
        <div className={styles.panelHeading}>
          <span>Context</span>
          <strong>
            {selectedCombatant ? combatantLabel(selectedCombatant.id) : 'Selected tile'}
          </strong>
        </div>
        {selectedCombatant && selectedPlacement ? (
          <div className={styles.inspectorBody}>
            <div className={styles.vitals}>
              <span>
                HP{' '}
                <strong>
                  {selectedCombatant.hp}/{selectedCombatant.maxHp}
                </strong>
              </span>
              <span>
                MP{' '}
                <strong>
                  {selectedCombatant.mp}/{selectedCombatant.maxMp}
                </strong>
              </span>
            </div>
            <dl className={styles.detailList}>
              <div>
                <dt>Facing</dt>
                <dd>
                  {selectedPlacement.facing} {facingGlyph(selectedPlacement.facing)}
                </dd>
              </div>
              <div>
                <dt>Initiative</dt>
                <dd>{selectedCombatant.initiative}</dd>
              </div>
              <div>
                <dt>Movement</dt>
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
                <dd>{selectedProfile ? percentFromBasisPoints(selectedProfile.evasion) : '—'}</dd>
              </div>
            </dl>
            <div className={styles.statusList}>
              {selectedStatuses.length > 0 ? (
                selectedStatuses.map((status) => (
                  <span key={`${status.statusId}:${status.sourceCombatantId}`}>
                    {status.statusId} · {status.stacks} stack{status.stacks === 1 ? '' : 's'}
                  </span>
                ))
              ) : (
                <span>No active status effects</span>
              )}
            </div>
          </div>
        ) : selectedTile ? (
          <div className={styles.inspectorBody}>
            <dl className={styles.detailList}>
              <div>
                <dt>Position</dt>
                <dd>
                  {selectedTile.position.x + 1}, {selectedTile.position.y + 1}
                </dd>
              </div>
              <div>
                <dt>Terrain</dt>
                <dd>{selectedTile.terrainId}</dd>
              </div>
              <div>
                <dt>Elevation</dt>
                <dd>{selectedTile.elevation}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <p className={styles.emptyText}>Select a unit or tile to inspect it.</p>
        )}
      </aside>

      <section
        className={styles.turnEconomy}
        aria-label="Turn Economy Tracker"
        aria-busy={recruitPending}
      >
        <div className={styles.panelHeading}>
          <span>Turn Economy</span>
          <strong>
            {playerTurn ? 'Your turn' : recruitPending ? 'Recruit thinking' : 'Opponent turn'}
          </strong>
        </div>
        <div className={styles.economyGrid}>
          <div>
            <span>Movement</span>
            <strong>
              {currentTurn?.movementRemaining ?? 0}/{currentTurn?.movementMaximum ?? 0}
            </strong>
            <small>
              {preview?.preview.kind === 'move'
                ? `Preview cost ${preview.preview.cost}`
                : 'Position resource · does not normally spend Action'}
            </small>
          </div>
          <div>
            <span>Action</span>
            <strong>{actionReady ? 'READY' : 'SPENT'}</strong>
            <small>
              {preview?.preview.kind === 'action' && preview.preview.spendsAction
                ? 'Selected action spends it'
                : actionReady
                  ? 'Basic Attack or Guard can spend it'
                  : 'Attack and Guard unavailable this turn'}
            </small>
          </div>
          <div>
            <span>MP</span>
            <strong>
              {activeCombatant?.mp ?? 0}/{activeCombatant?.maxMp ?? 0}
            </strong>
            <small>
              {preview?.preview.kind === 'action'
                ? `Preview cost ${preview.preview.mpCost} MP`
                : 'No selected MP cost'}
            </small>
          </div>
          <div>
            <span>Final facing</span>
            <strong>
              {provisionalFacing} {facingGlyph(provisionalFacing)}
            </strong>
            <small>Provisional · commits with End Turn</small>
          </div>
        </div>
      </section>

      <section className={styles.commandDeck} aria-label="Command Deck">
        <p className={styles.emptyText} data-testid="combat-mode-instruction" aria-live="polite">
          {modeInstruction(mode, Boolean(actionReady), provisionalFacing)}
        </p>
        <div className={styles.commandRow}>
          <button
            type="button"
            className={mode === 'inspect' ? styles.commandActive : ''}
            onClick={() => chooseMode('inspect')}
          >
            <span>01</span>
            <strong>Inspect</strong>
            <small>No commitment</small>
          </button>
          <button
            type="button"
            className={mode === 'move' ? styles.commandActive : ''}
            onClick={() => chooseMode('move')}
            disabled={planningDisabled}
          >
            <span>02</span>
            <strong>Move</strong>
            <small>
              {planningDisabled
                ? 'Unavailable outside your turn'
                : 'Position only · Action stays available'}
            </small>
          </button>
          <button
            type="button"
            className={mode === 'attack' ? styles.commandActive : ''}
            onClick={() => chooseMode('attack')}
            disabled={planningDisabled || !actionReady}
          >
            <span>03</span>
            <strong>Basic Attack</strong>
            <small>
              {planningDisabled
                ? 'Unavailable outside your turn'
                : actionReady
                  ? 'Choose one enemy'
                  : 'Action already spent'}
            </small>
          </button>
          <button
            type="button"
            className={mode === 'guard' ? styles.commandActive : ''}
            onClick={() => chooseMode('guard')}
            disabled={planningDisabled || !actionReady}
          >
            <span>04</span>
            <strong>Guard</strong>
            <small>
              {planningDisabled
                ? 'Unavailable outside your turn'
                : actionReady
                  ? 'Spend Action defensively'
                  : 'Action already spent'}
            </small>
          </button>
          <button
            type="button"
            className={mode === 'end-turn' ? styles.commandActive : ''}
            onClick={() => chooseMode('end-turn')}
            disabled={planningDisabled}
          >
            <span>05</span>
            <strong>End Turn</strong>
            <small>
              {planningDisabled
                ? 'Unavailable outside your turn'
                : `Facing required · defaults ${facingGlyph(provisionalFacing)} · review then Confirm`}
            </small>
          </button>
        </div>

        <div className={styles.facingRow} aria-label="Final facing controls">
          <span>Facing · WASD / arrows while preparing End Turn</span>
          {(['north', 'east', 'south', 'west'] as const).map((facing) => (
            <button
              key={facing}
              type="button"
              onClick={() => previewFacing(facing)}
              disabled={planningDisabled}
              aria-label={`Face ${facing}`}
              aria-pressed={provisionalFacing === facing}
            >
              {facingGlyph(facing)} <small>{facing.slice(0, 1).toUpperCase()}</small>
            </button>
          ))}
        </div>

        <div className={styles.forecast} aria-live="polite">
          <div>
            <span>Planning</span>
            <strong>
              {previewPending
                ? 'Checking…'
                : mode === 'end-turn' && finalTurnPreview
                  ? finalTurnPreview.legal
                    ? 'Ready to end'
                    : 'Blocked'
                  : preview
                    ? preview.preview.legal
                      ? 'Legal'
                      : 'Blocked'
                    : 'No preview'}
            </strong>
          </div>
          {preview?.preview.kind === 'action' ? (
            <>
              <div>
                <span>Hit chance</span>
                <strong>{percentFromBasisPoints(preview.preview.hitChanceBasisPoints)}</strong>
              </div>
              <div>
                <span>Base damage after {preview.preview.defenseKind ?? 'defense'}</span>
                <strong>{preview.preview.mitigatedBaseDamage ?? '—'}</strong>
              </div>
            </>
          ) : null}
          {preview?.preview.kind === 'move' ? (
            <div>
              <span>Movement after</span>
              <strong>{preview.preview.movementRemainingAfter}</strong>
            </div>
          ) : null}
          {mode === 'end-turn' && finalTurnPreview ? (
            <div>
              <span>Facing at commit</span>
              <strong>
                {finalTurnPreview.facing} {facingGlyph(finalTurnPreview.facing)}
              </strong>
            </div>
          ) : null}
          <p>
            {mode === 'end-turn'
              ? (finalTurnPreview?.issues[0]?.message ??
                'Facing and End Turn commit together as one authoritative command.')
              : (preview?.preview.issues[0]?.message ??
                'Forecasts describe the current rules; probabilistic outcomes are not guaranteed.')}
          </p>
        </div>

        <div className={styles.commitRow}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={() => {
              resetPlanning()
              setNotice('Planning cleared. No command was committed.')
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

      <footer className={styles.eventTicker} aria-live="polite">
        <span className={styles.connectionDot} aria-hidden="true" />
        <strong>Authority</strong>
        <p>{notice}</p>
        <BattleLogPanel
          battleSessionId={battle.battleSessionId}
          battleVersion={battle.battleVersion}
        />
        <button
          type="button"
          onClick={() => {
            recruitAttemptedVersion.current = null
            void refreshBattle()
          }}
          disabled={commitPending || recruitPending}
        >
          Refetch
        </button>
      </footer>
    </main>
  )
}
