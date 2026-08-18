'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import styles from './navigation-menu.module.css'

const navigation = [
  { href: '/game/character', label: 'Profile', detail: 'Character sheet and build' },
  { href: '/game/battle', label: 'Battle Hall', detail: 'Practice fights and combat' },
  {
    href: '/game/training',
    label: "Wayfarer's Practice",
    detail: 'Plan modest progress while away',
  },
] as const

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
        className={styles.trigger}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">◇</span> Navigation
      </button>
      {open ? (
        <nav className={styles.menu} aria-label="Game navigation">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
              <strong>{item.label}</strong>
              <small>{item.detail}</small>
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  )
}
