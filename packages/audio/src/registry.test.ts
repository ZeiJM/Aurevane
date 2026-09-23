import { describe, expect, it } from 'vitest'

import { PHASE4_AUDIO_DISCIPLINES } from './phase4'
import { audioAssetRegistry, validateAudioRegistry, validateRegisteredAudioAssets } from './registry'

describe('audio registry', () => {
  it('keeps every foundation media request traceable', () => {
    expect(validateRegisteredAudioAssets()).toEqual([])
  })

  it('covers all 17 published Disciplines with three action and three Essence variants', () => {
    expect(PHASE4_AUDIO_DISCIPLINES).toHaveLength(17)
    expect(new Set(PHASE4_AUDIO_DISCIPLINES).size).toBe(17)

    for (const discipline of PHASE4_AUDIO_DISCIPLINES) {
      const assets = [...audioAssetRegistry.values()].filter((asset) =>
        asset.id.startsWith(`audio.phase4.${discipline}-`),
      )
      expect(assets).toHaveLength(6)
      expect(assets.filter((asset) => asset.id.includes('-action-v01-'))).toHaveLength(3)
      expect(assets.filter((asset) => asset.id.includes('-essence-v01-'))).toHaveLength(3)
      expect(assets.every((asset) => asset.status === 'approved' && asset.src)).toBe(true)
    }
  })

  it('rejects duplicate ids and approved assets without runtime sources', () => {
    expect(
      validateAudioRegistry([
        {
          id: 'ui.duplicate',
          kind: 'ui',
          channel: 'ui',
          status: 'approved',
          requestId: 'AUDIO-UI-900',
          loop: false,
          preload: 'metadata',
        },
        {
          id: 'ui.duplicate',
          kind: 'ui',
          channel: 'ui',
          status: 'requested',
          requestId: 'AUDIO-UI-901',
          loop: false,
          preload: 'metadata',
        },
      ]),
    ).toEqual([
      'Approved audio asset ui.duplicate is missing a runtime source.',
      'Duplicate audio asset id: ui.duplicate',
    ])
  })
})
