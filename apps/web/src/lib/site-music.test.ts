import { describe, expect, it } from 'vitest'

import {
  createDefaultSiteMusicConfig,
  parseSiteMusicDraft,
  parseSiteMusicUploadMetadata,
  resolveSiteMusicTrack,
  SITE_MUSIC_MAX_UPLOAD_BYTES,
} from './site-music'

describe('site music configuration', () => {
  it('uses Road to Aurevane on the account entry and character creation routes', () => {
    const config = createDefaultSiteMusicConfig()

    expect(resolveSiteMusicTrack(config, '/')?.label).toBe('Road to Aurevane')
    expect(resolveSiteMusicTrack(config, '/game/create/1')?.label).toBe('Road to Aurevane')
    expect(resolveSiteMusicTrack(config, '/game/select')?.label).toBe('Road to Aurevane')
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

  it('treats a root-page override as exact instead of a catch-all', () => {
    const config = createDefaultSiteMusicConfig()
    config.routeOverrides = [
      {
        id: 'account',
        label: 'Account',
        pathPrefix: '/',
        enabled: true,
        track: {
          label: 'Account',
          url: 'https://cdn.example.com/account.mp3',
          source: 'url',
          loop: true,
        },
      },
    ]

    expect(resolveSiteMusicTrack(config, '/')?.label).toBe('Account')
    expect(resolveSiteMusicTrack(config, '/news')?.label).toBe('Road to Aurevane')
  })

  it('does not let /game rules match unrelated prefixes', () => {
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
    ]

    expect(resolveSiteMusicTrack(config, '/gameplay')?.label).toBe('Road to Aurevane')
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

  it('rejects unsafe linked sources and duplicate normalized page prefixes', () => {
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

  it('accepts root-relative and HTTPS sources while rejecting protocol-relative URLs', () => {
    expect(() =>
      parseSiteMusicDraft({
        enabled: true,
        defaultTrack: {
          label: 'Local',
          url: '/media/audio/music/road-to-aurevane.mp3',
          source: 'bundled',
          loop: true,
        },
        routeOverrides: [],
      }),
    ).not.toThrow()

    expect(() =>
      parseSiteMusicDraft({
        enabled: true,
        defaultTrack: {
          label: 'Remote',
          url: 'https://audio.example.com/track.mp3',
          source: 'url',
          loop: true,
        },
        routeOverrides: [],
      }),
    ).not.toThrow()

    expect(() =>
      parseSiteMusicDraft({
        enabled: true,
        defaultTrack: {
          label: 'Protocol-relative',
          url: '//audio.example.com/track.mp3',
          source: 'url',
          loop: true,
        },
        routeOverrides: [],
      }),
    ).toThrow(/HTTPS URL/)
  })

  it('validates upload metadata before minting a signed storage token', () => {
    expect(
      parseSiteMusicUploadMetadata({
        name: 'road-to-aurevane.m4a',
        size: 3_469_574,
        type: 'audio/x-m4a',
      }),
    ).toEqual({
      label: 'road to aurevane',
      extension: 'm4a',
      mimeType: 'audio/x-m4a',
      size: 3_469_574,
    })

    expect(() =>
      parseSiteMusicUploadMetadata({
        name: 'too-large.mp3',
        size: SITE_MUSIC_MAX_UPLOAD_BYTES + 1,
        type: 'audio/mpeg',
      }),
    ).toThrow(/20 MB or smaller/)

    expect(() =>
      parseSiteMusicUploadMetadata({
        name: 'not-audio.txt',
        size: 100,
        type: 'text/plain',
      }),
    ).toThrow(/MP3, M4A\/AAC, OGG, WebM, or WAV/)
  })
})
