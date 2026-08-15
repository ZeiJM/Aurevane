import { describe, expect, it } from 'vitest'

import {
  createDefaultAudioSettings,
  parsePersistedAudioSettings,
  reduceAudioSettings,
  serializeAudioSettings,
} from './settings'

describe('audio settings', () => {
  it('clamps channel volume without mutating the previous state', () => {
    const initial = createDefaultAudioSettings()
    const next = reduceAudioSettings(initial, {
      type: 'set-volume',
      channel: 'music',
      value: 4,
    })

    expect(next.volumes.music).toBe(1)
    expect(initial.volumes.music).toBe(0.62)
  })

  it('mutes without destroying the levels that will be restored', () => {
    const initial = createDefaultAudioSettings()
    const muted = reduceAudioSettings(initial, { type: 'toggle-mute' })
    const restored = reduceAudioSettings(muted, { type: 'toggle-mute' })

    expect(muted.muted).toBe(true)
    expect(muted.volumes).toEqual(initial.volumes)
    expect(restored).toEqual(initial)
  })

  it('round-trips persisted versioned settings', () => {
    const settings = reduceAudioSettings(createDefaultAudioSettings(), {
      type: 'set-volume',
      channel: 'ambience',
      value: 0.31,
    })

    expect(parsePersistedAudioSettings(serializeAudioSettings(settings))).toEqual(settings)
  })

  it('falls back safely when persisted settings are malformed or from another version', () => {
    expect(parsePersistedAudioSettings('{not-json')).toEqual(createDefaultAudioSettings())
    expect(parsePersistedAudioSettings('{"version":2}')).toEqual(createDefaultAudioSettings())
  })
})
