'use client'
import { useEffect, useRef } from 'react'
import type { WorldPosition, WorldView } from '@/world/types'
import { createMapRenderer } from './map-renderer'
import { WorldMotion } from './world-motion'
import styles from './workspace.module.css'
export function WorldMap({
  view,
  motion,
  portrait,
  animate,
  paused,
  zoom,
  zoomLocked,
  onZoom,
  onWalk,
  onPlayer,
  onVisiblePlayers,
}: {
  view: WorldView
  motion: WorldMotion
  portrait: string
  animate: boolean
  paused: boolean
  zoom: number
  zoomLocked: boolean
  onZoom: (zoom: number) => void
  onWalk: (position: WorldPosition) => void
  onPlayer: (id: string) => void
  onVisiblePlayers: (ids: string[]) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    renderer = useRef<ReturnType<typeof createMapRenderer>>(null)
  const initial = useRef(view)
  const callbacks = useRef({ onWalk, onPlayer, onZoom, onVisiblePlayers })
  useEffect(() => {
    callbacks.current = { onWalk, onPlayer, onZoom, onVisiblePlayers }
  }, [onWalk, onPlayer, onZoom, onVisiblePlayers])
  useEffect(() => {
    if (!canvas.current) return
    renderer.current = createMapRenderer(
      canvas.current,
      motion,
      initial.current,
      (position) => callbacks.current.onWalk(position),
      (id) => callbacks.current.onPlayer(id),
      (zoom) => callbacks.current.onZoom(zoom),
      (ids) => callbacks.current.onVisiblePlayers(ids),
    )
    return () => renderer.current?.dispose()
  }, [motion]) // Initial snapshot is replaced below without recreating the renderer.
  useEffect(() => {
    renderer.current?.update(view)
  }, [view])
  useEffect(() => {
    renderer.current?.settings({ animate, zoom, paused, zoomLocked })
  }, [animate, zoom, paused, zoomLocked])
  return (
    <canvas
      ref={canvas}
      className={styles.canvas}
      data-world-stage
      data-portrait={portrait}
      tabIndex={0}
      role="application"
      aria-label="World map. Click ground or use WASD and arrow keys to walk. Use the mouse wheel or pinch to zoom."
    />
  )
}
