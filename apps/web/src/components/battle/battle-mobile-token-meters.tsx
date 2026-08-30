'use client'

import { useEffect, useRef } from 'react'

import type { BattleSessionView } from '@/server/battle/battle-session-service'

const MOBILE_QUERY = '(max-width: 820px)'

function percent(value: number, maximum: number): string {
  if (maximum <= 0) return '0%'
  return `${Math.max(0, Math.min(100, (value / maximum) * 100))}%`
}

function occupiedName(tile: HTMLButtonElement): string | null {
  const label = tile.getAttribute('aria-label') ?? ''
  const marker = '; occupied by '
  const index = label.indexOf(marker)
  return index >= 0 ? label.slice(index + marker.length).trim() || null : null
}

function ensureMeterHost(token: HTMLElement): HTMLElement {
  const existing = token.querySelector<HTMLElement>(':scope > [data-mobile-token-meters="true"]')
  if (existing) return existing

  const host = document.createElement('span')
  host.dataset.mobileTokenMeters = 'true'
  host.setAttribute('aria-hidden', 'true')

  for (const resource of ['hp', 'mp'] as const) {
    const track = document.createElement('span')
    track.dataset.mobileTokenMeter = resource
    const fill = document.createElement('i')
    track.append(fill)
    host.append(track)
  }

  token.append(host)
  return host
}

function removeMeters(root: ParentNode = document): void {
  root
    .querySelectorAll<HTMLElement>('[data-mobile-token-meters="true"]')
    .forEach((meter) => meter.remove())
}

export function BattleMobileTokenMeters({
  initialBattle,
  combatantNames,
}: {
  initialBattle: BattleSessionView
  combatantNames: Readonly<Record<string, string>>
}) {
  const battle = useRef(initialBattle)

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('main[data-unified-battle="true"]')
    const battlefield = root?.querySelector<HTMLElement>('#battlefield') ?? null
    const media = window.matchMedia(MOBILE_QUERY)
    if (!root || !battlefield) return

    const combatantIdByName = new Map(
      Object.entries(combatantNames).map(([combatantId, name]) => [name, combatantId]),
    )
    let frame = 0

    const sync = () => {
      frame = 0
      if (!media.matches) {
        removeMeters(battlefield)
        return
      }

      const combatants = new Map(
        battle.current.snapshot.tactical.battle.combatants.map((combatant) => [combatant.id, combatant]),
      )

      for (const tile of battlefield.querySelectorAll<HTMLButtonElement>(
        'button[aria-label^="Tile "][aria-label*="occupied by"]',
      )) {
        const name = occupiedName(tile)
        const combatantId = name ? combatantIdByName.get(name) : null
        const combatant = combatantId ? combatants.get(combatantId) : null
        const token =
          tile.querySelector<HTMLElement>(':scope > [data-battle-shared-token="true"]') ??
          tile.querySelector<HTMLElement>(':scope > [data-team]')
        if (!token || !combatant) continue

        token.dataset.battleSharedToken = 'true'
        const host = ensureMeterHost(token)
        const hpFill = host.querySelector<HTMLElement>('[data-mobile-token-meter="hp"] > i')
        const mpFill = host.querySelector<HTMLElement>('[data-mobile-token-meter="mp"] > i')
        const hpWidth = percent(combatant.hp, combatant.maxHp)
        const mpWidth = percent(combatant.mp, combatant.maxMp)
        if (hpFill && hpFill.style.width !== hpWidth) hpFill.style.width = hpWidth
        if (mpFill && mpFill.style.width !== mpWidth) mpFill.style.width = mpWidth
      }
    }

    const schedule = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(sync)
    }

    const receiveBattleState = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      const next = event.detail as BattleSessionView | undefined
      if (!next || next.battleSessionId !== initialBattle.battleSessionId) return
      battle.current = next
      schedule()
    }

    sync()
    const observer = new MutationObserver(schedule)
    observer.observe(battlefield, { childList: true, subtree: true })
    media.addEventListener('change', schedule)
    window.addEventListener('aurevane:battle-state', receiveBattleState)

    return () => {
      observer.disconnect()
      media.removeEventListener('change', schedule)
      window.removeEventListener('aurevane:battle-state', receiveBattleState)
      if (frame !== 0) window.cancelAnimationFrame(frame)
      removeMeters(battlefield)
    }
  }, [combatantNames, initialBattle])

  return null
}
