import { describe, expect, it } from 'vitest'

import {
  createDefaultSiteMusicConfig,
  parseSiteMusicDraft,
  resolveSiteMusicTrack,
} from './site-music'

describe('site music configuration', () => {
  it('uses the bundled theme across account and character creation routes', () => {
    const config = createDefaultSiteMusicConfig()

    expect(resolveSiteMusicTrack(config, '/auth/signup')?.label).toBe('Road to Aurevane')
    expect(resolveSiteMusicTrack(config, '/game/character/create')?.label).toBe(
      'Road to Aurevane',
    )
  })

  it('uses the most specific matching page override', () => {
    const config = createDefaultSiteMusicConfig()
    config.routeOverrides = [
      {
        id: 'game',
        label: 'Game',
        pathPrefix: '/game',
        enabled: true,
        track: {
          label: 'Game',
          url: 'https://cdn.example.com/game.mp3',
          source: 'url',
          loop: true,
        },
      },
      {
        id: 'battle',
        label: 'Battle',
        pathPrefix: '/game/battle',
        enabled: true,
        track: {
          label: 'Battle',
          url: 'https://cdn.example.com/battle.mp3',
          source: 'url',
          loop: true,
        },
      },
    ]

    expect(resolveSiteMusicTrack(config, '/game/battle/123')?.label).toBe('Battle')
  })

  it('allows a page rule to intentionally silence a section', () => {
    const config = createDefaultSiteMusicConfig()
    config.routeOverrides = [
      {
        id: 'silent',
        label: 'Silent',
        pathPrefix: '/game/battle',
        enabled: false,
        track: { ...config.defaultTrack },
      },
    ]

    expect(resolveSiteMusicTrack(config, '/game/battle/123')).toBeNull()
  })

  it('rejects unsafe linked sources and duplicate page prefixes', () => {
    expect(() =>
      parseSiteMusicDraft({
        enabled: true,
        defaultTrack: {
          label: 'Unsafe',
          url: 'javascript:alert(1)',
          source: 'url',
          loop: true,
        },
        routeOverrides: [],
      }),
    ).toThrow(/HTTPS URL/)

    expect(() =>
      parseSiteMusicDraft({
        enabled: true,
        defaultTrack: {
          label: 'Safe',
          url: '/music.mp3',
          source: 'bundled',
          loop: true,
        },
        routeOverrides: [
          {
            id: 'one',
            label: 'One',
            pathPrefix: '/game',
            enabled: true,
            track: { label: 'One', url: '/one.mp3', source: 'upload', loop: true },
          },
          {
            id: 'two',
            label: 'Two',
            pathPrefix: '/game/',
            enabled: true,
            track: { label: 'Two', url: '/two.mp3', source: 'upload', loop: true },
          },
        ],
      }),
    ).toThrow(/Duplicate page path prefix/)
  })
})
