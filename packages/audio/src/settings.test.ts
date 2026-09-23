import { describe, expect, it } from 'vitest'

import {
  createDefaultAudioSettings,
  parsePersistedAudioSettings,
  reduceAudioSettings,
  serializeAudioSettings,
} from './settings'

describe('audio settings', () => {
  it('clamps music volume without mutating the previous state', () => {
    const initial = createDefaultAudioSettings()
    const next = reduceAudioSettings(initial, {
      type: 'set-volume',
      channel: 'music',
      value: 4,
    })

    expect(next.volumes.music).toBe(1)
    expect(initial.volumes.music).toBe(0.62)
  })

  it('routes the visible sound-effects level to all non-music channels', () => {
    const initial = createDefaultAudioSettings()
    const next = reduceAudioSettings(initial, {
      type: 'set-volume',
      channel: 'sfx',
      value: 0.31,
    })

    expect(next.volumes.sfx).toBe(0.31)
    expect(next.volumes.ambience).toBe(0.31)
    expect(next.volumes.ui).toBe(0.31)
    expect(next.volumes.music).toBe(initial.volumes.music)
    expect(initial.volumes.sfx).toBe(0.78)
  })

  it('mutes without destroying the levels that will be restored', () => {
    const initial = createDefaultAudioSettings()
    const muted = reduceAudioSettings(initial, { type: 'toggle-mute' })
    const restored = reduceAudioSettings(muted, { type: 'toggle-mute' })

    expect(muted.muted).toBe(true)
    expect(muted.volumes).toEqual(initial.volumes)
    expect(restored).toEqual(initial)
  })

  it('round-trips the two user-facing channel levels', () => {
    let settings = reduceAudioSettings(createDefaultAudioSettings(), {
      type: 'set-volume',
      channel: 'music',
      value: 0.41,
    })
    settings = reduceAudioSettings(settings, {
      type: 'set-volume',
      channel: 'sfx',
      value: 0.27,
    })

    expect(parsePersistedAudioSettings(serializeAudioSettings(settings))).toEqual(settings)
  })

  it('normalizes legacy hidden channel levels so invisible controls cannot suppress audio', () => {
    const legacy = JSON.stringify({
      version: 1,
      muted: false,
      volumes: {
        master: 0,
        music: 0.33,
        sfx: 0.44,
        ambience: 0,
        ui: 0,
      },
    })

    expect(parsePersistedAudioSettings(legacy)).toEqual({
      muted: false,
      volumes: {
        master: 1,
        music: 0.33,
        sfx: 0.44,
        ambience: 0.44,
        ui: 0.44,
      },
    })
  })

  it('falls back safely when persisted settings are malformed or from another version', () => {
    expect(parsePersistedAudioSettings('{not-json')).toEqual(createDefaultAudioSettings())
    expect(parsePersistedAudioSettings('{"version":2}')).toEqual(createDefaultAudioSettings())
  })
})
