'use client'

import { useEffect, useRef } from 'react'

import {
  readBattleCockpitSelections,
  writeBattleCockpitSelections,
} from './battle-cockpit-selection-storage'
import styles from './battle-cockpit-layout-stabilizer.module.css'

const MOBILE_QUERY = '(max-width: 820px)'
type Facing = 'north' | 'east' | 'south' | 'west'

function facingFromIndicator(indicator: HTMLElement | null): Facing | null {
  const facing = indicator?.dataset.facing
  return facing === 'north' || facing === 'east' || facing === 'south' || facing === 'west'
    ? facing
    : null
}

function finishTurnButton(target: EventTarget | null): HTMLButtonElement | null {
  const element = target instanceof Element ? target : null
  const button =
    element?.closest<HTMLButtonElement>('section[aria-label="Command Deck"] button') ?? null
  return button?.querySelector(':scope > strong')?.textContent?.trim() === 'Finish Turn'
    ? button
    : null
}

function currentFacingControl(playerName: string): HTMLButtonElement | null {
  const tile = Array.from(
    document.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label*="occupied by"]'),
  ).find((candidate) =>
    (candidate.getAttribute('aria-label') ?? '').includes(`occupied by ${playerName}`),
  )
  if (!tile) return null

  const facing = facingFromIndicator(
    tile.querySelector<HTMLElement>('[data-battle-facing-indicator="true"]'),
  )
  return facing
    ? document.querySelector<HTMLButtonElement>(`button[aria-label="Face ${facing}"]`)
    : null
}

function syncFacingPads() {
  document.querySelectorAll<HTMLElement>('[data-unified-facing-pad="true"]').forEach((pad) => {
    if (pad.hasAttribute('data-open')) {
      // React owns the live Final Facing state. Remove the stabilizer's dormant inline hide so
      // the open-state CSS can render the controls and keyboard/pointer commits can reach them.
      pad.style.removeProperty('display')
      return
    }
    pad.style.setProperty('display', 'none', 'important')
  })
}

function syncFinishTurnCopy() {
  syncFacingPads()

  const deck = document.querySelector<HTMLElement>('section[aria-label="Command Deck"]')
  if (!deck) return
  const button = Array.from(deck.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) =>
      candidate.querySelector(':scope > strong')?.textContent?.trim() === 'Finish Turn',
  )
  const cost = button?.querySelector<HTMLElement>(':scope > small')
  if (cost && cost.textContent !== 'Choose facing + end') cost.textContent = 'Choose facing + end'
}

function skillSelectorCategory(listbox: HTMLElement): string | null {
  const label = listbox.getAttribute('aria-label')?.trim() ?? ''
  return label.endsWith(' skills') ? label.slice(0, -' skills'.length).trim() || null : null
}

function skillSelectorTrigger(category: string): HTMLButtonElement | null {
  return (
    Array.from(
      document.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="listbox"]'),
    ).find((button) =>
      (button.getAttribute('aria-label') ?? '').startsWith(`Choose ${category} skill.`),
    ) ?? null
  )
}

function selectedSkillLabel(category: string): string | null {
  const trigger = skillSelectorTrigger(category)
  const label = trigger?.getAttribute('aria-label') ?? ''
  const prefix = `Choose ${category} skill. `
  const suffix = ' selected.'
  if (!label.startsWith(prefix) || !label.endsWith(suffix)) return null
  return label.slice(prefix.length, -suffix.length).trim() || null
}

function selectorOption(category: string, skillLabel: string): HTMLButtonElement | null {
  const listbox = Array.from(document.querySelectorAll<HTMLElement>('[role="listbox"]')).find(
    (candidate) => candidate.getAttribute('aria-label') === `${category} skills`,
  )
  if (!listbox) return null

  return (
    Array.from(listbox.querySelectorAll<HTMLButtonElement>('button[role="option"]')).find(
      (option) => option.querySelector('strong')?.textContent?.trim() === skillLabel,
    ) ?? null
  )
}

