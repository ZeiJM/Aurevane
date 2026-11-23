import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/proxy', () => ({ updateSupabaseSession: vi.fn() }))

import { config } from './proxy'

const matches = (url: string) => unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })

describe('authentication proxy request scope', () => {
  it.each([
    '/media/audio/music/theme.mp3',
    '/media/audio/sfx/impact.ogg?version=2',
    '/media/art/world/intro.webm',
    '/media/art/world/runtime/manifest.json',
    '/media/art/character/portrait.webp',
    '/_next/static/chunks/app.js',
    '/_next/image?url=%2Fportrait.webp&w=640&q=75',
    '/favicon.ico',
  ])('serves public assets without running authentication: %s', (url) => {
    expect(matches(url)).toBe(false)
  })

  it.each([
    '/',
    '/account/sign-in',
    '/auth/callback?code=example',
    '/auth/recovery',
    '/auth/reset-password',
    '/game/world',
    '/master',
    '/api/chat/messages?channel=world',
    '/api/master/media',
    '/api/media/record.mp3',
    '/media-private/record',
  ])('retains session refresh for application routes: %s', (url) => {
    expect(matches(url)).toBe(true)
  })
})
