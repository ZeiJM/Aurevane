import { illustratedStarterPortrait } from '@/appearance/appearance-starter-gallery'
import { isStarterCharacterPortraitRef } from '@aurevane/game-core/character/starter-options'
import { appearanceManifestFromImageUrl } from '@/appearance/appearance-manifest'
import { starterPortraitArtworkVersion } from './starter-portrait-version'

export function resolvePublicCharacterImageUrl(
  profileImageUrl: string | null | undefined,
  portraitRef: string | null | undefined,
  illustratedStarter = false,
): string | null {
  const custom = profileImageUrl?.trim()
  if (custom?.startsWith('/api/media/appearance/6/'))
    return appearanceManifestFromImageUrl(custom)?.portraits.neutral ?? custom
  if (custom) return custom
  if (!portraitRef || !isStarterCharacterPortraitRef(portraitRef)) return null

  if (illustratedStarter)
    return illustratedStarterPortrait(portraitRef)?.manifest.portraits.neutral ?? null
  const version = starterPortraitArtworkVersion(portraitRef)
  return `/api/media/starter-portrait/${encodeURIComponent(portraitRef)}${version ? `?v=${version}` : ''}`
}