export function BattleCockpitLayoutStabilizer({ playerName }: { playerName: string }) {
  const queuedFrame = useRef(0)
  const retryFrame = useRef(0)

  useEffect(() => {
    void styles

    let selectionFrame = 0
    let selectionRetry = 0
    let restoringSelection = false
    const battleScope = window.location.pathname

    const persistSkillSelection = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null
      const option = target?.closest<HTMLButtonElement>('button[role="option"]') ?? null
      const listbox = option?.closest<HTMLElement>('[role="listbox"]') ?? null
      const category = listbox ? skillSelectorCategory(listbox) : null
      const skillLabel = option?.querySelector('strong')?.textContent?.trim() ?? ''
      if (!category || !skillLabel) return

      const current = readBattleCockpitSelections(window.sessionStorage, battleScope)
      writeBattleCockpitSelections(window.sessionStorage, battleScope, {
        ...current,
        [category]: skillLabel,
      })
    }

    const restoreSkillSelections = () => {
      selectionFrame = 0
      if (restoringSelection) return

      const saved = Object.entries(
        readBattleCockpitSelections(window.sessionStorage, battleScope),
      ).filter(([category, skillLabel]) => selectedSkillLabel(category) !== skillLabel)
      if (saved.length === 0) return

      restoringSelection = true
      const restoreAt = (index: number) => {
        const entry = saved[index]
        if (!entry) {
          restoringSelection = false
          return
        }

        const [category, skillLabel] = entry
        const trigger = skillSelectorTrigger(category)
        if (!trigger) {
          restoreAt(index + 1)
          return
        }

        trigger.click()
        window.requestAnimationFrame(() => {
          const option = selectorOption(category, skillLabel)
          if (option) option.click()
          restoreAt(index + 1)
        })
      }

      restoreAt(0)
    }

    const scheduleSkillRestore = () => {
      if (selectionFrame !== 0 || restoringSelection) return
      selectionFrame = window.requestAnimationFrame(restoreSkillSelections)
    }

    const commitCurrentFacing = (retry = false) => {
      const control = currentFacingControl(playerName)
      if (control && !control.disabled) {
        control.click()
        return
      }
      if (!retry) {
        retryFrame.current = window.requestAnimationFrame(() => commitCurrentFacing(true))
      }
    }

    const handleDoubleClick = (event: MouseEvent) => {
      const button = finishTurnButton(event.target)
      if (!button || button.disabled || window.matchMedia(MOBILE_QUERY).matches) return

      event.preventDefault()
      event.stopImmediatePropagation()
      if (queuedFrame.current !== 0) window.cancelAnimationFrame(queuedFrame.current)
      if (retryFrame.current !== 0) window.cancelAnimationFrame(retryFrame.current)

      // Desktop single-click now only opens final-facing selection. A deliberate double-click keeps
      // the actor's existing facing as the shortcut, matching the two-Space keyboard contract.
      queuedFrame.current = window.requestAnimationFrame(() => {
        queuedFrame.current = 0
        syncFacingPads()
        commitCurrentFacing()
      })
    }

    const sync = () => {
      syncFinishTurnCopy()
      scheduleSkillRestore()
    }

    sync()
    // The cockpit itself is remounted whenever authoritative battleVersion changes. Observing the
    // shared page root lets the player's chosen Attack/Guard/Recovery option be re-applied after
    // those remounts and after a full mobile or desktop refresh without affecting combat authority.
    const observer = new MutationObserver(sync)
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-open', 'aria-label'],
      childList: true,
      subtree: true,
    })
    const media = window.matchMedia(MOBILE_QUERY)
    media.addEventListener('change', sync)
    document.addEventListener('dblclick', handleDoubleClick, true)
    document.addEventListener('click', persistSkillSelection, true)

    selectionRetry = window.setTimeout(scheduleSkillRestore, 80)

    return () => {
      observer.disconnect()
      media.removeEventListener('change', sync)
      document.removeEventListener('dblclick', handleDoubleClick, true)
      document.removeEventListener('click', persistSkillSelection, true)
      if (queuedFrame.current !== 0) window.cancelAnimationFrame(queuedFrame.current)
      if (retryFrame.current !== 0) window.cancelAnimationFrame(retryFrame.current)
      if (selectionFrame !== 0) window.cancelAnimationFrame(selectionFrame)
      if (selectionRetry !== 0) window.clearTimeout(selectionRetry)
    }
  }, [playerName])

  return null
}
