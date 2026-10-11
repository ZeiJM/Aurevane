'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FRONTIER_APPROACH } from '@/world/catalog'
import { remainingTravelMs, samePosition, worldSyncDelayMs } from '@/world/travel'
import type { WorldIntent, WorldView } from '@/world/types'
import {
  buildStageState,
  parseStageMessage,
  travelDestination,
  type WorldStageState,
} from './stage-bridge'
import styles from './world.module.css'

export function WorldWorkspace({
  initialView,
  character,
}: {
  initialView: WorldView
  character: { name: string; portrait: string }
}) {
  const router = useRouter()
  const refreshing = useRef(false)
  const [view, setView] = useState(initialView),
    [journal, setJournal] = useState(false),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false)
  const frame = useRef<HTMLIFrameElement | null>(null),
    stageReady = useRef(false)
  const current = useRef(initialView),
    pending = useRef(false),
    queuedIntent = useRef<WorldIntent | null>(null),
    mounted = useRef(true),
    viewAcceptedAt = useRef<number | null>(null),
    syncTimer = useRef<number | null>(null),
    scheduleSync = useRef<() => void>(() => {})
  function accept(next: WorldView) {
    if (!mounted.current) return
    if (next.battleSessionId) {
      router.replace(`/game/battle/${next.battleSessionId}`)
      return
    }
    if (next.characterId !== current.current.characterId) {
      router.refresh()
      return
    }
    if (next.version < current.current.version) return
    current.current = next
    viewAcceptedAt.current = Date.now()
    setView(next)
  }
  async function refresh() {
    if (refreshing.current) return
    refreshing.current = true
    try {
      const response = await fetch('/api/world', { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error?.message ?? 'The world could not be refreshed.')
      accept(body)
    } finally {
      refreshing.current = false
      if (mounted.current) scheduleSync.current()
    }
  }
  async function send(intent: WorldIntent) {
    if (pending.current) {
      // A command pressed while another is in flight (a due tick, usually) is held and sent
      // right after it, so Stop and travel clicks are never silently dropped.
      if (intent.kind !== 'tick') queuedIntent.current = intent
      return
    }
    pending.current = true
    if (intent.kind !== 'tick') setBusy(true)
    try {
      const response = await fetch('/api/world', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent,
          characterId: current.current.characterId,
          expectedVersion: current.current.version,
          commandId: crypto.randomUUID(),
        }),
      })
      const body = await response.json()
      if (!response.ok) {
        if (response.status === 409) await refresh()
        throw new Error(body.error?.message ?? 'Travel could not continue.')
      }
      accept(body)
      setMessage('')
    } catch (error) {
      if (mounted.current)
        setMessage(error instanceof Error ? error.message : 'Travel is briefly unavailable.')
    } finally {
      pending.current = false
      if (mounted.current) {
        if (intent.kind !== 'tick') setBusy(false)
        const held = queuedIntent.current
        queuedIntent.current = null
        if (held) void sendRef.current(held)
        else scheduleSync.current()
      }
    }
  }
  const sendRef = useRef(send),
    refreshRef = useRef(refresh)
  useEffect(() => {
    sendRef.current = send
    refreshRef.current = refresh
  })
  useEffect(() => {
    mounted.current = true
    viewAcceptedAt.current = Date.now()
    const clearSyncTimer = () => {
      if (syncTimer.current === null) return
      window.clearTimeout(syncTimer.current)
      syncTimer.current = null
    }
    const schedule = () => {
      clearSyncTimer()
      if (!mounted.current) return
      const latest = current.current
      const serverNow =
        latest.serverNow +
        Math.max(0, viewAcceptedAt.current === null ? 0 : Date.now() - viewAcceptedAt.current)
      const delay = worldSyncDelayMs({
        routeLength: latest.route.length,
        movementBlocked: Boolean(latest.movementBlocked),
        nextStepAt: latest.nextStepAt,
        serverNow,
        remainingMs: remainingTravelMs(latest, serverNow),
      })
      syncTimer.current = window.setTimeout(() => {
        syncTimer.current = null
        if (!mounted.current || pending.current || refreshing.current) return
        const active = current.current
        const travelling = active.route.length > 0 && !active.movementBlocked
        if (travelling) {
          void sendRef.current({ kind: 'tick' })
          return
        }
        if (document.visibilityState === 'hidden') return
        void refreshRef.current().catch((error) => {
          if (mounted.current) setMessage(error.message)
        })
      }, delay)
    }
    scheduleSync.current = schedule
    schedule()
    return () => {
      mounted.current = false
      scheduleSync.current = () => {}
      clearSyncTimer()
    }
  }, [])
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || pending.current) return
      void refreshRef.current().catch((error) => {
        if (mounted.current) setMessage(error.message)
      })
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  const postState = useCallback(() => {
    const target = frame.current?.contentWindow
    if (!target || !stageReady.current) return
    const latest = current.current
    const elapsed = Math.max(
      0,
      viewAcceptedAt.current === null ? 0 : Date.now() - viewAcceptedAt.current,
    )
    const state: WorldStageState = buildStageState(
      latest,
      character,
      latest.serverNow + elapsed,
      pending.current,
    )
    target.postMessage({ av: 'world-host', type: 'state', state }, window.location.origin)
  }, [character])
  const postRef = useRef(postState)
  useEffect(() => {
    postRef.current = postState
  })
  useEffect(() => {
    postState()
  }, [view, busy, postState])
  // The frame can finish loading before React hydrates, so its one-time "ready" message may be
  // missed. Posting on load, and immediately when it is already loaded, closes that race; a
  // message sent to a stage that is not listening yet is simply dropped.
  useEffect(() => {
    const element = frame.current
    if (!element) return
    const onLoad = () => {
      stageReady.current = true
      postRef.current()
    }
    element.addEventListener('load', onLoad)
    try {
      if (element.contentDocument?.readyState === 'complete') onLoad()
    } catch {
      // A cross-origin frame cannot be inspected; the load event covers it.
    }
    return () => element.removeEventListener('load', onLoad)
  }, [])
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (!frame.current || event.source !== frame.current.contentWindow) return
      const message = parseStageMessage(event.data)
      if (!message) return
      if (message.type === 'ready') {
        stageReady.current = true
        postRef.current()
      } else if (message.type === 'walk')
        void sendRef.current({ kind: 'walk', destination: message.destination })
      else if (message.type === 'attack')
        void sendRef.current({ kind: 'attack', targetId: message.targetId })
      else if (message.type === 'tab') setJournal(message.tab === 'missions')
      else if (message.type === 'autopath')
        void sendRef.current({ kind: 'autopath', objectiveId: message.objectiveId })
      else if (message.type === 'travel') {
        const destination = travelDestination(current.current, message.sectorId)
        if (destination) void sendRef.current({ kind: 'walk', destination })
        else setMessage('That place has no known route yet. Chart the road to it first.')
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])
  // Confirm the steps already taken first, so the character stops where it is standing.
  async function stopMoving() {
    frame.current?.contentWindow?.postMessage(
      { av: 'world-host', type: 'stop' },
      window.location.origin,
    )
    if (current.current.route.length && !pending.current) await sendRef.current({ kind: 'tick' })
    await sendRef.current({ kind: 'stop' })
  }
  const local = view.sectors.find((s) => s.id === view.position.sectorId) ?? view.sectors[0]!
  const disabled = busy || Boolean(view.movementBlocked)
  const pulseObjectives = view.objectives.filter((objective) => objective.kind === 'event')
  const questObjectives = view.objectives.filter((objective) => objective.kind === 'quest')
  const autoPathButton = (
    objective: WorldView['objectives'][number],
    start: string,
    clues: string,
    running: string,
  ) => (
    <button
      className={styles.primary}
      disabled={
        view.routeObjectiveId !== objective.id &&
        (disabled || !objective.autoPath || !objective.destination)
      }
      onClick={() =>
        void (view.routeObjectiveId === objective.id
          ? stopMoving()
          : send({ kind: 'autopath', objectiveId: objective.id }))
      }
    >
      ♧{' '}
      {view.routeObjectiveId === objective.id
        ? running
        : objective.autoPath && objective.destination
          ? start
          : clues}
    </button>
  )
  return (
    <section
      className={styles.workspace}
      data-world-workspace
      data-world-view="sector"
      data-av-surface="moonstone"
    >
      <div className={styles.stageArea}>
        <iframe
          ref={frame}
          className={styles.stageFrame}
          title="World map"
          data-world-stage
          src="/world-stage/index.html"
          allow="fullscreen"
        />
        {journal ? (
          <aside className={styles.journal} id="world-journal" aria-label="Missions">
            <div className={styles.journalHead}>
              <h2>Missions</h2>
            </div>
            {view.interactions.length ? (
              <section className={styles.panel} aria-label="Local interaction">
                <h2>✦ Local interaction</h2>
                <p className={styles.quiet}>At your current position in {local.name}.</p>
                {view.interactions.map((interaction) => (
                  <div className={styles.quest} key={interaction.id}>
                    <h3>{interaction.title}</h3>
                    <p>
                      <strong>{interaction.speaker}</strong> · {interaction.body}
                    </p>
                    {interaction.actionLabel ? (
                      <button
                        className={styles.primary}
                        disabled={disabled || view.route.length > 0}
                        onClick={() =>
                          void send({ kind: 'interact', interactionId: interaction.id })
                        }
                      >
                        {interaction.actionLabel}
                      </button>
                    ) : (
                      <p className={styles.quiet}>
                        {interaction.progress === 'completed'
                          ? 'This objective is complete.'
                          : 'Return after checking the eastern watch.'}
                      </p>
                    )}
                  </div>
                ))}
              </section>
            ) : null}
            {pulseObjectives.length ? (
              <section className={styles.panel} aria-label="World Pulse">
                <h2>✦ World Pulse</h2>
                <p className={styles.quiet}>
                  Live happenings that currently reach your part of the world.
                </p>
                {pulseObjectives.map((objective) => (
                  <div className={styles.quest} key={objective.id}>
                    <h3>{objective.name}</h3>
                    <p>○ {objective.description}</p>
                    {autoPathButton(
                      objective,
                      'Follow event route',
                      'Follow the clues',
                      'Stop Auto-path',
                    )}
                  </div>
                ))}
              </section>
            ) : null}
            <section className={styles.panel}>
              <h2>⚑ Tracked Quests</h2>
              {questObjectives.map((objective) => (
                <div className={styles.quest} key={objective.id}>
                  <h3>{objective.name}</h3>
                  <p>
                    {objective.completed ? '✓ ' : '○ '}
                    {objective.description}
                  </p>
                  {!objective.completed
                    ? autoPathButton(
                        objective,
                        'Start Auto-path',
                        'Follow the clues',
                        'Stop Auto-path',
                      )
                    : null}
                </div>
              ))}
            </section>
            {view.archive.length ? (
              <section className={styles.panel} aria-label="Archive">
                <h2>▤ Archive</h2>
                {view.archive.map((entry) => (
                  <div className={styles.quest} key={entry.id}>
                    <h3>{entry.title}</h3>
                    <p>{entry.summary}</p>
                    <p className={styles.quiet}>
                      Field Observation · {entry.location} · {entry.provenance}
                    </p>
                  </div>
                ))}
              </section>
            ) : null}
            {view.anchors?.length ? (
              <section className={styles.panel} aria-label="Frontier Anchors">
                <h2>◇ Frontier Anchors</h2>
                <p className={styles.quiet}>
                  Persistent places you have personally confirmed beyond reliable cartography.
                </p>
                {view.anchors.map((anchor) => (
                  <div className={styles.quest} key={anchor.id}>
                    <h3>{anchor.name}</h3>
                    <p className={styles.quiet}>Recorded Anchor · persists in frontier history</p>
                  </div>
                ))}
              </section>
            ) : null}
            {!local.charted || samePosition(view.position, FRONTIER_APPROACH) ? (
              <section className={styles.panel}>
                <h2>Beyond the last map</h2>
                <p>Routes beyond this point may not remain where you left them.</p>
                {local.charted ? (
                  <button
                    className={styles.primary}
                    disabled={disabled || view.route.length > 0}
                    onClick={() => {
                      if (
                        window.confirm(
                          'Cross beyond the last reliable map? Your route ends here; the next steps must be surveyed.',
                        )
                      )
                        void send({ kind: 'cross' })
                    }}
                  >
                    Cross into uncharted territory
                  </button>
                ) : (
                  <p className={styles.quiet}>
                    Your survey is saved as you explore. Known ground keeps its coordinates.
                  </p>
                )}
              </section>
            ) : null}
          </aside>
        ) : null}
        <div className={styles.stageBar}>
          <span className={styles.stageLeft}>
            <span className={styles.coords} data-world-coordinates>
              <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
                <path
                  d="M12 2.5c-3.6 0-6.5 2.8-6.5 6.4 0 4.7 6.5 12.6 6.5 12.6s6.5-7.9 6.5-12.6c0-3.6-2.9-6.4-6.5-6.4zm0 8.8a2.4 2.4 0 110-4.8 2.4 2.4 0 010 4.8z"
                  fill="currentColor"
                />
              </svg>
              <span>
                <small>Coordinates</small>
                <b>
                  {local.coordinate} · E{local.east + view.position.x} · N
                  {local.north - view.position.y}
                </b>
              </span>
            </span>
          </span>
          <span data-world-travel-status className={styles.travelStatus}>
            {message || view.movementBlocked ? (
              <span role="status">{message || view.movementBlocked}</span>
            ) : null}
          </span>
          <span className={styles.stageActions}>
            {view.route.length ? (
              <button onClick={() => void stopMoving()}>Stop travel</button>
            ) : null}
            <button
              className={styles.gear}
              aria-label="Settings"
              title="Settings"
              onClick={() =>
                frame.current?.contentWindow?.postMessage(
                  { av: 'world-host', type: 'settings' },
                  window.location.origin,
                )
              }
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
                <path
                  d="M12 8.6a3.4 3.4 0 100 6.8 3.4 3.4 0 000-6.8zm8.4 4.4v-2l-2.1-.5a6.6 6.6 0 00-.7-1.6l1.1-1.9-1.4-1.4-1.9 1.1a6.6 6.6 0 00-1.6-.7L13 3.6h-2l-.5 2.1a6.6 6.6 0 00-1.6.7L7 5.3 5.6 6.7l1.1 1.9c-.3.5-.5 1-.7 1.6l-2.1.5v2l2.1.5c.2.6.4 1.1.7 1.6l-1.1 1.9L7 18.1l1.9-1.1c.5.3 1 .5 1.6.7l.5 2.1h2l.5-2.1c.6-.2 1.1-.4 1.6-.7l1.9 1.1 1.4-1.4-1.1-1.9c.3-.5.5-1 .7-1.6l2.1-.5z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </span>
        </div>
      </div>
    </section>
  )
}
