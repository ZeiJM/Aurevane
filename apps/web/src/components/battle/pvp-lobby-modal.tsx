'use client'

import type { CharacterPortraitRef } from '@aurevane/game-core/character/creation'
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
  const [pending, setPending] = useState(false)
  const [copyNotice, setCopyNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const startLock = useRef(false)
  const localMember = useMemo(
    () => lobby.members.find((member) => member.characterId === localCharacterId) ?? null,
    [lobby.members, localCharacterId],
  )
  const teams = teamCount(lobby)

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
      setError(startError instanceof Error ? startError.message : 'The PvP battle could not be started.')
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
      if (!response.ok || !body.lobby) {
        throw new Error(body.error?.message ?? 'Readiness could not be updated.')
      }
      setLobby(body.lobby)
    } catch (readyError) {
      setError(readyError instanceof Error ? readyError.message : 'Readiness could not be updated.')
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
  const required = lobby.teamSizes.reduce((total, size) => total + size, 0)
  const readyCount = lobby.members.filter((member) => member.ready).length

  return (
    <div className={styles.backdrop} role="presentation">
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="pvp-lobby-title">
        <header className={styles.header}>
          <div>
            <span>Battle Hall · PvP Staging</span>
            <h2 id="pvp-lobby-title">The arena is waiting.</h2>
            <p>{lobby.mode.toUpperCase()} · Assemble the roster, ready every combatant, then battle begins automatically.</p>
          </div>
          <div className={styles.keyStack}>
            <button type="button" onClick={() => void copyValue(lobby.lobbyKey, 'Lobby key')}>
              <small>Lobby Key · click to copy</small>
              <strong>{lobby.lobbyKey}</strong>
            </button>
            <button
              type="button"
              onClick={() =>
                void copyValue(`${window.location.origin}/game/battle?join=${lobby.lobbyKey}`, 'Invite link')
              }
            >
              Copy invite link
            </button>
            {copyNotice ? <span>{copyNotice}</span> : null}
          </div>
        </header>

        <div className={styles.arenaLine}>
          <span>{filled}/{required} combatants seated</span>
          <i aria-hidden="true" />
          <span>{readyCount}/{required} ready</span>
        </div>

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
                      <article className={styles.filledSeat} key={seatIndex} data-ready={member.ready || undefined}>
                        <div className={styles.portraitFrame}>
                          <Portrait member={member} />
                          {member.ready ? <span className={styles.readyGlyph}>✓</span> : null}
                        </div>
                        <div>
                          <strong>{member.characterName}</strong>
                          <small>Level {member.characterLevel}{member.isHost ? ' · Host' : ''}</small>
                        </div>
                        <span>{member.ready ? 'READY' : 'STANDBY'}</span>
                      </article>
                    ) : (
                      <article className={styles.emptySeat} key={seatIndex}>
                        <div>◇</div>
                        <strong>Open combat seat</strong>
                        <small>Waiting for a challenger</small>
                      </article>
                    )
                  })}
                </div>
              </section>
            </div>
          ))}
        </div>

        {error ? <p className={styles.error} role="alert">{error}</p> : null}

        <footer className={styles.footer}>
          <div>
            <span>{lobby.readyToStart ? 'All combatants ready — opening the arena…' : 'Battle begins when every required seat is filled and ready.'}</span>
            {lobby.status === 'cancelled' ? <button type="button" onClick={onLeave}>Return to Battle Hall</button> : null}
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.leave} onClick={() => void leaveLobby()} disabled={pending || lobby.status !== 'waiting'}>
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
