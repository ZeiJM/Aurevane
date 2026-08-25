'use client'

import { useEffect, useState } from 'react'

import { BattleLogPanel } from './battle-log-panel'
import styles from './desktop-battle-log-dock.module.css'

const DESKTOP_QUERY = '(min-width: 821px)'
const LOG_REFRESH_MS = 1200

function combatLogTrigger(): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>('header button')).find((button) =>
      button.textContent?.includes('Combat Log'),
    ) ?? null
  )
}

export function DesktopBattleLogDock({
  battleSessionId,
  playerName,
  combatantNames,
}: {
  battleSessionId: string
  playerName?: string
  combatantNames?: Readonly<Record<string, string>>
}) {
  const [desktop, setDesktop] = useState(false)
  const [open, setOpen] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY)
    const sync = () => setDesktop(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!desktop) return

    function interceptLogTrigger(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null
      const button = target?.closest<HTMLButtonElement>('header button')
      if (!button || !button.textContent?.includes('Combat Log')) return
      event.preventDefault()
      event.stopImmediatePropagation()
      setOpen((value) => !value)
    }

    document.addEventListener('click', interceptLogTrigger, true)
    return () => document.removeEventListener('click', interceptLogTrigger, true)
  }, [desktop])

  useEffect(() => {
    if (!desktop) return
    const trigger = combatLogTrigger()
    trigger?.setAttribute('aria-expanded', String(open))
  }, [desktop, open])

  useEffect(() => {
    if (!desktop || !open) return
    const timer = window.setInterval(() => setRefreshTick((value) => value + 1), LOG_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [desktop, open])

  if (!desktop) return null

  return (
    <>
      <span className={styles.hook} aria-hidden="true" />
      <BattleLogPanel
        battleSessionId={battleSessionId}
        battleVersion={refreshTick}
        open={open}
        playerName={playerName}
        combatantNames={combatantNames}
        dockOnDesktop
      />
    </>
  )
}
