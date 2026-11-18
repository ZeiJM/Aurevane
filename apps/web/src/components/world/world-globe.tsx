'use client'
import { useEffect, useMemo, useState } from 'react'
import { ATLAS_COLUMNS, ATLAS_ROWS } from '@/world/atlas'
import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { FERRY_MAINLAND_DOCK } from '@/world/ferry'
import { globeSectorCenter, globeSectorCoordinate, projectGlobePoint } from '@/world/globe-math'
import type { WorldView } from '@/world/types'
import { SphericalView } from './spherical-view'
import { projectGlobeTowns } from './globe-atlas'
import { UNCHARTED_VEIL_FOCUS } from './globe-veil'
import { globeFerryPosition } from './globe-ferry'
import { nextWorldTravelPoint, worldTravelPoints } from './world-travel-points'
import styles from './workspace.module.css'

// Regional silhouettes are presentation only; every marker keeps its public
// sector anchor and its ordinary selection/confirmation authority.
const townSymbols: Readonly<Record<string, string>> = {
  'aureth-crown':
    'M2 29V10h3V5h3v5h3V3l5 3 5-3v7h3V5h3v5h3v19H19v-7a3 3 0 0 0-6 0v7H2zm4-15v5h3v-5H6zm17 0v5h3v-5h-3z',
  'verdant-expanse':
    'M2 17 13 6l11 11h-3v12H5V17H2zm11 4v8h4v-8h-4zm11-6 4-9 4 9h-3v4h3l-4-9-4 9h3v10h2V15h-5z',
  frostmere:
    'M1 16 12 3l11 13h-4v13H5V16H1zm7-2h8l-4-6-4 6zm3 9v6h4v-6h-4zm12-8 4-6 4 6h-2v14h-4V15h-2z',
  emberreach:
    'M3 29V17h4V9l5-6 4 6v8h3V6l5-4 5 4v23H3zm6-11h4v-7l-2-3-2 3v7zm12-1h6v-7h-6v7zm-7 8v4h4v-4h-4z',
  'hollow-coast':
    'M2 21 8 15l6 6v6H2v-6zm17 6 2-18h7l2 18H19zm1-21 5-5 6 5H20zm3 7v4h4v-4h-4zM1 30l5-2 5 2 5-2 5 2 5-2 5 2v2H1v-2z',
  'glasswind-desert':
    'M2 29V13h3V5l3-4 3 4v8h3v16H2zm4-12v5h3v-5H6zm10 12V17h14v12h-5v-7h-4v7h-5zm-1-14a8 8 0 0 1 16 0H15z',
  'starfall-highlands':
    'M3 29V15l7-8 7 8v14H3zm5-8v8h4v-8H8zm12 8V11h8v18h-8zm-2-20 6-7 6 7H18zm5 6v5h2v-5h-2zM4 3l2-3 2 3-2 3-2-3z',
  'umbral-march':
    'M2 29V12l4-6 4 6v17H2zm20 0V12l4-6 4 6v17h-8zM9 14l7-5 7 5v4H9v-4zm3 15v-7a4 4 0 0 1 8 0v7h-3v-6h-2v6h-3z',
}

