import { describe, expect, it } from 'vitest'

import { validateAudioRegistry, validateRegisteredAudioAssets } from './registry'

describe('audio registry', () => {
  it('keeps every foundation media request traceable', () => {
    expect(validateRegisteredAudioAssets()).toEqual([])
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
