'use client'
import { useEffect, useRef, useState } from 'react'
import { SphericalView } from './spherical-view'
import styles from './world.module.css'
export function Surroundings({
  src,
  name,
  onClose,
}: {
  src: string
  name: string
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [camera, setCamera] = useState({ longitude: 0, latitude: 0 }),
    [zoom, setZoom] = useState(1)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.showModal()
    return () => {
      previous?.focus()
    }
  }, [])
  return (
    <dialog
      ref={dialog}
      className={styles.surroundings}
      onClose={onClose}
      aria-labelledby="surroundings-title"
    >
      <SphericalView
        src={src}
        camera={camera}
        onCamera={setCamera}
        zoom={zoom}
        onZoom={setZoom}
        panorama
      />
      <header>
        <div>
          <small>VIEW 360°</small>
          <h2 id="surroundings-title">{name}</h2>
        </div>
        <button autoFocus onClick={onClose}>
          Return to Map ×
        </button>
      </header>
      <footer>
        <span>Drag to look around · Arrow keys to turn · Esc to return</span>
        <div>
          <button
            onClick={() => setCamera((c) => ({ ...c, longitude: c.longitude - 30 }))}
            aria-label="Look left"
          >
            ←
          </button>
          <button
            onClick={() => setCamera((c) => ({ ...c, longitude: c.longitude + 30 }))}
            aria-label="Look right"
          >
            →
          </button>
        </div>
        <small>Your character remains in the world.</small>
      </footer>
    </dialog>
  )
}
