import { describe, expect, it } from 'vitest'

import { validateImageRegistry, validateRegisteredImageAssets } from './registry'

describe('image registry', () => {
  it('keeps requested foundation art traceable without fake runtime paths', () => {
    expect(validateRegisteredImageAssets()).toEqual([])
  })

  it('rejects approved meaningful art without runtime dimensions and alt text', () => {
    expect(
      validateImageRegistry([
        {
          id: 'ui.invalid',
          kind: 'environment',
          status: 'approved',
          requestId: 'ART-UI-999',
          decorative: false,
          alt: '',
          src: '/media/art/ui/invalid.webp',
        },
      ]),
    ).toEqual([
      'Approved image asset ui.invalid requires source, width, and height.',
      'Meaningful image asset ui.invalid requires alt text.',
    ])
  })
})
