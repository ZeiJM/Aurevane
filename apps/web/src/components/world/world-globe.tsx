'use client'
import { useEffect, useState } from 'react'
import { ATLAS_COLUMNS, ATLAS_ROWS } from '@/world/atlas'
import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import {
  FERRY_MAINLAND_DOCK,
  FERRY_NORTH_DOCK,
  FERRY_ASTERWAKE_DOCK,
  PUBLIC_FERRY_TERMINALS,
  FERRY_TERMINAL_NAMES,
} from '@/world/ferry'
import { globeSectorCenter, globeSectorCoordinate, projectGlobePoint } from '@/world/globe-math'
import { ASTERWAKE_GOLDEN_TREE, ASTERWAKE_NAME } from '@/world/asterwake'
import type { WorldPosition, WorldView } from '@/world/types'
import { SphericalView } from './spherical-view'
import { projectGlobeTowns } from './globe-atlas'
import { UNCHARTED_VEIL_FOCUS } from './globe-veil'
import {
  globeFerryPosition,
  UNCHARTED_FERRY_CHART_ID,
  UNCHARTED_FERRY_CHART_LOCATION,
} from './globe-ferry'
import { worldTravelDestination } from './world-travel-points'
import styles from './workspace.module.css'

const townMarkers: Readonly<Record<string, number>> = {
  'aureth-crown': 0,
  'verdant-expanse': 1,
  frostmere: 2,
  emberreach: 3,
  'hollow-coast': 4,
  'glasswind-desert': 5,
  'starfall-highlands': 6,
  'umbral-march': 7,
}

function AtlasMarker({ index, town }: { index: number; town?: string }) {
  return (
    <i
      className={styles.atlasMarker}
      style={{ backgroundPosition: `${(index % 4) * (100 / 3)}% ${Math.floor(index / 4) * 50}%` }}
      data-globe-town-symbol={town}
      aria-hidden="true"
    />
  )
}

