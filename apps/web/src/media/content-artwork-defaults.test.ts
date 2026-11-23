import type { FinalizedContentImage } from '@aurevane/game-core/combat/content-media'
import { expect, it } from 'vitest'
import snapshot from './content-artwork-defaults.json'
import { contentArtworkDefault, restoreContentArtworkDefault } from './content-artwork-defaults'
it('restores the captured per-item artwork independently of a later custom image or another item', () => {
  const baseline = snapshot.records.find((row) => row.media.iconKey)!
  const custom = {
    iconKey: 'different-item',
    audioCueKey: 'chosen-sound',
    vfxKey: 'chosen-animation',
    artwork: {
      ...snapshot.records.find((row) => row.media.artwork)!.media.artwork,
      id: 'new-custom',
    } as FinalizedContentImage,
  }
  const restored = restoreContentArtworkDefault(baseline.body_id, custom)
  expect(restored.iconKey).toBe(baseline.media.iconKey)
  expect(restored.artwork).toBeUndefined()
  expect(restored.audioCueKey).toBe(custom.audioCueKey)
  expect(restored.vfxKey).toBe(custom.vfxKey)
  expect(custom.artwork.id).toBe('new-custom')
  expect(contentArtworkDefault(baseline.body_id)).toEqual(
    contentArtworkDefault(baseline.content_key),
  )
})
it('retains artwork that was already custom when the Owner designated current art as default', () => {
  const baseline = snapshot.records.find((row) => row.media.artwork)!
  expect(
    restoreContentArtworkDefault(baseline.body_id, {
      iconKey: null,
      audioCueKey: null,
      vfxKey: null,
    }).artwork,
  ).toEqual(baseline.media.artwork)
  expect(
    restoreContentArtworkDefault('new.custom.skill', {
      iconKey: 'temporary',
      audioCueKey: null,
      vfxKey: null,
    }).iconKey,
  ).toBeNull()
})
