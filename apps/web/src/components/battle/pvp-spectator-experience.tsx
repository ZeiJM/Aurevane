'use client'

import { BattleRouteFrame } from './battle-route-frame'

import { BattleTerrainToggle } from './battle-terrain-toggle'
import { battleTerrainName } from './battle-terrain-key-presentation'
import { BattleCombatantCard } from './battle-combatant-card'
import { BattleVersusEmblem } from './battle-versus-emblem'
import { BattleLogPanel } from './battle-log-panel'
import { BattleChronicleHeading } from './battle-chronicle-heading'
import type { BattlePresentationParticipant } from './battle-runtime'

import { terrainOverlayAt } from '@aurevane/game-core/combat/terrain-overlays'
import { PV1F_MOVEMENT_COST_PER_TERRAIN_POINT } from '@aurevane/game-core/combat/pv1f-skills'
import { terrainOverlayDescription } from '../../lib/battle/combat-interaction-presentation'

import type { CharacterPortraitRef } from '@aurevane/game-core/character/creation'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'

import { DesktopBattleCombatantInspect } from '@/components/battle/desktop-battle-combatant-inspect'
import { PvpBattleChat } from '@/components/battle/pvp-battle-chat'
import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import { getStarterPortraitImageAssetId } from '@/media/character'
import type { PvpBattleParticipantView, PvpSpectatorView } from '@/server/battle/pvp-lobby-service'

import styles from './pvp-spectator-experience.module.css'

const MOVE_COST_PER_TERRAIN_POINT = PV1F_MOVEMENT_COST_PER_TERRAIN_POINT
const SPECTATOR_REFRESH_MS = 850

type GridPosition = { x: number; y: number }
type Facing = 'north' | 'east' | 'south' | 'west'

