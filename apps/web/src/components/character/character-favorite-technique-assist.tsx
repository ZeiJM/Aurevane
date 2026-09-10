'use client'

import { useEffect } from 'react'

import {
  readFavoriteTechniques,
  setFavoriteTechnique,
  type FavoriteTechniqueCategory,
} from '../battle/favorite-technique-storage'
import styles from './character-favorite-technique-assist.module.css'

interface FavoriteCandidate {
  id: string
  label: string
  category: FavoriteTechniqueCategory
}

function categoryLabel(category: FavoriteTechniqueCategory): string {
  if (category === 'heal') return 'Heal'
  if (category === 'defense') return 'Defense'
  return 'Attack'
}

function categoryFromCard(card: HTMLElement): FavoriteTechniqueCategory {
  const chips = Array.from(card.querySelectorAll<HTMLElement>('small'))
  const type = chips.at(-1)?.textContent?.trim().toLowerCase() ?? ''
  if (type === 'recovery' || type === 'heal') return 'heal'
  if (type === 'defense' || type === 'guard') return 'defense'
  return 'attack'
}

function candidateForCard(card: HTMLElement): FavoriteCandidate | null {
  const label =
    card.querySelector<HTMLElement>('[data-testid="active-essence"]')?.textContent?.trim() ??
    card.querySelector<HTMLElement>('label strong')?.textContent?.trim() ??
    ''
  if (!label) return null
  return { id: label, label, category: categoryFromCard(card) }
}

function syncStar(host: HTMLElement, candidate: FavoriteCandidate, characterId: string): void {
  let star = host.querySelector<HTMLButtonElement>(
    ':scope > button[data-favorite-technique-star="true"]',
  )
  if (!star) {
    star = document.createElement('button')
    star.type = 'button'
    star.className = styles.star
    star.dataset.favoriteTechniqueStar = 'true'
    star.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      event.stopPropagation()
    })
    host.append(star)
  }

  const favorite = readFavoriteTechniques(window.localStorage, characterId)[candidate.category]
  const active = favorite?.id === candidate.id
  star.dataset.favoriteTechniqueId = candidate.id
  star.dataset.favoriteTechniqueCategory = candidate.category
  star.setAttribute('aria-pressed', active ? 'true' : 'false')
  star.setAttribute(
    'aria-label',
    active
      ? `Remove ${candidate.label} as favorite ${categoryLabel(candidate.category)} Technique`
      : `Set ${candidate.label} as favorite ${categoryLabel(candidate.category)} Technique`,
  )
  star.title = active
    ? `Favorite ${categoryLabel(candidate.category)} Technique`
    : `Make favorite ${categoryLabel(candidate.category)} Technique`
  const glyph = active ? '★' : '☆'
  if (star.textContent !== glyph) star.textContent = glyph

  star.onclick = (event) => {
    event.preventDefault()
    event.stopPropagation()
    const current = readFavoriteTechniques(window.localStorage, characterId)
    const currentFavorite = current[candidate.category]
    setFavoriteTechnique(
      window.localStorage,
      characterId,
      candidate.category,
      currentFavorite?.id === candidate.id
        ? null
        : { id: candidate.id, label: candidate.label },
    )
    window.dispatchEvent(new CustomEvent('aurevane:favorite-techniques-changed'))
  }
}

export function CharacterFavoriteTechniqueAssist({ characterId }: { characterId: string }) {
  useEffect(() => {
    function renderStars() {
      const list = document.querySelector<HTMLElement>('[data-testid="learned-skill-list"]')
      if (list) {
        for (const card of list.querySelectorAll<HTMLElement>('article[data-active-source="true"]')) {
          const existing = card.querySelector<HTMLButtonElement>(
            ':scope > button[data-favorite-technique-star="true"]',
          )
          if (card.dataset.selected !== 'true') {
            existing?.remove()
            continue
          }
          const candidate = candidateForCard(card)
          if (candidate) syncStar(card, candidate, characterId)
        }
      }

      const essenceLabel = document.querySelector<HTMLElement>('[data-testid="active-essence"]')
      const essenceCard = essenceLabel?.closest<HTMLElement>('article') ?? null
      if (essenceCard) {
        const candidate = candidateForCard(essenceCard)
        if (candidate) syncStar(essenceCard, candidate, characterId)
      }
    }

    renderStars()
    const observer = new MutationObserver(renderStars)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-selected'],
    })
    window.addEventListener('aurevane:favorite-techniques-changed', renderStars)

    return () => {
      observer.disconnect()
      window.removeEventListener('aurevane:favorite-techniques-changed', renderStars)
    }
  }, [characterId])

  return null
}
