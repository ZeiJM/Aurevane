import { isStarterCharacterPortraitRef } from '@aurevane/game-core/character/starter-options'
import { starterPortraitArtworkVersion } from './starter-portrait-version'

export function resolvePublicCharacterImageUrl(
  profileImageUrl: string | null | undefined,
  portraitRef: string | null | undefined,
): string | null {
  const custom = profileImageUrl?.trim()
  if (custom) return custom
  if (!portraitRef || !isStarterCharacterPortraitRef(portraitRef)) return null

  const version = starterPortraitArtworkVersion(portraitRef)
  return `/api/media/starter-portrait/${encodeURIComponent(portraitRef)}${version ? `?v=${version}` : ''}`
}