export const GLOBE_FOCUS_EVENT = 'aurevane-world-globe-focus'
export function WorldGlobe({
  view,
  selected,
  selectedArrival,
  onSelect,
  zoom,
  zoomLocked,
  showLocationLabels = true,
  onZoom,
}: {
  view: WorldView
  selected: string | null
  selectedArrival?: WorldPosition
  onSelect: (id: string | null) => void
  zoom: number
  zoomLocked: boolean
  showLocationLabels?: boolean
  onZoom: (zoom: number) => void
}) {
  const current = view.sectors.find((sector) => sector.id === view.position.sectorId)!
  const sectorCenter = globeSectorCenter(current.coordinate, ATLAS_COLUMNS, ATLAS_ROWS)
  const mapped =
    sectorCenter && current.atlasColumn !== undefined && current.atlasRow !== undefined
      ? {
          longitude:
            ((current.atlasColumn + (view.position.x + 0.5) / GRID_WIDTH) * 360) / ATLAS_COLUMNS -
            180,
          latitude:
            90 - ((current.atlasRow + (view.position.y + 0.5) / GRID_HEIGHT) * 180) / ATLAS_ROWS,
        }
      : sectorCenter
  const anchor = view.atlas?.find((s) => s.id === current.regionId)
  const location =
    mapped ??
    (current.warpedTheme
      ? UNCHARTED_VEIL_FOCUS
      : (globeSectorCenter(anchor?.coordinate ?? '', ATLAS_COLUMNS, ATLAS_ROWS) ?? {
          longitude: 0,
          latitude: 0,
        }))
  const [camera, setCamera] = useState(location)
  const [ferryTime, setFerryTime] = useState<{ serverNow: number; now: number }>()
  useEffect(() => {
    const started = performance.now()
    const timer = setInterval(
      () =>
        setFerryTime({
          serverNow: view.serverNow,
          now: view.serverNow + (performance.now() - started),
        }),
      1000,
    )
    return () => clearInterval(timer)
  }, [view.serverNow])
  // Selecting a charted sector never initiates travel; the side panel owns confirmation.
  const activateSector = (id: string | null) => onSelect(id)
  const selectSector = (id: string | null) => {
    activateSector(id)
    const sector = view.atlas?.find((cell) => cell.id === id && cell.charted)
    const target = sector && globeSectorCenter(sector.coordinate, ATLAS_COLUMNS, ATLAS_ROWS)
    if (target) setCamera(target)
  }
  useEffect(() => {
    // A user-driven selection from the side panel focuses without synchronously
    // deriving state in an effect or remounting the expensive globe canvas.
    const focus = (event: Event) => {
      const id = (event as CustomEvent<string>).detail
      if (id === UNCHARTED_FERRY_CHART_ID) {
        setCamera(UNCHARTED_FERRY_CHART_LOCATION)
        return
      }
      const sector = view.atlas?.find((cell) => cell.id === id && cell.charted)
      const point = sector && globeSectorCenter(sector.coordinate, ATLAS_COLUMNS, ATLAS_ROWS)
      if (point) setCamera(point)
    }
    window.addEventListener(GLOBE_FOCUS_EVENT, focus)
    return () => window.removeEventListener(GLOBE_FOCUS_EVENT, focus)
  }, [view.atlas])
  const pin = projectGlobePoint(location, camera)
  const labels = projectGlobeTowns(view.atlas ?? [], camera, zoom)
  const veil = projectGlobePoint(UNCHARTED_VEIL_FOCUS, camera)
  const veilX = veil.x * zoom
  const veilY = veil.y * zoom
  const cellLocation = (
    { column, row }: { column: number; row: number },
    x: number,
    y: number,
  ) => ({
    longitude: ((column + (x + 0.5) / GRID_WIDTH) * 360) / ATLAS_COLUMNS - 180,
    latitude: 90 - ((row + (y + 0.5) / GRID_HEIGHT) * 180) / ATLAS_ROWS,
  })
  const ports = PUBLIC_FERRY_TERMINALS.flatMap(({ dock, name }) => {
    const sector = view.atlas?.find((cell) => cell.charted && cell.id === dock.sectorId)
    return sector ? [{ dock, name, location: cellLocation(sector, dock.x, dock.y) }] : []
  })
  const markerStyle = (location: { longitude: number; latitude: number }) => {
    const point = projectGlobePoint(location, camera)
    const x = point.x * zoom
    const y = point.y * zoom
    return point.visible && Math.hypot(x, y) < Math.min(0.94, zoom * 0.96)
      ? { left: `${(x + 1) * 50}%`, top: `${(1 - y) * 50}%` }
      : undefined
  }
  const unchartedTerminal = markerStyle(UNCHARTED_FERRY_CHART_LOCATION)
  const dockLocation = ports.find(({ dock }) => dock === FERRY_MAINLAND_DOCK)?.location
  const northernDeparture = ports.find(({ dock }) => dock === FERRY_NORTH_DOCK)?.location
  const northernArrival = ports.find(({ dock }) => dock === FERRY_ASTERWAKE_DOCK)?.location
  const clock = ferryTime?.serverNow === view.serverNow ? ferryTime.now : view.serverNow
  const vessels = [
    { point: dockLocation && globeFerryPosition(clock, dockLocation), name: 'Ferry underway' },
    {
      point:
        northernDeparture &&
        northernArrival &&
        globeFerryPosition(clock, northernDeparture, northernArrival),
      name: 'Asterwake ferry underway',
    },
  ]
  const asterwake = view.atlas?.find(
    (sector) => sector.charted && sector.id === ASTERWAKE_GOLDEN_TREE.sectorId,
  )
  const asterwakeLabel = asterwake && markerStyle(cellLocation(asterwake, 6, 4))
  const target = view.atlas?.find((cell) => cell.charted && cell.id === selected)
  const targetCell = target && (selectedArrival ?? worldTravelDestination(target.id))
  const targetPin =
    target &&
    targetCell &&
    projectGlobePoint(cellLocation(target, targetCell.x, targetCell.y), camera)
  return (
    <div className={styles.globeScene} role="region" aria-label="World Atlas">
      <div className={styles.globeFrame}>
        <SphericalView
          src="/media/art/world/runtime/globe-materials-v02.webp"
          camera={camera}
          zoom={zoom}
          onCamera={setCamera}
          onZoom={onZoom}
          zoomLocked={zoomLocked}
          grid={false}
          gridColumns={ATLAS_COLUMNS}
          gridRows={ATLAS_ROWS}
          atlas={view.atlas}
          onActivate={(point) => {
            const coordinate = globeSectorCoordinate(point, ATLAS_COLUMNS, ATLAS_ROWS)
            const sector = view.atlas?.find(
              (cell) => cell.coordinate === coordinate && cell.charted,
            )
            selectSector(sector?.id ?? null)
          }}
        >
          {labels.map(({ sector, left, top }) => (
            <button
              key={sector.id}
              className={styles.globeTown}
              data-globe-town
              data-globe-marker
              aria-label={`Select ${sector.name} town`}
              aria-pressed={selected === sector.id}
              onClick={() => selectSector(sector.id)}
              style={{
                left: `${left}%`,
                top: `${top}%`,
              }}
            >
              {showLocationLabels ? <span>{sector.name}</span> : null}
              <AtlasMarker index={townMarkers[sector.id] ?? 0} town={sector.id} />
            </button>
          ))}
          {mapped && pin.visible ? (
            <span
              className={styles.globePin}
              style={{ left: `${(pin.x * zoom + 1) * 50}%`, top: `${(1 - pin.y * zoom) * 50}%` }}
              aria-label="Your current position"
            >
              <AtlasMarker index={10} />
              <span>You are here</span>
            </span>
          ) : null}
          {showLocationLabels &&
          veil.visible &&
          Math.hypot(veilX, veilY) < Math.min(0.72, zoom * 0.8) ? (
            <span
              className={styles.globeVeilLabel}
              style={{ left: `${(veilX + 1) * 50}%`, top: `${(1 - veilY) * 50}%` }}
            >
              <span>Uncharted Lands</span>
            </span>
          ) : null}
          {showLocationLabels && asterwakeLabel ? (
            <span className={styles.globeVeilLabel} style={asterwakeLabel}>
              <span>{ASTERWAKE_NAME}</span>
            </span>
          ) : null}
          {ports.map(({ dock, name, location }) => {
            const style = markerStyle(location)
            return style ? (
              <button
                key={dock.sectorId}
                className={styles.globeTerminal}
                type="button"
                data-globe-marker
                aria-label={`Select ${name}`}
                title={name}
                aria-pressed={selected === dock.sectorId}
                onClick={() => selectSector(dock.sectorId)}
                style={style}
              >
                <AtlasMarker index={8} />
              </button>
            ) : null
          })}
          {unchartedTerminal ? (
            <span
              className={styles.globeTerminal}
              role="img"
              aria-label={`${FERRY_TERMINAL_NAMES.uncharted} (illustrated harbor)`}
              title={FERRY_TERMINAL_NAMES.uncharted}
              style={unchartedTerminal}
            >
              <AtlasMarker index={8} />
            </span>
          ) : null}
          {vessels.map(({ point, name }) => {
            const style = point && markerStyle(point)
            return style ? (
              <span
                key={name}
                className={styles.globeFerry}
                role="img"
                aria-label={name}
                style={style}
              >
                <AtlasMarker index={9} />
              </span>
            ) : null
          })}
          {target &&
          targetPin?.visible &&
          Math.hypot(targetPin.x * zoom, targetPin.y * zoom) < 0.97 ? (
            <span
              className={styles.globeDestinationPin}
              data-globe-destination={target.id}
              role="img"
              aria-label={`Selected destination: ${target.name}`}
              style={{
                left: `${(targetPin.x * zoom + 1) * 50}%`,
                top: `${(1 - targetPin.y * zoom) * 50}%`,
              }}
            >
              <AtlasMarker index={11} />
            </span>
          ) : null}
        </SphericalView>
      </div>
    </div>
  )
}
