'use client'

import { useEffect } from 'react'

import styles from './battle-stabilization-polish.module.css'

type Facing = 'north' | 'east' | 'south' | 'west'

const MOBILE_PVP_QUERY = '(max-width: 820px)'
const BASE_FACING_GLYPH = '←'
const FACING_TRANSFORM: Record<Facing, string> = {
  west: 'none',
  north: 'rotate(90deg)',
  east: 'scaleX(-1)',
  south: 'rotate(-90deg)',
}

function facingFromGlyph(value: string): Facing | null {
  if (value.includes('↑')) return 'north'
  if (value.includes('→')) return 'east'
  if (value.includes('↓')) return 'south'
  if (value.includes('←')) return 'west'
  return null
}

function directUnit(tile: HTMLElement): HTMLElement | null {
  return (
    Array.from(tile.children).find(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && Boolean(child.querySelector(':scope > strong')),
    ) ?? null
  )
}

function nativeFacingElement(unit: HTMLElement): HTMLElement | null {
  return (
    Array.from(unit.children).find((child): child is HTMLElement => {
      if (!(child instanceof HTMLElement)) return false
      if (child.hasAttribute('data-mobile-token-facing')) return false
      if (child.hasAttribute('data-mobile-token-meters')) return false
      return facingFromGlyph(child.textContent?.trim() ?? '') !== null
    }) ?? null
  )
}

function restoreNativeFacingMarkers(root: ParentNode = document): void {
  for (const native of root.querySelectorAll<HTMLElement>('[data-mobile-native-facing="true"]')) {
    native.style.removeProperty('visibility')
    delete native.dataset.mobileNativeFacing
  }
  for (const marker of root.querySelectorAll<HTMLElement>('[data-mobile-token-facing="true"]')) {
    marker.remove()
  }
}

function createFacingMarker(unit: HTMLElement): HTMLElement {
  const marker = document.createElement('span')
  marker.dataset.mobileTokenFacing = 'true'
  marker.setAttribute('aria-hidden', 'true')
  marker.textContent = BASE_FACING_GLYPH

  // Canonical geometry is the approved red PvP token marker. Every direction reuses this exact
  // glyph and box. East mirrors the west glyph horizontally instead of rotating it 180 degrees;
  // that preserves the font's vertical baseline so left/right arrows sit at the exact same height.
  marker.style.position = 'absolute'
  marker.style.top = '-0.78rem'
  marker.style.left = '50%'
  marker.style.zIndex = '9'
  marker.style.display = 'grid'
  marker.style.width = '0.68rem'
  marker.style.height = '0.68rem'
  marker.style.marginLeft = '-0.34rem'
  marker.style.placeItems = 'center'
  marker.style.color = '#f1d892'
  marker.style.fontFamily = 'var(--av-font-mono)'
  marker.style.fontSize = '0.68rem'
  marker.style.fontWeight = '900'
  marker.style.lineHeight = '1'
  marker.style.textAlign = 'center'
  marker.style.textShadow = '0 1px 3px #000'
  marker.style.transformOrigin = '50% 50%'
  marker.style.pointerEvents = 'none'

  unit.append(marker)
  return marker
}

function syncMobilePvpFacingMarkers(): void {
  const root = document.querySelector<HTMLElement>('main[data-pvp-battle="true"]')
  if (!root) return

  const media = window.matchMedia(MOBILE_PVP_QUERY)
  if (!media.matches) {
    restoreNativeFacingMarkers(root)
    return
  }

  const battlefield = root.querySelector<HTMLElement>(
    'section[aria-label="PvP tactical battlefield"]',
  )
  if (!battlefield) return

  for (const tile of battlefield.querySelectorAll<HTMLElement>('button[aria-label*="occupied by"]')) {
    const unit = directUnit(tile)
    if (!unit) continue

    const nativeFacing = nativeFacingElement(unit)
    if (!nativeFacing) continue
    const facing = facingFromGlyph(nativeFacing.textContent?.trim() ?? '')
    if (!facing) continue

    if (nativeFacing.dataset.mobileNativeFacing !== 'true') {
      nativeFacing.dataset.mobileNativeFacing = 'true'
      nativeFacing.style.setProperty('visibility', 'hidden', 'important')
    }

    const marker =
      unit.querySelector<HTMLElement>(':scope > [data-mobile-token-facing="true"]') ??
      createFacingMarker(unit)
    if (marker.dataset.mobileTokenFacingDirection !== facing) {
      marker.dataset.mobileTokenFacingDirection = facing
      marker.style.transform = FACING_TRANSFORM[facing]
    }
  }
}

export function BattleStabilizationPolish() {
  useEffect(() => {
    let frame = 0
    const media = window.matchMedia(MOBILE_PVP_QUERY)

    const run = () => {
      frame = 0
      syncMobilePvpFacingMarkers()
    }
    const schedule = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(run)
    }

    run()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    media.addEventListener('change', schedule)

    return () => {
      observer.disconnect()
      media.removeEventListener('change', schedule)
      if (frame !== 0) window.cancelAnimationFrame(frame)
      restoreNativeFacingMarkers()
    }
  }, [])

  return <span className={styles.hook} aria-hidden="true" />
}
