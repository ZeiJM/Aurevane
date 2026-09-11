'use client'

import { useEffect, useState } from 'react'

import {
  readFavoriteTechniques,
  setFavoriteTechnique,
  type FavoriteTechniqueCategory,
} from '../battle/favorite-technique-storage'
import styles from './character-favorite-technique-assist.module.css'

interface FavoriteTechniqueButtonProps {
  characterId: string
  techniqueId: string
  label: string
  category: FavoriteTechniqueCategory
  disabled?: boolean
}

function categoryLabel(category: FavoriteTechniqueCategory): string {
  if (category === 'heal') return 'Heal'
  if (category === 'defense') return 'Defense'
  return 'Attack'
}

export function FavoriteTechniqueButton({
  characterId,
  techniqueId,
  label,
  category,
  disabled = false,
}: FavoriteTechniqueButtonProps) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    function syncFavorite() {
      const favorite = readFavoriteTechniques(window.localStorage, characterId)[category]
      setActive(favorite?.id === techniqueId || favorite?.label === label)
    }

    syncFavorite()
    window.addEventListener('aurevane:favorite-techniques-changed', syncFavorite)
    return () => window.removeEventListener('aurevane:favorite-techniques-changed', syncFavorite)
  }, [category, characterId, label, techniqueId])

  const actionLabel = active ? 'Remove' : 'Set'
  const cockpitLabel = categoryLabel(category)
  const ariaLabel = disabled
    ? `Select ${label} before setting it as favorite ${cockpitLabel} Technique`
    : `${actionLabel} ${label} as favorite ${cockpitLabel} Technique`

  return (
    <button
      type="button"
      className={styles.star}
      data-favorite-technique-star="true"
      data-favorite-technique-id={techniqueId}
      data-favorite-technique-category={category}
      aria-label={ariaLabel}
      aria-pressed={active}
      disabled={disabled}
      title={
        disabled
          ? `Select ${label} to make it your favorite ${cockpitLabel} Technique`
          : active
            ? `Favorite ${cockpitLabel} Technique`
            : `Make favorite ${cockpitLabel} Technique`
      }
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (disabled) return
        const current = readFavoriteTechniques(window.localStorage, characterId)
        const currentFavorite = current[category]
        const next = setFavoriteTechnique(
          window.localStorage,
          characterId,
          category,
          currentFavorite?.id === techniqueId || currentFavorite?.label === label
            ? null
            : { id: techniqueId, label },
        )
        setActive(next[category]?.id === techniqueId)
        window.dispatchEvent(new CustomEvent('aurevane:favorite-techniques-changed'))
      }}
    >
      <svg
        className={styles.icon}
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 24 24"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      >
        <path d="M12 2.5 15.09 8.76 22 9.76 17 14.64 18.18 21.5 12 18.26 5.82 21.5 7 14.64 2 9.76 8.91 8.76Z" />
      </svg>
    </button>
  )
}
