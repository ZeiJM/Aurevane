import { expect, it } from 'vitest'
import { starterItemDefinitions } from '@aurevane/game-core/content/starter-items'
import { presentItem } from './item-presentation'
it('uses independent Support artwork and preserves captured absence without new default fallback', () => {
  const current = starterItemDefinitions().find((item) => item.id === 'stormcaller-staff')!
  const result = presentItem(current)
  expect(result.artworkSrc).toBe('/media/art/items/stormcaller-staff-v01.webp')
  expect(result.actions.support?.artworkSrc).toBe(
    '/media/art/items/techniques/stormcaller-staff-technique-v01.webp',
  )
  const historical = {
    ...current,
    contentVersion: 6,
    actions: {
      ...current.actions,
      support: { behaviorId: current.actions!.support!.behaviorId, name: 'Storm Ward' },
    },
  }
  expect(presentItem(historical).actions.support?.artworkSrc).toBe(result.artworkSrc)
  expect(presentItem(historical).actions.support).not.toHaveProperty('media')
})
it('prefers exact finalized technique artwork over built-in and weapon artwork', () => {
  const item = starterItemDefinitions().find((row) => row.id === 'emberbrand')!
  const artwork = {
    id: '00000000-0000-4000-8000-000000000099',
    kind: 'image' as const,
    checksum: 'a'.repeat(64),
    byteLength: 100,
    contentType: 'image/png' as const,
    width: 128,
    height: 128,
    sourceWidth: 128,
    sourceHeight: 128,
    crop: { x: 0, y: 0, size: 128 },
  }
  const current = {
    ...item,
    actions: {
      ...item.actions,
      support: { ...item.actions!.support!, media: { ...item.actions!.support!.media, artwork } },
    },
  }
  expect(presentItem(current).actions.support?.artworkSrc).toBe(`/api/content-media/${artwork.id}`)
  expect(presentItem(current).artworkSrc).toBe('/media/art/items/emberbrand-v01.webp')
})
