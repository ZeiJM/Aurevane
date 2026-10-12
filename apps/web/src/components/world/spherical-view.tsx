'use client'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { unprojectGlobePoint, type GlobeLocation } from '@/world/globe-math'
import { createSphericalRenderer } from './spherical-renderer'
import styles from './world.module.css'
import type { WorldAtlasCell } from '@/world/types'
import { globeAtlasDetailPixels, readGlobePainting, type GlobePainting } from './globe-atlas'
import { globeFallbackPixels } from './globe-fallback'

interface Props {
  src: string
  camera: GlobeLocation
  zoom: number
  zoomLocked?: boolean
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
  zoomLocked = false,
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
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = host.current
    if (!element) return
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      if (!zoomLocked)
        onZoom(Math.max(0.6, Math.min(1.4, zoom - event.deltaY * (event.ctrlKey ? 0.006 : 0.0008))))
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [zoomLocked, zoom, onZoom])
  const drag = useRef<{ x: number; y: number; camera: GlobeLocation } | null>(null)
  const touchPoints = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ distance: number; zoom: number } | null>(null)
  const gestured = useRef(false)
  const touchDistance = () => {
    const [a, b] = [...touchPoints.current.values()]
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
  }
  const endTouch = (id: number) => {
    touchPoints.current.delete(id)
    if (touchPoints.current.size < 2) pinch.current = null
    if (!touchPoints.current.size) gestured.current = false
  }
  const cameraFrame = useRef<number | null>(null)
  const pendingCamera = useRef<GlobeLocation | null>(null)
  const [failed, setFailed] = useState(false)
  const fallbackCanvas = useRef<HTMLCanvasElement>(null)
  const hasAtlas = Boolean(atlas)
  const [painting, setPainting] = useState<GlobePainting | undefined>(undefined)
  useEffect(() => {
    if (!failed || !hasAtlas) return
    const image = new Image()
    image.onload = () => setPainting(readGlobePainting(image))
    image.src = src
    return () => {
      image.onload = null
    }
  }, [failed, src, hasAtlas])
  const detail = useMemo(
    () => (failed && atlas ? globeAtlasDetailPixels(atlas, gridColumns, gridRows, painting) : null),
    [failed, atlas, gridColumns, gridRows, painting],
  )
  useEffect(() => {
    const canvas = fallbackCanvas.current,
      ctx = canvas?.getContext('2d')
    if (!ctx || !detail || !canvas) return
    const size = 420
    canvas.width = size
    canvas.height = size
    ctx.putImageData(
      new ImageData(
        globeFallbackPixels(detail, camera, zoom, gridColumns, gridRows, size),
        size,
        size,
      ),
      0,
      0,
    )
  }, [detail, camera, zoom, gridColumns, gridRows])
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
      ref={host}
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
        if (e.pointerType === 'touch') {
          touchPoints.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
          if (touchPoints.current.size === 2) {
            pinch.current = { distance: touchDistance(), zoom }
            gestured.current = true
            drag.current = null
            return
          }
        }
        drag.current = { x: e.clientX, y: e.clientY, camera }
      }}
      onPointerMove={(e) => {
        if (touchPoints.current.has(e.pointerId))
          touchPoints.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (pinch.current && touchPoints.current.size >= 2) {
          if (!zoomLocked && pinch.current.distance > 0)
            onZoom(
              Math.max(
                0.6,
                Math.min(1.4, (pinch.current.zoom * touchDistance()) / pinch.current.distance),
              ),
            )
          return
        }
        if (gestured.current) return
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
        if (gestured.current) {
          endTouch(e.pointerId)
          drag.current = null
          return
        }
        endTouch(e.pointerId)
        const start = drag.current
        drag.current = null
        if (!start || !onActivate || panorama) return
        const dx = e.clientX - start.x,
          dy = e.clientY - start.y
        if (dx * dx + dy * dy > 36) return
        const bounds = e.currentTarget.getBoundingClientRect(),
          x = (((e.clientX - bounds.left) / bounds.width) * 2 - 1) / zoom,
          y = (1 - ((e.clientY - bounds.top) / bounds.height) * 2) / zoom
        const location = unprojectGlobePoint(x, y, start.camera)
        if (location) onActivate(location)
      }}
      onPointerCancel={(e) => {
        endTouch(e.pointerId)
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
        if (e.key === '-') onZoom(Math.max(0.6, zoom - 0.1))
      }}
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
            <canvas
              ref={fallbackCanvas}
              role="img"
              aria-label="Charted world atlas"
              data-globe-fallback
            />
          ) : (
            <span>Drag to look around · choose a region from the list</span>
          )}
        </div>
      ) : (
        <canvas ref={canvas} aria-hidden="true" />
      )}
      {!failed || atlas ? children : null}
    </div>
  )
}
