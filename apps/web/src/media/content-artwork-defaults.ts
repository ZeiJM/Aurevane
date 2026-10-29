import {
  isFinalizedContentMedia,
  type FinalizedContentImage,
} from '@aurevane/game-core/combat/content-media'
import type { MatureSkillMediaHooks } from '@aurevane/game-core/combat/mature-skills'
import snapshot from './content-artwork-defaults.json'
interface ArtworkBaseline {
  readonly iconKey: string | null
  readonly artwork?: FinalizedContentImage
  readonly artworkId?: string
}
const baselines = new Map<string, ArtworkBaseline>()
for (const row of snapshot.records) {
  const media = row.media as { iconKey?: unknown; artworkId?: unknown; artwork?: unknown }
  const baseline: ArtworkBaseline = {
    iconKey: typeof media.iconKey === 'string' ? media.iconKey : null,
    ...(typeof media.artworkId === 'string' ? { artworkId: media.artworkId } : {}),
    ...(isFinalizedContentMedia(media.artwork) && media.artwork.kind === 'image'
      ? { artwork: media.artwork }
      : {}),
  }
  baselines.set(row.content_key, baseline)
  baselines.set(row.body_id, baseline)
}
export function contentArtworkDefault(contentId?: string): ArtworkBaseline {
  return structuredClone(
    contentId ? (baselines.get(contentId) ?? { iconKey: null }) : { iconKey: null },
  )
}
export function restoreContentArtworkDefault(
  contentId: string | undefined,
  value: MatureSkillMediaHooks,
): MatureSkillMediaHooks {
  const baseline = contentArtworkDefault(contentId)
  return { ...value, iconKey: baseline.iconKey, artwork: baseline.artwork }
}
