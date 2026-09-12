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

function syncFinishTurnCopy() {
  const deck = document.querySelector<HTMLElement>('section[aria-label="Command Deck"]')
  if (!deck) return
  const button = Array.from(deck.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) =>
      candidate.querySelector(':scope > strong')?.textContent?.trim() === 'Finish Turn',
  )
  const cost = button?.querySelector<HTMLElement>(':scope > small')
  if (cost && cost.textContent !== 'Choose facing + end') cost.textContent = 'Choose facing + end'
}

function skillSelectorTrigger(category: string): HTMLButtonElement | null {
  return (
    Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-battle-skill-selector-category]'),
    ).find((button) => button.dataset.battleSkillSelectorCategory === category) ?? null
  )
}

function selectedSkillId(category: string): string | null {
  return skillSelectorTrigger(category)?.dataset.battleSelectedSkillId ?? null
}

function selectorOption(category: string, skillId: string): HTMLButtonElement | null {
  const listbox = Array.from(
    document.querySelectorAll<HTMLElement>('[data-battle-skill-listbox-category]'),
  ).find((candidate) => candidate.dataset.battleSkillListboxCategory === category)
  if (!listbox) return null

  return (
    Array.from(listbox.querySelectorAll<HTMLButtonElement>('[data-battle-skill-option-id]')).find(
      (option) => option.dataset.battleSkillOptionId === skillId,
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
      const option = target?.closest<HTMLButtonElement>('[data-battle-skill-option-id]') ?? null
      const listbox = option?.closest<HTMLElement>('[data-battle-skill-listbox-category]') ?? null
      const category = listbox?.dataset.battleSkillListboxCategory ?? ''
      const skillId = option?.dataset.battleSkillOptionId ?? ''
      if (!category || !skillId) return

      const current = readBattleCockpitSelections(window.sessionStorage, battleScope)
      writeBattleCockpitSelections(window.sessionStorage, battleScope, {
        ...current,
        [category]: skillId,
      })
    }

    const restoreSkillSelections = () => {
      selectionFrame = 0
      if (restoringSelection) return

      const saved = Object.entries(
        readBattleCockpitSelections(window.sessionStorage, battleScope),
      ).filter(([category, skillId]) => selectedSkillId(category) !== skillId)
      if (saved.length === 0) return

      restoringSelection = true
      const restoreAt = (index: number) => {
        const entry = saved[index]
        if (!entry) {
          restoringSelection = false
          return
        }

        const [category, skillId] = entry
        const trigger = skillSelectorTrigger(category)
        if (!trigger) {
          restoreAt(index + 1)
          return
        }

        trigger.click()
        window.requestAnimationFrame(() => {
          const option = selectorOption(category, skillId)
          if (option) option.click()
          window.requestAnimationFrame(() => restoreAt(index + 1))
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
      attributeFilter: ['data-battle-selected-skill-id', 'data-battle-skill-selector-category'],
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
