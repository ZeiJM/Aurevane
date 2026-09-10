'use client'

import { useEffect, useRef } from 'react'

import {
  readFavoriteTechniques,
  type FavoriteTechniqueCategory,
  type FavoriteTechniqueSelection,
} from './favorite-technique-storage'

const SELECTOR_LABEL: Readonly<Record<FavoriteTechniqueCategory, string>> = {
  attack: 'Attack',
  defense: 'Guard',
  heal: 'Heal',
}

function selectorTrigger(category: FavoriteTechniqueCategory): HTMLButtonElement | null {
  const label = SELECTOR_LABEL[category]
  return document.querySelector<HTMLButtonElement>(
    `button[data-battle-skill-selector-category="${label}"]`,
  )
}

function optionFor(
  category: FavoriteTechniqueCategory,
  favorite: FavoriteTechniqueSelection,
): HTMLButtonElement | null {
  const label = SELECTOR_LABEL[category]
  const listbox = document.querySelector<HTMLElement>(
    `[data-battle-skill-listbox-category="${label}"]`,
  )
  if (!listbox) return null
  return (
    Array.from(listbox.querySelectorAll<HTMLButtonElement>('button[data-battle-skill-option-id]')).find(
      (option) => {
        const optionLabel = option.querySelector<HTMLElement>('strong')?.textContent?.trim()
        return option.dataset.battleSkillOptionId === favorite.id || optionLabel === favorite.label
      },
    ) ?? null
  )
}

export function BattleFavoriteTechniqueAssist({ characterId }: { characterId: string | null }) {
  const applied = useRef(new Set<FavoriteTechniqueCategory>())
  const pending = useRef(new Set<FavoriteTechniqueCategory>())

  useEffect(() => {
    if (!characterId) return

    let cancelled = false
    const timers = new Set<number>()

    function markApplied(category: FavoriteTechniqueCategory) {
      pending.current.delete(category)
      applied.current.add(category)
    }

    function closeSelector(category: FavoriteTechniqueCategory) {
      const trigger = selectorTrigger(category)
      if (trigger?.getAttribute('aria-expanded') === 'true') trigger.click()
    }

    function applyCategory(category: FavoriteTechniqueCategory) {
      if (cancelled || applied.current.has(category) || pending.current.has(category)) return
      const favorite = readFavoriteTechniques(window.localStorage, characterId)[category]
      if (!favorite) {
        markApplied(category)
        return
      }

      const trigger = selectorTrigger(category)
      if (!trigger) return
      const currentlySelected = trigger.getAttribute('aria-label') ?? ''
      if (
        trigger.dataset.battleSelectedSkillId === favorite.id ||
        currentlySelected.includes(`${favorite.label} selected`)
      ) {
        markApplied(category)
        return
      }

      pending.current.add(category)
      trigger.click()
      let attempts = 0
      const timer = window.setInterval(() => {
        attempts += 1
        if (cancelled || attempts > 30) {
          window.clearInterval(timer)
          timers.delete(timer)
          closeSelector(category)
          markApplied(category)
          return
        }

        const option = optionFor(category, favorite)
        if (!option) {
          const label = SELECTOR_LABEL[category]
          const openList = document.querySelector(
            `[data-battle-skill-listbox-category="${label}"]`,
          )
          if (openList) {
            window.clearInterval(timer)
            timers.delete(timer)
            closeSelector(category)
            markApplied(category)
          }
          return
        }

        window.clearInterval(timer)
        timers.delete(timer)
        option.click()
        markApplied(category)
      }, 40)
      timers.add(timer)
    }

    function applyFavorites() {
      ;(['attack', 'defense', 'heal'] as const).forEach(applyCategory)
    }

    applyFavorites()
    const observer = new MutationObserver(applyFavorites)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      cancelled = true
      observer.disconnect()
      for (const timer of timers) window.clearInterval(timer)
      timers.clear()
      pending.current.clear()
      applied.current.clear()
    }
  }, [characterId])

  return null
}
