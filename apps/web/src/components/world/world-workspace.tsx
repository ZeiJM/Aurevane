'use client'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { WORLD_REGIONS, FRONTIER_APPROACH, worldRegion } from '@/world/catalog'
import { remainingTravelMs, samePosition, worldSyncDelayMs } from '@/world/travel'
import type { WorldIntent, WorldPosition, WorldView } from '@/world/types'
import { Globe } from './globe'
import { SectorMap } from './sector-map'
import { Surroundings } from './surroundings'
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
    [mode, setMode] = useState<'globe' | 'sector'>('sector'),
    [selected, setSelected] = useState(initialView.position.sectorId)
  const [grid, setGrid] = useState(true),
    [motion, setMotion] = useState(true),
    [layers, setLayers] = useState(false),
    [panorama, setPanorama] = useState(false),
    [focus, setFocus] = useState(0)
  const [search, setSearch] = useState(''),
    [target, setTarget] = useState<string | null>(null),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false)
  const current = useRef(initialView),
    pending = useRef(false),
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
    if (next.position.sectorId !== current.current.position.sectorId) {
      setSelected(next.position.sectorId)
      setPanorama(false)
    }
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
    if (pending.current) return
    pending.current = true
    setBusy(true)
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
        setBusy(false)
        scheduleSync.current()
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
      const delay = worldSyncDelayMs({
        routeLength: latest.route.length,
        movementBlocked: Boolean(latest.movementBlocked),
        nextStepAt: latest.nextStepAt,
        serverNow:
          latest.serverNow +
          Math.max(0, viewAcceptedAt.current === null ? 0 : Date.now() - viewAcceptedAt.current),
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
  const sector = view.sectors.find((s) => s.id === selected) ?? view.sectors[0]!
  const player = view.players.find((p) => p.characterId === target) ?? view.players[0]
  const local = view.sectors.find((s) => s.id === view.position.sectorId)!
  const safe = local.cells.find((c) => c.x === view.position.x && c.y === view.position.y)?.safe
  const destination = view.route.at(-1)?.position
  const destinationName = view.sectors.find((s) => s.id === destination?.sectorId)?.name
  const remainingSeconds = Math.ceil(remainingTravelMs(view, view.serverNow) / 1000)
  const remainingTime =
    remainingSeconds >= 60
      ? `${Math.floor(remainingSeconds / 60)}m ${remainingSeconds % 60}s`
      : `${remainingSeconds}s`
  function select(id: string) {
    setSelected(id)
    setSearch('')
  }
  function walk(destination: WorldPosition) {
    void send({ kind: 'walk', destination })
  }
  const disabled = busy || Boolean(view.movementBlocked)
  const pulseObjectives = view.objectives.filter((objective) => objective.kind === 'event')
  const questObjectives = view.objectives.filter((objective) => objective.kind === 'quest')
  const majorRegionIds = new Set(WORLD_REGIONS.map((region) => region.id))
  const chartedMinorSectors = view.sectors.filter(
    (candidate) =>
      candidate.charted &&
      !majorRegionIds.has(candidate.id) &&
      (candidate.name.toLowerCase().includes(search.toLowerCase()) ||
        candidate.coordinate.toLowerCase().includes(search.toLowerCase())),
  )
  return (
    <section className={styles.workspace} data-world-workspace data-av-surface="moonstone">
      <div className={styles.mapColumn}>
        <header className={styles.toolbar}>
          <div className={styles.heading}>
            <span className={styles.compass} aria-hidden="true">
              ✥
            </span>
            <div>
              <h1>{mode === 'globe' ? 'World Map' : sector.name}</h1>
              <p>
                {mode === 'globe'
                  ? 'The known world, and the roads beyond'
                  : selected === view.position.sectorId
                    ? `${sector.coordinate} · E${local.east + view.position.x} / N${local.north - view.position.y}`
                    : `${sector.coordinate} · Inspecting this region`}
              </p>
            </div>
          </div>
          <div className={styles.tools}>
            <button aria-pressed={grid} onClick={() => setGrid(!grid)}>
              ▦ Grid
            </button>
            <button aria-expanded={layers} onClick={() => setLayers(!layers)}>
              ▱ Layers
            </button>
            <button
              onClick={() => {
                setSelected(view.position.sectorId)
                setFocus((n) => n + 1)
              }}
            >
              ⌖ My Position
            </button>
            <button disabled={!local.panorama} onClick={() => setPanorama(true)}>
              ◉ View 360°
            </button>
          </div>
          <div className={styles.toolbarBottom}>
            <div className={styles.tabs} role="group" aria-label="Map view">
              <button aria-pressed={mode === 'globe'} onClick={() => setMode('globe')}>
                ◎ Globe
              </button>
              <button aria-pressed={mode === 'sector'} onClick={() => setMode('sector')}>
                ✥ Sector
              </button>
            </div>
            <span className={styles.territory} data-safe={safe}>
              {safe ? '◇ Protected settlement' : '⚔ Open PvP territory'}
              <small>
                {safe ? 'A place to rest and prepare.' : 'Other travellers may be encountered.'}
              </small>
            </span>
          </div>
          {layers ? (
            <div className={styles.layerPanel}>
              <label>
                <input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} />
                Coordinate grid
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={motion}
                  onChange={(e) => setMotion(e.target.checked)}
                />
                Environmental motion
              </label>
              <p>Uncharted places reveal themselves as you explore.</p>
            </div>
          ) : null}
        </header>
        <div className={styles.mapViewport}>
          {mode === 'globe' ? (
            <Globe
              sectorCoordinate={local.coordinate}
              selected={selected}
              sectors={view.sectors}
              onSelect={(id) => {
                select(id)
                setMessage('')
              }}
              onUnavailable={(coordinate) =>
                setMessage(
                  `${coordinate} is uncharted. No charted destination is available there yet.`,
                )
              }
              grid={grid}
              portrait={character.portrait}
              name={character.name}
              focusKey={focus}
            />
          ) : (
            <SectorMap
              sector={sector}
              position={view.position}
              route={view.route}
              players={view.players}
              portrait={character.portrait}
              name={character.name}
              grid={grid}
              motion={motion}
              disabled={disabled}
              onMove={walk}
              onPlayer={setTarget}
            />
          )}
        </div>
        <div className={styles.travelBar}>
          <span data-world-travel-status>
            {view.route.length ? (
              <>
                <strong>
                  {view.route[0]?.road ?? 'Walking'} → {destinationName}
                </strong>
                <small>
                  About {remainingTime} · {view.route.length} steps remaining
                </small>
              </>
            ) : selected !== view.position.sectorId ? (
              'Inspecting a charted sector. Choose a walkable tile to plot your journey.'
            ) : (
              'Select a square to walk there.'
            )}
          </span>
          {view.route.length ? (
            <button onClick={() => void send({ kind: 'stop' })} disabled={busy}>
              Stop travel
            </button>
          ) : null}
        </div>
        {message || view.movementBlocked ? (
          <p role="status" className={styles.notice}>
            {message || view.movementBlocked}
          </p>
        ) : null}
      </div>
      <aside className={styles.sidebar}>
        {view.interactions.length ? (
          <section className={styles.panel} aria-label="Local interaction">
            <h2>✦ Local interaction</h2>
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
                    onClick={() => void send({ kind: 'interact', interactionId: interaction.id })}
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
        {mode === 'globe' ? (
          <section className={styles.panel}>
            <h2>✥ World Regions</h2>
            <input
              className={styles.search}
              aria-label="Find a region"
              placeholder="Find a region…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className={styles.regionList}>
              {WORLD_REGIONS.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())).map(
                (r) => (
                  <button key={r.id} data-active={selected === r.id} onClick={() => select(r.id)}>
                    <Image
                      src={`/media/art/world/${r.art}-v01.webp`}
                      alt=""
                      width={56}
                      height={47}
                    />
                    <span>{r.name}</span>
                  </button>
                ),
              )}
            </div>
            {chartedMinorSectors.length ? (
              <div className={styles.chartedSectorIndex}>
                <h3>Charted Sectors</h3>
                <div className={styles.chartedSectorList}>
                  {chartedMinorSectors.map((chartedSector) => (
                    <button
                      key={chartedSector.id}
                      data-active={selected === chartedSector.id}
                      onClick={() => select(chartedSector.id)}
                    >
                      <strong>{chartedSector.name}</strong>
                      <small>{chartedSector.coordinate}</small>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <p className={styles.regionDescription}>
              {worldRegion(selected)?.summary ??
                `${sector.name} · ${sector.coordinate}. An unlabeled charted sector.`}
            </p>
            <button className={styles.primary} onClick={() => setMode('sector')}>
              Inspect sector →
            </button>
          </section>
        ) : (
          <section className={styles.panel}>
            <h2>⚑ Nearby Players</h2>
            {player ? (
              <>
                <div className={styles.playerSummary}>
                  <Image src={player.imageUrl!} alt="" width={72} height={72} />
                  <div>
                    <h3>{player.name}</h3>
                    <span>Level {player.level}</span>
                    <small>{player.attackable ? '● Within reach' : 'Approach to interact'}</small>
                  </div>
                </div>
                {view.players.length > 1 ? (
                  <select
                    aria-label="Select nearby player"
                    value={player.characterId}
                    onChange={(e) => setTarget(e.target.value)}
                  >
                    {view.players.map((p) => (
                      <option key={p.characterId} value={p.characterId}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                <button
                  className={styles.attack}
                  disabled={disabled || !player.attackable}
                  onClick={() => void send({ kind: 'attack', targetId: player.characterId })}
                >
                  ⚔ Attack
                </button>
                <p className={styles.quiet}>
                  Attacks begin tactical combat immediately in open territory.
                </p>
              </>
            ) : (
              <div className={styles.emptyPlayers}>
                <span>♧</span>
                <h3>A quiet stretch of road</h3>
                <p>Other travellers appear here when they enter your surroundings.</p>
              </div>
            )}
          </section>
        )}
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
                <button
                  className={styles.primary}
                  disabled={
                    busy ||
                    (view.routeObjectiveId !== objective.id &&
                      (disabled || !objective.autoPath || !objective.destination))
                  }
                  onClick={() =>
                    void send(
                      view.routeObjectiveId === objective.id
                        ? { kind: 'stop' }
                        : { kind: 'autopath', objectiveId: objective.id },
                    )
                  }
                >
                  ♧{' '}
                  {view.routeObjectiveId === objective.id
                    ? 'Stop Auto-path'
                    : objective.autoPath && objective.destination
                      ? 'Follow event route'
                      : 'Follow the clues'}
                </button>
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
              {!objective.completed ? (
                <button
                  className={styles.primary}
                  disabled={
                    busy ||
                    (view.routeObjectiveId !== objective.id &&
                      (disabled || !objective.autoPath || !objective.destination))
                  }
                  onClick={() =>
                    void send(
                      view.routeObjectiveId === objective.id
                        ? { kind: 'stop' }
                        : { kind: 'autopath', objectiveId: objective.id },
                    )
                  }
                >
                  ♧{' '}
                  {view.routeObjectiveId === objective.id
                    ? 'Stop Auto-path'
                    : objective.autoPath && objective.destination
                      ? 'Start Auto-path'
                      : 'Follow the clues'}
                </button>
              ) : null}
            </div>
          ))}
        </section>
        {sector.exits.length ? (
          <section className={styles.panel} aria-label="Roads and crossings">
            <h2>Roads & crossings</h2>
            <p className={styles.quiet}>From {sector.name}</p>
            <div className={styles.exitList}>
              {sector.exits.map((exit) => {
                const targetSector = view.sectors.find((s) => s.id === exit.to.sectorId)
                if (!targetSector) return null
                return (
                  <button
                    key={`${exit.to.sectorId}:${exit.to.x}:${exit.to.y}`}
                    disabled={disabled}
                    onClick={() => walk(exit.to)}
                  >
                    <strong>Travel to {targetSector.name}</strong>
                    <small>
                      {exit.name} · {targetSector.coordinate}
                    </small>
                  </button>
                )
              })}
            </div>
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
      {panorama && local.panorama ? (
        <Surroundings src={local.panorama} name={local.name} onClose={() => setPanorama(false)} />
      ) : null}
    </section>
  )
}
