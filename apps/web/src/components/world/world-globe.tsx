'use client'
import { useMemo, useState } from 'react'
import { ATLAS_COLUMNS, ATLAS_ROWS } from '@/world/atlas'
import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { globeSectorCenter, globeSectorCoordinate, projectGlobePoint } from '@/world/globe-math'
import type { WorldView } from '@/world/types'
import { SphericalView } from './spherical-view'
import { globeTowns, projectGlobeTowns } from './globe-atlas'
import styles from './workspace.module.css'
const sectorOrder = new Intl.Collator('en', { numeric: true })
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
  const location = mapped ??
    globeSectorCenter(anchor?.coordinate ?? '', ATLAS_COLUMNS, ATLAS_ROWS) ?? {
      longitude: 0,
      latitude: 0,
    }
  const [camera, setCamera] = useState(location)
  const towns = useMemo(
    () =>
      globeTowns(view.atlas ?? []).sort((a, b) =>
        sectorOrder.compare(a.sector.coordinate, b.sector.coordinate),
      ),
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
        .sort((a, b) => sectorOrder.compare(a.coordinate, b.coordinate))
        .map((sector) => (
          <option key={sector.id} value={sector.id}>
            {sector.coordinate} · {sector.name}
          </option>
        )),
    [view.atlas],
  )
  const pin = projectGlobePoint(location, camera)
  const labels = projectGlobeTowns(view.atlas ?? [], camera, zoom)
  return (
    <div className={styles.globeScene}>
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
        </SphericalView>
      </div>
      <div className={styles.sectorPicker}>
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
                {sector.name} · {sector.coordinate}
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
    </div>
  )
}
