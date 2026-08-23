'use client'

import { useEffect, useRef } from 'react'

import { battleCombatantAccent } from './battle-combatant-colors'
import styles from './ai-desktop-combatant-rail-polish.module.css'

const DESKTOP_QUERY = '(min-width: 881px)'

function combatantNameFromRail(rail: HTMLElement): string | null {
  const label = rail.getAttribute('aria-label') ?? ''
  const suffix = ' combat status'
  if (!label.endsWith(suffix)) return null
  const name = label.slice(0, -suffix.length).trim()
  return name || null
}

export function AiDesktopCombatantRailPolish({ playerName }: { playerName: string }) {
  const accentsByName = useRef(new Map<string, string>())
  const nextAccentIndex = useRef(1)

  useEffect(() => {
    accentsByName.current.clear()
    accentsByName.current.set(playerName, battleCombatantAccent(0))
    nextAccentIndex.current = 1

    let frame = 0

    const accentForName = (name: string): string => {
      const existing = accentsByName.current.get(name)
      if (existing) return existing
      const accent = battleCombatantAccent(nextAccentIndex.current)
      nextAccentIndex.current += 1
      accentsByName.current.set(name, accent)
      return accent
    }

    const decorate = () => {
      frame = 0
      if (!window.matchMedia(DESKTOP_QUERY).matches) return

      const root = document.querySelector<HTMLElement>('main[aria-busy]')
      if (!root || root.dataset.pvpBattle === 'true') return
      root.dataset.aiDesktopCombatantRails = 'true'

      for (const rail of root.querySelectorAll<HTMLElement>(
        'aside[aria-label$=" combat status"]',
      )) {
        const name = combatantNameFromRail(rail)
        if (!name) continue
        const accent = accentForName(name)
        rail.dataset.aiCompactRail = 'true'
        rail.style.setProperty('--battle-combatant-accent', accent)

        const card = rail.querySelector<HTMLElement>(':scope > article')
        if (!card) continue
        card.dataset.aiCompactCard = 'true'
        card.style.setProperty('--battle-combatant-accent', accent)

        const heading =
          card.firstElementChild instanceof HTMLElement ? card.firstElementChild : null
        if (heading) heading.dataset.aiCompactHeading = 'true'

        const portrait = card.querySelector<HTMLButtonElement>('button[aria-label^="Show "]')
        if (portrait) {
          portrait.dataset.aiCompactPortrait = 'true'
          portrait.dataset.desktopInspectName = name
          portrait.style.setProperty('--battle-combatant-accent', accent)
        }

        const effects = card.querySelector<HTMLElement>('[aria-label$=" buffs and debuffs"]')
        if (effects) effects.dataset.aiCompactHidden = 'true'

        const facing = Array.from(card.querySelectorAll<HTMLButtonElement>('button')).find(
          (button) => {
            if (button === portrait) return false
            const text = button.textContent?.toLowerCase() ?? ''
            return ['north', 'east', 'south', 'west'].some((direction) => text.includes(direction))
          },
        )
        if (facing) {
          facing.dataset.aiCompactHidden = 'true'
          if (heading) {
            let arrow = heading.querySelector<HTMLElement>('[data-ai-facing-arrow="true"]')
            if (!arrow) {
              arrow = document.createElement('i')
              arrow.dataset.aiFacingArrow = 'true'
              const activeBadge = heading.querySelector(':scope > b')
              heading.insertBefore(arrow, activeBadge)
            }
            arrow.textContent = facing.querySelector('span')?.textContent?.trim() ?? '•'
            arrow.setAttribute('aria-label', `${name} current facing`)
            arrow.title = `Current facing: ${facing.textContent?.trim() ?? ''}`
          }
        }
      }

      for (const tile of root.querySelectorAll<HTMLButtonElement>(
        '#battlefield button[aria-label^="Tile "][aria-label*="occupied by"]',
      )) {
        const label = tile.getAttribute('aria-label') ?? ''
        const occupiedBy = label.split('; occupied by ')[1]?.trim()
        if (!occupiedBy) continue
        const token = tile.lastElementChild instanceof HTMLElement ? tile.lastElementChild : null
        if (!token || !token.querySelector('strong')) continue
        const accent = accentForName(occupiedBy)
        token.dataset.aiCombatantToken = 'true'
        token.style.setProperty('--battle-combatant-accent', accent)
      }
    }

    const schedule = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(decorate)
    }

    decorate()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    })
    window.addEventListener('resize', schedule)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', schedule)
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [playerName])

  return <span className={styles.hook} aria-hidden="true" />
}
