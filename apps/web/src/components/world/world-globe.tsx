'use client'
import { useEffect, useMemo, useState } from 'react'
import { ATLAS_COLUMNS, ATLAS_ROWS } from '@/world/atlas'
import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { sectorDisplayNumber, sectorLabel } from '@/world/coordinate-label'
import { FERRY_MAINLAND_DOCK } from '@/world/ferry'
import { globeSectorCenter, globeSectorCoordinate, projectGlobePoint } from '@/world/globe-math'
import type { WorldAtlasCell, WorldView } from '@/world/types'
import { SphericalView } from './spherical-view'
import { globeTowns, projectGlobeTowns } from './globe-atlas'
import { UNCHARTED_VEIL_FOCUS } from './globe-veil'
import { globeFerryPosition } from './globe-ferry'
import styles from './workspace.module.css'
const sectorOrder = new Intl.Collator('en', { numeric: true })
const geographicOrder = (a: WorldAtlasCell, b: WorldAtlasCell) =>
  (sectorDisplayNumber(a) ?? Infinity) - (sectorDisplayNumber(b) ?? Infinity) ||
  sectorOrder.compare(a.coordinate, b.coordinate)
export function WorldGlobe({
  view,
  selected,
  onSelect,
  zoom,
  zoomLocked,
  onZoom,
}: {
  view: WorldView
  selected: string | null
  onSelect: (id: string | null) => void
  zoom: number
  zoomLocked: boolean
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
  const towns = useMemo(
    () => globeTowns(view.atlas ?? []).sort((a, b) => geographicOrder(a.sector, b.sector)),
    [view.atlas],
  )
  const selectSector = (id: string | null) => {
    onSelect(id)
    const sector = view.atlas?.find((cell) => cell.id === id && cell.charted)
    const location = sector && globeSectorCenter(sector.coordinate, ATLAS_COLUMNS, ATLAS_ROWS)
    if (location) setCamera(location)
  }
  const options = useMemo(
    () =>
      view.atlas
        ?.filter((s) => s.charted)
        .sort(geographicOrder)
        .map((sector) => (
          <option key={sector.id} value={sector.id}>
            {sectorLabel(sector)} · {sector.name}
          </option>
        )),
    [view.atlas],
  )
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
  return (
    <div className={styles.globeScene}>
      <div className={styles.globeTitle}>
        <span>Surveyor’s collection</span>
        <h2>World Atlas</h2>
      </div>
      <div className={styles.globeFrame}>
        <SphericalView
          src="/media/art/world/globe-v01.webp"
          camera={camera}
          zoom={zoom}
          onCamera={setCamera}
          onZoom={onZoom}
          zoomLocked={zoomLocked}
          gridColumns={ATLAS_COLUMNS}
          gridRows={ATLAS_ROWS}
          atlas={view.atlas}
          onActivate={(point) => {
            const coordinate = globeSectorCoordinate(point, ATLAS_COLUMNS, ATLAS_ROWS),
              sector = view.atlas?.find((cell) => cell.coordinate === coordinate && cell.charted)
            onSelect(sector?.id ?? null)
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
              Uncharted waters
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
        </SphericalView>
      </div>
      <div className={styles.sectorPicker}>
        <div className={styles.globeOrientation} aria-label="Globe orientation">
          <button type="button" onClick={() => setCamera(location)}>
            My position
          </button>
          {port ? (
            <button type="button" onClick={() => selectSector(port.id)}>
              Ferry dock
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              onSelect(null)
              setCamera(UNCHARTED_VEIL_FOCUS)
            }}
          >
            Uncharted waters
          </button>
        </div>
        <label className={styles.townPicker}>
          Main towns
          <select
            aria-label="Main town"
            value={towns.some((town) => town.sector.id === selected) ? selected! : ''}
            onChange={(event) => selectSector(event.target.value || null)}
          >
            <option value="">Find a town</option>
            {towns.map(({ sector }) => (
              <option key={sector.id} value={sector.id}>
                {sector.name} · {sectorLabel(sector)}
              </option>
            ))}
          </select>
        </label>
        <details>
          <summary>Known Lands</summary>
          <label>
            Choose a destination
            <select
              aria-label="Charted sector"
              value={selected ?? ''}
              onChange={(event) => selectSector(event.target.value || null)}
            >
              <option value="">Select a sector</option>
              {options}
            </select>
          </label>
        </details>
      </div>
      <div className={styles.globeCaption}>
        <span>
          <i aria-hidden="true" /> Charted ground
        </span>
        <span>
          <i aria-hidden="true" /> Uncharted waters
        </span>
      </div>
    </div>
  )
}
