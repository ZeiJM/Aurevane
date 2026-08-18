'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import styles from './navigation-menu.module.css'

export function NavigationMenu() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutside, true)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside, true)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">◆</span> Navigation
      </button>
      {open ? (
        <nav className={styles.menu} aria-label="Game navigation">
          <Link href="/game/character" onClick={() => setOpen(false)}>
            <strong>Profile</strong>
            <small>Character overview</small>
          </Link>
          <Link href="/game/battle" onClick={() => setOpen(false)}>
            <strong>Battle Hall</strong>
            <small>Practice and combat</small>
          </Link>
          <Link href="/game/training" onClick={() => setOpen(false)}>
            <strong>Offline Training</strong>
            <small>Progress while away</small>
          </Link>
        </nav>
      ) : null}
    </div>
  )
}
