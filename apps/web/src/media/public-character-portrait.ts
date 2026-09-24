import { isStarterCharacterPortraitRef } from '@aurevane/game-core/character/starter-options'

export function resolvePublicCharacterImageUrl(
  profileImageUrl: string | null | undefined,
  portraitRef: string | null | undefined,
): string | null {
  const custom = profileImageUrl?.trim()
  if (custom) return custom
  if (!portraitRef || !isStarterCharacterPortraitRef(portraitRef)) return null

  return `/api/media/starter-portrait/${encodeURIComponent(portraitRef)}`
}
