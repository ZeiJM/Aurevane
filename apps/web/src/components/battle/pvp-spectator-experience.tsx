'use client'

import type { CharacterPortraitRef } from '@aurevane/game-core/character/creation'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'

import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import { PvpBattleChat } from '@/components/battle/pvp-battle-chat'
import { getStarterPortraitImageAssetId } from '@/media/character'
import type { PvpBattleParticipantView, PvpSpectatorView } from '@/server/battle/pvp-lobby-service'

import styles from './pvp-spectator-experience.module.css'

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

function meterPercent(value: number, maximum: number): number {
  if (maximum <= 0) return 0
  return Math.max(0, Math.min(100, (value / maximum) * 100))
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

  const battle = spectator.battle
  const tactical = battle.snapshot.tactical
  const battleState = tactical.battle
  const teamCount = spectator.mode === '1v1v1' ? 3 : 2
  const participantByCombatant = useMemo(
    () =>
      new Map(spectator.participants.map((participant) => [participant.combatantId, participant])),
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

  const boardStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${tactical.width}, minmax(0, 1fr))`,
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
          if (!cancelled) setConnectionNote(body.error?.message ?? 'Arena link interrupted. Retrying…')
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

  return (
    <main className={styles.page} data-pvp-spectator="true">
      <header className={styles.header}>
        <div>
          <span>Battle Hall · Spectator</span>
          <h1>{winner ? `${teamName(winner.teamIndex)} wins.` : 'Live PvP broadcast'}</h1>
          <p>{connectionNote}</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.keyButton} onClick={() => void copySpectatorKey()}>
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
              <span>{team.standing}/{team.members.length} standing</span>
            </div>
            <div className={styles.teamMeter} aria-label={`${teamName(team.teamIndex)} health`}>
              <i style={{ width: `${meterPercent(team.hp, team.maxHp)}%` }} />
            </div>
            <small>{team.hp}/{team.maxHp} team HP</small>
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
                  <span>HP {activeCombatant.hp}/{activeCombatant.maxHp}</span>
                  <span>MP {activeCombatant.mp}/{activeCombatant.maxMp}</span>
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
              <div>
                <dt>Status</dt>
                <dd>{battleState.lifecycle === 'active' ? 'Live' : 'Complete'}</dd>
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
                const placement = placementByTile.get(positionKey(tile.position))
                const participant = placement
                  ? participantByCombatant.get(placement.combatantId)
                  : undefined
                const combatant = placement
                  ? battleState.combatants.find((candidate) => candidate.id === placement.combatantId)
                  : undefined
                return (
                  <div
                    className={styles.tile}
                    data-terrain={tile.terrainId}
                    data-elevation={tile.elevation}
                    key={positionKey(tile.position)}
                    aria-label={`Tile ${tile.position.x + 1}, ${tile.position.y + 1}${participant ? ` occupied by ${participant.characterName}` : ''}`}
                  >
                    {tile.elevation > 0 ? <small className={styles.elevation}>+{tile.elevation}</small> : null}
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
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <PvpBattleChat
          battleSessionId={battle.battleSessionId}
          readOnly
          showBattleLog
          className={styles.comms}
        />
      </section>
    </main>
  )
}
