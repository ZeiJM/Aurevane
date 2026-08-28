'use client'

import { useEffect } from 'react'

import styles from './battle-stabilization-polish.module.css'

type Facing = 'north' | 'east' | 'south' | 'west'

const BASE_FACING_GLYPH = '←'
const FACING_TRANSFORM: Record<Facing, string> = {
  west: 'none',
  north: 'rotate(90deg)',
  east: 'scaleX(-1)',
  south: 'rotate(-90deg)',
}

const BATTLEFIELD_SELECTORS = [
  'section[aria-label="Tactical battlefield"]',
  'section[aria-label="PvP tactical battlefield"]',
] as const

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
      if (child.hasAttribute('data-battle-tile-facing')) return false
      if (child.hasAttribute('data-mobile-token-facing')) return false
      if (child.hasAttribute('data-mobile-token-meters')) return false
      if (child.tagName !== 'SPAN' && child.tagName !== 'I') return false
      return facingFromGlyph(child.textContent?.trim() ?? '') !== null
    }) ?? null
  )
}

function restoreFacingPresentation(root: ParentNode = document): void {
  for (const native of root.querySelectorAll<HTMLElement>('[data-battle-native-facing="true"]')) {
    native.style.removeProperty('visibility')
    delete native.dataset.battleNativeFacing
  }

  // Clean up the superseded mobile-only marker from the previous presentation pass as well.
  for (const legacy of root.querySelectorAll<HTMLElement>('[data-mobile-native-facing="true"]')) {
    legacy.style.removeProperty('visibility')
    delete legacy.dataset.mobileNativeFacing
  }
  for (const marker of root.querySelectorAll<HTMLElement>('[data-mobile-token-facing="true"]')) {
    marker.remove()
  }
  for (const marker of root.querySelectorAll<HTMLElement>('[data-battle-tile-facing="true"]')) {
    marker.remove()
  }
}

function createTileFacingMarker(tile: HTMLElement): HTMLElement {
  const marker = document.createElement('span')
  marker.dataset.battleTileFacing = 'true'
  marker.setAttribute('aria-hidden', 'true')
  marker.textContent = BASE_FACING_GLYPH

  // The tile is already position: relative in both battle renderers. Keeping this marker inside the
  // tile guarantees it cannot protrude past a board edge regardless of the unit's facing direction.
  marker.style.position = 'absolute'
  marker.style.right = '0.18rem'
  marker.style.zIndex = '12'
  marker.style.display = 'grid'
  marker.style.width = '0.68rem'
  marker.style.height = '0.68rem'
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

  tile.append(marker)
  return marker
}

function syncBattlefieldFacingMarkers(): void {
  for (const selector of BATTLEFIELD_SELECTORS) {
    const battlefield = document.querySelector<HTMLElement>(selector)
    if (!battlefield) continue

    for (const tile of battlefield.querySelectorAll<HTMLElement>('button[aria-label*="occupied by"]')) {
      const unit = directUnit(tile)
      if (!unit) continue

      const nativeFacing = nativeFacingElement(unit)
      if (!nativeFacing) continue
      const facing = facingFromGlyph(nativeFacing.textContent?.trim() ?? '')
      if (!facing) continue

      if (nativeFacing.dataset.battleNativeFacing !== 'true') {
        nativeFacing.dataset.battleNativeFacing = 'true'
        nativeFacing.style.setProperty('visibility', 'hidden', 'important')
      }

      // Remove the previous mobile-only clone if it happens to survive a hot/client transition.
      unit.querySelector<HTMLElement>(':scope > [data-mobile-token-facing="true"]')?.remove()

      const marker =
        tile.querySelector<HTMLElement>(':scope > [data-battle-tile-facing="true"]') ??
        createTileFacingMarker(tile)

      // Raised-ground tiles already reserve the extreme top-right for the elevation glyph.
      marker.style.top = tile.hasAttribute('data-elevation') ? '0.82rem' : '0.18rem'

      if (marker.dataset.battleTileFacingDirection !== facing) {
        marker.dataset.battleTileFacingDirection = facing
        marker.style.transform = FACING_TRANSFORM[facing]
      }
    }
  }
}

export function BattleStabilizationPolish() {
  useEffect(() => {
    let frame = 0

    const run = () => {
      frame = 0
      syncBattlefieldFacingMarkers()
    }
    const schedule = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(run)
    }

    run()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['aria-label', 'data-elevation'],
    })

    return () => {
      observer.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
      restoreFacingPresentation()
    }
  }, [])

  return <span className={styles.hook} aria-hidden="true" />
}
