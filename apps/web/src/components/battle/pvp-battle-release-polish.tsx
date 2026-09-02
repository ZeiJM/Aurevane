'use client'

import { useEffect } from 'react'

import spectatorFooterStyles from './battle-spectator-footer-shape.module.css'
import visualParityStyles from './pvp-ai-action-visual-parity.module.css'
import objectiveParityStyles from './pvp-ai-header-objective-parity.module.css'
import boardScaleStyles from './pvp-battle-board-scale-authority.module.css'
import styles from './pvp-battle-release-polish.module.css'
import parityStyles from './pvp-battle-shell-parity-fix.module.css'

const APPROVED_HEADER_LAYOUT = 'approved'

type PvpActionVisualMode = 'move' | 'attack' | 'guard' | 'recover' | 'finish'

function activeActionVisualMode(root: HTMLElement): PvpActionVisualMode | null {
  const activeCommand = Array.from(
    root.querySelectorAll<HTMLButtonElement>(
      'section[aria-label="Command Deck"] button[data-active]',
    ),
  ).find((button) => button.querySelector('strong'))
  const label = activeCommand?.querySelector('strong')?.textContent?.trim()

  if (label === 'Move') return 'move'
  if (label === 'Basic Attack') return 'attack'
  if (label === 'Guard') return 'guard'
  if (label === 'Recover') return 'recover'
  if (label === 'Finish Turn') return 'finish'
  return null
}

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

      if (root) {
        const actionMode = activeActionVisualMode(root)
        if (actionMode) root.dataset.pvpActionMode = actionMode
        else delete root.dataset.pvpActionMode
      }
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
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-active'],
    })

    return () => {
      observer.disconnect()
      if (frame !== null) window.cancelAnimationFrame(frame)
      const root = document.querySelector<HTMLElement>('main[data-pvp-battle="true"]')
      root?.removeAttribute('data-pvp-action-mode')
      root
        ?.querySelector<HTMLElement>(
          `:scope > header[data-pvp-header-layout="${APPROVED_HEADER_LAYOUT}"]`,
        )
        ?.removeAttribute('data-pvp-header-layout')
      root
        ?.querySelector<HTMLElement>(
          `[data-pvp-header-economy="true"][data-pvp-header-layout="${APPROVED_HEADER_LAYOUT}"]`,
        )
        ?.removeAttribute('data-pvp-header-layout')
    }
  }, [])

  return (
    <span
      className={`${styles.hook} ${parityStyles.hook} ${visualParityStyles.hook} ${objectiveParityStyles.hook} ${boardScaleStyles.hook} ${spectatorFooterStyles.hook}`}
      aria-hidden="true"
    />
  )
}
