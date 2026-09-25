import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: vi.fn(),
}))

import { createDefaultSiteMusicConfig } from '@/lib/site-music'

import { SiteMusicManagement } from './site-music-management'

describe('Master Panel site music management', () => {
  it('keeps a local PC audio-file picker available for the default site track', () => {
    const markup = renderToStaticMarkup(
      createElement(SiteMusicManagement, {
        initialConfig: createDefaultSiteMusicConfig(),
      }),
    )

    expect(markup).toContain('Upload from PC')
    expect(markup).toContain('type="file"')
    expect(markup).toContain(
      'accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/webm,audio/wav,audio/x-wav"',
    )
  })
})
