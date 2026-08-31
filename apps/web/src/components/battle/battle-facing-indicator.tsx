'use client'

import { useEffect, useRef, useState } from 'react'

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
  const [displayFacing, setDisplayFacing] = useState(facing)
  const compatibilityGlyphRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => setDisplayFacing(facing), [facing])

  useEffect(() => {
    const glyph = compatibilityGlyphRef.current
    if (!glyph) return

    const syncLegacyPreview = () => {
      const nextFacing = facingFromGlyph(glyph.textContent ?? '')
      if (nextFacing) setDisplayFacing(nextFacing)
    }

    const observer = new MutationObserver(syncLegacyPreview)
    observer.observe(glyph, { childList: true, characterData: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return (
    <div
      className={styles.indicator}
      data-battle-facing-indicator="true"
      data-facing={displayFacing}
      aria-hidden="true"
    >
      <svg viewBox="0 0 12 12" focusable="false" aria-hidden="true">
        <path d="M6 0.8 10.4 5.2H7.4V11.2H4.6V5.2H1.6L6 0.8Z" />
      </svg>
      <span ref={compatibilityGlyphRef} className={styles.compatibilityGlyph}>
        {FACING_GLYPHS[displayFacing]}
      </span>
    </div>
  )
}
