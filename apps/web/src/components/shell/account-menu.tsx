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
  characterName?: string | null
  masterPanelHref?: Route | null
}

export function AccountMenu({
  activeSessionHref = null,
  activeSessionLabel = null,
  characterName = null,
  masterPanelHref = null,
}: AccountMenuProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [resolvedMasterPanelHref, setResolvedMasterPanelHref] = useState<Route | null>(null)
  const [masterAccessResolved, setMasterAccessResolved] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const effectiveMasterPanelHref = masterPanelHref ?? resolvedMasterPanelHref

  useEffect(() => {
    if (!open || masterPanelHref || masterAccessResolved) return
    let cancelled = false

    async function loadMasterPanelAccess() {
      try {
        const response = await fetch('/api/master/access', { cache: 'no-store' })
        const body = (await response.json()) as { hasAccess?: boolean }
        if (cancelled) return
        setResolvedMasterPanelHref(response.ok && body.hasAccess === true ? '/master' : null)
      } catch {
        if (cancelled) return
        setResolvedMasterPanelHref(null)
      } finally {
        if (!cancelled) setMasterAccessResolved(true)
      }
    }

    void loadMasterPanelAccess()
    return () => {
      cancelled = true
    }
  }, [masterAccessResolved, masterPanelHref, open])

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
          {characterName ? (
            <div className={styles.characterGreeting}>
              <span>Current character</span>
              <strong>Welcome back, {characterName}.</strong>
            </div>
          ) : null}
          <AudioSettingsMenu
            rootClassName={styles.audioRoot}
            triggerClassName={styles.audioTrigger}
            triggerLabel="Audio"
            triggerRole="menuitem"
            showTriggerMarker={false}
          />
          {pathname !== '/game/settings/controls' ? (
            <Link
              href="/game/settings/controls"
              prefetch={false}
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              Controls &amp; Keybinds
            </Link>
          ) : null}
          {!activeSessionHref && pathname !== '/game/account/titles' ? (
            <Link
              href="/game/account/titles"
              prefetch={false}
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              Titles &amp; Profile Display
            </Link>
          ) : null}
          {activeSessionHref ? (
            <Link
              href={activeSessionHref}
              prefetch={false}
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              {activeSessionLabel ?? 'Return to Active Session'}
            </Link>
          ) : pathname !== '/game' ? (
            <Link
              href="/game"
              prefetch={false}
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              Switch Character
            </Link>
          ) : null}
          {effectiveMasterPanelHref && !pathname.startsWith('/master') ? (
            <Link
              className={styles.masterPanelLink}
              href={effectiveMasterPanelHref}
              prefetch={false}
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <span aria-hidden="true">✦</span>
              Master Panel
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
