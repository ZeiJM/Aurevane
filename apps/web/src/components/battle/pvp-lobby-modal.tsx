'use client'

import type { CharacterPortraitRef } from '@aurevane/game-core/character/creation'
import type { PvpMapBias, PvpMapSize, PvpTurnTimerSeconds } from '@aurevane/validation/combat/pvp'
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
  turnTimerSeconds: PvpTurnTimerSeconds
}

const DEFAULT_SETTINGS: MapSettings = {
  mapSize: 'medium',
  elevationBias: 'neutral',
  terrainBias: 'neutral',
  turnTimerSeconds: 60,
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
      (member) => member.seated && member.teamIndex === teamIndex && member.seatIndex === seatIndex,
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
  const dialogRef = useRef<HTMLDialogElement>(null)
  const startLock = useRef(false)
  const lobbyMutationGeneration = useRef(0)
  const lobbyMutationPending = useRef(false)
  const localMember = useMemo(
    () => lobby.members.find((member) => member.characterId === localCharacterId) ?? null,
    [lobby.members, localCharacterId],
  )
  const unseatedMembers = useMemo(
    () => lobby.members.filter((member) => !member.seated),
    [lobby.members],
  )
  const teams = teamCount(lobby)
  const required = lobby.teamSizes.reduce((total, size) => total + size, 0)
  const canMoveSeats = required > 2 && lobby.status === 'waiting'

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    // Native modal containment keeps keyboard focus and pointer input in the lobby.
    // Closing the presentation never substitutes for the explicit server-side Leave action.
    dialog.showModal()
    return () => dialog.close()
  }, [])

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
    let timer: number | null = null

    function schedulePoll() {
      if (cancelled) return
      timer = window.setTimeout(() => {
        void pollLobby()
      }, 850)
    }

    async function pollLobby() {
      if (cancelled) return
      if (lobbyMutationPending.current) {
        schedulePoll()
        return
      }

      const generation = lobbyMutationGeneration.current
      try {
        const response = await fetch(`/api/pvp/lobbies/${lobby.lobbyId}`, { cache: 'no-store' })
        const body = (await response.json()) as { lobby?: PvpLobbyView } & ApiErrorBody
        if (!response.ok || !body.lobby || cancelled) {
          schedulePoll()
          return
        }
        if (lobbyMutationPending.current || generation !== lobbyMutationGeneration.current) {
          schedulePoll()
          return
        }

        setLobby(body.lobby)
        if (body.lobby.status === 'cancelled') {
          setError('The lobby host closed this lobby.')
          return
        }
      } catch {
        // The next poll can recover from a transient connection interruption.
      }
      schedulePoll()
    }

    schedulePoll()
    return () => {
      cancelled = true
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [lobby.lobbyId])

  function beginLobbyMutation() {
    lobbyMutationPending.current = true
    lobbyMutationGeneration.current += 1
  }

  function endLobbyMutation() {
    lobbyMutationGeneration.current += 1
    lobbyMutationPending.current = false
  }

  async function toggleReady() {
    if (!localMember?.seated || pending) return
    setPending(true)
    beginLobbyMutation()
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
      endLobbyMutation()
      setPending(false)
    }
  }

  async function moveSeat(targetTeamIndex: number | null, targetSeatIndex: number | null) {
    if (!localMember || !canMoveSeats || pending) return
    const unseating = targetTeamIndex === null && targetSeatIndex === null
    if (
      !unseating &&
      localMember.seated &&
      localMember.teamIndex === targetTeamIndex &&
      localMember.seatIndex === targetSeatIndex
    ) {
      return
    }
    setPending(true)
    beginLobbyMutation()
    setError(null)
    try {
      const response = await fetch(`/api/pvp/lobbies/${lobby.lobbyId}/seat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTeamIndex, targetSeatIndex }),
      })
      const body = (await response.json()) as { lobby?: PvpLobbyView } & ApiErrorBody
      if (!response.ok || !body.lobby) {
        throw new Error(
          body.error?.message ??
            (unseating ? 'That seat could not be released.' : 'That team move could not be made.'),
        )
      }
      setLobby(body.lobby)
    } catch (moveError) {
      setError(
        moveError instanceof Error
          ? moveError.message
          : unseating
            ? 'That seat could not be released.'
            : 'That team move could not be made.',
      )
    } finally {
      endLobbyMutation()
      setPending(false)
    }
  }

  async function leaveLobby() {
    if (pending) return
    setPending(true)
    beginLobbyMutation()
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
    } finally {
      endLobbyMutation()
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

  const filled = lobby.members.filter((member) => member.seated).length
  const readyCount = lobby.members.filter((member) => member.seated && member.ready).length
  const mapSizeLabel = settings.mapSize === 'medium' ? 'Standard' : 'Expanded'
  const turnTimerLabel =
    settings.turnTimerSeconds === null ? 'No timer' : `${settings.turnTimerSeconds} seconds`

  return (
    <dialog
      ref={dialogRef}
      className={styles.modal}
      data-lobby-concept="true"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pvp-lobby-title"
      aria-describedby="pvp-lobby-description"
      onCancel={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const buttons =
          event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
        const first = buttons[0]
        const last = buttons[buttons.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }}
    >
      <header className={styles.header}>
        <div>
          <span>Battle Hall · PvP Staging</span>
          <h2 id="pvp-lobby-title">The arena is waiting.</h2>
          <p id="pvp-lobby-description">
            {lobby.mode.toUpperCase()} · Assemble the roster, settle the teams, ready every
            combatant, then battle begins automatically.
          </p>
        </div>
        <div className={styles.keyStack}>
          <button type="button" onClick={() => void copyValue(lobby.lobbyKey, 'Lobby key')}>
            <small>Lobby Key · click to copy</small>
            <strong>{lobby.lobbyKey}</strong>
          </button>
          <span role="status">{copyNotice ?? 'Share this key with your challengers.'}</span>
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.arenaLine}>
          <span>
            {filled}/{required} combatants seated
          </span>
          <i aria-hidden="true" />
          <span>
            {readyCount}/{required} ready
          </span>
        </div>

        <section className={styles.settings} aria-label="Locked PvP battle settings">
          {[
            ['Map size', mapSizeLabel],
            ['Elevation', settings.elevationBias],
            ['Difficult ground', settings.terrainBias],
            ['Turn timer', turnTimerLabel],
          ].map(([label, value]) => (
            <div className={styles.setting} key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </section>

        {canMoveSeats ? (
          <p className={styles.seatHelp}>
            Click your occupied seat to step out of formation. Click an open seat to rejoin; while
            seated, clicking another occupied seat swaps positions. Any seat change clears every
            Ready state.
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
                    const ownSeat = member?.characterId === localCharacterId
                    const occupiedWhileUnseated = Boolean(
                      member && localMember && !localMember.seated,
                    )
                    return member ? (
                      <button
                        type="button"
                        className={styles.filledSeat}
                        key={seatIndex}
                        data-ready={member.ready || undefined}
                        disabled={
                          !canMoveSeats ||
                          pending ||
                          !localMember ||
                          (occupiedWhileUnseated && !ownSeat)
                        }
                        onClick={() =>
                          void (ownSeat ? moveSeat(null, null) : moveSeat(teamIndex, seatIndex))
                        }
                        title={
                          canMoveSeats
                            ? ownSeat
                              ? 'Step out of this seat and choose another position.'
                              : occupiedWhileUnseated
                                ? 'Choose an open seat before swapping with another combatant.'
                                : `Swap into Team ${teamIndex + 1}, seat ${seatIndex + 1}`
                            : undefined
                        }
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
                        <span>
                          {member.ready
                            ? 'READY'
                            : ownSeat && canMoveSeats
                              ? 'CLICK TO MOVE'
                              : 'STANDBY'}
                        </span>
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

        {unseatedMembers.length > 0 ? (
          <section className={styles.unseated} aria-label="Combatants choosing a seat">
            <h3>Choosing a seat</h3>
            <div className={styles.unseatedList}>
              {unseatedMembers.map((member) => (
                <div className={styles.unseatedMember} key={member.characterId}>
                  <Portrait member={member} />
                  <span>
                    <strong>{member.characterName}</strong>
                    <small>Select an open team seat{member.isHost ? ' · Host' : ''}</small>
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <footer className={styles.footer}>
        <div>
          <span>
            {lobby.readyToStart
              ? 'All combatants ready — opening the arena…'
              : localMember && !localMember.seated
                ? 'Choose an open combat seat before marking Ready.'
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
            disabled
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
            disabled={pending || !localMember || !localMember.seated || lobby.status !== 'waiting'}
          >
            <span>{localMember?.ready ? '✓' : '○'}</span>
            {localMember?.ready
              ? 'Ready — click to stand down'
              : localMember && !localMember.seated
                ? 'Choose a seat first'
                : 'Mark Ready'}
          </button>
        </div>
      </footer>
    </dialog>
  )
}
