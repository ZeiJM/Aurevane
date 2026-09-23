import { describe, expect, it } from 'vitest'

import { audioAssetRegistry, validateAudioRegistry, validateRegisteredAudioAssets } from './registry'
import { PHASE4_AUDIO_DISCIPLINES } from './phase4'

describe('audio registry', () => {
  it('keeps every foundation media request traceable', () => {
    expect(validateRegisteredAudioAssets()).toEqual([])
  })

  it('ships current v02 action and Essence families for all 17 published Disciplines', () => {
    expect(PHASE4_AUDIO_DISCIPLINES).toHaveLength(17)
    for (const discipline of PHASE4_AUDIO_DISCIPLINES) {
      for (const role of ['action', 'essence'] as const) {
        for (const variant of [1, 2, 3] as const) {
          expect(
            audioAssetRegistry.get(`audio.phase4.${discipline}-${role}-v02-${variant}`),
          ).toEqual(
            expect.objectContaining({
              status: 'approved',
              src: `/media/audio/sfx/phase4/${discipline}-${role}-v02-${variant}.mp3`,
            }),
          )
        }
      }
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
