'use client'

import type { CharacterPortraitRef } from '@aurevane/game-core/character/creation'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'

import { BattleLogFeed } from '@/components/battle/battle-log-feed'
import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import { PvpBattleChat } from '@/components/battle/pvp-battle-chat'
import { getStarterPortraitImageAssetId } from '@/media/character'
import type { BattleLogView } from '@/server/battle/battle-log-service'
import type { PvpBattleParticipantView, PvpSpectatorView } from '@/server/battle/pvp-lobby-service'

import styles from './pvp-spectator-experience.module.css'

const MOVE_COST_PER_TERRAIN_POINT = 25

type GridPosition = { x: number; y: number }
type Facing = 'north' | 'east' | 'south' | 'west'

type ApiBody = {
  spectator?: PvpSpectatorView
  participantTitles?: Record<string, string | null>
  battleLog?: BattleLogView
  error?: { message?: string }
}

function positionKey(position: GridPosition): string {
  return `${position.x}:${position.y}`
}

function positionsEqual(left: GridPosition, right: GridPosition): boolean {
  return left.x === right.x && left.y === right.y
}

function meterPercent(value: number, maximum: number): number {
  if (maximum <= 0) return 0
  return Math.max(0, Math.min(100, (value / maximum) * 100))
}

function percentFromBasisPoints(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${Math.round(value / 100)}%`
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
  const router = useRouter()
  const [spectator, setSpectator] = useState(initialSpectator)
  const [participantTitles, setParticipantTitles] = useState(initialParticipantTitles)
  const [connectionNote, setConnectionNote] = useState('Live arena link established.')
  const [copyNotice, setCopyNotice] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [battleLog, setBattleLog] = useState<BattleLogView | null>(null)
  const [battleLogError, setBattleLogError] = useState<string | null>(null)
  const [inspectMode, setInspectMode] = useState(false)
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
  const activeCombatant = activeCombatantId
    ? (battleState.combatants.find((combatant) => combatant.id === activeCombatantId) ?? null)
    : null
  const selectedTile = selectedPosition
    ? (tactical.tiles.find((tile) => positionsEqual(tile.position, selectedPosition)) ?? null)
    : null
  const selectedPlacement = selectedPosition
    ? (placementByTile.get(positionKey(selectedPosition)) ?? null)
    : null
  const selectedParticipant = selectedPlacement
    ? (participantByCombatant.get(selectedPlacement.combatantId) ?? null)
    : null
  const selectedCombatant = selectedPlacement
    ? (battleState.combatants.find(
        (combatant) => combatant.id === selectedPlacement.combatantId,
      ) ?? null)
    : null
  const selectedProfile = selectedPlacement
    ? (battle.snapshot.statBridge.combatants.find(
        (profile) => profile.combatantId === selectedPlacement.combatantId,
      ) ?? null)
    : null
  const selectedTerrain = selectedTile
    ? (tactical.terrains.find((terrain) => terrain.id === selectedTile.terrainId) ?? null)
    : null

  const boardStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${tactical.width}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${tactical.height}, minmax(0, 1fr))`,
    aspectRatio: `${tactical.width} / ${tactical.height}`,
  }

  const teamSummaries = Array.from({ length: teamCount }, (_, teamIndex) => {
    const members = spectator.participants.filter(
      (participant) => participant.teamIndex === teamIndex,
    )
    let hp = 0
    let maxHp = 0
    let standing = 0
    for (const member of members) {
      const combatant = battleState.combatants.find(
        (candidate) => candidate.id === member.combatantId,
      )
      if (!combatant) continue
      hp += combatant.hp
      maxHp += combatant.maxHp
      if (combatant.hp > 0) standing += 1
    }
    return { teamIndex, members, hp, maxHp, standing }
  })

  const livingTeams = teamSummaries.filter((team) => team.standing > 0)
  const winner =
    battleState.lifecycle === 'completed' && livingTeams.length === 1 ? livingTeams[0] : null

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      try {
        const response = await fetch(
          `/api/pvp/spectate/${encodeURIComponent(spectator.battleKey)}`,
          { cache: 'no-store' },
        )
        const body = (await response.json()) as ApiBody
        if (!response.ok || !body.spectator || cancelled) {
          if (!cancelled)
            setConnectionNote(body.error?.message ?? 'Arena link interrupted. Retrying…')
          return
        }
        setSpectator(body.spectator)
        if (body.participantTitles) setParticipantTitles(body.participantTitles)
        setConnectionNote(
          body.spectator.battle.snapshot.tactical.battle.lifecycle === 'completed'
            ? 'Match complete · committed state retained.'
            : 'Live arena link established.',
        )
      } catch {
        if (!cancelled) setConnectionNote('Arena link interrupted. Retrying…')
      }
    }
    const timer = window.setInterval(() => void refresh(), 850)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [spectator.battleKey])

  useEffect(() => {
    let cancelled = false
    let timer: number | null = null

    const refreshLog = async () => {
      try {
        const params = new URLSearchParams({ after: '0', includeLog: '1' })
        const response = await fetch(
          `/api/pvp/battles/${encodeURIComponent(battle.battleSessionId)}/chat?${params.toString()}`,
          { cache: 'no-store' },
        )
        const body = (await response.json()) as ApiBody
        if (cancelled) return
        if (!response.ok) {
          setBattleLogError(body.error?.message ?? 'Battle log is temporarily unavailable.')
          return
        }
        if (body.battleLog) setBattleLog(body.battleLog)
        setBattleLogError(null)
      } catch {
        if (!cancelled) setBattleLogError('Battle log interrupted. Retrying…')
      }
    }

    void refreshLog()
    timer = window.setInterval(() => void refreshLog(), 1200)
    return () => {
      cancelled = true
      if (timer !== null) window.clearInterval(timer)
    }
  }, [battle.battleSessionId])

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
      router.push('/game/battle')
      router.refresh()
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
          <span>Use Inspect to examine any combatant or tile without affecting the battle.</span>
        </>
      )
    }

    if (selectedCombatant && selectedPlacement && selectedProfile) {
      return (
        <>
          <strong>{selectedParticipant?.characterName ?? selectedCombatant.id}</strong>
          <span>
            Initiative {selectedCombatant.initiative} · Movement{' '}
            {selectedCombatant.baseMovementBudget} · Jump {selectedProfile.jump} · Armor{' '}
            {selectedProfile.armor} · Evasion {percentFromBasisPoints(selectedProfile.evasion)} ·
            Facing {selectedPlacement.facing} {facingGlyph(selectedPlacement.facing as Facing)}
          </span>
        </>
      )
    }

    if (selectedTile) {
      const terrainName = terrainPresentation(selectedTile.terrainId) === 'rough'
        ? 'Difficult ground'
        : 'Open ground'
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
            · Elevation {selectedTile.elevation}.
          </span>
        </>
      )
    }

    return (
      <>
        <strong>Inspect</strong>
        <span>Click any tile or combatant to read its tactical details here.</span>
      </>
    )
  }

  return (
    <main className={styles.page} data-pvp-spectator="true">
      <header className={styles.header}>
        <div>
          <span>Battle Hall · Spectator</span>
          <h1>{winner ? `${teamName(winner.teamIndex)} wins.` : 'Live PvP broadcast'}</h1>
          <p>{connectionNote}</p>
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

      <section className={styles.scoreboard} aria-label="PvP team status">
        {teamSummaries.map((team) => (
          <article className={styles.teamCard} key={team.teamIndex} data-team={team.teamIndex}>
            <div className={styles.teamHeading}>
              <strong>{teamName(team.teamIndex)}</strong>
              <span>
                {team.standing}/{team.members.length} standing
              </span>
            </div>
            <div className={styles.teamMeter} aria-label={`${teamName(team.teamIndex)} health`}>
              <i style={{ width: `${meterPercent(team.hp, team.maxHp)}%` }} />
            </div>
            <div className={styles.teamMembers}>
              {team.members.map((member) => {
                const combatant = battleState.combatants.find(
                  (candidate) => candidate.id === member.combatantId,
                )
                const active = member.combatantId === activeCombatantId
                return (
                  <div
                    className={styles.member}
                    data-active={active || undefined}
                    data-defeated={combatant?.hp === 0 || undefined}
                    key={member.characterId}
                  >
                    <CharacterPortraitImage
                      imageUrl={member.profileImageUrl}
                      fallbackAssetId={getStarterPortraitImageAssetId(
                        member.portraitRef as CharacterPortraitRef,
                      )}
                      className={styles.memberPortrait}
                      sizes="42px"
                      alt=""
                    />
                    <span>
                      <strong>{member.characterName}</strong>
                      <small>
                        Level {member.characterLevel}
                        {participantTitles[member.characterId]
                          ? ` · ${participantTitles[member.characterId]}`
                          : ''}
                      </small>
                    </span>
                  </div>
                )
              })}
            </div>
          </article>
        ))}
      </section>

      <section className={styles.broadcast}>
        <aside className={styles.controlRail} aria-label="Spectator match context">
          <article className={styles.actingCard}>
            <span>Now Acting</span>
            <strong>{activeParticipant?.characterName ?? 'Match complete'}</strong>
            {activeCombatant && activeParticipant ? (
              <>
                <small>{teamName(activeParticipant.teamIndex)}</small>
                <div className={styles.resourceLine}>
                  <span>
                    HP {activeCombatant.hp}/{activeCombatant.maxHp}
                  </span>
                  <span>
                    MP {activeCombatant.mp}/{activeCombatant.maxMp}
                  </span>
                </div>
              </>
            ) : null}
          </article>
          <article className={styles.pulseCard}>
            <span>Match Pulse</span>
            <dl>
              <div>
                <dt>Round</dt>
                <dd>{battleState.round}</dd>
              </div>
              <div>
                <dt>Activation</dt>
                <dd>{battleState.turnNumber}</dd>
              </div>
              <div>
                <dt>Format</dt>
                <dd>{spectator.mode.toUpperCase()}</dd>
              </div>
            </dl>
          </article>
        </aside>

        <section className={styles.battlefieldWrap} aria-label="Live battlefield">
          <div className={styles.battlefieldHeader}>
            <div>
              <span>Battlefield</span>
              <strong>{participantName(participantByCombatant, activeCombatantId)}</strong>
            </div>
            <small>Read-only tactical view</small>
          </div>
          <div className={styles.boardScroller}>
            <div className={styles.board} style={boardStyle}>
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
                const x = tile.position.x + 1
                const y = tile.position.y + 1
                const selected = Boolean(
                  inspectMode && selectedPosition && positionsEqual(tile.position, selectedPosition),
                )

                return (
                  <button
                    type="button"
                    className={styles.tile}
                    data-terrain={terrain}
                    data-elevation={tile.elevation > 0 || undefined}
                    data-inspect-active={inspectMode || undefined}
                    data-selected={selected || undefined}
                    key={key}
                    onClick={() => {
                      if (inspectMode) setSelectedPosition({ ...tile.position })
                    }}
                    aria-label={`Tile ${x}, ${y}; ${terrain} ground; elevation ${tile.elevation}${participant ? `; occupied by ${participant.characterName}` : ''}`}
                    aria-pressed={selected}
                  >
                    <span className={styles.tileMeta}>
                      {x}.{y}
                      {terrain === 'rough' ? <b>R50</b> : null}
                      {tile.elevation > 0 ? <b>▲{tile.elevation}</b> : null}
                    </span>
                    {participant && placement ? (
                      <span
                        className={styles.unit}
                        data-team={participant.teamIndex}
                        data-active={placement.combatantId === activeCombatantId || undefined}
                        data-defeated={combatant?.hp === 0 || undefined}
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
          <div className={styles.inspectDeck} aria-label="Spectator inspect controls">
            <button
              type="button"
              className={styles.inspectButton}
              data-active={inspectMode || undefined}
              aria-pressed={inspectMode}
              onClick={toggleInspect}
            >
              <span>00</span>
              <strong>Inspect</strong>
              <small>Free</small>
            </button>
            <div className={styles.inspectContext}>{inspectContext()}</div>
          </div>
          <div className={styles.legend} aria-label="Terrain legend">
            <span className={styles.terrainKey}>
              <i className={styles.roughKey} aria-hidden="true" />
              <span>
                <b>Difficult Ground</b>
                <small>Higher movement cost</small>
              </span>
            </span>
            <span className={styles.terrainKey}>
              <i className={styles.raisedKey} aria-hidden="true">
                ▲
              </i>
              <span>
                <b>Raised Ground</b>
                <small>Elevation +1</small>
              </span>
            </span>
          </div>
        </section>

        <div className={styles.commsStack}>
          <PvpBattleChat
            battleSessionId={battle.battleSessionId}
            readOnly
            combatantNames={combatantNames}
            className={styles.comms}
          />
          <section className={styles.battleLogPanel} aria-label="Spectator battle log">
            <header className={styles.battleLogHeader}>
              <div>
                <strong>Battle Log</strong>
                <small>Rounds · actions · outcomes</small>
              </div>
            </header>
            <div className={styles.battleLogBody} aria-live="polite">
              {battleLogError ? (
                <p className={styles.battleLogNotice} role="status">
                  {battleLogError}
                </p>
              ) : (
                <BattleLogFeed
                  entries={battleLog?.entries ?? []}
                  combatantNames={combatantNames}
                  emptyMessage="No committed battle actions yet."
                />
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}
