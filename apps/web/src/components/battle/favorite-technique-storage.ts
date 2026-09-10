'use client'

export type FavoriteTechniqueCategory = 'attack' | 'defense' | 'heal'

export interface FavoriteTechniqueSelection {
  id: string
  label: string
}

export type FavoriteTechniqueSelections = Readonly<
  Partial<Record<FavoriteTechniqueCategory, FavoriteTechniqueSelection>>
>

export type FavoriteTechniqueStorage = Pick<Storage, 'getItem' | 'setItem'>

const STORAGE_KEY_PREFIX = 'aurevane:favorite-techniques:v1:'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCategory(value: string): value is FavoriteTechniqueCategory {
  return value === 'attack' || value === 'defense' || value === 'heal'
}

export function favoriteTechniqueStorageKey(characterId: string): string {
  return `${STORAGE_KEY_PREFIX}${encodeURIComponent(characterId)}`
}

export function readFavoriteTechniques(
  storage: FavoriteTechniqueStorage,
  characterId: string,
): FavoriteTechniqueSelections {
  try {
    const raw = storage.getItem(favoriteTechniqueStorageKey(characterId))
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.favorites)) return {}

    const favorites: Partial<Record<FavoriteTechniqueCategory, FavoriteTechniqueSelection>> = {}
    for (const [category, favorite] of Object.entries(parsed.favorites)) {
      if (!isCategory(category) || !isRecord(favorite)) continue
      if (
        typeof favorite.id !== 'string' ||
        favorite.id.length === 0 ||
        favorite.id.length > 160 ||
        typeof favorite.label !== 'string' ||
        favorite.label.length === 0 ||
        favorite.label.length > 160
      ) {
        continue
      }
      favorites[category] = { id: favorite.id, label: favorite.label }
    }
    return favorites
  } catch {
    return {}
  }
}

export function writeFavoriteTechniques(
  storage: FavoriteTechniqueStorage,
  characterId: string,
  favorites: FavoriteTechniqueSelections,
): void {
  try {
    storage.setItem(
      favoriteTechniqueStorageKey(characterId),
      JSON.stringify({ version: 1, favorites }),
    )
  } catch {
    // Favorites are a presentation preference; combat remains usable if storage is unavailable.
  }
}

export function setFavoriteTechnique(
  storage: FavoriteTechniqueStorage,
  characterId: string,
  category: FavoriteTechniqueCategory,
  favorite: FavoriteTechniqueSelection | null,
): FavoriteTechniqueSelections {
  const current = readFavoriteTechniques(storage, characterId)
  const next: Partial<Record<FavoriteTechniqueCategory, FavoriteTechniqueSelection>> = {
    ...current,
  }
  if (favorite) next[category] = favorite
  else delete next[category]
  writeFavoriteTechniques(storage, characterId, next)
  return next
}
