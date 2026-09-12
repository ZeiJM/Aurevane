'use client'

import { useEffect, useState } from 'react'

import { useDesktopBattleLayout } from './battle-responsive-layout'
import { BattleLogPanel } from './battle-log-panel'
import { useBattleSessionUiBoolean } from './battle-session-ui-state'
import styles from './desktop-battle-log-dock.module.css'

const LOG_REFRESH_MS = 5000

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
  eventDriven = false,
}: {
  battleSessionId: string
  playerName?: string
  combatantNames?: Readonly<Record<string, string>>
  eventDriven?: boolean
}) {
  const desktop = useDesktopBattleLayout()
  const [open, setOpen] = useBattleSessionUiBoolean(battleSessionId, 'battleLogOpen', desktop)
  const [refreshTick, setRefreshTick] = useState(0)

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
  }, [desktop, setOpen])

  useEffect(() => {
    if (!desktop) return
    const trigger = combatLogTrigger()
    trigger?.setAttribute('aria-expanded', String(open))
  }, [desktop, open])

  useEffect(() => {
    if (!desktop || !open) return

    const refreshFromBattleState = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      const next = event.detail as
        { battleSessionId?: unknown; battleVersion?: unknown } | undefined
      if (next?.battleSessionId !== battleSessionId) return
      if (typeof next.battleVersion !== 'number') return
      setRefreshTick(next.battleVersion)
    }
    const eventName = eventDriven ? 'aurevane:pvp-battle-state' : 'aurevane:battle-state'
    window.addEventListener(eventName, refreshFromBattleState)

    // PvE keeps a quiet fallback poll in case a browser misses an event, but normal combat updates
    // now refresh immediately from the authoritative battle-state event instead of waiting 5s.
    const timer = eventDriven
      ? null
      : window.setInterval(() => setRefreshTick((value) => value + 1), LOG_REFRESH_MS)

    return () => {
      window.removeEventListener(eventName, refreshFromBattleState)
      if (timer !== null) window.clearInterval(timer)
    }
  }, [battleSessionId, desktop, eventDriven, open])

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
