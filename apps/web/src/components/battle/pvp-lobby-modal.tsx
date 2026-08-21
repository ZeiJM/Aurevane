'use client'

import type { CharacterPortraitRef } from '@aurevane/game-core/character/creation'
import type { PvpMapBias, PvpMapSize } from '@aurevane/validation/combat/pvp'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import { getStarterPortraitImageAssetId } from '@/media/character'
import type { PvpLobbyMemberView, PvpLobbyView } from '@/server/battle/pvp-lobby-service'

import styles from './pvp-lobby-modal.module.css'

interface PvpLobbyModalProps {
  initialLobby: PvpLobbyView
  localCharacterId: string
  onLeave: () => void
}

interface ApiErrorBody {
  error?: { message?: string }
}

interface MapSettings {
  mapSize: PvpMapSize
  elevationBias: PvpMapBias
  terrainBias: PvpMapBias
}

const DEFAULT_SETTINGS: MapSettings = {
  mapSize: 'medium',
  elevationBias: 'neutral',
  terrainBias: 'neutral',
}

function teamLabel(index: number, teamCount: number): string {
  if (teamCount === 3) return `Faction ${String.fromCharCode(65 + index)}`
  return index === 0 ? 'Vanguard' : 'Challengers'
}

function teamCount(lobby: PvpLobbyView): number {
  return lobby.teamSizes[2] > 0 ? 3 : 2
}

function memberForSeat(
  lobby: PvpLobbyView,
  teamIndex: number,
  seatIndex: number,
): PvpLobbyMemberView | null {
  return (
    lobby.members.find(
      (member) => member.teamIndex === teamIndex && member.seatIndex === seatIndex,
    ) ?? null
  )
}

function Portrait({ member }: { member: PvpLobbyMemberView }) {
  return (
    <CharacterPortraitImage
      imageUrl={member.profileImageUrl}
      fallbackAssetId={getStarterPortraitImageAssetId(member.portraitRef as CharacterPortraitRef)}
      className={styles.portrait}
      alt={`${member.characterName} portrait`}
      sizes="96px"
    />
  )
}

