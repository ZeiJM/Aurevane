'use client'
import { useEffect, useState } from 'react'
import { ATLAS_COLUMNS, ATLAS_ROWS } from '@/world/atlas'
import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { FERRY_MAINLAND_DOCK } from '@/world/ferry'
import { globeSectorCenter, globeSectorCoordinate, projectGlobePoint } from '@/world/globe-math'
import type { WorldAtlasCell, WorldView } from '@/world/types'
import { SphericalView } from './spherical-view'
import { projectGlobeTowns } from './globe-atlas'
import { UNCHARTED_VEIL_FOCUS } from './globe-veil'
import { globeFerryPosition } from './globe-ferry'
import styles from './workspace.module.css'
export function WorldGlobe({
  view,
  selected,
  onSelect,
  zoom,
  zoomLocked,
  onZoom,
  onTravelRequest,
}: {
  view: WorldView
  selected: string | null
  onSelect: (id: string | null) => void
  zoom: number
  zoomLocked: boolean
  onZoom: (zoom: number) => void
  onTravelRequest?: (sectorId: string) => void
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
  // A single click selects a charted sector. A deliberate double-click on
  // a town marker can separately open the confirmation, never initiate travel.
  const activateSector = (id: string | null) => onSelect(id)
  const selectSector = (id: string | null) => {
    activateSector(id)
    const sector = view.atlas?.find((cell) => cell.id === id && cell.charted)
    const target = sector && globeSectorCenter(sector.coordinate, ATLAS_COLUMNS, ATLAS_ROWS)
    if (target) setCamera(target)
  }
  useEffect(() => {
    const sector = view.atlas?.find((cell) => cell.id === selected && cell.charted)
    const target = sector && globeSectorCenter(sector.coordinate, ATLAS_COLUMNS, ATLAS_ROWS)
    if (target) setCamera(target)
  }, [selected, view.atlas])
  const pin = projectGlobePoint(location, camera)
  const labels = projectGlobeTowns(view.atlas ?? [], camera, zoom)
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
  const dockPoint = dockLocation ? projectGlobePoint(dockLocation, camera) : null
  return (
    <div className={styles.globeScene}>
      <div className={styles.globeTitle}>
        <span>Surveyor’s collection</span>
        <h2>World Atlas</h2>
      </div>
      <button
        type="button"
        className={styles.globeFocusUncharted}
        aria-label="Focus Uncharted Lands"
        onClick={() => setCamera(UNCHARTED_VEIL_FOCUS)}
      >
        ◇ Uncharted Lands
      </button>
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
            activateSector(sector?.id ?? null)
          }}
        >
          {labels.map(({ sector, left, top }) => (
            <button
              key={sector.id}
              className={styles.globeTown}
              data-globe-town
              aria-label={`Select ${sector.name} town`}
              aria-pressed={selected === sector.id}
              onClick={() => selectSector(sector.id)}
              onDoubleClick={() => onTravelRequest?.(sector.id)}
              style={{
                left: `${left}%`,
                top: `${top}%`,
              }}
            >
              <span>{sector.name}</span>
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M3 21V7h3V3h3v4h6V3h3v4h3v14h-7v-5a2 2 0 0 0-4 0v5H3zm3-11v3h2v-3H6zm10 0v3h2v-3h-2z" />
              </svg>
            </button>
          ))}
          {mapped && pin.visible ? (
            <span
              className={styles.globePin}
              style={{ left: `${(pin.x * zoom + 1) * 50}%`, top: `${(1 - pin.y * zoom) * 50}%` }}
              aria-label="Your current position"
            >
              <i />
              You are here
            </span>
          ) : null}
          {veil.visible && Math.hypot(veilX, veilY) < Math.min(0.72, zoom * 0.8) ? (
            <span
              className={styles.globeVeilLabel}
              style={{ left: `${(veilX + 1) * 50}%`, top: `${(1 - veilY) * 50}%` }}
            >
              <i aria-hidden="true">◇</i>
              Uncharted Lands
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
          {port && dockPoint?.visible ? (
            <button
              type="button"
              data-globe-travel-point
              data-globe-town
              className={styles.globeTravelPoint}
              aria-label="Travel point: Ferry dock"
              title="Travel point: Ferry dock"
              onClick={() => selectSector(port.id)}
              style={{
                left: (dockPoint.x * zoom + 1) * 50 + '%',
                top: (1 - dockPoint.y * zoom) * 50 + '%',
              }}
            >
              ◈
            </button>
          ) : null}
        </SphericalView>
      </div>
    </div>
  )
}
