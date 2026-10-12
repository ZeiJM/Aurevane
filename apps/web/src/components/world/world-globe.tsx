'use client'
import { useState } from 'react'
import { ATLAS_COLUMNS, ATLAS_ROWS } from '@/world/atlas'
import { globeSectorCenter, globeSectorCoordinate, projectGlobePoint } from '@/world/globe-math'
import type { WorldPosition, WorldView } from '@/world/types'
import { SphericalView } from './spherical-view'
import styles from './workspace.module.css'
export function WorldGlobe({
  view,
  onTravel,
}: {
  view: WorldView
  onTravel: (position: WorldPosition) => void
}) {
  const current = view.sectors.find((sector) => sector.id === view.position.sectorId)!
  const mapped = globeSectorCenter(current.coordinate, ATLAS_COLUMNS, ATLAS_ROWS)
  const anchor = view.atlas?.find((s) => s.id === current.regionId)
  const location = mapped ??
    globeSectorCenter(anchor?.coordinate ?? '', ATLAS_COLUMNS, ATLAS_ROWS) ?? {
      longitude: 0,
      latitude: 0,
    }
  const [camera, setCamera] = useState(location),
    [zoom, setZoom] = useState(0.94),
    [selected, setSelected] = useState<string | null>(null)
  const pin = projectGlobePoint(location, camera)
  const destination = view.atlas?.find((sector) => sector.id === selected)
  return (
    <div className={styles.globeScene}>
      <div className={styles.globeFrame}>
        <SphericalView
          src="/media/art/world/globe-v01.webp"
          camera={camera}
          zoom={zoom}
          onCamera={setCamera}
          onZoom={setZoom}
          gridColumns={ATLAS_COLUMNS}
          gridRows={ATLAS_ROWS}
          atlas={view.atlas}
          onActivate={(point) => {
            const coordinate = globeSectorCoordinate(point, ATLAS_COLUMNS, ATLAS_ROWS),
              sector = view.atlas?.find((cell) => cell.coordinate === coordinate && cell.charted)
            setSelected(sector?.id ?? null)
          }}
        >
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
      <div className={styles.globeCaption}>
        <p>Drag to turn the globe · select a charted sector to travel</p>
        <span>Uncharted regions lie beneath the mist.</span>
      </div>
      {destination ? (
        <div className={styles.destination}>
          <span>
            {destination.name} · {destination.coordinate}
          </span>
          <button onClick={() => onTravel({ sectorId: destination.id, x: 6, y: 4 })}>
            Travel here
          </button>
          <button aria-label="Clear destination" onClick={() => setSelected(null)}>
            ×
          </button>
        </div>
      ) : null}
      <details className={styles.sectorPicker}>
        <summary>Charted sectors</summary>
        <label>
          Choose a destination
          <select
            aria-label="Charted sector"
            value={selected ?? ''}
            onChange={(event) => setSelected(event.target.value || null)}
          >
            <option value="">Select a sector</option>
            {view.atlas
              ?.filter((s) => s.charted)
              .map((sector) => (
                <option key={sector.id} value={sector.id}>
                  {sector.coordinate} · {sector.name}
                </option>
              ))}
          </select>
        </label>
      </details>
    </div>
  )
}
