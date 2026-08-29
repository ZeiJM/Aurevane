'use client'

import type { Route } from 'next'
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
] as const

const navigationPopoverId = 'game-navigation-menu'

interface NavigationMenuProps {
  activeSessionHref?: Route | null
  activeSessionLabel?: string | null
}

export function NavigationMenu({
  activeSessionHref = null,
  activeSessionLabel = null,
}: NavigationMenuProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLElement>(null)
  const visibleNavigation = useMemo(
    () =>
      activeSessionHref
        ? []
        : navigation.filter(
            (item) => pathname !== item.href && !pathname.startsWith(`${item.href}/`),
          ),
    [activeSessionHref, pathname],
  )

  useEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    const syncOpenState = () => setOpen(menu.matches(':popover-open'))
    menu.addEventListener('toggle', syncOpenState)
    return () => menu.removeEventListener('toggle', syncOpenState)
  }, [])

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
        popoverTarget={navigationPopoverId}
        popoverTargetAction="toggle"
      >
        <span aria-hidden="true">◇</span> Navigation
      </button>
      <nav
        id={navigationPopoverId}
        ref={menuRef}
        popover="auto"
        className={styles.menu}
        aria-label="Game navigation"
      >
        {activeSessionHref ? (
          <Link href={activeSessionHref} prefetch={false} onClick={closeMenu}>
            <strong>{activeSessionLabel ?? 'Return to Active Session'}</strong>
            <small>Restricted actions stay locked until this session ends</small>
          </Link>
        ) : null}
        {visibleNavigation.map((item) => (
          <Link key={item.href} href={item.href} prefetch={false} onClick={closeMenu}>
            <strong>{item.label}</strong>
            <small>{item.detail}</small>
          </Link>
        ))}
      </nav>
    </div>
  )
}
