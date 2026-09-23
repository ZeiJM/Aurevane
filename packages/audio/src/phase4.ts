import type { AudioAssetDescriptor } from './registry'

const PHASE4_LEGACY_AUDIO_DISCIPLINES = [
  'ironfist',
  'chronist',
  'bastion',
  'ravager',
  'edgedancer',
  'wildwarden',
  'runeblade',
  'dawnshield',
  'cinderweaver',
  'frostweaver',
  'stormsinger',
  'tidecaller',
] as const

export const PHASE4_AUDIO_DISCIPLINES = [
  'vanguard',
  'farstrider',
  'shadehand',
  'aetherist',
  'lifebinder',
  ...PHASE4_LEGACY_AUDIO_DISCIPLINES,
] as const

export const PHASE4_DISCIPLINE_AUDIO_VERSION = 'v02' as const

const SHARED_PHASE4_AUDIO_FAMILIES = ['attrition', 'healing', 'cleanse', 'resonance'] as const

function disciplineAssets(
  family: (typeof PHASE4_AUDIO_DISCIPLINES)[number],
  version: 'v01' | 'v02',
  requestId: string,
): readonly AudioAssetDescriptor[] {
  return ['action', 'essence'].flatMap((role) =>
    [1, 2, 3].map((variant): AudioAssetDescriptor => ({
      id: `audio.phase4.${family}-${role}-${version}-${variant}`,
      kind: 'sfx',
      channel: 'sfx',
      status: 'approved',
      requestId,
      src: `/media/audio/sfx/phase4/${family}-${role}-${version}-${variant}.mp3`,
      loop: false,
      preload: 'none',
    })),
  )
}

const legacyDisciplineAssets = PHASE4_LEGACY_AUDIO_DISCIPLINES.flatMap((family) =>
  disciplineAssets(
    family,
    'v01',
    family === 'chronist'
      ? 'AUDIO-DISC-003'
      : family === 'ironfist'
        ? 'AUDIO-DISC-002'
        : 'AUDIO-DISC-001',
  ),
)

const currentDisciplineAssets = PHASE4_AUDIO_DISCIPLINES.flatMap((family) =>
  disciplineAssets(family, PHASE4_DISCIPLINE_AUDIO_VERSION, 'AUDIO-A07-001'),
)

const sharedAssets = SHARED_PHASE4_AUDIO_FAMILIES.flatMap((family) =>
  [1, 2, 3].map((variant): AudioAssetDescriptor => ({
    id: `audio.phase4.${family}-action-v01-${variant}`,
    kind: 'sfx',
    channel: 'sfx',
    status: 'approved',
    requestId: 'AUDIO-DISC-001',
    src: `/media/audio/sfx/phase4/${family}-action-v01-${variant}.mp3`,
    loop: false,
    preload: 'none',
  })),
)

/** Original material renders; provenance and activation records live in content/media-releases. */
export const phase4AudioAssets: readonly AudioAssetDescriptor[] = [
  ...legacyDisciplineAssets,
  ...currentDisciplineAssets,
  ...sharedAssets,
]