export function PvpLobbyModal({ initialLobby, localCharacterId, onLeave }: PvpLobbyModalProps) {
  const router = useRouter()
  const [lobby, setLobby] = useState(initialLobby)
  const [settings, setSettings] = useState<MapSettings>(DEFAULT_SETTINGS)
  const [pending, setPending] = useState(false)
  const [copyNotice, setCopyNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const startLock = useRef(false)
  const localMember = useMemo(
    () => lobby.members.find((member) => member.characterId === localCharacterId) ?? null,
    [lobby.members, localCharacterId],
  )
  const teams = teamCount(lobby)
  const required = lobby.teamSizes.reduce((total, size) => total + size, 0)
  const canMoveSeats = required > 2 && lobby.status === 'waiting'

  const startBattle = useCallback(async () => {
    if (startLock.current || lobby.status !== 'waiting' || !lobby.readyToStart) return
    startLock.current = true
    setError(null)
    try {
      const response = await fetch(`/api/pvp/lobbies/${lobby.lobbyId}/start`, { method: 'POST' })
      const body = (await response.json()) as {
        battle?: { battleSessionId?: string }
      } & ApiErrorBody
      if (!response.ok || !body.battle?.battleSessionId) {
        throw new Error(body.error?.message ?? 'The PvP battle could not be started.')
      }
      router.push(`/game/battle/${body.battle.battleSessionId}`)
    } catch (startError) {
      setError(
        startError instanceof Error ? startError.message : 'The PvP battle could not be started.',
      )
      startLock.current = false
    }
  }, [lobby.lobbyId, lobby.readyToStart, lobby.status, router])

  useEffect(() => {
    if (lobby.status === 'active' && lobby.battleSessionId) {
      router.push(`/game/battle/${lobby.battleSessionId}`)
      return
    }
    if (lobby.readyToStart) void startBattle()
  }, [lobby.battleSessionId, lobby.readyToStart, lobby.status, router, startBattle])

  useEffect(() => {
    let cancelled = false
    async function loadSettings() {
      try {
        const response = await fetch(`/api/pvp/lobbies/${lobby.lobbyId}/settings`, {
          cache: 'no-store',
        })
        const body = (await response.json()) as { settings?: MapSettings }
        if (response.ok && body.settings && !cancelled) setSettings(body.settings)
      } catch {
        // Lobby remains usable if cosmetic staging settings cannot refresh momentarily.
      }
    }
    void loadSettings()
    return () => {
      cancelled = true
    }
  }, [lobby.lobbyId])

  useEffect(() => {
    let cancelled = false
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/pvp/lobbies/${lobby.lobbyId}`, { cache: 'no-store' })
        const body = (await response.json()) as { lobby?: PvpLobbyView } & ApiErrorBody
        if (!response.ok || !body.lobby || cancelled) return
        if (body.lobby.status === 'cancelled') {
          setError('The lobby host closed this lobby.')
          window.clearInterval(timer)
          return
        }
        setLobby(body.lobby)
      } catch {
        // The next poll can recover from a transient connection interruption.
      }
    }, 850)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [lobby.lobbyId])

  async function toggleReady() {
    if (!localMember || pending) return
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/pvp/lobbies/${lobby.lobbyId}/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ready: !localMember.ready }),
      })
      const body = (await response.json()) as { lobby?: PvpLobbyView } & ApiErrorBody
      if (!response.ok || !body.lobby)
        throw new Error(body.error?.message ?? 'Readiness could not be updated.')
      setLobby(body.lobby)
    } catch (readyError) {
      setError(readyError instanceof Error ? readyError.message : 'Readiness could not be updated.')
    } finally {
      setPending(false)
    }
  }

  async function moveSeat(targetTeamIndex: number, targetSeatIndex: number) {
    if (!localMember || !canMoveSeats || pending) return
    if (localMember.teamIndex === targetTeamIndex && localMember.seatIndex === targetSeatIndex)
      return
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/pvp/lobbies/${lobby.lobbyId}/seat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTeamIndex, targetSeatIndex }),
      })
      const body = (await response.json()) as { lobby?: PvpLobbyView } & ApiErrorBody
      if (!response.ok || !body.lobby)
        throw new Error(body.error?.message ?? 'That team move could not be made.')
      setLobby(body.lobby)
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : 'That team move could not be made.')
    } finally {
      setPending(false)
    }
  }

  async function leaveLobby() {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/pvp/lobbies/${lobby.lobbyId}`, { method: 'DELETE' })
      if (!response.ok) {
        const body = (await response.json()) as ApiErrorBody
        throw new Error(body.error?.message ?? 'The lobby could not be left.')
      }
      onLeave()
    } catch (leaveError) {
      setError(leaveError instanceof Error ? leaveError.message : 'The lobby could not be left.')
      setPending(false)
    }
  }

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopyNotice(`${label} copied`)
      window.setTimeout(() => setCopyNotice(null), 1600)
    } catch {
      setCopyNotice('Copy unavailable')
    }
  }

  const filled = lobby.members.length
  const readyCount = lobby.members.filter((member) => member.ready).length

  return (
    <div className={styles.backdrop} role="presentation">
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pvp-lobby-title"
      >
        <header className={styles.header}>
          <div>
            <span>Battle Hall · PvP Staging</span>
            <h2 id="pvp-lobby-title">The arena is waiting.</h2>
            <p>
              {lobby.mode.toUpperCase()} · Assemble the roster, settle the teams, ready every
              combatant, then battle begins automatically.
            </p>
          </div>
          <div className={styles.keyStack}>
            <button type="button" onClick={() => void copyValue(lobby.lobbyKey, 'Lobby key')}>
              <small>Lobby Key · click to copy</small>
              <strong>{lobby.lobbyKey}</strong>
            </button>
            {copyNotice ? <span>{copyNotice}</span> : null}
          </div>
        </header>

        <div className={styles.arenaLine}>
          <span>
            {filled}/{required} combatants seated
          </span>
          <i aria-hidden="true" />
          <span>
            {readyCount}/{required} ready
          </span>
        </div>

        <section
          aria-label="PvP battlefield generation"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '0.45rem',
          }}
        >
          {[
            ['Map size', settings.mapSize],
            ['Elevation', settings.elevationBias],
            ['Difficult ground', settings.terrainBias],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                display: 'grid',
                gap: '0.25rem',
                minWidth: 0,
                padding: '0.45rem 0.55rem',
                border: '1px solid rgba(207, 169, 93, 0.22)',
                borderRadius: '0.35rem',
                background: 'rgba(255, 255, 255, 0.025)',
              }}
            >
              <span
                style={{
                  color: 'var(--av-text-dim)',
                  fontSize: '0.52rem',
                }}
              >
                {label}
              </span>
              <strong
                style={{
                  color: 'var(--av-text)',
                  fontSize: '0.68rem',
                  fontWeight: 650,
                  textTransform: 'capitalize',
                }}
              >
                {value}
              </strong>
            </div>
          ))}
        </section>

        {canMoveSeats ? (
          <p
            style={{
              margin: 0,
              color: 'var(--av-text-dim)',
              fontSize: '0.52rem',
              textAlign: 'center',
            }}
          >
            Click any team seat to move there. Occupied seats swap positions. Any team change clears
            everyone&apos;s Ready state.
          </p>
        ) : null}

        <div className={styles.teams} data-team-count={teams}>
          {Array.from({ length: teams }, (_, teamIndex) => (
            <div className={styles.teamWrap} key={teamIndex}>
              {teamIndex > 0 ? <div className={styles.vs}>VS</div> : null}
              <section className={styles.team} data-team={teamIndex}>
                <div className={styles.teamHeading}>
                  <span>Team {teamIndex + 1}</span>
                  <strong>{teamLabel(teamIndex, teams)}</strong>
                </div>
                <div className={styles.seats}>
                  {Array.from({ length: lobby.teamSizes[teamIndex] ?? 0 }, (_, seatIndex) => {
                    const member = memberForSeat(lobby, teamIndex, seatIndex)
                    return member ? (
                      <button
                        type="button"
                        className={styles.filledSeat}
                        key={seatIndex}
                        data-ready={member.ready || undefined}
                        disabled={!canMoveSeats || pending || !localMember}
                        onClick={() => void moveSeat(teamIndex, seatIndex)}
                        title={
                          canMoveSeats
                            ? `Move to Team ${teamIndex + 1}, seat ${seatIndex + 1}`
                            : undefined
                        }
                        style={{
                          width: '100%',
                          color: 'inherit',
                          textAlign: 'left',
                          cursor: canMoveSeats ? 'pointer' : 'default',
                        }}
                      >
                        <div className={styles.portraitFrame}>
                          <Portrait member={member} />
                          {member.ready ? <span className={styles.readyGlyph}>✓</span> : null}
                        </div>
                        <div>
                          <strong>{member.characterName}</strong>
                          <small>
                            Level {member.characterLevel}
                            {member.isHost ? ' · Host' : ''}
                          </small>
                        </div>
                        <span>{member.ready ? 'READY' : 'STANDBY'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.emptySeat}
                        key={seatIndex}
                        disabled={!canMoveSeats || pending || !localMember}
                        onClick={() => void moveSeat(teamIndex, seatIndex)}
                        title={
                          canMoveSeats
                            ? `Move to Team ${teamIndex + 1}, seat ${seatIndex + 1}`
                            : undefined
                        }
                        style={{
                          width: '100%',
                          color: 'inherit',
                          textAlign: 'left',
                          cursor: canMoveSeats ? 'pointer' : 'default',
                        }}
                      >
                        <div>◇</div>
                        <strong>Open combat seat</strong>
                        <small>Waiting for a challenger</small>
                      </button>
                    )
                  })}
                </div>
              </section>
            </div>
          ))}
        </div>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <footer className={styles.footer}>
          <div>
            <span>
              {lobby.readyToStart
                ? 'All combatants ready — opening the arena…'
                : 'Battle begins when every required seat is filled and ready.'}
            </span>
            {lobby.status === 'cancelled' ? (
              <button type="button" onClick={onLeave}>
                Return to Battle Hall
              </button>
            ) : null}
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.lobbyChat}
              aria-disabled="true"
              title="Lobby chat will be enabled in a later update."
            >
              Chat
            </button>
            <button
              type="button"
              className={styles.leave}
              onClick={() => void leaveLobby()}
              disabled={pending || lobby.status !== 'waiting'}
            >
              {localMember?.isHost ? 'Close Lobby' : 'Leave Lobby'}
            </button>
            <button
              type="button"
              className={styles.ready}
              data-ready={localMember?.ready || undefined}
              onClick={() => void toggleReady()}
              disabled={pending || !localMember || lobby.status !== 'waiting'}
            >
              <span>{localMember?.ready ? '✓' : '○'}</span>
              {localMember?.ready ? 'Ready — click to stand down' : 'Mark Ready'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}
