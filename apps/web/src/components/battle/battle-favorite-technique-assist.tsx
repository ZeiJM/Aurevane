'use client'

import { useEffect } from 'react'

import {
  BATTLE_FAVORITE_TECHNIQUE_SELECT_EVENT,
  readFavoriteTechniques,
  type BattleFavoriteTechniqueSelectDetail,
  type FavoriteTechniqueCategory,
} from './favorite-technique-storage'

const SELECTOR_LABEL: Readonly<Record<FavoriteTechniqueCategory, string>> = {
  attack: 'Attack',
  defense: 'Guard',
  heal: 'Heal',
}

const APPLY_RETRY_MS = 50
const APPLY_MAX_ATTEMPTS = 30

export function BattleFavoriteTechniqueAssist({ characterId }: { characterId: string | null }) {
  useEffect(() => {
    const resolvedCharacterId = characterId ?? ''
    if (!resolvedCharacterId) return

    const applied = new Set<FavoriteTechniqueCategory>()
    const pending = new Set<FavoriteTechniqueCategory>()
    let cancelled = false
    const timers = new Set<number>()

    function markApplied(category: FavoriteTechniqueCategory) {
      pending.delete(category)
      applied.add(category)
    }

    function applyCategory(category: FavoriteTechniqueCategory) {
      if (cancelled || applied.has(category) || pending.has(category)) return
      const favorite = readFavoriteTechniques(window.localStorage, resolvedCharacterId)[category]
      if (!favorite) {
        markApplied(category)
        return
      }

      pending.add(category)
      let attempts = 0
      let timer = 0

      const tryApply = () => {
        attempts += 1
        const detail: BattleFavoriteTechniqueSelectDetail = {
          categoryLabel: SELECTOR_LABEL[category],
          id: favorite.id,
          label: favorite.label,
        }
        const event = new CustomEvent<BattleFavoriteTechniqueSelectDetail>(
          BATTLE_FAVORITE_TECHNIQUE_SELECT_EVENT,
          { detail, cancelable: true },
        )
        const handled = !window.dispatchEvent(event)

        if (handled || cancelled || attempts >= APPLY_MAX_ATTEMPTS) {
          if (timer) {
            window.clearInterval(timer)
            timers.delete(timer)
          }
          markApplied(category)
        }
      }

      timer = window.setInterval(tryApply, APPLY_RETRY_MS)
      timers.add(timer)
      tryApply()
    }

    ;(['attack', 'defense', 'heal'] as const).forEach(applyCategory)

    return () => {
      cancelled = true
      for (const timer of timers) window.clearInterval(timer)
      timers.clear()
      pending.clear()
      applied.clear()
    }
  }, [characterId])

  return null
}
