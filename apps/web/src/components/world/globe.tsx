'use client'
import Image from 'next/image'
import { useState } from 'react'
import { WORLD_REGIONS, worldRegion } from '@/world/catalog'
import { projectGlobePoint } from '@/world/globe-math'
import type { WorldPosition } from '@/world/types'
import { SphericalView } from './spherical-view'
import styles from './world.module.css'

export function Globe({
  position,
  selected,
  onSelect,
  grid,
  portrait,
  name,
  focusKey,
}: {
  position: WorldPosition
  selected: string
  onSelect: (id: string) => void
  grid: boolean
  portrait: string
  name: string
  focusKey: number
}) {
  const initial = worldRegion(position.sectorId) ?? WORLD_REGIONS[1]!
  const [camera, setCamera] = useState({ longitude: 0, latitude: 8 }),
    [zoom, setZoom] = useState(0.94),
    [lastFocus, setLastFocus] = useState(focusKey)
  if (lastFocus !== focusKey) {
    setLastFocus(focusKey)
    setCamera({ longitude: initial.longitude, latitude: initial.latitude })
    setZoom(0.94)
  }
  const region = worldRegion(position.sectorId)
  // Snap the portrait to the centre of its globe sector; never use the label's offset.
  const marker = region
    ? {
        longitude: (Math.floor((region.longitude + 180) / 11.25) + 0.5) * 11.25 - 180,
        latitude: 90 - (Math.floor((90 - region.latitude) / 11.25) + 0.5) * 11.25,
      }
    : null
  const projected = marker ? projectGlobePoint(marker, camera) : null
  const fogPoint = projectGlobePoint({ longitude: 80, latitude: 9 }, camera)
  const outline = marker
    ? Array.from({ length: 20 }, (_, i) => {
        const edge = Math.floor(i / 5),
          t = (i % 5) / 5,
          half = 5.625
        const longitude =
          marker.longitude +
          (edge === 0
            ? -half + t * 11.25
            : edge === 1
              ? half
              : edge === 2
                ? half - t * 11.25
                : -half)
        const latitude =
          marker.latitude +
          (edge === 0
            ? half
            : edge === 1
              ? half - t * 11.25
              : edge === 2
                ? -half
                : -half + t * 11.25)
        return projectGlobePoint({ longitude, latitude }, camera)
      })
    : []
  return (
    <div className={styles.globeStage}>
      <SphericalView
        src="/media/art/world/globe-v01.webp"
        camera={camera}
        onCamera={setCamera}
        zoom={zoom}
        onZoom={setZoom}
        grid={grid}
      >
        {WORLD_REGIONS.map((region) => {
          const point = projectGlobePoint(region, camera)
          if (!point.visible) return null
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
        {projected?.visible && outline.every((p) => p.visible) ? (
          <svg className={styles.globeOutline} viewBox="0 0 1000 1000" aria-hidden="true">
            <polygon
              points={outline
                .map((p) => `${500 + p.x * zoom * 500},${500 - p.y * zoom * 500}`)
                .join(' ')}
            />
          </svg>
        ) : null}
        {projected?.visible ? (
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
        {fogPoint.visible ? (
          <span
            className={styles.unchartedLabel}
            style={{
              left: `${50 + fogPoint.x * zoom * 50}%`,
              top: `${50 - fogPoint.y * zoom * 50}%`,
            }}
          >
            Uncharted
            <br />
            Territory
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
      <div className={styles.globeHint}>Drag to rotate · Scroll to zoom</div>
      <div className={styles.legend}>
        <span>◉ Charted</span>
        <span>◇ Surveyed</span>
        <span>◌ Uncharted</span>
      </div>
    </div>
  )
}
