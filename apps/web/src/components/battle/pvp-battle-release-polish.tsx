'use client'

import { useEffect } from 'react'

import styles from './pvp-battle-release-polish.module.css'
import parityStyles from './pvp-battle-shell-parity-fix.module.css'

const APPROVED_HEADER_LAYOUT = 'approved'

export function PvpBattleReleasePolish() {
  useEffect(() => {
    let frame: number | null = null

    const locate = () => {
      frame = null
      const root = document.querySelector<HTMLElement>('main[data-pvp-battle="true"]')
      const header = root?.querySelector<HTMLElement>(':scope > header') ?? null
      const economyTrack =
        header?.querySelector<HTMLElement>(
          '[role="progressbar"][aria-label="Action Economy remaining"]',
        ) ?? null
      const economy =
        economyTrack?.parentElement instanceof HTMLElement ? economyTrack.parentElement : null

      if (header) header.dataset.pvpHeaderLayout = APPROVED_HEADER_LAYOUT
      if (economy) {
        economy.dataset.pvpHeaderEconomy = 'true'
        economy.dataset.pvpHeaderLayout = APPROVED_HEADER_LAYOUT
      }
    }

    const schedule = () => {
      if (frame !== null) return
      frame = window.requestAnimationFrame(locate)
    }

    locate()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      if (frame !== null) window.cancelAnimationFrame(frame)
      const root = document.querySelector<HTMLElement>('main[data-pvp-battle="true"]')
      root
        ?.querySelector<HTMLElement>(`:scope > header[data-pvp-header-layout="${APPROVED_HEADER_LAYOUT}"]`)
        ?.removeAttribute('data-pvp-header-layout')
      root
        ?.querySelector<HTMLElement>(
          `[data-pvp-header-economy="true"][data-pvp-header-layout="${APPROVED_HEADER_LAYOUT}"]`,
        )
        ?.removeAttribute('data-pvp-header-layout')
    }
  }, [])

  return <span className={`${styles.hook} ${parityStyles.hook}`} aria-hidden="true" />
}
