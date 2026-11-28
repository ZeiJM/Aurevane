import { liveCharacterAppearanceUrl } from '@/appearance/appearance-live'
import { isStarterCharacterPortraitRef } from '@aurevane/game-core/character/starter-options'
import { appearanceManifestFromImageUrl } from '@/appearance/appearance-manifest'
import { starterPortraitArtworkVersion } from './starter-portrait-version'

export function resolvePublicCharacterImageUrl(
  profileImageUrl: string | null | undefined,
  portraitRef: string | null | undefined,
  useLiveCatalogue = false,
): string | null {
  const custom = profileImageUrl?.trim()
  if (
    useLiveCatalogue &&
    (custom?.startsWith('/api/media/appearance/') ||
      (!custom && portraitRef && isStarterCharacterPortraitRef(portraitRef)))
  )
    return liveCharacterAppearanceUrl(custom, portraitRef)
  if (custom?.startsWith('/api/media/appearance/6/'))
    return appearanceManifestFromImageUrl(custom)?.portraits.neutral ?? custom
  if (custom) return custom
  if (!portraitRef || !isStarterCharacterPortraitRef(portraitRef)) return null

  const version = starterPortraitArtworkVersion(portraitRef)
  return `/api/media/starter-portrait/${encodeURIComponent(portraitRef)}${version ? `?v=${version}` : ''}`
}
