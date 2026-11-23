import { describe, expect, it } from 'vitest'

import {
  audioAssetRegistry,
  validateAudioRegistry,
  validateRegisteredAudioAssets,
} from './registry'
import { skillFxGroups } from './skill-fx'

describe('audio registry', () => {
  it('keeps every foundation media request traceable', () => {
    expect(validateRegisteredAudioAssets()).toEqual([])
  })

  it('ships only the new neutral sound groups with three compressed variants', () => {
    expect(skillFxGroups).toHaveLength(153)
    const sounds = [...audioAssetRegistry.values()].filter((asset) => asset.kind === 'sfx')
    expect(sounds).toHaveLength(459)
    for (const sound of sounds)
      expect(sound).toMatchObject({
        status: 'approved',
        preload: 'none',
        src: expect.stringMatching(/\/skill-fx-v01\/\d{3}-[123]\.mp3$/),
      })
    expect([...audioAssetRegistry.keys()].some((key) => key.startsWith('audio.phase4.'))).toBe(
      false,
    )
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
