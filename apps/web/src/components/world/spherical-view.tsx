'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { unprojectGlobePoint, type GlobeLocation } from '@/world/globe-math'
import { createSphericalRenderer } from './spherical-renderer'
import styles from './world.module.css'
import type { WorldAtlasCell } from '@/world/types'
import { globeAtlasPixels } from './globe-atlas'

interface Props {
  src: string
  camera: GlobeLocation
  zoom: number
  panorama?: boolean
  grid?: boolean
  gridColumns?: number
  gridRows?: number
  onCamera: (camera: GlobeLocation) => void
  onZoom: (zoom: number) => void
  onActivate?: (location: GlobeLocation) => void
  children?: ReactNode
  atlas?: readonly WorldAtlasCell[]
}
export function SphericalView({
  src,
  camera,
  zoom,
  panorama = false,
  grid = true,
  gridColumns = 32,
  gridRows = 16,
  onCamera,
  onZoom,
  onActivate,
  children,
  atlas,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null),
    renderer = useRef<ReturnType<typeof createSphericalRenderer>>(null)
  const drag = useRef<{ x: number; y: number; camera: GlobeLocation } | null>(null)
  const cameraFrame = useRef<number | null>(null)
  const pendingCamera = useRef<GlobeLocation | null>(null)
  const [failed, setFailed] = useState(false)
  const fallbackPixels = failed && atlas ? globeAtlasPixels(atlas, gridColumns, gridRows) : null
  useEffect(() => {
    if (!canvas.current) return
    renderer.current = createSphericalRenderer(canvas.current, src, () => setFailed(true), {
      columns: gridColumns,
      rows: gridRows,
    })
    return () => renderer.current?.dispose()
  }, [src, gridColumns, gridRows])
  useEffect(() => {
    renderer.current?.draw({ ...camera, zoom, panorama, grid })
  }, [camera, zoom, panorama, grid])
  useEffect(() => {
    if (atlas) renderer.current?.updateAtlas(atlas)
  }, [atlas])
  useEffect(() => {
    if (failed) renderer.current?.dispose()
  }, [failed])
  useEffect(
    () => () => {
      if (cameraFrame.current !== null) cancelAnimationFrame(cameraFrame.current)
    },
    [],
  )
  const scheduleCamera = (next: GlobeLocation) => {
    pendingCamera.current = next
    if (cameraFrame.current !== null) return
    cameraFrame.current = requestAnimationFrame(() => {
      cameraFrame.current = null
      const scheduled = pendingCamera.current
      pendingCamera.current = null
      if (scheduled) onCamera(scheduled)
    })
  }
  return (
    <div
      className={panorama ? styles.panoramaScene : styles.sphere}
      role="group"
      aria-label={
        panorama
          ? '360 degree surroundings. Drag or use arrow keys to look around.'
          : 'World globe. Drag or use arrow keys to rotate.'
      }
      tabIndex={0}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('button')) return
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { x: e.clientX, y: e.clientY, camera }
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        scheduleCamera({
          longitude: drag.current.camera.longitude - (e.clientX - drag.current.x) * 0.25,
          latitude: Math.max(
            -75,
            Math.min(75, drag.current.camera.latitude + (e.clientY - drag.current.y) * 0.2),
          ),
        })
      }}
      onPointerUp={(e) => {
        const start = drag.current
        drag.current = null
        if (!start || !onActivate || panorama) return
        const dx = e.clientX - start.x,
          dy = e.clientY - start.y
        if (dx * dx + dy * dy > 36) return
        const bounds = e.currentTarget.getBoundingClientRect(),
          x = (((e.clientX - bounds.left) / bounds.width) * 2 - 1) / zoom,
          y = (1 - ((e.clientY - bounds.top) / bounds.height) * 2) / zoom
        const location =
          failed && atlas
            ? {
                longitude: ((e.clientX - bounds.left) / bounds.width) * 360 - 180,
                latitude: 90 - ((e.clientY - bounds.top) / bounds.height) * 180,
              }
            : unprojectGlobePoint(x, y, start.camera)
        if (location) onActivate(location)
      }}
      onPointerCancel={() => {
        drag.current = null
      }}
      onKeyDown={(e) => {
        const amount = panorama ? 8 : 10
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
          e.preventDefault()
          onCamera({
            longitude:
              camera.longitude +
              (e.key === 'ArrowLeft' ? -amount : e.key === 'ArrowRight' ? amount : 0),
            latitude: Math.max(
              -75,
              Math.min(
                75,
                camera.latitude +
                  (e.key === 'ArrowUp' ? amount : e.key === 'ArrowDown' ? -amount : 0),
              ),
            ),
          })
        }
        if (e.key === '+' || e.key === '=') onZoom(Math.min(1.4, zoom + 0.1))
        if (e.key === '-') onZoom(Math.max(0.65, zoom - 0.1))
      }}
      onWheel={(e) => onZoom(Math.max(0.65, Math.min(1.4, zoom - e.deltaY * 0.0008)))}
    >
      {failed ? (
        <div
          className={styles.sphereFallback}
          style={
            atlas
              ? undefined
              : {
                  backgroundImage: `url(${src})`,
                  backgroundPosition: `${50 - camera.longitude / 3.6}% ${50 + camera.latitude / 1.8}%`,
                }
          }
        >
          {atlas ? (
            <svg
              viewBox={`0 0 ${gridColumns} ${gridRows}`}
              preserveAspectRatio="none"
              width="100%"
              height="100%"
              aria-label="Charted world atlas"
              className={styles.flatAtlas}
            >
              <rect width={gridColumns} height={gridRows} fill="#183d48" />
              {atlas
                .filter((s) => s.charted)
                .map((cell) => {
                  const rgb = fallbackPixels!.slice(
                    (cell.row * gridColumns + cell.column) * 4,
                    (cell.row * gridColumns + cell.column) * 4 + 3,
                  )
                  return (
                    <rect
                      key={cell.id}
                      x={cell.column}
                      y={cell.row}
                      width={1}
                      height={1}
                      fill={`rgb(${[...rgb].join(',')})`}
                      stroke="#c7dac440"
                      strokeWidth={0.04}
                    />
                  )
                })}
            </svg>
          ) : (
            <span>Drag to look around · choose a region from the list</span>
          )}
        </div>
      ) : (
        <canvas ref={canvas} aria-hidden="true" />
      )}
      {!failed ? children : null}
    </div>
  )
}
