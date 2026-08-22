'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { AudioSettingsMenu } from '@/components/audio/audio-settings-menu'

import styles from './account-menu.module.css'

interface AccountMenuProps {
  activeSessionHref?: Route | null
  activeSessionLabel?: string | null
}

export function AccountMenu({
  activeSessionHref = null,
  activeSessionLabel = null,
}: AccountMenuProps) {
  const pathname = usePathname()
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
        <span aria-hidden="true">◇</span> Account
      </button>
      {open ? (
        <div className={styles.menu} role="menu" aria-label="Account menu">
          <div className={styles.audio}>
            <span>Audio</span>
            <AudioSettingsMenu />
          </div>
          {pathname !== '/game/settings/controls' ? (
            <Link href="/game/settings/controls" role="menuitem" onClick={() => setOpen(false)}>
              Controls &amp; Keybinds
            </Link>
          ) : null}
          {!activeSessionHref && pathname !== '/game/account/titles' ? (
            <Link href="/game/account/titles" role="menuitem" onClick={() => setOpen(false)}>
              Titles &amp; Profile Display
            </Link>
          ) : null}
          {activeSessionHref ? (
            <Link href={activeSessionHref} role="menuitem" onClick={() => setOpen(false)}>
              {activeSessionLabel ?? 'Return to Active Session'}
            </Link>
          ) : pathname !== '/game' ? (
            <Link href="/game" role="menuitem" onClick={() => setOpen(false)}>
              Switch Character
            </Link>
          ) : null}
          <form action="/auth/signout" method="post">
            <button type="submit" role="menuitem">
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  )
}
