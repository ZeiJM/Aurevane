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
  const menuRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    const syncOpenState = () => setOpen(menu.matches(':popover-open'))
    menu.addEventListener('toggle', syncOpenState)
    return () => menu.removeEventListener('toggle', syncOpenState)
  }, [])

  function toggleMenu() {
    const menu = menuRef.current
    if (!menu) return
    if (menu.matches(':popover-open')) menu.hidePopover()
    else menu.showPopover()
  }

  function closeMenu() {
    const menu = menuRef.current
    if (menu?.matches(':popover-open')) menu.hidePopover()
  }

  return (
    <div className={styles.root}>
      <button
        className={styles.trigger}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={toggleMenu}
      >
        <span aria-hidden="true">◇</span> Navigation
      </button>
      <nav ref={menuRef} popover="auto" className={styles.menu} aria-label="Game navigation">
        {navigation.map((item) => (
          <Link key={item.href} href={item.href} onClick={closeMenu}>
            <strong>{item.label}</strong>
            <small>{item.detail}</small>
          </Link>
        ))}
      </nav>
    </div>
  )
}
