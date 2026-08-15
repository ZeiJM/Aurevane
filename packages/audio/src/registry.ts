import type { RoutedAudioChannel } from './settings'

export type AudioAssetStatus = 'requested' | 'approved'
export type AudioAssetKind = 'music' | 'ambience' | 'sfx' | 'ui'
export type AudioPreload = 'none' | 'metadata' | 'auto'

export interface AudioAssetDescriptor {
  id: string
  kind: AudioAssetKind
  channel: RoutedAudioChannel
  status: AudioAssetStatus
  requestId: string
  src?: string
  loop: boolean
  preload: AudioPreload
}

const AUDIO_ASSETS = [
  {
    id: 'music.foundation.title',
    kind: 'music',
    channel: 'music',
    status: 'requested',
    requestId: 'AUDIO-MUS-001',
    loop: true,
    preload: 'none',
  },
  {
    id: 'ambience.foundation.world',
    kind: 'ambience',
    channel: 'ambience',
    status: 'requested',
    requestId: 'AUDIO-AMB-001',
    loop: true,
    preload: 'none',
  },
  {
    id: 'ui.foundation.confirm',
    kind: 'ui',
    channel: 'ui',
    status: 'requested',
    requestId: 'AUDIO-UI-001',
    loop: false,
    preload: 'metadata',
  },
] as const satisfies readonly AudioAssetDescriptor[]

export type AudioAssetId = (typeof AUDIO_ASSETS)[number]['id']

export const audioAssetRegistry: ReadonlyMap<string, AudioAssetDescriptor> = new Map(
  AUDIO_ASSETS.map((asset) => [asset.id, asset]),
)

export function getAudioAsset(id: AudioAssetId): AudioAssetDescriptor {
  const asset = audioAssetRegistry.get(id)
  if (!asset) {
    throw new Error(`Unknown AUREVANE audio asset: ${id}`)
  }

  return asset
}

export function validateAudioRegistry(entries: readonly AudioAssetDescriptor[]): string[] {
  const errors: string[] = []
  const seen = new Set<string>()

  for (const asset of entries) {
    if (seen.has(asset.id)) {
      errors.push(`Duplicate audio asset id: ${asset.id}`)
    }
    seen.add(asset.id)

    if (!asset.requestId.trim()) {
      errors.push(`Audio asset ${asset.id} is missing a request id.`)
    }

    if (asset.status === 'approved' && !asset.src?.trim()) {
      errors.push(`Approved audio asset ${asset.id} is missing a runtime source.`)
    }

    if (asset.status === 'requested' && asset.src) {
      errors.push(`Requested audio asset ${asset.id} must not pretend to have a runtime source.`)
    }
  }

  return errors
}

export function validateRegisteredAudioAssets(): string[] {
  return validateAudioRegistry(AUDIO_ASSETS)
}
