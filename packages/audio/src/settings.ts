export const AUDIO_CHANNELS = ['master', 'music', 'sfx', 'ambience', 'ui'] as const

export type AudioChannel = (typeof AUDIO_CHANNELS)[number]
export type RoutedAudioChannel = Exclude<AudioChannel, 'master'>

export interface AudioMixSettings {
  muted: boolean
  volumes: Record<AudioChannel, number>
}

interface StoredAudioSettingsV1 {
  version: 1
  muted: boolean
  volumes: Record<AudioChannel, number>
}

export type AudioSettingsAction =
  | { type: 'set-volume'; channel: AudioChannel; value: number }
  | { type: 'toggle-mute' }
  | { type: 'replace'; settings: AudioMixSettings }

const DEFAULT_VOLUMES: Record<AudioChannel, number> = {
  master: 0.8,
  music: 0.62,
  sfx: 0.78,
  ambience: 0.58,
  ui: 0.68,
}

export function createDefaultAudioSettings(): AudioMixSettings {
  return {
    muted: false,
    volumes: { ...DEFAULT_VOLUMES },
  }
}

export function clampAudioVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(1, Math.max(0, value))
}

export function reduceAudioSettings(
  state: AudioMixSettings,
  action: AudioSettingsAction,
): AudioMixSettings {
  switch (action.type) {
    case 'set-volume':
      return {
        ...state,
        volumes: {
          ...state.volumes,
          [action.channel]: clampAudioVolume(action.value),
        },
      }
    case 'toggle-mute':
      return { ...state, muted: !state.muted }
    case 'replace':
      return cloneAudioSettings(action.settings)
  }
}

export function serializeAudioSettings(settings: AudioMixSettings): string {
  const stored: StoredAudioSettingsV1 = {
    version: 1,
    muted: settings.muted,
    volumes: { ...settings.volumes },
  }

  return JSON.stringify(stored)
}

export function parsePersistedAudioSettings(value: string | null): AudioMixSettings {
  if (!value) {
    return createDefaultAudioSettings()
  }

  try {
    const parsed: unknown = JSON.parse(value)
    if (!isStoredAudioSettingsV1(parsed)) {
      return createDefaultAudioSettings()
    }

    return {
      muted: parsed.muted,
      volumes: Object.fromEntries(
        AUDIO_CHANNELS.map((channel) => [channel, clampAudioVolume(parsed.volumes[channel])]),
      ) as Record<AudioChannel, number>,
    }
  } catch {
    return createDefaultAudioSettings()
  }
}

function cloneAudioSettings(settings: AudioMixSettings): AudioMixSettings {
  return {
    muted: settings.muted,
    volumes: { ...settings.volumes },
  }
}

function isStoredAudioSettingsV1(value: unknown): value is StoredAudioSettingsV1 {
  if (!isRecord(value) || value.version !== 1 || typeof value.muted !== 'boolean') {
    return false
  }

  const volumes = value.volumes
  if (!isRecord(volumes)) {
    return false
  }

  return AUDIO_CHANNELS.every((channel) => typeof volumes[channel] === 'number')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
