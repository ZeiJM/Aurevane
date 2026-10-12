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
  center,
  onWalk,
  onPlayer,
}: {
  view: WorldView
  motion: WorldMotion
  portrait: string
  animate: boolean
  paused: boolean
  zoom: number
  center: number
  onWalk: (position: WorldPosition) => void
  onPlayer: (id: string) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    renderer = useRef<ReturnType<typeof createMapRenderer>>(null)
  const initial = useRef(view)
  const callbacks = useRef({ onWalk, onPlayer })
  useEffect(() => {
    callbacks.current = { onWalk, onPlayer }
  }, [onWalk, onPlayer])
  useEffect(() => {
    if (!canvas.current) return
    renderer.current = createMapRenderer(
      canvas.current,
      motion,
      initial.current,
      (position) => callbacks.current.onWalk(position),
      (id) => callbacks.current.onPlayer(id),
    )
    return () => renderer.current?.dispose()
  }, [motion]) // Initial snapshot is replaced below without recreating the renderer.
  useEffect(() => {
    renderer.current?.update(view)
  }, [view])
  useEffect(() => {
    renderer.current?.settings({ animate, zoom, paused })
  }, [animate, zoom, paused])
  useEffect(() => {
    renderer.current?.center()
  }, [center])
  return (
    <canvas
      ref={canvas}
      className={styles.canvas}
      data-world-stage
      data-portrait={portrait}
      tabIndex={0}
      role="application"
      aria-label="World map. Click ground to walk, drag to look around, or use arrow keys to walk."
    />
  )
}
