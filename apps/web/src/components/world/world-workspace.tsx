'use client'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { WORLD_LAND_NAME } from '@/world/atlas'
import { WORLD_REGIONS } from '@/world/catalog'
import { precipitationKind } from './map-weather'
import { remainingTravelMs, worldSyncDelayMs } from '@/world/travel'
import type { WorldIntent, WorldPosition, WorldView } from '@/world/types'
import { WorldConflict, WorldController } from './world-controller'
import { localRoute, mapPoint, WorldMotion } from './world-motion'
import { WorldMap } from './world-map'
import { WorldGlobe } from './world-globe'
import { WorldMissions } from './world-missions'
import styles from './workspace.module.css'

function SettingsButton({
  open,
  onClick,
  className,
}: {
  open: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      className={className}
      aria-label="Map settings"
      aria-expanded={open}
      aria-controls="world-settings"
      onClick={onClick}
    >
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M10 2h4l.6 3 2.2 1.3 2.8-1 2 3.4-2.2 2v2.6l2.2 2-2 3.4-2.8-1-2.2 1.3-.6 3h-4l-.6-3-2.2-1.3-2.8 1-2-3.4 2.2-2v-2.6l-2.2-2 2-3.4 2.8 1L9.4 5z" />
        <circle cx="12" cy="12" r="3.2" />
      </svg>
    </button>
  )
}