type ApiBody = {
  spectator?: PvpSpectatorView
  participantTitles?: Record<string, string | null>
  error?: { message?: string }
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

function teamName(teamIndex: number): string {
  return `Team ${teamIndex + 1}`
}

function participantName(
  participants: ReadonlyMap<string, PvpBattleParticipantView>,
  combatantId: string | null | undefined,
): string {
  if (!combatantId) return 'Awaiting next activation'
  return participants.get(combatantId)?.characterName ?? 'Unknown combatant'
}

function terrainPresentation(terrainId: string): 'rough' | 'open' {
  return terrainId.includes('rough') || terrainId.includes('difficult') ? 'rough' : 'open'
}

export function PvpSpectatorExperience({
  initialSpectator,
  initialParticipantTitles,
}: {
  initialSpectator: PvpSpectatorView
  initialParticipantTitles: Record<string, string | null>
}) {
  const [spectator, setSpectator] = useState(initialSpectator)
  const [participantTitles, setParticipantTitles] = useState(initialParticipantTitles)
  const [connectionNote, setConnectionNote] = useState<string | null>(null)
  const [copyNotice, setCopyNotice] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [inspectMode, setInspectMode] = useState(false)
  const [selectedCombatantId, setSelectedCombatantId] = useState<string | null>(null)
  const [selectedPosition, setSelectedPosition] = useState<GridPosition | null>(null)

  const battle = spectator.battle
  const tactical = battle.snapshot.tactical
  const battleState = tactical.battle
  const teamCount = spectator.mode === '1v1v1' ? 3 : 2
  const participantByCombatant = useMemo(
    () =>
      new Map(spectator.participants.map((participant) => [participant.combatantId, participant])),
    [spectator.participants],
  )
  const combatantNames = useMemo(
    () =>
      Object.fromEntries(
        spectator.participants.map((participant) => [
          participant.combatantId,
          participant.characterName,
        ]),
      ),
    [spectator.participants],
  )
  const presentationParticipants: BattlePresentationParticipant[] = spectator.participants.map(
    (participant) => ({
      combatantId: participant.combatantId,
      characterId: participant.characterId,
      name: participant.characterName,
      level: participant.characterLevel,
      teamIndex: participant.teamIndex,
      seatIndex: participant.seatIndex,
      profileImageUrl: participant.profileImageUrl,
      portraitAssetId: getStarterPortraitImageAssetId(
        participant.portraitRef as CharacterPortraitRef,
      ),
      local: false,
    }),
  )
  const inspectMetadata = useMemo(
    () => ({ participants: spectator.participants }),
    [spectator.participants],
  )
  const placementByTile = useMemo(
    () =>
      new Map(
        tactical.placements.map(
          (placement) => [positionKey(placement.position), placement] as const,
        ),
      ),
    [tactical.placements],
  )
  const activeCombatantId = battleState.currentTurn?.combatantId ?? null
  const activeParticipant = activeCombatantId
    ? (participantByCombatant.get(activeCombatantId) ?? null)
    : null
  const actingTeamIndex = activeParticipant?.teamIndex ?? presentationParticipants[0]?.teamIndex
  const activeCombatant = activeCombatantId
    ? (battleState.combatants.find((combatant) => combatant.id === activeCombatantId) ?? null)
    : null
  const selectedTile = selectedPosition
    ? (tactical.tiles.find((tile) => positionsEqual(tile.position, selectedPosition)) ?? null)
    : null
  const selectedPlacement = selectedPosition
    ? (placementByTile.get(positionKey(selectedPosition)) ?? null)
    : null
  const selectedTerrain = selectedTile
    ? (tactical.terrains.find((terrain) => terrain.id === selectedTile.terrainId) ?? null)
    : null

  const boardStyle = {
    gridTemplateColumns: `repeat(${tactical.width}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${tactical.height}, minmax(0, 1fr))`,
    aspectRatio: `${tactical.width} / ${tactical.height}`,
    '--battle-columns': tactical.width,
  } as CSSProperties

  const teamSummaries = Array.from({ length: teamCount }, (_, teamIndex) => {
    const members = spectator.participants.filter(
      (participant) => participant.teamIndex === teamIndex,
    )
    let standing = 0
    for (const member of members) {
      const combatant = battleState.combatants.find(
        (candidate) => candidate.id === member.combatantId,
      )
      if (combatant && combatant.hp > 0) standing += 1
    }
    return { teamIndex, members, standing }
  })

  const livingTeams = teamSummaries.filter((team) => team.standing > 0)
  const winner =
    battleState.lifecycle === 'completed' && livingTeams.length === 1 ? livingTeams[0] : null
  const draw = battleState.lifecycle === 'completed' && winner === null

  useEffect(() => {
    let cancelled = false
    let timer: number | null = null
    let controller: AbortController | null = null

    const schedule = () => {
      if (cancelled) return
      timer = window.setTimeout(() => void refresh(), SPECTATOR_REFRESH_MS)
    }

    const refresh = async () => {
      controller = new AbortController()

      try {
        const response = await fetch(
          `/api/pvp/spectate/${encodeURIComponent(spectator.battleKey)}`,
          { cache: 'no-store', signal: controller.signal },
        )
        const body = (await response.json()) as ApiBody
        if (!response.ok || !body.spectator || cancelled || controller.signal.aborted) {
          if (!cancelled) {
            setConnectionNote(body.error?.message ?? 'Arena link interrupted. Retrying…')
          }
          return
        }
        setSpectator(body.spectator)
        if (body.participantTitles) setParticipantTitles(body.participantTitles)
        setConnectionNote(null)
      } catch (refreshError) {
        if (
          !cancelled &&
          !(refreshError instanceof DOMException && refreshError.name === 'AbortError')
        ) {
          setConnectionNote('Arena link interrupted. Retrying…')
        }
      } finally {
        controller = null
        schedule()
      }
    }

    schedule()
    return () => {
      cancelled = true
      controller?.abort()
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [spectator.battleKey])

  async function stopSpectating() {
    if (stopping) return
    setStopping(true)
    try {
      const response = await fetch(`/api/pvp/spectate/${encodeURIComponent(spectator.battleKey)}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const body = (await response.json()) as ApiBody
        setConnectionNote(body.error?.message ?? 'Spectator state could not be cleared.')
        setStopping(false)
        return
      }
      window.location.replace('/game/battle')
    } catch {
      setConnectionNote('Spectator state could not be cleared. Try again.')
      setStopping(false)
    }
  }

  async function copySpectatorKey() {
    try {
      await navigator.clipboard.writeText(spectator.battleKey)
      setCopyNotice(true)
      window.setTimeout(() => setCopyNotice(false), 1500)
    } catch {
      setConnectionNote('Clipboard access is unavailable.')
    }
  }

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('aurevane:battle-state', { detail: battle }))
  }, [battle])

  function toggleInspect() {
    setInspectMode((current) => {
      const next = !current
      if (!next) setSelectedPosition(null)
      return next
    })
  }

  function inspectContext() {
    if (!inspectMode) {
      return (
        <>
          <strong>Read-only battlefield</strong>
          <span>
            Use Inspect to examine a combatant or terrain tile without affecting the battle.
          </span>
        </>
      )
    }

    if (selectedTile && !selectedPlacement) {
      const terrainName = battleTerrainName(selectedTile.terrainId, selectedTile.elevation)
      const traversalCost = selectedTerrain?.traversalCost ?? null
      return (
        <>
          <strong>
            {terrainName} · Tile {selectedTile.position.x + 1},{selectedTile.position.y + 1}
          </strong>
          <span>
            Base entry cost{' '}
            {traversalCost === null
              ? 'blocked'
              : `${traversalCost * MOVE_COST_PER_TERRAIN_POINT} AP`}{' '}
            · Elevation {selectedTile.elevation}.{' '}
            {terrainOverlayDescription(terrainOverlayAt(battle.snapshot, selectedTile.position))}
          </span>
        </>
      )
    }

    return (
      <>
        <strong>Inspect</strong>
        <span>
          Click an occupied combatant for the full Inspect window, or an empty tile for terrain.
        </span>
      </>
    )
  }

  return (
    <BattleRouteFrame sessionHref={`/game/battle/spectate/${spectator.battleKey}`} spectating>
      <main
        data-battle-concept="true"
        data-battle-layout="refined"
        className={styles.page}
        data-pvp-spectator="true"
        data-spectator-inspect-active={inspectMode || undefined}
      >
        <header className={styles.header}>
          <div>
            <span>Battle Hall · Spectator</span>
            <h1>
              {winner
                ? `${teamName(winner.teamIndex)} wins.`
                : draw
                  ? 'Draw.'
                  : 'Live PvP broadcast'}
            </h1>
            {connectionNote ? <p>{connectionNote}</p> : null}
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.keyButton}
              onClick={() => void copySpectatorKey()}
            >
              <small>{copyNotice ? 'Copied!' : 'Spectator Key · click to copy'}</small>
              <strong>{spectator.battleKey}</strong>
            </button>
            <button
              type="button"
              className={styles.stopButton}
              disabled={stopping}
              onClick={() => void stopSpectating()}
            >
              {stopping ? 'Stopping…' : 'Stop Spectating'}
            </button>
          </div>
        </header>

        <section
          className={styles.broadcast}
          data-spectator-broadcast="true"
          aria-label="PvP team status"
        >
          <aside
            className={styles.localSide}
            data-battle-side="local"
            aria-label="Acting character"
          >
            <BattleCombatantCard
              participant={
                presentationParticipants.find((item) => item.combatantId === activeCombatantId) ??
                presentationParticipants[0] ??
                null
              }
              battle={battle}
              teamCount={teamCount}
              role="acting"
            />
            {presentationParticipants.some((item) => item.teamIndex !== actingTeamIndex) ? (
              <BattleVersusEmblem />
            ) : null}
            {activeParticipant && participantTitles[activeParticipant.characterId] ? (
              <small className={styles.actorTitle}>
                {participantTitles[activeParticipant.characterId]}
              </small>
            ) : null}
            <BattleCombatantCard
              participant={
                presentationParticipants.find(
                  (item) =>
                    item.combatantId === selectedCombatantId && item.teamIndex !== actingTeamIndex,
                ) ??
                presentationParticipants.find((item) => item.teamIndex !== actingTeamIndex) ??
                null
              }
              battle={battle}
              teamCount={teamCount}
              role="selected"
            />
          </aside>

          <section
            id="battlefield"
            className={styles.battlefieldWrap}
            aria-label="Live battlefield"
          >
            <div
              className={styles.battlefieldHeader}
              data-active-hp={
                activeCombatant ? `${activeCombatant.hp}/${activeCombatant.maxHp}` : '—'
              }
            >
              <div>
                <span>Battlefield</span>
                <strong>{participantName(participantByCombatant, activeCombatantId)}</strong>
              </div>
              <small>Read-only tactical view</small>
            </div>
            <div className={styles.boardScroller} data-battlefield-backdrop="true">
              <div
                className={styles.board}
                style={boardStyle}
                data-board-auto-fit={`${tactical.width}x${tactical.height}`}
              >
                {tactical.tiles.map((tile) => {
                  const key = positionKey(tile.position)
                  const placement = placementByTile.get(key)
                  const participant = placement
                    ? participantByCombatant.get(placement.combatantId)
                    : undefined
                  const combatant = placement
                    ? battleState.combatants.find(
                        (candidate) => candidate.id === placement.combatantId,
                      )
                    : undefined
                  const terrain = terrainPresentation(tile.terrainId)
                  const overlay = terrainOverlayAt(battle.snapshot, tile.position)
                  const x = tile.position.x + 1
                  const y = tile.position.y + 1
                  const selected = Boolean(
                    inspectMode &&
                    selectedPosition &&
                    positionsEqual(tile.position, selectedPosition),
                  )

                  return (
                    <button
                      type="button"
                      className={styles.tile}
                      data-terrain={terrain}
                      data-terrain-overlay={overlay?.kind}
                      data-elevation={tile.elevation > 0 || undefined}
                      data-inspect-active={inspectMode || undefined}
                      data-selected={selected || undefined}
                      key={key}
                      onClick={() => {
                        if (placement && participant?.teamIndex !== actingTeamIndex)
                          setSelectedCombatantId(placement.combatantId)
                        if (inspectMode) setSelectedPosition({ ...tile.position })
                      }}
                      aria-label={`Tile ${x}, ${y}; ${tile.terrainId}; elevation ${tile.elevation}${participant ? `; occupied by ${participant.characterName}` : ''}${overlay ? `; ${terrainOverlayDescription(overlay)}` : ''}`}
                      aria-pressed={selected}
                    >
                      {overlay ? (
                        <i data-terrain-overlay-marker="true" aria-hidden="true">
                          {overlay.kind === 'frozen' ? '❄' : '≋'}
                          {overlay.remainingRoundBoundaries}
                        </i>
                      ) : null}
                      {participant && placement ? (
                        <span
                          className={styles.unit}
                          data-team={participant.teamIndex}
                          data-active={placement.combatantId === activeCombatantId || undefined}
                          data-defeated={combatant?.hp === 0 || undefined}
                          data-desktop-inspect-combatant={placement.combatantId}
                          title={`${participant.characterName} · ${teamName(participant.teamIndex)}`}
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
                          <i>{facingGlyph(placement.facing as Facing)}</i>
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          <aside
            className={styles.selectedSide}
            data-battle-side="selected"
            aria-label="Battle Chronicle"
          >
            <BattleChronicleHeading round={battleState.round} />
            <BattleLogPanel
              presentation="inline"
              battleSessionId={battle.battleSessionId}
              battleVersion={battle.battleVersion}
              combatantNames={combatantNames}
              currentRound={battleState.round}
              recentTurnCount={2}
            />
          </aside>
          <div className={styles.preview} data-battle-preview-strip="true">
            <div data-battle-spectator-preview-content="true">{inspectContext()}</div>
          </div>
          <div className={styles.inspectDock} data-battle-command-dock="true">
            <button type="button" aria-pressed={inspectMode} onClick={toggleInspect}>
              Inspect
            </button>
            <span>Read-only battlefield · Select a character to view its current state.</span>
            <div className={styles.terrainControl}>
              <BattleTerrainToggle snapshot={battle.snapshot} />
            </div>
            <details className={styles.chatDock}>
              <summary>Battle Chat</summary>
              <PvpBattleChat
                battleSessionId={battle.battleSessionId}
                readOnly={false}
                combatantNames={combatantNames}
                className={styles.comms}
              />
            </details>
          </div>
        </section>
      </main>
      <DesktopBattleCombatantInspect
        battleSessionId={battle.battleSessionId}
        pvpMetadata={inspectMetadata}
        battleView={battle}
      />
    </BattleRouteFrame>
  )
}
