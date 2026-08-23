'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import styles from './pvp-battle-release-polish.module.css'
import parityStyles from './pvp-battle-shell-parity-fix.module.css'

export function PvpBattleReleasePolish() {
  const [headerTarget, setHeaderTarget] = useState<HTMLElement | null>(null)
  const [victorySource, setVictorySource] = useState<HTMLButtonElement | null>(null)
  const [victoryCount, setVictoryCount] = useState('0/1')

  useEffect(() => {
    let frame: number | null = null

    const locate = () => {
      frame = null
      const root = document.querySelector<HTMLElement>('main[data-pvp-battle="true"]')
      const header = root?.querySelector<HTMLElement>(':scope > header') ?? null
      const economy = root?.querySelector<HTMLElement>('[data-pvp-header-economy="true"]') ?? null
      const source = economy
        ? (Array.from(economy.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
            button.textContent?.includes('Victory Conditions'),
          ) ?? null)
        : null

      if (source) source.dataset.pvpHeaderVictorySource = 'true'
      const count = source?.querySelector<HTMLElement>('strong')?.textContent?.trim()
      if (count) setVictoryCount((current) => (current === count ? current : count))
      setHeaderTarget((current) => (current === header ? current : header))
      setVictorySource((current) => (current === source ? current : source))
    }

    const schedule = () => {
      if (frame !== null) return
      frame = window.requestAnimationFrame(locate)
    }

    locate()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    return () => {
      observer.disconnect()
      if (frame !== null) window.cancelAnimationFrame(frame)
      victorySource?.removeAttribute('data-pvp-header-victory-source')
    }
  }, [victorySource])

  return (
    <>
      <span className={`${styles.hook} ${parityStyles.hook}`} aria-hidden="true" />
      {headerTarget && victorySource
        ? createPortal(
            <button
              type="button"
              className={parityStyles.victoryMirror}
              data-pvp-header-victory-mirror="true"
              onClick={() => victorySource.click()}
            >
              <span>Victory Conditions</span>
              <strong>{victoryCount}</strong>
            </button>,
            headerTarget,
          )
        : null}
    </>
  )
}
