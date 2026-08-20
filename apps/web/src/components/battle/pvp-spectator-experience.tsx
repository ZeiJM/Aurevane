'use client'

import type { CharacterPortraitRef } from '@aurevane/game-core/character/creation'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'

import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import { getStarterPortraitImageAssetId } from '@/media/character'
import type { PvpBattleParticipantView, PvpSpectatorView } from '@/server/battle/pvp-lobby-service'

import styles from './pvp-spectator-experience.module.css'

type GridPosition = { x: number; y: number }
type Facing = 'north' | 'east' | 'south' | 'west'

type ApiBody = {
  spectator?: PvpSpectatorView
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

function teamName(teamIndex: number, teamCount: number): string {
  if (teamCount === 3) return `Faction ${String.fromCharCode(65 + teamIndex)}`
  return teamIndex === 0 ? 'Vanguard' : 'Challengers'
}

function participantName(
  participants: ReadonlyMap<string, PvpBattleParticipantView>,
  combatantId: string | null | undefined,
): string {
  if (!combatantId) return 'Awaiting result'
  return participants.get(combatantId)?.characterName ?? 'Unknown combatant'
}

export function PvpSpectatorExperience({
  initialSpectator,
}: {
  initialSpectator: PvpSpectatorView
}) {
  const router = useRouter()
  const [spectator, setSpectator] = useState(initialSpectator)
  const [connectionNote, setConnectionNote] = useState('Live arena link established.')
  const [copyNotice, setCopyNotice] = useState(false)

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
    if (battleState.lifecycle !== 'active') return
    let cancelled = false
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(
          `/api/pvp/spectate/${encodeURIComponent(spectator.battleKey)}`,
          { cache: 'no-store' },
        )
        const body = (await response.json()) as ApiBody
        if (cancelled) return
        if (!response.ok || !body.spectator) {
          setConnectionNote(body.error?.message ?? 'Arena link interrupted. Retrying…')
          return
        }
        setConnectionNote('Live arena link established.')
        setSpectator((current) =>
          body.spectator && body.spectator.battle.battleVersion !== current.battle.battleVersion
            ? body.spectator
            : current,
        )
      } catch {
        if (!cancelled) setConnectionNote('Arena link interrupted. Retrying…')
      }
    }, 700)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [battleState.lifecycle, spectator.battleKey])

  async function copyBattleKey() {
    try {
      await navigator.clipboard.writeText(spectator.battleKey)
      setCopyNotice(true)
      window.setTimeout(() => setCopyNotice(false), 1500)
    } catch {
      setConnectionNote('Battle Key copy is unavailable in this browser.')
    }
  }

  return (
    <main className={styles.shell} data-pvp-spectator="true">
      <header className={styles.broadcastHeader}>
        <div className={styles.identity}>
          <span>Battle Hall · Live Spectation</span>
          <h1>{spectator.mode.toUpperCase()} Arena Broadcast</h1>
          <p>Read-only battle view · participant controls are never exposed here.</p>
        </div>

        <div className={styles.liveStatus} aria-live="polite">
          <span data-live={battleState.lifecycle === 'active' || undefined}>
            {battleState.lifecycle === 'active' ? 'LIVE' : 'FINAL'}
          </span>
          <strong>Round {battleState.round}</strong>
          <small>{connectionNote}</small>
        </div>
      </header>

      <section className={styles.scoreboard} aria-label="Battle teams">
        {teamSummaries.map((team) => (
          <article className={styles.teamCard} data-team={team.teamIndex} key={team.teamIndex}>
            <div className={styles.teamHeading}>
              <div>
                <span>Team {team.teamIndex + 1}</span>
                <strong>{teamName(team.teamIndex, teamCount)}</strong>
              </div>
              <b>
                {team.standing}/{team.members.length} standing
              </b>
            </div>
            <div className={styles.teamHealth}>
              <span style={{ width: `${meterPercent(team.hp, team.maxHp)}%` }} />
            </div>
            <div className={styles.teamRoster}>
              {team.members.map((participant) => {
                const combatant = battleState.combatants.find(
                  (candidate) => candidate.id === participant.combatantId,
                )
                const active = participant.combatantId === activeCombatantId
                return (
                  <div
                    className={styles.fighter}
                    data-active={active || undefined}
                    data-defeated={combatant?.hp === 0 || undefined}
                    key={participant.combatantId}
                  >
                    <CharacterPortraitImage
                      imageUrl={participant.profileImageUrl}
                      fallbackAssetId={getStarterPortraitImageAssetId(
                        participant.portraitRef as CharacterPortraitRef,
                      )}
                      className={styles.fighterPortrait}
                      sizes="52px"
                      alt=""
                    />
                    <div>
                      <strong>{participant.characterName}</strong>
                      <small>Lv {participant.characterLevel}</small>
                    </div>
                    <span>
                      {active
                        ? 'ACTING'
                        : combatant?.hp === 0
                          ? 'DOWN'
                          : `${combatant?.hp ?? 0} HP`}
                    </span>
                  </div>
                )
              })}
            </div>
          </article>
        ))}
      </section>

      <section className={styles.arenaStage}>
        <aside className={styles.turnSpotlight}>
          <span>{battleState.lifecycle === 'active' ? 'Now Acting' : 'Battle Result'}</span>
          {activeParticipant && activeCombatant ? (
            <>
              <CharacterPortraitImage
                imageUrl={activeParticipant.profileImageUrl}
                fallbackAssetId={getStarterPortraitImageAssetId(
                  activeParticipant.portraitRef as CharacterPortraitRef,
                )}
                className={styles.spotlightPortrait}
                sizes="110px"
                alt=""
              />
              <h2>{activeParticipant.characterName}</h2>
              <p>
                Team {activeParticipant.teamIndex + 1} · {activeCombatant.hp}/
                {activeCombatant.maxHp} HP
              </p>
            </>
          ) : winner ? (
            <>
              <div className={styles.victoryGlyph}>◆</div>
              <h2>{teamName(winner.teamIndex, teamCount)} wins</h2>
              <p>Last team standing after Round {battleState.round}.</p>
            </>
          ) : (
            <>
              <div className={styles.victoryGlyph}>◇</div>
              <h2>Battle complete</h2>
              <p>The arena has settled.</p>
            </>
          )}
          <div className={styles.pulseLine}>
            <i />
            <span>Arena Pulse</span>
            <i />
          </div>
        </aside>

        <section className={styles.battlefield} aria-label="Read-only tactical battlefield">
          <div className={styles.board} style={boardStyle}>
            {tactical.tiles.map((tile) => {
              const key = positionKey(tile.position)
              const placement = placementByTile.get(key)
              const participant = placement
                ? participantByCombatant.get(placement.combatantId)
                : null
              const combatant = placement
                ? battleState.combatants.find((candidate) => candidate.id === placement.combatantId)
                : null
              const terrain = tile.terrainId === 'rough-ground' ? 'rough' : 'open'

              return (
                <div
                  className={styles.tile}
                  data-terrain={terrain}
                  data-elevation={tile.elevation > 0 || undefined}
                  key={key}
                  aria-label={`Tile ${tile.position.x + 1}, ${tile.position.y + 1}${participant ? `; ${participant.characterName}` : ''}`}
                >
                  <span className={styles.coordinates}>
                    {tile.position.x + 1},{tile.position.y + 1}
                  </span>
                  {tile.elevation > 0 ? <span className={styles.elevation}>▲</span> : null}
                  {participant && placement ? (
                    <div
                      className={styles.unit}
                      data-team={participant.teamIndex}
                      data-active={participant.combatantId === activeCombatantId || undefined}
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
                      <i>{facingGlyph(placement.facing as Facing)}</i>
                      <strong>{participant.characterName}</strong>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>

        <aside className={styles.matchPulse}>
          <span>Match Pulse</span>
          <strong>{participantName(participantByCombatant, activeCombatantId)}</strong>
          <p>
            {battleState.lifecycle === 'active'
              ? `Turn ${battleState.turnNumber} · Round ${battleState.round}`
              : winner
                ? `${teamName(winner.teamIndex, teamCount)} secured the arena.`
                : 'Final state recorded.'}
          </p>
          <div className={styles.teamPips}>
            {teamSummaries.map((team) => (
              <div key={team.teamIndex} data-team={team.teamIndex}>
                <span>Team {team.teamIndex + 1}</span>
                <b>{Math.round(meterPercent(team.hp, team.maxHp))}%</b>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <footer className={styles.footer}>
        <button type="button" onClick={() => router.push('/game/battle')}>
          Return to Battle Hall
        </button>
        <button type="button" className={styles.battleKey} onClick={() => void copyBattleKey()}>
          <small>{copyNotice ? 'Copied!' : 'Battle Key · click to copy'}</small>
          <strong>{spectator.battleKey}</strong>
        </button>
        <div className={styles.readOnlyBadge}>
          <span>◉</span>
          <strong>Spectator Link</strong>
          <small>Read-only</small>
        </div>
      </footer>
    </main>
  )
}
