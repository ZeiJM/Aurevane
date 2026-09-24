'use client'
import Image from 'next/image'
import { useState } from 'react'
import { WORLD_REGIONS } from '@/world/catalog'
import { globeSectorCenter, globeSectorCoordinate, projectGlobePoint } from '@/world/globe-math'
import { SphericalView } from './spherical-view'
import styles from './world.module.css'

export function Globe({
  sectorCoordinate,
  selected,
  sectors,
  onSelect,
  onUnavailable,
  grid,
  portrait,
  name,
  focusKey,
}: {
  sectorCoordinate: string
  selected: string
  sectors: readonly { id: string; coordinate: string }[]
  onSelect: (id: string) => void
  onUnavailable?: (coordinate: string) => void
  grid: boolean
  portrait: string
  name: string
  focusKey: number
}) {
  const marker = globeSectorCenter(sectorCoordinate)
  const sectorByCoordinate = new Map(sectors.map((sector) => [sector.coordinate, sector]))
  const [camera, setCamera] = useState({ longitude: 0, latitude: 8 }),
    [zoom, setZoom] = useState(0.94),
    [lastFocus, setLastFocus] = useState(focusKey)
  if (lastFocus !== focusKey) {
    setLastFocus(focusKey)
    setCamera(marker ?? { longitude: 0, latitude: 8 })
    setZoom(0.94)
  }
  const projected = marker ? projectGlobePoint(marker, camera) : null
  const fogPoint = projectGlobePoint({ longitude: 38, latitude: 9 }, camera)
  const overlayVisible = (point: ReturnType<typeof projectGlobePoint>) =>
    point.visible && Math.abs(point.x * zoom) < 0.82 && Math.abs(point.y * zoom) < 0.9
  const labelVisible = (point: ReturnType<typeof projectGlobePoint>) =>
    point.visible && Math.abs(point.x * zoom) < 0.6 && Math.abs(point.y * zoom) < 0.72
  const sectorOutline = (coordinate: string) => {
    const center = globeSectorCenter(coordinate)
    if (!center) return []
    return Array.from({ length: 20 }, (_, i) => {
      const edge = Math.floor(i / 5),
        t = (i % 5) / 5,
        half = 5.625
      const longitude =
        center.longitude +
        (edge === 0
          ? -half + t * 11.25
          : edge === 1
            ? half
            : edge === 2
              ? half - t * 11.25
              : -half)
      const latitude =
        center.latitude +
        (edge === 0
          ? half
          : edge === 1
            ? half - t * 11.25
            : edge === 2
              ? -half
              : -half + t * 11.25)
      return projectGlobePoint({ longitude, latitude }, camera)
    })
  }
  const chartedOutlines = sectors
    .map((sector) => ({ sector, points: sectorOutline(sector.coordinate) }))
    .filter(({ points }) => points.length && points.every(overlayVisible))
  return (
    <div className={styles.globeStage}>
      <SphericalView
        src="/media/art/world/globe-v01.webp"
        camera={camera}
        onCamera={setCamera}
        zoom={zoom}
        onZoom={setZoom}
        grid={grid}
        onActivate={(location) => {
          const coordinate = globeSectorCoordinate(location)
          if (!coordinate) return
          const sector = sectorByCoordinate.get(coordinate)
          if (sector) onSelect(sector.id)
          else onUnavailable?.(coordinate)
        }}
      >
        {WORLD_REGIONS.map((region) => {
          const point = projectGlobePoint(region, camera)
          if (!labelVisible(point)) return null
          return (
            <button
              key={region.id}
              className={styles.regionLabel}
              data-selected={selected === region.id}
              style={{ left: `${50 + point.x * zoom * 50}%`, top: `${50 - point.y * zoom * 50}%` }}
              onClick={() => onSelect(region.id)}
            >
              {region.name}
            </button>
          )
        })}
        {chartedOutlines.length ? (
          <svg className={styles.globeOutline} viewBox="0 0 1000 1000" aria-hidden="true">
            {chartedOutlines.map(({ sector, points }) => (
              <polygon
                key={sector.id}
                data-sector-outline={sector.id}
                data-current={sector.coordinate === sectorCoordinate}
                data-selected={sector.id === selected}
                points={points
                  .map((p) => `${500 + p.x * zoom * 500},${500 - p.y * zoom * 500}`)
                  .join(' ')}
              />
            ))}
          </svg>
        ) : null}
        {projected && overlayVisible(projected) ? (
          <div
            className={styles.globePlayer}
            style={{
              left: `${50 + projected.x * zoom * 50}%`,
              top: `${50 - projected.y * zoom * 50}%`,
            }}
          >
            <Image
              unoptimized
              referrerPolicy="no-referrer"
              src={portrait}
              alt={`${name}, your current sector`}
              width={48}
              height={48}
            />
          </div>
        ) : null}
        {labelVisible(fogPoint) ? (
          <span
            className={styles.unchartedLabel}
            style={{
              left: `${50 + fogPoint.x * zoom * 50}%`,
              top: `${50 - fogPoint.y * zoom * 50}%`,
            }}
          >
            <strong>Uncharted Territory</strong>
            <small>Beyond reliable charts</small>
          </span>
        ) : null}
      </SphericalView>
      <div className={styles.zoom}>
        <button onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))} aria-label="Zoom in">
          +
        </button>
        <button onClick={() => setZoom((z) => Math.max(0.65, z - 0.1))} aria-label="Zoom out">
          −
        </button>
      </div>
      <div className={styles.globeHint}>Drag to rotate · Scroll to zoom · Click charted grid sectors</div>
      <div className={styles.legend}>
        <span>◉ Charted</span>
        <span>◇ Surveyed</span>
        <span>◌ Uncharted</span>
      </div>
    </div>
  )
}
