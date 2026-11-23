import { describe, expect, it } from 'vitest'
import { getImageAsset } from '@/media/registry'

describe('approved entry scene artwork', () => {
  it.each(['environment.entry.gateway', 'environment.entry.roster-gallery'])(
    '%s uses a registered clean landscape derivative',
    (id) => {
      const asset = getImageAsset(id as Parameters<typeof getImageAsset>[0])
      expect(asset.status).toBe('approved')
      expect(asset.decorative).toBe(true)
      expect(asset.src).toMatch(/^\/media\/art\/entry\/.+\.webp$/)
      expect(asset.width! / asset.height!).toBeCloseTo(16 / 9, 2)
      expect(asset.generationRequestId).toBe('ART-UI-ENTRY-20261001')
    },
  )
})
