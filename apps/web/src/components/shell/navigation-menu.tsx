'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import styles from './navigation-menu.module.css'

const navigation = [
  { href: '/game/character', label: 'Profile', detail: 'Character sheet and build' },
  { href: '/game/battle', label: 'Battle Hall', detail: 'Practice fights and combat' },
  {
    href: '/game/training',
    label: 'Passive Training',
    detail: 'Start a timed background training plan',
  },
  { href: '/game/online', label: 'Online Users', detail: 'Characters active in the last 10 minutes' },
] as const

export function NavigationMenu() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLElement>(null)
  const visibleNavigation = useMemo(
    () => navigation.filter((item) => pathname !== item.href && !pathname.startsWith(`${item.href}/`)),
    [pathname],
  )

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
        {visibleNavigation.map((item) => (
          <Link key={item.href} href={item.href} onClick={closeMenu}>
            <strong>{item.label}</strong>
            <small>{item.detail}</small>
          </Link>
        ))}
      </nav>
    </div>
  )
}
