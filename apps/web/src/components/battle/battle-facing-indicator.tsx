'use client'

import { Fragment, useEffect, useRef } from 'react'

import type { BattleFacing } from './battle-geometry'
import styles from './battle-facing-indicator.module.css'

const FACING_GLYPHS: Record<BattleFacing, string> = {
  north: '↑',
  east: '→',
  south: '↓',
  west: '←',
}

function facingFromGlyph(value: string): BattleFacing | null {
  if (value.includes(FACING_GLYPHS.north)) return 'north'
  if (value.includes(FACING_GLYPHS.east)) return 'east'
  if (value.includes(FACING_GLYPHS.south)) return 'south'
  if (value.includes(FACING_GLYPHS.west)) return 'west'
  return null
}

export function BattleFacingIndicator({ facing }: { facing: BattleFacing }) {
  const indicatorRef = useRef<HTMLDivElement | null>(null)
  const compatibilityGlyphRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const indicator = indicatorRef.current
    const glyph = compatibilityGlyphRef.current
    if (!indicator || !glyph) return

    const syncLegacyPreview = () => {
      const nextFacing = facingFromGlyph(glyph.textContent ?? '')
      if (nextFacing) indicator.dataset.facing = nextFacing
    }

    const observer = new MutationObserver(syncLegacyPreview)
    observer.observe(glyph, { childList: true, characterData: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return (
    <Fragment>
      <div
        ref={indicatorRef}
        className={styles.indicator}
        data-battle-facing-indicator="true"
        data-facing={facing}
        aria-hidden="true"
      >
        <svg viewBox="0 0 12 12" focusable="false" aria-hidden="true">
          <path d="M6 0.8 10.4 5.2H7.4V11.2H4.6V5.2H1.6L6 0.8Z" />
        </svg>
      </div>
      <i ref={compatibilityGlyphRef} className={styles.compatibilityGlyph} aria-hidden="true">
        {FACING_GLYPHS[facing]}
      </i>
    </Fragment>
  )
}
