'use client'
import { ChatPanel } from '@/components/social/chat/chat-panel'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { OnlinePresenceLink } from '@/components/shell/online-presence-link'
import { WORLD_LAND_NAME } from '@/world/atlas'
import { WORLD_REGIONS } from '@/world/catalog'
import { precipitationKind } from './map-weather'
import { remainingTravelMs, worldSyncDelayMs } from '@/world/travel'
import type { WorldAttackReceipt } from '@/world/attack-receipt'
import { mergeWorldMovement } from '@/world/movement-receipt'
import { WorldNearbyPlayer } from './world-nearby-player'
import { WorldPlacePortrait } from './world-place-portrait'
import { mergeWorldRefresh, worldRefreshUrl } from '@/world/presence'
import type { WorldIntent, WorldPosition, WorldView } from '@/world/types'
import { WorldConflict, WorldController } from './world-controller'
import { worldSceneCoversViewport } from './world-scene-coverage'
import { WorldLivePresence } from './world-live-presence'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { localRoute, mapPoint, prepareLocalRoute, WorldMotion } from './world-motion'
import { WorldMap } from './world-map'
import { WorldGlobe } from './world-globe'
import { WorldMissions } from './world-missions'
import { clampWorldZoom, WORLD_MIN_ZOOM, WORLD_MAX_ZOOM } from './world-zoom'
import { battleSessionHref } from '@/components/battle/battle-return-navigation'
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
  const [tab, setTab] = useState<'nearby' | 'places' | 'missions' | 'chat'>('nearby'),
    [panelOpen, setPanelOpen] = useState(false),
    [message, setMessage] = useState('')
  const [active, setActive] = useState<WorldIntent | null>(null),
    [selectedPlayer, setSelectedPlayer] = useState<string | null>(null),
    [approachingPlayer, setApproachingPlayer] = useState<string | null>(null),
    [settings, setSettings] = useState(false),
    [visiblePlayerIds, setVisiblePlayerIds] = useState<string[] | null>(null),
    [destinationId, setDestinationId] = useState<string | null>(null)
  const [animate, setAnimate] = useState(true),
    [zoom, setZoom] = useState(1),
    [globeZoom, setGlobeZoom] = useState(0.94)
  const [motion] = useState(() => new WorldMotion(initialView, performance.now()))
  const [approvedPosition, setApprovedPosition] = useState(initialView.position)
  const zoomLocked = useSyncExternalStore(subscribeZoomLock, readZoomLock, () => false)
  const changeZoom = (value: number) =>
    (mode === 'global' ? setGlobeZoom : setZoom)(clampWorldZoom(value))
  const controller = useRef<WorldController | null>(null),
    livePresence = useRef<WorldLivePresence | null>(null),
    acceptedAt = useRef(0),
    localViewActive = useRef(true)
  useEffect(() => {
    localViewActive.current = mode === 'local'
    if (controller.current)
      livePresence.current?.update(
        controller.current.view,
        mode === 'local' && document.visibilityState === 'visible',
      )
    if (mode === 'local') void controller.current?.refresh()
  }, [mode])
  useEffect(() => {
    acceptedAt.current = Date.now()
    motion.reconcile(initialView, performance.now())
    let mounted = true,
      timer: number | null = null,
      arrivalTimer: number | null = null,
      sceneTimer: number | null = null
    const scheduleArrival = () => {
      if (arrivalTimer !== null) clearTimeout(arrivalTimer)
      if (!mounted) return
      const now = performance.now()
      setApprovedPosition(motion.approvedPosition(now))
      const delay = motion.nextApprovedTransitionDelay(now)
      if (delay !== null) arrivalTimer = window.setTimeout(scheduleArrival, Math.max(1, delay))
    }
    const accept = (next: WorldView, reconcile: boolean) => {
      if (!mounted) return
      if (next.battleSessionId) {
        router.replace(battleSessionHref(next.battleSessionId, 'world'))
        return
      }
      if (next.characterId !== initialView.characterId) {
        router.refresh()
        return
      }
      acceptedAt.current = Date.now()
      if (reconcile) motion.reconcile(next, performance.now())
      else motion.approveReceipt(next, performance.now())
      scheduleArrival()
      setView(next)
      live.update(next, localViewActive.current && document.visibilityState === 'visible')
      schedule()
    }
    const instance: WorldController = new WorldController(initialView, {
      command: async (intent, current) => {
        const response = await fetch('/api/world', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-world-response': 'movement' },
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
        if (intent.kind === 'attack') {
          if (
            body.characterId !== current.characterId ||
            typeof body.battleSessionId !== 'string' ||
            !body.battleSessionId.trim()
          )
            throw new Error('The encounter could not be opened safely.')
          return body as WorldAttackReceipt
        }
        return body.kind === 'movement'
          ? mergeWorldMovement(current, body)
          : mergeWorldRefresh(current, body as WorldView)
      },
      refresh: async (signal, fullScene) => {
        const previous = instance.view
        const response = await fetch(fullScene ? '/api/world' : worldRefreshUrl(previous), {
            cache: 'no-store',
            signal,
          }),
          body = await response.json()
        if (!response.ok)
          throw new Error(body.error?.message ?? 'The world could not be refreshed.')
        return mergeWorldRefresh(previous, body)
      },
      accept,
      sceneCovered: (current) => {
        if (!localViewActive.current) return true
        const canvas = document.querySelector<HTMLCanvasElement>('canvas[data-world-stage]')
        if (!canvas) return false
        const point = motion.sample(performance.now()).point
        return worldSceneCoversViewport(
          current,
          [
            point,
            ...current.route
              .slice(0, 4)
              .map((step) => mapPoint(step.position, current.sectors, point)),
          ],
          {
            width: canvas.clientWidth,
            height: canvas.clientHeight,
            tile: Number(canvas.dataset.tileSize),
          },
        )
      },
      presentation: (next) => {
        if (!mounted) return
        motion.updateScene(next.sectors, performance.now())
        scheduleArrival()
        scheduleScene()
        setView(next)
        live.update(next, localViewActive.current && document.visibilityState === 'visible')
      },
      error: (text) => {
        if (mounted) {
          setMessage(text)
          setApproachingPlayer(null)
        }
      },
      busy: (intent) => {
        if (mounted) setActive(intent?.kind === 'tick' ? null : intent)
      },
    })
    controller.current = instance
    let client: ReturnType<typeof createSupabaseBrowserClient> | null = null
    const live = new WorldLivePresence({
      getView: () => instance.view,
      subscribe: (topic, changed) => {
        client ??= createSupabaseBrowserClient()
        const connection = client
        const channel = connection
          .channel(topic, { config: { private: true } })
          .on('broadcast', { event: 'changed' }, changed)
        let alive = true
        void connection.auth
          .getSession()
          .then(async ({ data }) => {
            if (!alive || !data.session) return
            await connection.realtime.setAuth(data.session.access_token)
            if (alive)
              channel.subscribe((status) => {
                if (status === 'SUBSCRIBED') changed()
              })
          })
          .catch(() => {
            /* Owned polling remains available. */
          })
        return () => {
          alive = false
          void connection.removeChannel(channel)
        }
      },
      read: async (current, signal) => {
        const query = new URLSearchParams({
          version: String(current.version),
          characterId: current.characterId,
        })
        const response = await fetch(`/api/world/presence?${query}`, { cache: 'no-store', signal })
        if (!response.ok) throw new Error('World presence is temporarily unavailable.')
        return response.json()
      },
      accept: (source, receipt) => {
        if (mounted && instance.acceptPlayers(source, receipt.players)) setView(instance.view)
      },
    })
    livePresence.current = live
    live.update(initialView, localViewActive.current && document.visibilityState === 'visible')
    const scheduleScene = () => {
      if (sceneTimer !== null) clearTimeout(sceneTimer)
      if (!mounted || !instance.view.route.length || instance.view.movementBlocked) return
      const current = instance.view,
        now = current.serverNow + Math.max(0, Date.now() - acceptedAt.current)
      const loaded = motion.loadedHorizonMs(performance.now()),
        remaining = remainingTravelMs(current, now)
      if (loaded >= remaining - 1) return
      sceneTimer = window.setTimeout(
        async () => {
          if (document.visibilityState === 'visible') await instance.hydrate()
          scheduleScene()
        },
        Math.max(100, loaded - 1200),
      )
    }
    const schedule = () => {
      if (!mounted) return
      if (timer) clearTimeout(timer)
      scheduleScene()
      const current = instance.view,
        now = current.serverNow + Math.max(0, Date.now() - acceptedAt.current)
      const delay = worldSyncDelayMs({
        routeLength: current.route.length,
        movementBlocked: Boolean(current.movementBlocked),
        nextStepAt: current.nextStepAt,
        serverNow: now,
        remainingMs: remainingTravelMs(current, now),
        observePlayers: localViewActive.current,
        onlinePlayers: current.players.filter((player) => player.online !== false).length,
      })
      timer = window.setTimeout(
        async () => {
          if (document.visibilityState === 'visible' && !instance.pending) {
            if (instance.view.route.length && !instance.view.movementBlocked) {
              await instance.send({ kind: 'tick' })
              void instance.hydrate({ movement: true })
            } else await instance.refresh()
          }
          schedule()
        },
        Math.max(100, delay),
      )
    }
    schedule()
    scheduleArrival()
    const visible = () => {
      live.update(instance.view, localViewActive.current && document.visibilityState === 'visible')
      if (document.visibilityState === 'visible') void instance.refresh(true)
    }
    document.addEventListener('visibilitychange', visible)
    return () => {
      mounted = false
      live.dispose()
      livePresence.current = null
      instance.dispose()
      if (timer) clearTimeout(timer)
      if (arrivalTimer !== null) clearTimeout(arrivalTimer)
      if (sceneTimer !== null) clearTimeout(sceneTimer)
      document.removeEventListener('visibilitychange', visible)
      controller.current = null
    }
  }, [initialView, router, motion])
  useEffect(() => {
    if (!approachingPlayer || controller.current?.pending) return
    const target = view.players.find((player) => player.characterId === approachingPlayer)
    const inRange =
      target &&
      target.position.sectorId === approvedPosition.sectorId &&
      Math.abs(target.position.x - approvedPosition.x) +
        Math.abs(target.position.y - approvedPosition.y) <=
        1
    const now = view.serverNow + Math.max(0, Date.now() - acceptedAt.current)
    if (!inRange && (!view.route.length || remainingTravelMs(view, now) <= 0))
      setApproachingPlayer(null)
  }, [approachingPlayer, approvedPosition, view, active])
  const send = useCallback(
    (intent: WorldIntent) => {
      setMessage('')
      if (intent.kind === 'stop') motion.stop(performance.now())
      else if (intent.kind === 'attack') motion.hold(performance.now())
      void controller.current?.send(intent).then(() => {
        if (['walk', 'autopath', 'stop'].includes(intent.kind))
          void controller.current?.hydrate({ movement: true })
      })
    },
    [motion],
  )
  const walk = useCallback(
    (destination: WorldPosition) => {
      const current = controller.current?.view
      if (
        !current ||
        current.movementBlocked ||
        current.battleSessionId ||
        controller.current?.attackPending
      )
        return
      setApproachingPlayer(null)
      const now = performance.now(),
        route = localRoute(current, motion.sample(now).position, destination)
      if (route) motion.plan(route, current.sectors, now)
      send({ kind: 'walk', destination })
    },
    [send, motion],
  )
  const stopMoving = () => {
    setApproachingPlayer(null)
    send({ kind: 'stop' })
  }
  const currentSector = view.sectors.find((s) => s.id === approvedPosition.sectorId)
  const local = currentSector ?? view.sectors[0]!
  const currentCell = currentSector?.cells.find(
    (cell) => cell.x === approvedPosition.x && cell.y === approvedPosition.y,
  )
  const zone = currentCell?.safe === true ? 'safe' : currentCell?.safe === false ? 'pvp' : 'unknown'
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
  const approach = useCallback(
    (position: WorldPosition) => {
      const current = controller.current?.view
      if (
        !current ||
        current.movementBlocked ||
        current.battleSessionId ||
        controller.current?.attackPending
      )
        return
      const now = performance.now(),
        from = motion.sample(now).position,
        navigate = prepareLocalRoute(current)
      const candidates = [
        { ...position, x: position.x - 1 },
        { ...position, x: position.x + 1 },
        { ...position, y: position.y - 1 },
        { ...position, y: position.y + 1 },
      ]
      const routes = candidates
        .map((destination) => ({ destination, route: navigate(from, destination) }))
        .filter((candidate) => candidate.route !== null)
        .sort((a, b) => a.route!.length - b.route!.length)
      if (routes[0]) {
        motion.plan(routes[0].route!, current.sectors, now)
        send({ kind: 'walk', destination: routes[0].destination })
      } else {
        setApproachingPlayer(null)
        setMessage('There is no known route to that character yet.')
      }
    },
    [motion, send],
  )
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
          <OnlinePresenceLink className={styles.onlineCompact} compact />
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
              <button
                id="chat-tab"
                role="tab"
                aria-selected={tab === 'chat'}
                aria-controls="chat-content"
                onClick={() => setTab('chat')}
              >
                Chat
              </button>
            </div>
          ) : null}
          <div className={styles.panelScroll}>
            {mode === 'local' && tab === 'chat' ? (
              <div
                id="chat-content"
                role="tabpanel"
                aria-labelledby="chat-tab"
                className={styles.chatHost}
              >
                <ChatPanel selfName={character.name} />
              </div>
            ) : mode === 'local' && tab === 'missions' ? (
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
                      <WorldPlacePortrait place={p} />
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
                          const targetCell = view.sectors
                            .find((s) => s.id === player.position.sectorId)
                            ?.cells.find(
                              (c) => c.x === player.position.x && c.y === player.position.y,
                            )
                          return (
                            <WorldNearbyPlayer
                              key={player.characterId}
                              player={{
                                ...player,
                                attackEligible:
                                  Boolean(player.attackEligible ?? player.attackable) &&
                                  currentCell?.safe === false &&
                                  targetCell?.safe === false,
                              }}
                              ownerPosition={approvedPosition}
                              disabled={disabled}
                              approaching={approachingPlayer === player.characterId}
                              attacking={
                                active?.kind === 'attack' && active.targetId === player.characterId
                              }
                              selected={selectedPlayer === player.characterId}
                              onApproach={() => {
                                setApproachingPlayer(player.characterId)
                                approach(player.position)
                              }}
                              onAttack={() =>
                                send({ kind: 'attack', targetId: player.characterId })
                              }
                            />
                          )
                        })
                      : null}
                  </section>
                ) : null}
              </div>
            )}
          </div>
          <div className={styles.panelFoot} data-world-panel-foot>
            <p
              className={styles.currentCoordinates}
              data-world-coordinates
              aria-label="Current sector and coordinates"
            >
              <span className={styles.coordinateHeader}>
                <span>Sector {local.coordinate}</span>
                <span className={styles.zoneStatus} data-world-zone={zone} role="status">
                  {zone === 'safe' ? 'Safe Zone' : zone === 'pvp' ? 'PvP Zone' : 'Zone unavailable'}
                </span>
              </span>
              <span>
                E{local.east + approvedPosition.x} · N{local.north - approvedPosition.y}
              </span>
            </p>
            <div className={styles.panelFootActions}>
              <SettingsButton open={settings} onClick={() => setSettings(!settings)} />
            </div>
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
                min={WORLD_MIN_ZOOM * 100}
                max={WORLD_MAX_ZOOM * 100}
                step="1"
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