export const GLOBE_FOCUS_EVENT = 'aurevane-world-globe-focus'
export function WorldGlobe({
  view,
  selected,
  onSelect,
  zoom,
  zoomLocked,
  showLocationLabels = true,
  onZoom,
}: {
  view: WorldView
  selected: string | null
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
      const sector = view.atlas?.find((cell) => cell.id === id && cell.charted)
      const point = sector && globeSectorCenter(sector.coordinate, ATLAS_COLUMNS, ATLAS_ROWS)
      if (point) setCamera(point)
    }
    window.addEventListener(GLOBE_FOCUS_EVENT, focus)
    return () => window.removeEventListener(GLOBE_FOCUS_EVENT, focus)
  }, [view.atlas])
  const pin = projectGlobePoint(location, camera)
  const labels = projectGlobeTowns(view.atlas ?? [], camera, zoom).map((town) => ({
    ...town,
    iconSize: 24 + Math.max(0, Math.min(5, town.districts.length - 9)) * 2,
  }))
  const veil = projectGlobePoint(UNCHARTED_VEIL_FOCUS, camera)
  const veilX = veil.x * zoom
  const veilY = veil.y * zoom
  const port = view.atlas?.find(
    (sector) => sector.charted && sector.id === FERRY_MAINLAND_DOCK.sectorId,
  )
  const dockLocation = port ? globeSectorCenter(port.coordinate, ATLAS_COLUMNS, ATLAS_ROWS) : null
  const vessel =
    dockLocation &&
    globeFerryPosition(
      ferryTime?.serverNow === view.serverNow ? ferryTime.now : view.serverNow,
      dockLocation,
    )
  const ferry = vessel && projectGlobePoint(vessel, camera)
  const travelPoints = useMemo(
    () => worldTravelPoints({ atlas: view.atlas, anchors: view.anchors }),
    [view.atlas, view.anchors],
  )
  const travelPointMarkers = travelPoints.flatMap((point) => {
    const location = globeSectorCenter(point.coordinate, ATLAS_COLUMNS, ATLAS_ROWS)!
    const projected = projectGlobePoint(location, camera)
    const town = labels.find(({ sector }) => sector.id === point.id)
    return projected.visible
      ? [
          {
            ...point,
            left: (projected.x * zoom + 1) * 50,
            top: (1 - projected.y * zoom) * 50,
            townOffset: town ? (town.iconSize + 12) / 2 + 19 : undefined,
          },
        ]
      : []
  })
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
          {labels.map(({ sector, left, top, iconSize }) => (
            <button
              key={sector.id}
              className={styles.globeTown}
              data-globe-town
              aria-label={`Select ${sector.name} town`}
              aria-pressed={selected === sector.id}
              onClick={() => selectSector(sector.id)}
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: iconSize + 12,
                minHeight: iconSize + 12,
              }}
            >
              {showLocationLabels ? <span>{sector.name}</span> : null}
              <svg
                viewBox="0 0 32 32"
                width={iconSize}
                height={iconSize}
                data-globe-town-symbol={sector.id}
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  d={townSymbols[sector.id] ?? townSymbols['aureth-crown']}
                  fillRule="evenodd"
                />
              </svg>
            </button>
          ))}
          {mapped && pin.visible ? (
            <span
              className={styles.globePin}
              style={{ left: `${(pin.x * zoom + 1) * 50}%`, top: `${(1 - pin.y * zoom) * 50}%` }}
              aria-label="Your current position"
            >
              <i aria-hidden="true" />
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
              <i aria-hidden="true">◇</i>
              <span>Uncharted Lands</span>
            </span>
          ) : null}
          {ferry?.visible &&
          Math.hypot(ferry.x * zoom, ferry.y * zoom) < Math.min(0.94, zoom * 0.96) ? (
            <span
              className={styles.globeFerry}
              role="img"
              aria-label="Ferry underway"
              style={{
                left: `${(ferry.x * zoom + 1) * 50}%`,
                top: `${(1 - ferry.y * zoom) * 50}%`,
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 2v12H4l8-12zm2 3 6 9h-6V5zM2 16h20l-4 5H6z" />
              </svg>
            </span>
          ) : null}
          {travelPointMarkers.map((point) => (
            <button
              key={point.id}
              type="button"
              data-globe-travel-point={point.id}
              data-globe-town
              className={styles.globeTravelPoint}
              aria-label={`Travel point: ${point.name}. Show next travel point`}
              aria-pressed={selected === point.id}
              title={`${point.name} · Show next travel point`}
              onClick={() => {
                const next = nextWorldTravelPoint(travelPoints, selected ?? point.id)
                if (next) selectSector(next.id)
              }}
              style={{
                left: `${point.left}%`,
                top: `${point.top}%`,
                marginLeft: point.townOffset,
              }}
            >
              ◈
            </button>
          ))}
        </SphericalView>
      </div>
    </div>
  )
}
