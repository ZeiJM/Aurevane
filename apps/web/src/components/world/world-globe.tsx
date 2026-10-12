'use client'
import { useMemo, useState } from 'react'
import { ATLAS_COLUMNS, ATLAS_ROWS } from '@/world/atlas'
import { globeSectorCenter, globeSectorCoordinate, projectGlobePoint } from '@/world/globe-math'
import type { WorldView } from '@/world/types'
import { SphericalView } from './spherical-view'
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
  const mapped = globeSectorCenter(current.coordinate, ATLAS_COLUMNS, ATLAS_ROWS)
  const anchor = view.atlas?.find((s) => s.id === current.regionId)
  const location = mapped ??
    globeSectorCenter(anchor?.coordinate ?? '', ATLAS_COLUMNS, ATLAS_ROWS) ?? {
      longitude: 0,
      latitude: 0,
    }
  const [camera, setCamera] = useState(location)
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
  const labels =
    view.atlas
      ?.filter((cell) => cell.charted && cell.id === cell.regionId)
      .flatMap((cell) => {
        const location = globeSectorCenter(cell.coordinate, ATLAS_COLUMNS, ATLAS_ROWS)
        if (!location) return []
        const p = projectGlobePoint(location, camera)
        return p.visible && p.x * p.x + p.y * p.y < 0.86 ? [{ ...cell, point: p }] : []
      }) ?? []
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
          {labels.map((cell) => (
            <span
              key={cell.id}
              className={styles.globeRegion}
              style={{
                left: `${(cell.point.x * zoom + 1) * 50}%`,
                top: `${(1 - cell.point.y * zoom) * 50}%`,
              }}
            >
              {cell.name}
            </span>
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
      <details className={styles.sectorPicker}>
        <summary>Known Lands</summary>
        <label>
          Choose a destination
          <select
            aria-label="Charted sector"
            value={selected ?? ''}
            onChange={(event) => onSelect(event.target.value || null)}
          >
            <option value="">Select a sector</option>
            {options}
          </select>
        </label>
      </details>
    </div>
  )
}
