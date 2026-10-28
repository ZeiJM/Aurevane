'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useSyncExternalStore } from 'react'

import styles from './authenticated-game-shell.module.css'

const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000
const FAILURE_RETRY_MS = 15_000

interface PresenceHeartbeatState {
  cachedPresenceCount: number | null
  nextHeartbeatAt: number
  failures: number
  sharedHeartbeat: Promise<void> | null
  consumers: number
  timer: number | null
  listeners: Set<() => void>
  onVisibilityChange: (() => void) | null
}

const characterHeartbeats = new Map<string, PresenceHeartbeatState>()

function documentIsVisible(): boolean {
  return document.visibilityState === 'visible'
}

function heartbeatState(characterId: string): PresenceHeartbeatState {
  let state = characterHeartbeats.get(characterId)
  if (!state) {
    state = {
      cachedPresenceCount: null,
      nextHeartbeatAt: 0,
      failures: 0,
      sharedHeartbeat: null,
      consumers: 0,
      timer: null,
      listeners: new Set(),
      onVisibilityChange: null,
    }
    characterHeartbeats.set(characterId, state)
  }
  return state
}

async function requestPresenceHeartbeat(
  state: PresenceHeartbeatState,
  onBanned: () => void,
): Promise<void> {
  if (Date.now() < state.nextHeartbeatAt) return
  if (state.sharedHeartbeat) return state.sharedHeartbeat

  state.sharedHeartbeat = (async () => {
    try {
      const response = await fetch('/api/presence', {
        method: 'POST',
        cache: 'no-store',
      })
      const body = (await response.json()) as {
        count?: number
        error?: { accountBanned?: boolean }
      }
      if (response.status === 403 && body.error?.accountBanned === true) {
        state.nextHeartbeatAt = Date.now() + HEARTBEAT_INTERVAL_MS
        onBanned()
        return
      }
      if (
        !response.ok ||
        !Number.isSafeInteger(body.count) ||
        typeof body.count !== 'number' ||
        body.count < 0
      ) {
        throw new Error('Invalid presence response')
      }

      state.cachedPresenceCount = body.count
      state.failures = 0
      state.nextHeartbeatAt = Date.now() + HEARTBEAT_INTERVAL_MS
      state.listeners.forEach((notify) => notify())
    } catch {
      // Supplementary presence cannot interrupt play or retry on every route render.
      state.failures = Math.min(state.failures + 1, 4)
      state.nextHeartbeatAt =
        Date.now() + Math.min(HEARTBEAT_INTERVAL_MS, FAILURE_RETRY_MS * 2 ** (state.failures - 1))
    } finally {
      state.sharedHeartbeat = null
    }
  })()

  return state.sharedHeartbeat
}

function startPresenceHeartbeat(characterId: string, onBanned: () => void): () => void {
  const state = heartbeatState(characterId)
  state.consumers += 1

  if (state.consumers === 1) {
    const clearTimer = () => {
      if (state.timer !== null) window.clearTimeout(state.timer)
      state.timer = null
    }
    const heartbeat = async () => {
      clearTimer()
      if (state.consumers === 0 || !documentIsVisible()) return
      await requestPresenceHeartbeat(state, onBanned)
      clearTimer()
      if (state.consumers > 0 && documentIsVisible()) {
        state.timer = window.setTimeout(
          () => void heartbeat(),
          Math.max(0, state.nextHeartbeatAt - Date.now()),
        )
      }
    }
    state.onVisibilityChange = () => {
      clearTimer()
      if (document.visibilityState === 'visible') void heartbeat()
    }
    document.addEventListener('visibilitychange', state.onVisibilityChange)
    void heartbeat()
  }

  return () => {
    state.consumers -= 1
    if (state.consumers > 0) return
    if (state.timer !== null) window.clearTimeout(state.timer)
    state.timer = null
    if (state.onVisibilityChange) {
      document.removeEventListener('visibilitychange', state.onVisibilityChange)
      state.onVisibilityChange = null
    }
  }
}

/** Activity keeps running while the Account menu (and its count link) is unmounted. */
export function OnlinePresenceHeartbeat({ characterId }: { characterId: string }) {
  const router = useRouter()
  useEffect(
    () => startPresenceHeartbeat(characterId, () => router.replace('/account/banned')),
    [characterId, router],
  )
  return null
}

export function OnlinePresenceLink({
  characterId,
  initialCount = null,
  className,
  compact = false,
}: {
  characterId: string
  initialCount?: number | null
  /** Replaces the footer presentation, e.g. when the count lives in another bar. */
  className?: string
  /** Show only the status dot and count; the full name stays in the accessible label. */
  compact?: boolean
}) {
  const count = useSyncExternalStore(
    (notify) => {
      const state = heartbeatState(characterId)
      state.listeners.add(notify)
      return () => state.listeners.delete(notify)
    },
    () => heartbeatState(characterId).cachedPresenceCount ?? initialCount,
    () => initialCount,
  )

  return (
    <Link
      href="/game/online"
      className={className ?? styles.onlineLink}
      prefetch={false}
      aria-label={compact ? `Online Users ${count ?? 'loading'}` : undefined}
    >
      {compact ? null : <>Online Users </>}
      <span
        aria-label={!compact && count === null ? 'Loading online count' : undefined}
        aria-hidden={compact ? true : undefined}
      >
        {count ?? '—'}
      </span>
    </Link>
  )
}
