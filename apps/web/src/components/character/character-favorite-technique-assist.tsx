'use client'

import type { EssenceDefinition } from '@aurevane/game-core/combat/essence'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
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
  sourceDisciplineId: string
}

function titleCase(value: string): string {
  return value
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function skillLabel(skill: MatureSkillDefinition): string {
  const tail = skill.id.includes('.') ? skill.id.slice(skill.id.indexOf('.') + 1) : skill.id
  return titleCase(tail)
}

function favoriteCategory(tags: readonly string[]): FavoriteTechniqueCategory {
  if (tags.includes('cockpit:recovery')) return 'heal'
  if (tags.includes('cockpit:defense')) return 'defense'
  if (tags.includes('cockpit:attack')) return 'attack'
  if (tags.includes('heal') || tags.includes('recovery')) return 'heal'
  if (tags.includes('defense') || tags.includes('guard')) return 'defense'
  return 'attack'
}

function categoryLabel(category: FavoriteTechniqueCategory): string {
  if (category === 'heal') return 'Heal'
  if (category === 'defense') return 'Defense'
  return 'Attack'
}

function cardSkillName(card: HTMLElement): string {
  return card.querySelector<HTMLElement>('label strong')?.textContent?.trim() ?? ''
}

function cardSource(card: HTMLElement): string {
  return card.dataset.source ?? ''
}

function syncStar(
  host: HTMLElement,
  candidate: FavoriteCandidate,
  characterId: string,
): HTMLButtonElement {
  let star = host.querySelector<HTMLButtonElement>(
    `:scope > button[data-favorite-technique-star="true"]`,
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

  const favorites = readFavoriteTechniques(window.localStorage, characterId)
  const active = favorites[candidate.category]?.id === candidate.id
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
  star.textContent = active ? '★' : '☆'

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

  return star
}

export function CharacterFavoriteTechniqueAssist({
  characterId,
  skills,
  essence,
}: {
  characterId: string
  skills: readonly MatureSkillDefinition[]
  essence: EssenceDefinition | null
}) {
  useEffect(() => {
    const candidates: FavoriteCandidate[] = skills.map((skill) => ({
      id: skill.id,
      label: skillLabel(skill),
      category: favoriteCategory(skill.tags),
      sourceDisciplineId: skill.sourceDisciplineId,
    }))
    const essenceCandidate: FavoriteCandidate | null = essence
      ? {
          id: essence.skill.id,
          label: essence.name,
          category: favoriteCategory(essence.skill.tags),
          sourceDisciplineId: essence.sourceDisciplineId,
        }
      : null

    function renderStars() {
      const favorites = readFavoriteTechniques(window.localStorage, characterId)
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

          const candidate = candidates.find(
            (entry) => entry.label === cardSkillName(card) && entry.sourceDisciplineId === cardSource(card),
          )
          if (!candidate) {
            existing?.remove()
            continue
          }
          syncStar(card, candidate, characterId)
        }
      }

      const essenceLabel = document.querySelector<HTMLElement>('[data-testid="active-essence"]')
      const essenceCard = essenceLabel?.closest<HTMLElement>('article') ?? null
      if (essenceCard && essenceCandidate) {
        syncStar(essenceCard, essenceCandidate, characterId)
      }

      for (const star of document.querySelectorAll<HTMLButtonElement>(
        'button[data-favorite-technique-star="true"]',
      )) {
        const category = star.dataset.favoriteTechniqueCategory as FavoriteTechniqueCategory | undefined
        const skillId = star.dataset.favoriteTechniqueId
        if (!category || !skillId) continue
        const active = favorites[category]?.id === skillId
        star.setAttribute('aria-pressed', active ? 'true' : 'false')
        star.textContent = active ? '★' : '☆'
        const candidate = [...candidates, ...(essenceCandidate ? [essenceCandidate] : [])].find(
          (entry) => entry.id === skillId,
        )
        if (candidate) {
          star.setAttribute(
            'aria-label',
            active
              ? `Remove ${candidate.label} as favorite ${categoryLabel(category)} Technique`
              : `Set ${candidate.label} as favorite ${categoryLabel(category)} Technique`,
          )
        }
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
  }, [characterId, essence, skills])

  return null
}