let fallbackZoomLock: boolean | null = null
const readZoomLock = () => {
  if (fallbackZoomLock !== null) return fallbackZoomLock
  try {
    return localStorage.getItem('aurevane.zoomLock') === 'on'
  } catch {
    return false
  }
}
const subscribeZoomLock = (changed: () => void) => {
  window.addEventListener('storage', changed)
  window.addEventListener('aurevane-zoom-lock', changed)
  return () => {
    window.removeEventListener('storage', changed)
    window.removeEventListener('aurevane-zoom-lock', changed)
  }
}
export function WorldWorkspace({
  initialView,
  character,
}: {
  initialView: WorldView
  character: { name: string; portrait: string }
}) {
  const router = useRouter(),
    [view, setView] = useState(initialView),
    [mode, setMode] = useState<'local' | 'global'>('local')
  const [tab, setTab] = useState<'nearby' | 'places' | 'missions'>('nearby'),
    [panelOpen, setPanelOpen] = useState(false),
    [message, setMessage] = useState('')
  const [active, setActive] = useState<WorldIntent | null>(null),
    [selectedPlayer, setSelectedPlayer] = useState<string | null>(null),
    [settings, setSettings] = useState(false),
    [visiblePlayerIds, setVisiblePlayerIds] = useState<string[] | null>(null),
    [destinationId, setDestinationId] = useState<string | null>(null)
  const [animate, setAnimate] = useState(true),
    [zoom, setZoom] = useState(1),
    [globeZoom, setGlobeZoom] = useState(0.94)
  const [motion] = useState(() => new WorldMotion(initialView))
  const zoomLocked = useSyncExternalStore(subscribeZoomLock, readZoomLock, () => false)
  const changeZoom = (value: number) =>
    (mode === 'global' ? setGlobeZoom : setZoom)(Math.max(0.6, Math.min(1.4, value)))
  const controller = useRef<WorldController | null>(null),
    acceptedAt = useRef(0)
  useEffect(() => {
    acceptedAt.current = Date.now()
    motion.reconcile(initialView, performance.now())
    let mounted = true,
      timer: number | null = null
    const accept = (next: WorldView, reconcile: boolean) => {
      if (!mounted) return
      if (next.battleSessionId) {
        router.replace(`/game/battle/${next.battleSessionId}`)
        return
      }
      if (next.characterId !== initialView.characterId) {
        router.refresh()
        return
      }
      acceptedAt.current = Date.now()
      if (reconcile) motion.reconcile(next, performance.now())
      setView(next)
      schedule()
    }
    const instance = new WorldController(initialView, {
      command: async (intent, current) => {
        const response = await fetch('/api/world', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            intent,
            characterId: current.characterId,
            expectedVersion: current.version,
            commandId: crypto.randomUUID(),
          }),
        })
        const body = await response.json()
        if (response.status === 409) throw new WorldConflict(body.error?.message)
        if (!response.ok) throw new Error(body.error?.message ?? 'The world could not respond.')
        return body as WorldView
      },
      refresh: async () => {
        const response = await fetch('/api/world', { cache: 'no-store' }),
          body = await response.json()
        if (!response.ok)
          throw new Error(body.error?.message ?? 'The world could not be refreshed.')
        return body as WorldView
      },
      accept,
      error: (text) => {
        if (mounted) setMessage(text)
      },
      busy: (intent) => {
        if (mounted) setActive(intent?.kind === 'tick' ? null : intent)
      },
    })
    controller.current = instance
    const schedule = () => {
      if (!mounted) return
      if (timer) clearTimeout(timer)
      const current = instance.view,
        now = current.serverNow + Math.max(0, Date.now() - acceptedAt.current)
      const delay = worldSyncDelayMs({
        routeLength: current.route.length,
        movementBlocked: Boolean(current.movementBlocked),
        nextStepAt: current.nextStepAt,
        serverNow: now,
        remainingMs: remainingTravelMs(current, now),
      })
      timer = window.setTimeout(
        async () => {
          if (document.visibilityState === 'visible' && !instance.pending) {
            if (instance.view.route.length && !instance.view.movementBlocked)
              await instance.send({ kind: 'tick' })
            else await instance.refresh()
          }
          schedule()
        },
        Math.max(100, delay),
      )
    }
    schedule()
    const visible = () => {
      if (document.visibilityState === 'visible') void instance.refresh()
    }
    document.addEventListener('visibilitychange', visible)
    return () => {
      mounted = false
      instance.dispose()
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', visible)
      controller.current = null
    }
  }, [initialView, router, motion])
  const send = useCallback(
    (intent: WorldIntent) => {
      setMessage('')
      if (intent.kind === 'stop') motion.stop(performance.now())
      void controller.current?.send(intent)
    },
    [motion],
  )
  const walk = useCallback(
    (destination: WorldPosition) => {
      const current = controller.current?.view
      if (!current || current.movementBlocked) return
      const route = localRoute(current, motion.sample(performance.now()).position, destination)
      if (route) motion.plan(route, current.sectors, performance.now())
      send({ kind: 'walk', destination })
    },
    [send, motion],
  )
  const stopMoving = () => {
    send({ kind: 'stop' })
  }
  const local = view.sectors.find((s) => s.id === view.position.sectorId) ?? view.sectors[0]!
  const region = WORLD_REGIONS.find((r) => r.id === local.regionId),
    localName = local.townId ? (region?.name ?? local.name) : local.name
  const actionBusy = Boolean(active && ['attack', 'interact', 'cross'].includes(active.kind)),
    disabled = actionBusy || Boolean(view.movementBlocked)
  const visibleIds = visiblePlayerIds && new Set(visiblePlayerIds)
  const nearby = view.players
    .filter((player) => !visibleIds || visibleIds.has(player.characterId))
    .sort((a, b) => {
      const origin = mapPoint(view.position, view.sectors),
        aa = mapPoint(a.position, view.sectors),
        bb = mapPoint(b.position, view.sectors)
      return (
        Math.hypot(aa.x - origin.x, aa.y - origin.y) - Math.hypot(bb.x - origin.x, bb.y - origin.y)
      )
    })
  const destination = view.atlas?.find((cell) => cell.id === destinationId && cell.charted)
  function approach(position: WorldPosition) {
    const candidates = [
      { ...position, x: position.x - 1 },
      { ...position, x: position.x + 1 },
      { ...position, y: position.y - 1 },
      { ...position, y: position.y + 1 },
    ]
    const routes = candidates
      .map((destination) => ({ destination, route: localRoute(view, view.position, destination) }))
      .filter((candidate) => candidate.route !== null)
      .sort((a, b) => a.route!.length - b.route!.length)
    if (routes[0]) walk(routes[0].destination)
    else setMessage('There is no known route to that character yet.')
  }
  const time = new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(view.environment.effectiveTimeMs)
  return (
    <section
      className={styles.workspace}
      data-world-workspace
      data-world-view={mode === 'local' ? 'sector' : 'globe'}
      data-av-surface="moonstone"
    >
      <header
        className={styles.header}
        style={{
          backgroundImage: `linear-gradient(90deg, #071c24 30%, #071c2480), url("/media/art/world/${region?.art ?? 'verdant-expanse'}-v01.webp")`,
        }}
      >
        <div>
          <button
            className={styles.location}
            title={mode === 'local' ? 'Open world atlas' : 'Return to local map'}
            aria-label={
              mode === 'local'
                ? `${localName} · Open world atlas`
                : `${WORLD_LAND_NAME} · Return to local map`
            }
            onClick={() => setMode(mode === 'local' ? 'global' : 'local')}
          >
            {mode === 'local' ? localName : WORLD_LAND_NAME}
          </button>
        </div>
        <div className={styles.environment}>
          <span>{time} UTC</span>
          {mode === 'local' ? (
            <span>
              {precipitationKind(view.environment.weather, local.regionId) === 'snow'
                ? view.environment.weather === 'storm'
                  ? 'Snowstorm'
                  : 'Snow'
                : view.environment.weather}
            </span>
          ) : null}
        </div>
        <button
          className={styles.panelToggle}
          aria-controls="world-panel"
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen(!panelOpen)}
        >
          {panelOpen ? 'Close details' : 'Details'} <span aria-hidden="true">☰</span>
        </button>
        {!panelOpen ? (
          <SettingsButton
            className={styles.mobileSettings}
            open={settings}
            onClick={() => setSettings(!settings)}
          />
        ) : null}
      </header>
      <div className={styles.body}>
        <div className={styles.stageArea}>
          {mode === 'local' ? (
            <WorldMap
              view={view}
              motion={motion}
              portrait={character.portrait}
              animate={animate}
              paused={false}
              zoom={zoom}
              zoomLocked={zoomLocked}
              onZoom={setZoom}
              onVisiblePlayers={setVisiblePlayerIds}
              onWalk={walk}
              onStop={stopMoving}
              onPlayer={(id) => {
                setSelectedPlayer(id)
                setTab('nearby')
                setPanelOpen(true)
              }}
            />
          ) : (
            <WorldGlobe
              view={view}
              zoom={globeZoom}
              zoomLocked={zoomLocked}
              onZoom={setGlobeZoom}
              selected={destinationId}
              onSelect={(id) => {
                setDestinationId(id)
                if (id) setPanelOpen(true)
              }}
            />
          )}
        </div>
        <aside
          id="world-panel"
          className={`${styles.sidebar} ${panelOpen ? styles.open : ''}`}
          aria-label="World details"
        >
          {mode === 'local' ? (
            <div className={styles.tabs} role="tablist" aria-label="World details">
              <button
                id="nearby-tab"
                role="tab"
                aria-selected={tab === 'nearby'}
                aria-controls="nearby-content"
                onClick={() => setTab('nearby')}
              >
                Nearby <i aria-label={`${nearby.length} visible players`}>{nearby.length}</i>
              </button>
              <button
                id="places-tab"
                role="tab"
                aria-selected={tab === 'places'}
                aria-controls="places-content"
                onClick={() => setTab('places')}
              >
                Places
              </button>
              <button
                id="missions-tab"
                role="tab"
                aria-selected={tab === 'missions'}
                aria-controls="missions-content"
                onClick={() => setTab('missions')}
              >
                Missions{' '}
                {view.objectives.filter((o) => !o.completed).length ? (
                  <i>{view.objectives.filter((o) => !o.completed).length}</i>
                ) : null}
              </button>
            </div>
          ) : null}
          <div className={styles.panelScroll}>
            {mode === 'local' && tab === 'missions' ? (
              <div id="missions-content" role="tabpanel" aria-labelledby="missions-tab">
                <WorldMissions
                  view={view}
                  disabled={disabled}
                  send={send}
                  stopMoving={stopMoving}
                />
              </div>
            ) : mode === 'local' && tab === 'places' ? (
              <div
                id="places-content"
                role="tabpanel"
                aria-labelledby="places-tab"
                className={styles.landmarks}
              >
                <h2>Places nearby</h2>
                {view.sectors
                  .flatMap((sector) =>
                    sector.landmarks
                      .filter((p) => p.kind !== 'frontier')
                      .map((p) => ({ p, sector })),
                  )
                  .sort((a, b) => {
                    const here = mapPoint(view.position, view.sectors),
                      aa = mapPoint({ ...a.p, sectorId: a.sector.id }, view.sectors),
                      bb = mapPoint({ ...b.p, sectorId: b.sector.id }, view.sectors)
                    return (
                      Math.hypot(aa.x - here.x, aa.y - here.y) -
                      Math.hypot(bb.x - here.x, bb.y - here.y)
                    )
                  })
                  .map(({ p, sector }) => (
                    <button
                      key={p.id}
                      disabled={disabled}
                      onClick={() => walk({ sectorId: sector.id, x: p.x, y: p.y })}
                    >
                      <span>◇</span>
                      <div>
                        {p.name}
                        <small>{sector.name}</small>
                      </div>
                      <span>↗</span>
                    </button>
                  ))}
              </div>
            ) : (
              <div
                id="nearby-content"
                role={mode === 'local' ? 'tabpanel' : 'region'}
                aria-labelledby={mode === 'local' ? 'nearby-tab' : undefined}
                aria-label={mode === 'global' ? 'World overview' : undefined}
              >
                {mode === 'global' ? (
                  <section className={styles.position}>
                    <small>YOUR POSITION</small>
                    <h2>{localName}</h2>
                  </section>
                ) : null}
                {mode === 'global' && destination ? (
                  <section className={styles.destination} aria-label="Selected destination">
                    <small>{destination.coordinate}</small>
                    <h2>{destination.name}</h2>
                    <button
                      className={styles.primary}
                      disabled={disabled}
                      onClick={() => {
                        walk({ sectorId: destination.id, x: 6, y: 4 })
                        setMode('local')
                        setDestinationId(null)
                        setPanelOpen(false)
                      }}
                    >
                      Travel here
                    </button>
                    <button aria-label="Clear destination" onClick={() => setDestinationId(null)}>
                      ×
                    </button>
                  </section>
                ) : null}
                {mode === 'local' ? (
                  <section className={styles.characters}>
                    {nearby.length
                      ? nearby.map((player) => {
                          const inRange =
                            player.position.sectorId === view.position.sectorId &&
                            Math.abs(player.position.x - view.position.x) +
                              Math.abs(player.position.y - view.position.y) <=
                              1
                          const attacking =
                            active?.kind === 'attack' && active.targetId === player.characterId
                          return (
                            <article
                              key={player.characterId}
                              className={`${styles.player} ${selectedPlayer === player.characterId ? styles.selected : ''}`}
                              data-world-player={player.characterId}
                            >
                              {player.imageUrl ? (
                                <Image
                                  src={player.imageUrl}
                                  alt=""
                                  width={56}
                                  height={56}
                                  unoptimized
                                />
                              ) : (
                                <span className={styles.avatar}>{player.name[0]}</span>
                              )}
                              <div>
                                <strong>{player.name}</strong>
                                <small>
                                  Level {player.level}
                                  {player.online ? ' · Online' : ''}
                                </small>
                                <div className={styles.rowActions}>
                                  {inRange ? (
                                    <>
                                      {player.attackable ? (
                                        <button
                                          disabled={disabled}
                                          onClick={() =>
                                            send({ kind: 'attack', targetId: player.characterId })
                                          }
                                        >
                                          {attacking ? 'Attacking…' : 'Attack'}
                                        </button>
                                      ) : null}
                                      <button disabled title="Coming soon">
                                        Talk
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      disabled={Boolean(view.movementBlocked)}
                                      onClick={() => approach(player.position)}
                                    >
                                      Approach
                                    </button>
                                  )}
                                </div>
                              </div>
                            </article>
                          )
                        })
                      : null}
                  </section>
                ) : null}
              </div>
            )}
          </div>
          <div className={styles.panelFoot}>
            <p
              className={styles.currentCoordinates}
              data-world-coordinates
              aria-label="Current sector and coordinates"
            >
              <span>Sector {local.coordinate}</span>
              <span>
                E{local.east + view.position.x} · N{local.north - view.position.y}
              </span>
            </p>
            <SettingsButton open={settings} onClick={() => setSettings(!settings)} />
          </div>
        </aside>
      </div>
      {message || view.movementBlocked ? (
        <div className={styles.errorNotice} role="alert">
          <span>{message || view.movementBlocked}</span>
          {message ? (
            <button aria-label="Dismiss message" onClick={() => setMessage('')}>
              ×
            </button>
          ) : null}
        </div>
      ) : null}
      {settings ? (
        <>
          <button
            className={styles.settingsBackdrop}
            aria-label="Close map settings"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setSettings(false)}
            onWheel={(event) => event.stopPropagation()}
          />
          <div
            id="world-settings"
            className={styles.settings}
            role="dialog"
            aria-label="Map settings"
            onKeyDown={(event) => {
              if (event.key === 'Escape') setSettings(false)
            }}
          >
            <h3>Map settings</h3>
            <label className={styles.zoomSetting}>
              Zoom
              <input
                autoFocus
                aria-label="Zoom level"
                type="range"
                min="60"
                max="140"
                step="2"
                value={Math.round((mode === 'global' ? globeZoom : zoom) * 100)}
                onChange={(event) => changeZoom(Number(event.target.value) / 100)}
              />
              <output>{Math.round((mode === 'global' ? globeZoom : zoom) * 100)}%</output>
            </label>
            <div className={styles.zoomButtons}>
              <button
                aria-pressed={zoomLocked}
                onClick={() => {
                  fallbackZoomLock = !zoomLocked
                  try {
                    localStorage.setItem('aurevane.zoomLock', !zoomLocked ? 'on' : 'off')
                    fallbackZoomLock = null
                  } catch {}
                  window.dispatchEvent(new Event('aurevane-zoom-lock'))
                }}
              >
                Zoom lock {zoomLocked ? 'On' : 'Off'}
              </button>
            </div>
            <label>
              <input
                type="checkbox"
                checked={animate}
                onChange={(event) => setAnimate(event.target.checked)}
              />{' '}
              Ambient animation
            </label>
            <p>Reduced motion follows your device preference.</p>
            <button onClick={() => setSettings(false)}>Done</button>
          </div>
        </>
      ) : null}
    </section>
  )
}
