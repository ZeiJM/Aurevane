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

  it('shows continuous background playback even for an older non-looping track', () => {
    const initialConfig = createDefaultSiteMusicConfig()
    initialConfig.defaultTrack.loop = false
    const markup = renderToStaticMarkup(createElement(SiteMusicManagement, { initialConfig }))

    expect(markup).toContain('Background music loops continuously.')
    expect(markup).toContain('loop=""')
    expect(markup).not.toContain('Loop continuously</span>')
  })
})

it('offers actual pages, all three explicit choices and a single selected preview without revision chores', () => {
  const initialConfig = createDefaultSiteMusicConfig()
  initialConfig.routeOverrides = [
    {
      id: 'game',
      label: 'Legacy Game',
      pathPrefix: '/game',
      enabled: false,
      track: initialConfig.defaultTrack,
    },
  ]
  const markup = renderToStaticMarkup(createElement(SiteMusicManagement, { initialConfig }))
  expect(markup).toContain('Global Music')
  expect(markup).toContain('Search pages')
  expect(markup).toContain('World')
  expect(markup).toContain('Character creation')
  expect(markup).toContain('Save Changes')
  expect(markup).not.toContain('Revision')
  expect(markup.match(/<audio /g)).toHaveLength(1)
  expect(markup).not.toContain('Page path prefix</span>')
})
